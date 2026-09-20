"""The Mirror: the final boss, driven by the player's own behaviour model.

It reads the same `PlayerModelSnapshot` the twin does — traits, sequence
predictions, spatial hotspots — and picks counters weighted by confidence:

    low confidence     -> generic boss behaviour
    medium confidence  -> slight adaptation (leans toward a counter)
    high confidence    -> strong counter

Every counter it takes is published as BOSS_COUNTER so the debug HUD can show
"it kited because you are 0.81 confident melee".
"""

from __future__ import annotations

from mirrorbound.game.combat.abilities import AbilityDef, AbilityType, get_ability
from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.enemy import Enemy, EnemyState
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.movement.navigation import Navigator
from mirrorbound.game.state import GameState

AOE_TOKENS = ("FLAME_BURST", "BINDING_NOVA", "FIRE_BURST")
DASH_TOKENS = ("DASH", "SHADOW_DASH")
MIN_RIPOSTE_WINDUP = 0.30  # leaves six 20-Hz snapshots to read the counter

#: The shortest gap between two spells, whatever their own cooldowns allow.
#:
#: Every ability keeps its own cooldown, but a boss carrying five of them could
#: still chain one after another with nothing in between, and a fight that is
#: only spells is as flat as a fight with none. This is the floor on the rhythm:
#: cast, then fight for a couple of seconds, then consider casting again.
SPELL_CADENCE = 2.4

#: How close a spell that hits around the caster wants its target.
#:
#: A nova or a cone thrown at someone outside its own radius is a cooldown
#: spent on nothing, which is the most common way a boss with abilities looks
#: stupid. Slightly inside the real area, so it commits only when it will land.
CLOSE_ENOUGH = 0.85

#: Below this fraction of its health, the boss will spend a cast on healing.
HURT_ENOUGH = 0.55

#: How long the Mirror commits to a stance before reconsidering, in seconds.
#:
#: The counters are scored every tick, and a trait like `melee_dependency`
#: saturates at 1.0 after a couple of dozen swings and then never comes down --
#: so a player who fights with a sword scored `kite` at ~1.0 on every tick of
#: the entire fight, and the boss backed away from them for the whole encounter
#: without once committing to anything else. Re-deciding sixty times a second
#: is not what makes a fight feel adaptive; *changing its mind in front of you*
#: is, and that needs the mind to have been made up in the first place.
#:
#: Pressing is the shorter window on purpose: it is the dangerous half for the
#: boss, and it should read as a decision to close rather than as a new default.
STANCE_SECONDS = {"kite": 3.4, "press": 2.8}

#: How much a stance is discounted for having just been held.
#:
#: Not zero -- the right answer against a melee player really is mostly to keep
#: away, and the Mirror should still mostly do it. This only stops "mostly"
#: from becoming "always", which is the difference between a boss that reads
#: you and a boss you can never touch.
STANCE_FATIGUE = 0.7

#: What closing always scores, however little the boss knows about you.
#:
#: This is the number that actually decides the rhythm, so it is worth being
#: explicit about the arithmetic: a sword player drives `kite` to 1.0, fatigue
#: takes that to 0.30 once it has been held, and 0.45 beats it -- so the boss
#: comes at you. Holding *that* drops press to 0.135 against an unfatigued kite
#: of 1.0, so it backs off again. The fight alternates, weighted toward keeping
#: range by the longer kite window, which is the correct read of a melee player
#: without being the only thing it ever does.
STANCE_FLOOR = 0.45


def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


