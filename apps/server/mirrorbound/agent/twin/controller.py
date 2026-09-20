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

from mirrorbound.agent.observation import AgentObservation, EntitySnapshot
from mirrorbound.agent.twin.style import TwinStyleModel
from mirrorbound.game.combat.weapons import WeaponType, get_weapon
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.twin import TwinIntent

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
DISENGAGED_POSTURE = {"RETREAT", "REPOSITION", "FOLLOW", "EXPLORE"}

# How strongly a confidently combo-heavy player pushes the twin toward
# disrupting the exchange (INTERCEPT: literally step into an incoming
# attack; FLANK: hit the player's target from another angle, breaking the
# 1v1 rhythm) rather than just reading as generically more aggressive.
COMBO_INTERCEPT_WEIGHT = 0.25
COMBO_FLANK_WEIGHT = 0.18


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
            target_id=best.target.id if best.target else None,
            position=best.position,
            confidence=confidence,
            utilities={c.intent: round(c.utility, 3) for c in candidates},
            reason=best.reason,
            desired_weapon=desired_weapon,
        )
