"""Twin v0: a utility-AI controller (directive sections 16, 17, 24).

Every decision scores the full candidate set — FOLLOW, PROTECT, INTERCEPT,
FLANK, ATTACK, ASSIST, RETREAT, DISTRACT, REPOSITION, EXPLORE — from the
observation, the player model's traits/predictions, and the twin's own learned
style, and returns the best one as a `TwinIntent` with all scores attached so
the debug HUD can show *why*.

The controller never touches game state. It is deterministic: the same
observation and the same style produce the same intent.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.agent.observation import AgentObservation, EntitySnapshot, VendorSnapshot
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.game.combat.weapons import WeaponType, get_weapon
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent
from mirrorbound.game.inventory import CONSUMABLES, FOODS
from mirrorbound.game.progression.survival import FED_ABOVE

HYSTERESIS = 0.07               # bonus for keeping the current intent, so it doesn't flap
THREAT_RADIUS = 260.0           # an enemy this close to the player is a threat
ISOLATION_RADIUS = 150.0        # an enemy with no friend this close is "isolated"
FAR_FROM_PLAYER = 250.0
FOLLOW_OFFSET = 62.0
AOE_TOKENS = ("FLAME_BURST", "BINDING_NOVA", "FIRE_BURST")
DASH_TOKENS = ("DASH", "SHADOW_DASH")

# How strongly the twin's own learned preferred_range/spell_preference bias
# ATTACK (close, self-chosen fight) vs FLANK/ASSIST (repositioned/supportive
# engagement), given engagement distance itself is still weapon-driven, not
# style-driven, until the twin can change its own equipment. Centered at zero
# for a neutral/unconfident style (confident_value() already blends toward
# 0.5 at low confidence, so subtracting 0.5 here means "no opinion yet"
# contributes exactly nothing, rather than silently nudging every decision).
RANGE_LEAN_ATTACK_WEIGHT = 0.30    # melee-leaning (< 0.5) favors ATTACK; ranged-leaning suppresses it
RANGE_LEAN_FLANK_WEIGHT = 0.24     # ranged-leaning favors FLANK
RANGE_LEAN_ASSIST_WEIGHT = 0.16    # ranged-leaning mildly favors ASSIST (support from range) over closing in
SPELL_PREFERENCE_FLANK_WEIGHT = 0.12  # a spell-leaning twin values repositioning generally, not just AoE-dodging

# Minimum score advantage an owned-but-unequipped weapon needs over the
# current one before the twin bothers requesting a switch -- without this,
# a barely-confident lean would make it flip weapons on every decision tick.
WEAPON_SWITCH_MARGIN = 0.15

# Decision momentum, driven by seconds_since_decision (previously computed on
# every observation and never read by anything -- see AI_ARCHITECTURE.md).
# A candidate whose posture opposes the currently-held intent's is penalized,
# scaled by how recently the last decision was made: at the real ~0.1s
# decision cadence this is a meaningful, real penalty; after a long gap
# (a delayed tick, or a slower cadence) it decays to nothing, since there's
# no "recent commitment" left to protect. The penalty is deliberately kept
# well below what a genuine emergency scores -- RETREAT at critical twin
# health easily clears 0.5+, far above MOMENTUM_SWITCH_PENALTY's ceiling --
# so a real threat spike still wins outright; this dampens close, marginal
# flips (flickering), not survival decisions.
MOMENTUM_WINDOW_SECONDS = 0.5
MOMENTUM_SWITCH_PENALTY = 0.18
ENGAGED_POSTURE = {"ATTACK", "ASSIST", "FLANK", "DISTRACT", "INTERCEPT", "PROTECT"}
DISENGAGED_POSTURE = {"RETREAT", "REPOSITION", "FOLLOW", "EXPLORE", "HEAL", "EAT", "SHOP"}

# How strongly a confidently combo-heavy player pushes the twin toward
# disrupting the exchange (INTERCEPT: literally step into an incoming
# attack; FLANK: hit the player's target from another angle, breaking the
# 1v1 rhythm) rather than just reading as generically more aggressive.
COMBO_INTERCEPT_WEIGHT = 0.25
COMBO_FLANK_WEIGHT = 0.18

# --- v1.2: looking after itself ----------------------------------------------
#
# HEAL, EAT and SHOP were the missing third of the twin. It could already fight
# like a player and pick a weapon like a player; it could not keep itself alive
# like one, because nothing scored drinking, eating or restocking and the loot
# system routed every potion it walked over into the player's bag.
#
# All three are scored in the same pass as everything else rather than handled as
# special cases ahead of it. That is what makes "retreat first, then drink" fall
# out on its own: HEAL is penalised by how close the nearest enemy is and RETREAT
# is rewarded by exactly the same thing, so with something breathing on it the
# twin backs off, and the moment it is clear the drink wins. Neither intent knows
# the other exists.
HEALTH_POTION = "health_potion"

#: What `stock_target` means in potions. An unconfident style blends to 0.5,
#: which lands on two -- what a careful player carries into a dungeon.
STOCK_MIN, STOCK_MAX = 1, 4

#: How close an enemy has to be before standing still to drink is a bad idea.
#: A use is 0.8s rooted and a hit spills it, so this is a gradient rather than a
#: flag: a drink at arm's length is worth almost nothing, a drink across the room
#: is worth nearly all of it.
DRINK_SAFE_DISTANCE = 300.0
#: Eating is the same commitment but never urgent, so it is suppressed harder.
EAT_SAFE_DISTANCE = 420.0

#: How far the twin will walk to a merchant, and how close it must be to buy.
#: The buy radius is the game's own TALK_RADIUS; the executor enforces it.
SHOP_MAX_WALK = 900.0


def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


@dataclass
class Candidate:
    intent: str
    utility: float
    target: EntitySnapshot | None = None
    position: Vec2 | None = None
    reason: str = ""
    extra: dict = field(default_factory=dict)


class TwinV0Controller:
    """Reference implementation of `TwinController`."""

    def __init__(self, style: TwinStyleModel | None = None):
        self.style = style or TwinStyleModel()
        self.current_intent: str = "FOLLOW"
        self.decisions: int = 0

    # --------------------------------------------------------------- helpers

    @staticmethod
    def _trait(model: dict, name: str, default: float = 0.5) -> tuple[float, float]:
        traits = model.get("traits") or {}
        t = traits.get(name)
        if not t:
            return default, 0.0
        return float(t.get("value", default)), float(t.get("confidence", 0.0))

    @staticmethod
    def _top_prediction(model: dict) -> tuple[str | None, float]:
        preds = model.get("predictions") or []
        if not preds:
            return None, 0.0
        top = preds[0]
        return str(top.get("token")), float(top.get("confidence", 0.0))

    @staticmethod
    def _nearest(pos: Vec2, entities: list[EntitySnapshot]) -> tuple[EntitySnapshot | None, float]:
        best, best_d = None, float("inf")
        for e in entities:
            d = (e.position - pos).length()
            if d < best_d:
                best, best_d = e, d
        return best, best_d

    @staticmethod
    def _preferred_weapon(
        owned: list[str], current_id: str, range_lean: float, spell_lean: float
    ) -> str | None:
        """Which owned weapon (if any) is a confidently better stylistic fit
        than the one currently equipped -- or None to keep the current one.

        Scoring is deliberately coarse: (range_lean - 0.5) rewards a ranged
        weapon and penalizes a melee one; spell_lean does the same for a magic
        one.

        The spell term reads the weapon's *type*, not its tags. Tags describe
        what the basic attack is -- and a staff's basic attack is a bash, so it
        is tagged MELEE and feeds melee_dependency, which is correct. What makes
        a staff a spell weapon is the three spells it grants, and `type` is the
        field that says so whatever its M1 happens to do.

        Honest limit: iron_sword (the only melee weapon) isn't in
        loot.py's WEAPON_DROPS, so in practice the twin only ever owns
        ranged/magic weapons unless a player manually equips it a sword via
        the TWIN_EQUIP command -- the melee term still exists for that case,
        it's just rarely reachable through play alone. It also can't
        distinguish ember_staff from frost_staff (both SPELL-tagged): that
        would need a style dimension this model doesn't track, so ties
        resolve to owned-list order rather than inventing one.
        """
        if len(owned) <= 1:
            return None

        def score(weapon_id: str) -> float:
            w = get_weapon(weapon_id)
            s = (range_lean - 0.5) * (-1.0 if w.is_melee else 1.0)
            if w.type is WeaponType.MAGIC:
                s += spell_lean - 0.5
            return s

        best = max(owned, key=score)
        if best == current_id or score(best) - score(current_id) < WEAPON_SWITCH_MARGIN:
            return None
        return best

    @staticmethod
    def _stock_target(stock_lean: float) -> int:
        """How many health potions the twin wants to be carrying."""
        return int(round(STOCK_MIN + (STOCK_MAX - STOCK_MIN) * clamp01(stock_lean)))

    @staticmethod
    def _best_meal(held: dict[str, int], deficit: float) -> str | None:
        """The food to eat for a `deficit`-sized hole in the bar.

        The smallest thing that fills it, or the largest thing it has if nothing
        does. Overeating is wasted outright (see `Hunger.eat`), so a twin that
        spends cooked meat on a snack while carrying bread is throwing food away
        -- and one that nibbles bread when it is starving looks like it is not
        paying attention.
        """
        owned = sorted(
            ((item, float(CONSUMABLES[item]["nourish"])) for item in FOODS
             if held.get(item, 0) > 0 and item in CONSUMABLES),
            key=lambda pair: pair[1],
        )
        if not owned:
            return None
        for item, nourish in owned:
            if nourish >= deficit:
                return item
        return owned[-1][0]

    @staticmethod
    def _shopping_list(obs: AgentObservation, wanted: dict[str, int]) -> tuple[VendorSnapshot, str, int] | None:
        """The nearest merchant in reach who will sell something on the list,
        and the cheapest such thing it can actually afford."""
        best: tuple[VendorSnapshot, str, int] | None = None
        best_d = SHOP_MAX_WALK
        for vendor in obs.vendors:
            d = (vendor.position - obs.twin_state.position).length()
            if d > best_d:
                continue
            affordable = [(price, item) for item, price in sorted(vendor.stock.items())
                          if wanted.get(item, 0) > 0 and price <= obs.twin_gold]
            if not affordable:
                continue
            price, item = min(affordable)
            best, best_d = (vendor, item, price), d
        return best

    @staticmethod
    def _posture(intent_type: str) -> str:
        return "engaged" if intent_type in ENGAGED_POSTURE else "disengaged"

    def _engage_position(self, obs: AgentObservation, target: EntitySnapshot, from_pos: Vec2) -> Vec2:
        """Where to stand to fight `target` with the current weapon."""
        to_target = target.position - from_pos
        d = to_target.length() or 1.0
        direction = to_target * (1.0 / d)
        if obs.twin_weapon_is_melee:
            return target.position - direction * max(24.0, obs.twin_weapon_range * 0.7)
        hold = obs.twin_weapon_range * 0.55
        return target.position - direction * hold

    # ------------------------------------------------------------------ decide

    def decide(self, obs: AgentObservation) -> TwinIntent:
        self.decisions += 1
        player, twin = obs.player_state, obs.twin_state
        enemies = obs.enemies
        style = self.style
        model = obs.player_model or {}

        # Learned dimensions (blended toward neutral when unconfident).
        aggression = style.confident_value("aggression")
        defensive = style.confident_value("defensive_tendency")
        risk = style.confident_value("risk_tolerance")
        mobility = style.confident_value("mobility")
        target_pref = style.confident_value("target_preference")
        # melee_dependency/ranged_dependency are updated in lockstep with
        # preferred_range in style.py (every melee/ranged attack nudges all
        # three together, always by the same amount) -- they're the same
        # evidence expressed three ways, so using preferred_range alone here
        # avoids triple-counting a single signal.
        range_lean = style.confident_value("preferred_range")   # 0 = melee-leaning, 1 = ranged-leaning
        spell_lean = style.confident_value("spell_preference")
        drink_at = style.confident_value("drink_threshold")     # health fraction it reaches for a flask at
        stock_lean = style.confident_value("stock_target")
        thrift = style.confident_value("thrift")                # 1 = hoards, 0 = spends
        # The player model informs *how* the twin supports, not what it copies.
        player_aggr, player_aggr_conf = self._trait(model, "aggression")
        combo_dep, combo_conf = self._trait(model, "combo_dependency")
        combo_pressure = combo_dep * combo_conf
        predicted, pred_conf = self._top_prediction(model)
        aoe_incoming = predicted in AOE_TOKENS and pred_conf > 0.45
        dash_incoming = predicted in DASH_TOKENS and pred_conf > 0.45

        twin_hp = twin.health_fraction
        player_hp = player.health_fraction
        dist_to_player = (twin.position - player.position).length()

        nearest_to_twin, d_twin = self._nearest(twin.position, enemies)
        nearest_to_player, d_player = self._nearest(player.position, enemies)
        threats = [e for e in enemies if (e.position - player.position).length() < THREAT_RADIUS
                   and (e.target_id in (player.id, None))]
        winding_at_player = [e for e in threats if e.winding_up]
        player_target = obs.enemy(obs.player_target_id)
        enemies_near_twin = [e for e in enemies if (e.position - twin.position).length() < 200]

        def isolated(e: EntitySnapshot) -> bool:
            return all(o.id == e.id or (o.position - e.position).length() > ISOLATION_RADIUS for o in enemies)

        def danger(e: EntitySnapshot) -> float:
            base = {"ranged": 0.9, "boss": 1.0, "fast": 0.6, "melee": 0.4, "tank": 0.3}.get(e.role, 0.5)
            return base + (0.2 if e.elite else 0.0)

        candidates: list[Candidate] = []

        # --- RETREAT: low health with enemies around -------------------------------
        if enemies_near_twin:
            u = clamp01((0.45 - twin_hp) * 2.4) * (1.35 - risk * 0.7)
            u += 0.25 * defensive * clamp01(0.6 - twin_hp)
            away = (twin.position - nearest_to_twin.position).normalized() if nearest_to_twin else Vec2(-1, 0)
            toward_player = (player.position - twin.position).normalized() if dist_to_player > 40 else Vec2()
            pos = twin.position + (away * 0.6 + toward_player * 0.7).normalized() * 160
            candidates.append(Candidate("RETREAT", u, None, pos, f"twin hp {twin_hp:.0%}, risk {risk:.2f}"))
        else:
            candidates.append(Candidate("RETREAT", 0.0, None, None, "no nearby enemies"))

        # --- INTERCEPT: an enemy is about to hit the player -------------------------
        if winding_at_player or (threats and player_hp < 0.6):
            pool = winding_at_player or threats
            threat = min(pool, key=lambda e: (e.position - player.position).length())
            u = 0.55 + 0.3 * defensive + clamp01(0.6 - player_hp) * 0.45
            if winding_at_player:
                u += 0.1
            u += COMBO_INTERCEPT_WEIGHT * combo_pressure
            mid = player.position + (threat.position - player.position) * 0.6
            candidates.append(Candidate("INTERCEPT", u, threat, mid, f"{threat.role} threatening player (hp {player_hp:.0%})"))
        else:
            candidates.append(Candidate("INTERCEPT", 0.0, None, None, "no imminent threat"))

        # --- PROTECT: multiple enemies pressing the player --------------------------
        if len(threats) >= 2:
            threat = min(threats, key=lambda e: (e.position - player.position).length())
            u = 0.48 + 0.25 * defensive + 0.08 * min(len(threats), 4)
            direction = (threat.position - player.position).normalized()
            candidates.append(Candidate("PROTECT", u, threat, player.position + direction * 46,
                                        f"{len(threats)} enemies on player"))
        else:
            candidates.append(Candidate("PROTECT", 0.0, None, None, "player not swarmed"))

        # --- DISTRACT: pull aggro when the player is fragile -------------------------
        if threats and player_hp < 0.4 and twin_hp > 0.5:
            threat = max(threats, key=danger)
            u = 0.5 + 0.3 * defensive + 0.15 * risk
            candidates.append(Candidate("DISTRACT", u, threat, None, f"player hp {player_hp:.0%}: drawing {threat.role}"))
        else:
            candidates.append(Candidate("DISTRACT", 0.0, None, None, "player stable"))

        # --- ASSIST: fight the player's target -------------------------------------
        if player_target is not None:
            u = 0.42 + 0.35 * aggression + 0.15 * player_aggr * player_aggr_conf
            u += RANGE_LEAN_ASSIST_WEIGHT * (range_lean - 0.5)
            if aoe_incoming:
                u -= 0.2   # the player is about to blanket that spot; don't stand in it
            candidates.append(Candidate("ASSIST", u, player_target, None,
                                        f"player is fighting {player_target.role}" + (" (AoE predicted)" if aoe_incoming else "")))
        else:
            candidates.append(Candidate("ASSIST", 0.0, None, None, "player has no target"))

        # --- ATTACK: take an enemy of our own choosing -------------------------------
        if enemies:
            def score(e: EntitySnapshot) -> float:
                d = (e.position - twin.position).length()
                s = 1.0 - clamp01(d / 520)
                s += 0.35 if isolated(e) else 0.0
                s += 0.3 * (danger(e) if target_pref > 0.5 else (1 - e.health_fraction))
                return s
            best = max(enemies, key=score)
            crowd = sum(1 for o in enemies if (o.position - best.position).length() < ISOLATION_RADIUS) - 1
            u = 0.33 + 0.35 * aggression + (0.22 if isolated(best) else 0.0) - 0.12 * crowd * (1 - risk)
            u -= RANGE_LEAN_ATTACK_WEIGHT * (range_lean - 0.5)
            u *= clamp01(0.35 + twin_hp)
            candidates.append(Candidate("ATTACK", u, best, None,
                                        ("isolated " if isolated(best) else "") + f"{best.role}, aggression {aggression:.2f}"))
        else:
            candidates.append(Candidate("ATTACK", 0.0, None, None, "no enemies"))

        # --- FLANK: hit the player's target from the other side --------------------------
        if player_target is not None and (player_target.position - twin.position).length() < 340:
            away_from_player = (player_target.position - player.position).normalized()
            hold = obs.twin_weapon_range * (0.7 if obs.twin_weapon_is_melee else 0.55)
            pos = player_target.position + away_from_player * max(40.0, hold)
            u = 0.3 + 0.3 * mobility + (0.28 if aoe_incoming else 0.0) + 0.1 * aggression
            u += RANGE_LEAN_FLANK_WEIGHT * (range_lean - 0.5)
            u += SPELL_PREFERENCE_FLANK_WEIGHT * (spell_lean - 0.5)
            u += COMBO_FLANK_WEIGHT * combo_pressure
            candidates.append(Candidate("FLANK", u, player_target, pos,
                                        "flanking player's target" + (" to stay out of the burst" if aoe_incoming else "")))
        else:
            candidates.append(Candidate("FLANK", 0.0, None, None, "nothing to flank"))

        # --- REPOSITION: too far from the player -----------------------------------------
        if dist_to_player > FAR_FROM_PLAYER:
            u = 0.38 + 0.25 * mobility + clamp01((dist_to_player - FAR_FROM_PLAYER) / 380)
            if dash_incoming:
                u += 0.1
            behind = player.position - player.facing * FOLLOW_OFFSET
            candidates.append(Candidate("REPOSITION", u, None, behind, f"{dist_to_player:.0f} units from player"))
        else:
            candidates.append(Candidate("REPOSITION", 0.0, None, None, "close to player"))

        # --- EXPLORE: nothing to fight, loot to grab -----------------------------------------
        if not enemies and obs.pickups:
            nearest_pickup = min(obs.pickups, key=lambda p: (p.position - twin.position).length())
            # With nothing to fight, gathering loot beats trailing the player.
            u = 0.52 + 0.1 * mobility
            candidates.append(Candidate("EXPLORE", u, None, nearest_pickup.position, f"collecting {nearest_pickup.kind}"))
        else:
            candidates.append(Candidate("EXPLORE", 0.0, None, None, "nothing to collect"))

        # --- HEAL: drink, because it is hurt and it is carrying something ------------------
        #
        # `exposure` is the whole design: how much of a 0.8s rooted drink an enemy
        # this close would take away. It is what makes the twin back off first
        # rather than drinking into a swing, without RETREAT and HEAL ever
        # referring to each other.
        def exposure(radius: float) -> float:
            if nearest_to_twin is None:
                return 0.0
            return clamp01(1.0 - d_twin / radius)

        winding_on_twin = any(e.winding_up for e in enemies_near_twin)
        potions = obs.held(HEALTH_POTION)
        if potions > 0 and twin_hp < 0.98 and not winding_on_twin:
            urgency = clamp01((drink_at - twin_hp) * 2.2)
            u = (0.30 + 0.75 * urgency) * (1.0 - 0.80 * exposure(DRINK_SAFE_DISTANCE))
            candidates.append(Candidate("HEAL", u, None, None,
                                        f"hp {twin_hp:.0%}, drinks at {drink_at:.0%} ({potions} left)",
                                        {"item": HEALTH_POTION}))
        else:
            candidates.append(Candidate("HEAL", 0.0, None, None,
                                        "nothing to drink" if potions == 0 else "no need to drink"))

        # --- EAT: stop and eat, because the bar says so -------------------------------------
        deficit = max(0.0, FED_ABOVE - obs.twin_hunger) * 100.0
        meal = self._best_meal(obs.twin_consumables, deficit) if deficit > 0 else None
        if meal is not None:
            u = 0.20 + 0.55 * clamp01(deficit / (FED_ABOVE * 100.0))
            if obs.twin_hunger_band == "hungry":
                u += 0.25            # the band that actually costs it damage and pace
            u *= 1.0 - 0.85 * exposure(EAT_SAFE_DISTANCE)
            candidates.append(Candidate("EAT", u, None, None,
                                        f"hunger {obs.twin_hunger:.0%} ({obs.twin_hunger_band}), eating {meal}",
                                        {"item": meal}))
        else:
            candidates.append(Candidate("EAT", 0.0, None, None,
                                        "not hungry" if deficit <= 0 else "no food"))

        # --- SHOP: walk to a merchant and restock -------------------------------------------
        #
        # Only with nothing to fight: a companion that wanders off to a stall
        # mid-fight is a bug however well it scores. Merchants stand in villages,
        # so in practice this is the twin spending its quarter-share of the gold
        # while the player is safe -- which is the version of the feature worth
        # watching.
        want_potions = max(0, self._stock_target(stock_lean) - potions)
        wanted = {HEALTH_POTION: want_potions}
        if obs.twin_hunger < FED_ABOVE and meal is None:
            for food in FOODS:
                wanted[food] = 1     # hungry with an empty pack: anything edible
        errand = None if enemies else self._shopping_list(obs, wanted)
        if errand is not None:
            vendor, item, price = errand
            need = 1.0 if item != HEALTH_POTION else clamp01(want_potions / max(1, STOCK_MAX - STOCK_MIN))
            # Centred on neutral, like every other lean in this file: an
            # unconfident style must contribute exactly nothing rather than
            # quietly taxing the errand 30% for having no opinion yet.
            u = (0.34 + 0.34 * need) * (1.0 - 0.60 * (thrift - 0.5))
            candidates.append(Candidate("SHOP", u, None, vendor.position,
                                        f"buying {item} for {price}g from {vendor.id} (thrift {thrift:.2f})",
                                        {"item": item, "vendor": vendor.id, "price": price}))
        else:
            candidates.append(Candidate("SHOP", 0.0, None, None, "nothing to buy, or nobody to buy from"))

        # --- FOLLOW: the default -----------------------------------------------------------------
        perp = player.facing.perpendicular()
        follow_pos = player.position - player.facing * FOLLOW_OFFSET + perp * 26
        u = 0.26 + (0.14 if not enemies else 0.0) + 0.05 * (1 - aggression)
        candidates.append(Candidate("FOLLOW", u, None, follow_pos, "staying with the player"))

        # --- pick --------------------------------------------------------------------------------
        momentum = clamp01(1.0 - obs.seconds_since_decision / MOMENTUM_WINDOW_SECONDS)
        current_posture = self._posture(self.current_intent)
        for c in candidates:
            if c.intent == self.current_intent:
                c.utility += HYSTERESIS
            elif self._posture(c.intent) != current_posture:
                c.utility -= MOMENTUM_SWITCH_PENALTY * momentum
        candidates.sort(key=lambda c: c.utility, reverse=True)
        best, second = candidates[0], candidates[1]
        total = best.utility + second.utility
        confidence = clamp01(best.utility / total) if total > 0 else 0.5
        self.current_intent = best.intent

        desired_weapon = self._preferred_weapon(
            obs.twin_owned_weapons, obs.twin_weapon_id, range_lean, spell_lean
        )

        return TwinIntent(
            intent_type=best.intent,
            # SHOP names a merchant rather than an enemy, and the executor looks
            # it up in the room's NPCs; every other intent's target is an entity.
            target_id=best.extra.get("vendor") if best.intent == "SHOP" else (best.target.id if best.target else None),
            position=best.position,
            confidence=confidence,
            utilities={c.intent: round(c.utility, 3) for c in candidates},
            reason=best.reason,
            desired_weapon=desired_weapon,
            item_id=best.extra.get("item"),
        )