class MirrorController:
    def __init__(self, rng: DeterministicRNG):
        self.rng = rng.spawn("mirror")
        self.navigator = Navigator()
        self.player_model: dict = {}
        self.counter_cooldown = 0.0
        self.deny_timer = 0.0
        #: The spell being charged, and what is left of its wind-up.
        self.casting: AbilityDef | None = None
        self.cast_charge = 0.0
        #: Time until the boss will consider casting again. Opens slightly into
        #: the fight rather than at zero, so the first thing it does is come at
        #: you rather than open with a spell from across the room.
        self.spell_timer = 2.0
        self.last_player_attack_tick = -1000
        #: The stance being held, and what is left of its window. See
        #: `STANCE_SECONDS`: the Mirror commits, then reconsiders.
        self.stance: str = "press"
        self.stance_timer = 0.0
        self.active_counter: str | None = None
        self.counters_used: dict[str, int] = {}
        self.phase = 1
        #: How much of the player the Mirror starts out already knowing, 0..1.
        #:
        #: Every counter it picks is weighted by how confident the player model
        #: is, so a floor under that confidence *is* a skill setting: at 0 it
        #: behaves generically until it has watched you, and at 1 it fights from
        #: the first second as though it had watched the whole run. A sandbox
        #: knob rather than a campaign one -- the real fight earns its
        #: confidence, which is the point of the real fight.
        self.skill_floor = 0.0

    # --- model access ---------------------------------------------------------------

    def _trait(self, name: str) -> tuple[float, float]:
        t = (self.player_model.get("traits") or {}).get(name) or {}
        return float(t.get("value", 0.5)), self._confident(float(t.get("confidence", 0.0)))

    def _prediction(self) -> tuple[str | None, float]:
        preds = self.player_model.get("predictions") or []
        if not preds:
            return None, 0.0
        return str(preds[0].get("token")), self._confident(float(preds[0].get("confidence", 0.0)))

    def _confident(self, measured: float) -> float:
        """Real confidence, or the sandbox's floor, whichever is higher.

        The floor never *reduces* what the model actually learned: a Mirror set
        to half skill that has genuinely read you still fights at full strength.
        """
        return max(measured, self.skill_floor)

    def _hot_cell(self, layer: str, cell_size: float) -> Vec2 | None:
        cells = (self.player_model.get("spatial") or {}).get(layer) or []
        if not cells:
            return None
        cx, cy = cells[0]["cell"]
        return Vec2((cx + 0.5) * cell_size, (cy + 0.5) * cell_size)

    def note_player_attack(self, tick: int) -> None:
        self.last_player_attack_tick = tick

    def _counter(self, state: GameState, boss: Enemy, name: str, confidence: float, detail: str) -> None:
        if self.active_counter == name and self.counter_cooldown > 0:
            return
        self.active_counter = name
        self.counter_cooldown = 1.2
        self.counters_used[name] = self.counters_used.get(name, 0) + 1
        state.emit("BOSS_COUNTER", enemy_id=boss.id, counter=name, confidence=round(confidence, 3),
                   detail=detail, phase=self.phase, position=boss.position.to_dict())

    def _choose_stance(self, kite: float, rush: float) -> bool:
        """Commit to keeping away or to closing, for a few seconds.

        Both counters are still scored from the model -- this only decides
        which one the boss acts on and for how long, and refuses to let either
        run the whole fight. The stance just held is discounted, so the losing
        option comes up on its own eventually even against a player whose
        profile never changes.

        With nothing confident on either side it presses: an unread player gets
        a boss that comes at them, which is also the fight you want on the
        first thirty seconds of an encounter.

        Returns whether the stance actually changed, so the switch can be
        announced -- a boss changing its mind is the one thing in this system
        worth showing the player, and until now only half of it was reported.
        """
        scores = {
            "kite": kite,
            # Closing is worth doing on a confident *ranged* read, and it is
            # also the floor: something has to happen when neither read is
            # strong, and standing at range doing nothing is not it.
            "press": max(rush, STANCE_FLOOR),
        }
        scores[self.stance] *= 1.0 - STANCE_FATIGUE
        previous = self.stance
        self.stance = max(scores, key=lambda name: scores[name])
        self.stance_timer = STANCE_SECONDS[self.stance]
        return self.stance != previous

    # --- casting ----------------------------------------------------------------------

    def _kit(self, boss: Enemy) -> list[AbilityDef]:
        """Everything this Mirror can cast, its own and what it took."""
        out: list[AbilityDef] = []
        for name in boss.enemy_def.abilities:
            try:
                out.append(get_ability(name))
            except ValueError:
                # A weapon naming an ability that does not exist should cost
                # the boss that one spell, not the whole fight.
                continue
        return out

    def _choose_spell(self, boss: Enemy, combat: CombatSystem, dist: float) -> AbilityDef | None:
        """The best spell for this moment, or none.

        Scored rather than ordered, because the same kit has to read sensibly
        whichever weapon it came off: a bow gives the Mirror a heal it should
        only use when hurt, a staff gives it a cone it should only use in your
        face, and a sword gives it a dash that is only worth spending when you
        are too far to hit. A fixed priority list would have to be rewritten
        for each of those; a score does not.
        """
        best: AbilityDef | None = None
        best_score = 0.0
        for ability in self._kit(boss):
            if not combat.enemy_ability_ready(boss, ability):
                continue
            score = self._score_spell(boss, ability, dist)
            if score > best_score:
                best, best_score = ability, score
        return best

    def _score_spell(self, boss: Enemy, ability: AbilityDef, dist: float) -> float:
        """How much this spell is worth throwing right now, 0 = never."""
        hurt = boss.health / max(boss.max_health, 1.0)

        if ability.type is AbilityType.HEAL:
            # Only when it would actually recover something worth a cast.
            return 0.0 if hurt > HURT_ENOUGH else 1.4 * (1.0 - hurt)
        if ability.type is AbilityType.SHIELD:
            # Worth it while being pressed, and pointless out of reach.
            return 0.9 if dist < boss.enemy_def.attack_range * 2.0 else 0.0
        if ability.type is AbilityType.DASH:
            # A gap-closer, so only when there is a gap worth closing.
            return 0.8 if dist > boss.enemy_def.attack_range * 2.5 else 0.0
        if ability.type in (AbilityType.NOVA, AbilityType.CONE):
            # Centred on the caster: it has to land, and its value rises the
            # more of its own radius the target is inside.
            reach = ability.area * CLOSE_ENOUGH
            if dist > reach:
                return 0.0
            return 1.0 + (1.0 - dist / max(reach, 1.0))
        if ability.type is AbilityType.PROJECTILE:
            # Out of melee, inside its own range. Worth more the further away
            # the target is, so the boss reaches for a spell rather than
            # walking the whole way.
            if dist > ability.range or dist < boss.enemy_def.attack_range:
                return 0.0
            return 0.6 + 0.6 * (dist / max(ability.range, 1.0))
        return 0.0

    def _announce_charge(self, state: GameState, boss: Enemy, ability: AbilityDef) -> None:
        """Telegraph a spell that has a wind-up.

        The nova keeps its own event because the client already draws a
        telegraph ring for it and that ring is the fairest thing in the fight.
        Everything else announces generically.
        """
        if ability.id == "mirror_nova":
            state.emit("BOSS_NOVA_CHARGE", enemy_id=boss.id, position=boss.position.to_dict(),
                       radius=ability.area, duration=ability.cast_time)
        else:
            state.emit("ENEMY_ABILITY_CHARGE", enemy_id=boss.id, ability_id=ability.id,
                       position=boss.position.to_dict(), radius=ability.area,
                       duration=ability.cast_time)

    def _announce_cast(self, state: GameState, boss: Enemy, ability: AbilityDef) -> None:
        """Say what it just did, and why it is worth reading."""
        if ability.id == "mirror_nova":
            state.emit("BOSS_NOVA", enemy_id=boss.id, position=boss.position.to_dict(),
                       radius=ability.area)
        self._counter(state, boss, f"cast:{ability.id}", 0.7,
                      f"casting {ability.name.lower()}")

    # --- update ------------------------------------------------------------------------

    def update(self, dt: float, boss: Enemy, state: GameState, combat: CombatSystem) -> None:
        self._update(dt, boss, state, combat)
        if boss.velocity.is_zero():
            return
        target = self._target(boss, state)
        goal = boss.position + boss.velocity.normalized() * 120
        if boss.state is EnemyState.REPOSITION and boss.reposition_target:
            goal = boss.reposition_target
        elif target and boss.velocity.dot(target.position - boss.position) > 0:
            goal = target.position
        boss.velocity = self.navigator.velocity(state.room, boss, goal, boss.velocity.length())

    def _update(self, dt: float, boss: Enemy, state: GameState, combat: CombatSystem) -> None:
        if not boss.active:
            boss.set_state(EnemyState.DEAD)
            return
        boss.state_timer += dt
        if boss.attack_timer > 0:
            boss.attack_timer -= dt
        for _ability, _left in list(boss.ability_timers.items()):
            boss.ability_timers[_ability] = _left - dt
        if self.counter_cooldown > 0:
            self.counter_cooldown -= dt
        self.stance_timer -= dt
        hp = boss.health / boss.max_health
        self.phase = 1 if hp > 0.6 else 2 if hp > 0.3 else 3
        speed_mult = {1: 1.0, 2: 1.15, 3: 1.28}[self.phase]

        target = self._target(boss, state)
        boss.target_id = target.id if target else None
        if target is None:
            boss.velocity = Vec2()
            return
        if boss.stagger > 0:
            boss.velocity = Vec2()
            return

        to_target = target.position - boss.position
        dist = to_target.length()
        direction = to_target.normalized() if dist > 0 else boss.facing
        boss.face(direction)

        # --- casting ------------------------------------------------------------------
        #
        # One path over the whole kit: its own two, plus whatever the weapon it
        # took off you grants. The nova used to live here as a hard-coded
        # special case with its radius and damage as module constants, which is
        # why nothing else it carried was ever cast -- there was no route for a
        # second spell to take.
        if self.cast_charge > 0:
            self.cast_charge -= dt
            boss.velocity = Vec2()
            if self.cast_charge <= 0:
                pending, self.casting = self.casting, None
                if pending is not None:
                    combat.resolve_enemy_ability(state, boss, pending, target)
                    self._announce_cast(state, boss, pending)
            return
        self.spell_timer -= dt
        if self.spell_timer <= 0:
            choice = self._choose_spell(boss, combat, dist)
            if choice is not None:
                self.spell_timer = SPELL_CADENCE
                if choice.cast_time > 0:
                    # Telegraphed. The whole encounter is built on being able to
                    # read a wind-up and move, so anything with a cast time
                    # announces itself and stands still while it charges.
                    self.casting = choice
                    self.cast_charge = choice.cast_time
                    boss.velocity = Vec2()
                    self._announce_charge(state, boss, choice)
                else:
                    combat.resolve_enemy_ability(state, boss, choice, target)
                    self._announce_cast(state, boss, choice)
                return

        melee_dep, melee_conf = self._trait("melee_dependency")
        ranged_dep, ranged_conf = self._trait("ranged_dependency")
        aggression, aggr_conf = self._trait("aggression")
        predicted, pred_conf = self._prediction()

        # --- attack resolution (wind-up already running) ---------------------------
        if boss.state is EnemyState.ATTACK:
            boss.velocity = Vec2()
            boss.windup_timer -= dt
            if boss.windup_timer <= 0:
                ranged = dist > boss.enemy_def.attack_range + target.radius
                if ranged and predicted in DASH_TOKENS and pred_conf > 0.5 and target.id == state.player.id:
                    # Shoot where the dash will land, not where the player is.
                    lead = state.player.last_move_dir if not state.player.last_move_dir.is_zero() else state.player.facing
                    predicted_pos = target.position + lead * 150
                    aim = (predicted_pos - boss.position).normalized()
                    combat._fire_projectiles(state, boss, boss.enemy_def.projectile, aim, boss.enemy_def.damage,
                                             boss.enemy_def.knockback, boss.enemy_def.tags, source="mirror_predict")
                    boss.attack_timer = boss.enemy_def.attack_cooldown
                    self._counter(state, boss, "predict_dash", pred_conf, f"{predicted} predicted; leading the shot")
                    state.emit("ENEMY_ATTACKED", enemy_id=boss.id, enemy_type="mirror", target=target.id, hit=True,
                               position=boss.position.to_dict(), ranged=True)
                else:
                    combat.process_enemy_attack(state, boss, target, ranged=ranged)
                boss.windup_timer = 0
                boss.set_state(EnemyState.REPOSITION)
            return

        # --- counters, confidence weighted --------------------------------------------------
        # 1. Kite a confident melee player: hold range and shoot.
        kite = melee_dep * melee_conf
        # 2. Rush a confident ranged player: close the gap fast.
        rush = ranged_dep * ranged_conf
        # 3. Dodge a predicted AoE when the player is lined up on us.
        facing_us = state.player.facing.dot((boss.position - state.player.position).normalized()) > 0.75
        aoe_threat = predicted in AOE_TOKENS and pred_conf > 0.45 and dist < 210 and facing_us and target.id == state.player.id
        # 4. Riposte a confident aggressive player right after they swing.
        recently_attacked = (state.tick - self.last_player_attack_tick) < 24
        riposte = aggression * aggr_conf if recently_attacked and dist < boss.enemy_def.attack_range * 2.2 else 0.0

        if aoe_threat and self.counter_cooldown <= 0:
            side = direction.perpendicular() * (1 if (state.tick // 120) % 2 == 0 else -1)
            boss.reposition_target = state.room.clamp(boss.position + side * 180, boss.radius + 8)
            boss.set_state(EnemyState.REPOSITION)
            self._counter(state, boss, "dodge_aoe", pred_conf, f"{predicted} predicted at {pred_conf:.2f}; sidestepping")
        elif riposte > 0.35 and boss.attack_timer <= 0 and dist < boss.enemy_def.attack_range + target.radius + 10:
            boss.set_state(EnemyState.ATTACK)
            boss.windup_timer = max(MIN_RIPOSTE_WINDUP, boss.enemy_def.attack_windup * 0.45)
            self._counter(state, boss, "riposte", riposte, f"aggression {aggression:.2f}@{aggr_conf:.2f}: punishing the swing")
            return

        if boss.state is EnemyState.REPOSITION:
            goal = boss.reposition_target
            if goal is None or (goal - boss.position).length() < 12 or boss.state_timer > 0.8:
                boss.set_state(EnemyState.CHASE)
                boss.reposition_target = None
            else:
                boss.velocity = (goal - boss.position).normalized() * boss.speed * speed_mult * 1.3
            return

        # Zone denial in phase 2+: stand on the player's favourite combat spot.
        if self.phase >= 2 and self.deny_timer <= 0:
            hot = self._hot_cell("combat", 2.0 * 32)  # pipeline cell size is in world units / 64 (see session)
            if hot is not None and (hot - boss.position).length() > 120 and dist > 160:
                boss.reposition_target = state.room.clamp(hot, boss.radius + 8)
                boss.set_state(EnemyState.REPOSITION)
                self.deny_timer = 9.0
                self._counter(state, boss, "deny_zone", 0.6, "moving onto your favourite fighting spot")
                return
        self.deny_timer -= dt

        # --- default engagement, on the committed stance ------------------------------------------
        #
        # Scored every tick, acted on in windows. Phase 3 is the exception: the
        # last third of its health is the climax and it stops backing away
        # altogether, so the fight ends with the boss coming at you rather than
        # with the longest chase of the encounter.
        if self.stance_timer <= 0 and self._choose_stance(kite, rush) and self.stance == "press":
            # Announced, because "it decided to come at you" was the half of
            # the fight nothing ever reported: `kite` and `rush` both had their
            # own events and closing on a melee player had none.
            self._counter(state, boss, "press", max(rush, aggression * aggr_conf),
                          f"melee dependency {melee_dep:.2f}@{melee_conf:.2f}: done keeping range, closing")
        if self.phase >= 3 and self.stance == "kite":
            self.stance = "press"
            self.stance_timer = STANCE_SECONDS["press"]

        # No confidence check here: the chooser cannot elect to keep range
        # unless `kite` beat the floor above, so reaching this means it did.
        if self.stance == "kite":
            ideal = 230.0
            if dist < ideal * 0.75:
                boss.velocity = (-direction) * boss.speed * speed_mult
            elif dist > ideal * 1.1:
                boss.velocity = direction * boss.speed * speed_mult * 0.8
            else:
                side = 1 if (state.tick // 100) % 2 == 0 else -1
                boss.velocity = direction.perpendicular() * boss.speed * speed_mult * 0.5 * side
            if boss.attack_timer <= 0 and dist < 380:
                boss.set_state(EnemyState.ATTACK)
                boss.windup_timer = boss.enemy_def.attack_windup + 0.15
                self._counter(state, boss, "kite", kite, f"melee dependency {melee_dep:.2f}@{melee_conf:.2f}: keeping range")
            return

        # Rush / generic: close and strike; ranged players get closed on faster.
        rush_mult = 1.0 + 0.45 * rush
        reach = boss.enemy_def.attack_range + target.radius
        if dist > reach:
            boss.velocity = direction * boss.speed * speed_mult * rush_mult
            if rush > 0.3 and self.counter_cooldown <= 0:
                self._counter(state, boss, "rush", rush, f"ranged dependency {ranged_dep:.2f}@{ranged_conf:.2f}: closing fast")
            # Opportunistic mid-range shot while approaching.
            if boss.attack_timer <= 0 and 140 < dist < 360 and (state.tick % 3 == 0) and rush < 0.3:
                boss.set_state(EnemyState.ATTACK)
                boss.windup_timer = boss.enemy_def.attack_windup + 0.1
        else:
            boss.velocity = Vec2()
            if boss.attack_timer <= 0:
                boss.set_state(EnemyState.ATTACK)
                boss.windup_timer = boss.enemy_def.attack_windup

    def _target(self, boss: Enemy, state: GameState) -> Entity | None:
        candidates: list[Entity] = []
        if state.player.state != "dead":
            candidates.append(state.player)
        if state.twin.available:
            candidates.append(state.twin)
        if not candidates:
            return None
        top = boss.top_threat()
        for c in candidates:
            if c.id == top:
                return c
        # The Mirror wants its sibling first.
        return candidates[0]

    def debug(self) -> dict:
        return {
            "phase": self.phase,
            "activeCounter": self.active_counter,
            "countersUsed": dict(self.counters_used),
        }
