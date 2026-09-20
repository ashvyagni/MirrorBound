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

from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.enemy import Enemy, EnemyState
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.state import GameState

AOE_TOKENS = ("FLAME_BURST", "BINDING_NOVA", "FIRE_BURST")
DASH_TOKENS = ("DASH", "SHADOW_DASH")
NOVA_RADIUS = 150.0
NOVA_DAMAGE = 22.0


def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


class MirrorController:
    def __init__(self, rng: DeterministicRNG):
        self.rng = rng.spawn("mirror")
        self.player_model: dict = {}
        self.counter_cooldown = 0.0
        self.nova_timer = 6.0
        self.nova_charge = 0.0
        self.deny_timer = 0.0
        self.last_player_attack_tick = -1000
        self.active_counter: str | None = None
        self.counters_used: dict[str, int] = {}
        self.phase = 1

    # --- model access ---------------------------------------------------------------

    def _trait(self, name: str) -> tuple[float, float]:
        t = (self.player_model.get("traits") or {}).get(name) or {}
        return float(t.get("value", 0.5)), float(t.get("confidence", 0.0))

    def _prediction(self) -> tuple[str | None, float]:
        preds = self.player_model.get("predictions") or []
        if not preds:
            return None, 0.0
        return str(preds[0].get("token")), float(preds[0].get("confidence", 0.0))

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

    # --- update ------------------------------------------------------------------------

    def update(self, dt: float, boss: Enemy, state: GameState, combat: CombatSystem) -> None:
        if not boss.active:
            boss.set_state(EnemyState.DEAD)
            return
        boss.state_timer += dt
        if boss.attack_timer > 0:
            boss.attack_timer -= dt
        if self.counter_cooldown > 0:
            self.counter_cooldown -= dt
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

        # Phase 3: periodic telegraphed nova.
        if self.phase >= 3:
            if self.nova_charge > 0:
                self.nova_charge -= dt
                boss.velocity = Vec2()
                if self.nova_charge <= 0:
                    self._nova(state, boss, combat)
                return
            self.nova_timer -= dt
            if self.nova_timer <= 0 and dist < NOVA_RADIUS * 1.6:
                self.nova_timer = 7.0
                self.nova_charge = 0.9
                state.emit("BOSS_NOVA_CHARGE", enemy_id=boss.id, position=boss.position.to_dict(),
                           radius=NOVA_RADIUS, duration=0.9)
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
            boss.windup_timer = boss.enemy_def.attack_windup * 0.45
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

        # --- default engagement, blended by kite/rush ---------------------------------------------
        if kite > rush and kite > 0.3:
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

    def _nova(self, state: GameState, boss: Enemy, combat: CombatSystem) -> None:
        for who in (state.player, state.twin):
            if who.id == state.twin.id and state.twin.downed:
                continue
            d = (who.position - boss.position).length()
            if d <= NOVA_RADIUS + who.radius:
                direction = (who.position - boss.position).normalized()
                if who.id == state.player.id:
                    combat.damage_player(state, NOVA_DAMAGE, boss.id, direction, 260)
                else:
                    combat.damage_twin(state, NOVA_DAMAGE, boss.id, direction, 260)
        state.emit("BOSS_NOVA", enemy_id=boss.id, position=boss.position.to_dict(), radius=NOVA_RADIUS)

    def _target(self, boss: Enemy, state: GameState) -> Entity | None:
        candidates: list[Entity] = []
        if state.player.state != "dead":
            candidates.append(state.player)
        if not state.twin.downed:
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
