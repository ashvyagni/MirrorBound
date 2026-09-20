"""Enemy AI: one state machine, parameterised by archetype behaviour.

    IDLE -> WANDER -> (target seen) CHASE -> ATTACK (wind-up, strike)
         -> REPOSITION -> CHASE ...       -> RETREAT (low health) -> CHASE
    anything -> DEAD

Enemies pick targets from a threat table (whoever has hurt them most) and fall
back to whichever ally is nearest, so the twin can genuinely pull aggro.
"""

from __future__ import annotations

from mirrorbound.game.combat.combat import CombatSystem
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.enemy import Enemy, EnemyBehavior, EnemyState
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.state import GameState
from mirrorbound.game.movement.navigation import Navigator, clear_segment

THREAT_DECAY_PER_SECOND = 0.35


class BasicEnemyController:
    """Controls enemy behaviour based on archetype."""

    def __init__(self, rng: DeterministicRNG):
        self.rng = rng.spawn("enemy_ai")
        self.navigator = Navigator()

    # --- entry point ---------------------------------------------------------

    def update(self, dt: float, enemy: Enemy, state: GameState, combat: CombatSystem) -> None:
        self._update(dt, enemy, state, combat)
        if enemy.velocity.is_zero():
            return
        target = state.entity_by_id(enemy.target_id)
        goal = enemy.position + enemy.velocity.normalized() * 120
        if enemy.state is EnemyState.WANDER and enemy.wander_target:
            goal = enemy.wander_target
        elif enemy.state is EnemyState.REPOSITION and enemy.reposition_target:
            goal = enemy.reposition_target
        elif target and enemy.velocity.dot(target.position - enemy.position) > 0:
            goal = target.position
        enemy.velocity = self.navigator.velocity(state.room, enemy, goal, enemy.velocity.length())

    def _update(self, dt: float, enemy: Enemy, state: GameState, combat: CombatSystem) -> None:
        if not enemy.active:
            enemy.set_state(EnemyState.DEAD)
            enemy.velocity = Vec2()
            return

        enemy.state_timer += dt
        if enemy.attack_timer > 0:
            enemy.attack_timer -= dt
        for _ability, _left in list(enemy.ability_timers.items()):
            enemy.ability_timers[_ability] = _left - dt
        for key in list(enemy.threat):
            enemy.threat[key] *= max(0.0, 1.0 - THREAT_DECAY_PER_SECOND * dt)
            if enemy.threat[key] < 0.5:
                del enemy.threat[key]

        target = self._choose_target(enemy, state)
        enemy.target_id = target.id if target else None

        if enemy.stagger > 0:
            enemy.velocity = Vec2()
            return

        if target is None:
            self._idle_or_wander(dt, enemy, state)
            return

        edef = enemy.enemy_def
        dist = enemy.distance_to(target)

        # Low-health retreat for the fragile archetypes.
        if (enemy.state not in (EnemyState.RETREAT, EnemyState.ATTACK)
                and edef.behavior in (EnemyBehavior.CHARGE, EnemyBehavior.KEEP_DISTANCE)
                and enemy.health < enemy.max_health * 0.22 and enemy.hits_taken >= 2
                and not edef.elite):
            enemy.set_state(EnemyState.RETREAT)

        if enemy.state in (EnemyState.IDLE, EnemyState.WANDER):
            enemy.set_state(EnemyState.CHASE)

        if enemy.state is EnemyState.CHASE:
            self._chase(enemy, target, dist, edef, state)
        elif enemy.state is EnemyState.ATTACK:
            self._attack(dt, enemy, target, dist, state, combat)
        elif enemy.state is EnemyState.REPOSITION:
            self._reposition(dt, enemy, target, dist, state)
        elif enemy.state is EnemyState.RETREAT:
            self._retreat(enemy, target, dist)

    # --- targeting -----------------------------------------------------------

    def _choose_target(self, enemy: Enemy, state: GameState) -> Entity | None:
        candidates: list[Entity] = []
        if state.player.state != "dead":
            candidates.append(state.player)
        if state.twin.available:
            candidates.append(state.twin)
        if not candidates:
            return None
        aggro = enemy.enemy_def.aggro_range
        top = enemy.top_threat()
        if top is not None:
            for c in candidates:
                if c.id == top and enemy.distance_to(c) < aggro * 1.6:
                    return c
        # Once engaged, stick with the current target unless it gets far away.
        current = state.entity_by_id(enemy.target_id)
        if current is not None and current in candidates and enemy.distance_to(current) < aggro * 1.4:
            return current
        nearest = min(candidates, key=enemy.distance_to)
        if enemy.distance_to(nearest) <= aggro:
            return nearest
        return None

    # --- states ----------------------------------------------------------------

    def _idle_or_wander(self, dt: float, enemy: Enemy, state: GameState) -> None:
        if enemy.state not in (EnemyState.IDLE, EnemyState.WANDER):
            enemy.set_state(EnemyState.IDLE)
        if enemy.state is EnemyState.IDLE:
            enemy.velocity = Vec2()
            if enemy.state_timer > 1.2 + self.rng.next_float() * 2.0:
                offset = Vec2.from_angle(self.rng.next_float() * 6.28318, 60 + self.rng.next_float() * 120)
                enemy.wander_target = state.room.clamp(enemy.home + offset, enemy.radius + 8)
                enemy.set_state(EnemyState.WANDER)
        else:
            target = enemy.wander_target or enemy.home
            diff = target - enemy.position
            if diff.length() < 8 or enemy.state_timer > 4.0:
                enemy.set_state(EnemyState.IDLE)
                enemy.velocity = Vec2()
            else:
                enemy.velocity = diff.normalized() * (enemy.speed * 0.45)
                enemy.face(diff)

    def _chase(self, enemy: Enemy, target: Entity, dist: float, edef, state: GameState) -> None:
        to_target = target.position - enemy.position
        enemy.face(to_target)
        if not clear_segment(state.room, enemy.position, target.position, 0):
            enemy.velocity = to_target.normalized() * enemy.speed
            return
        if edef.behavior is EnemyBehavior.KEEP_DISTANCE:
            ideal = edef.attack_range * 0.72
            if dist < ideal * 0.7:
                enemy.velocity = (-to_target).normalized() * enemy.speed
            elif dist > edef.attack_range * 0.95:
                enemy.velocity = to_target.normalized() * enemy.speed
            else:
                # Strafe around the target while waiting for the shot.
                side = 1 if (hash_side(enemy.id)) else -1
                enemy.velocity = to_target.perpendicular().normalized() * (enemy.speed * 0.55 * side)
            if dist <= edef.attack_range and enemy.attack_timer <= 0:
                self._begin_attack(enemy)
            return

        if dist <= edef.attack_range + target.radius:
            enemy.velocity = Vec2()
            if enemy.attack_timer <= 0:
                self._begin_attack(enemy)
        else:
            speed = enemy.speed
            if edef.behavior is EnemyBehavior.DART:
                speed *= 1.15
            enemy.velocity = to_target.normalized() * speed

    def _begin_attack(self, enemy: Enemy) -> None:
        enemy.set_state(EnemyState.ATTACK)
        enemy.windup_timer = enemy.enemy_def.attack_windup
        enemy.velocity = Vec2()

    def _attack(self, dt: float, enemy: Enemy, target: Entity, dist: float, state: GameState,
                combat: CombatSystem) -> None:
        edef = enemy.enemy_def
        enemy.face(target.position - enemy.position)
        # Tanks and darters keep a little forward drift during the wind-up.
        if edef.behavior is EnemyBehavior.DART:
            enemy.velocity = (target.position - enemy.position).normalized() * (enemy.speed * 0.5)
        else:
            enemy.velocity = Vec2()
        enemy.windup_timer -= dt
        if enemy.windup_timer <= 0:
            combat.process_enemy_attack(state, enemy, target)
            enemy.windup_timer = 0
            if edef.behavior is EnemyBehavior.DART:
                # Dart out after biting.
                away = (enemy.position - target.position).normalized()
                side = away.perpendicular() * (1 if hash_side(enemy.id) else -1)
                enemy.reposition_target = state.room.clamp(
                    enemy.position + (away + side * 0.6).normalized() * 170, enemy.radius + 8)
                enemy.set_state(EnemyState.REPOSITION)
            elif edef.behavior is EnemyBehavior.KEEP_DISTANCE:
                side = (target.position - enemy.position).perpendicular().normalized()
                enemy.reposition_target = state.room.clamp(
                    enemy.position + side * (90 if hash_side(enemy.id) else -90), enemy.radius + 8)
                enemy.set_state(EnemyState.REPOSITION)
            else:
                enemy.set_state(EnemyState.REPOSITION)
                enemy.reposition_target = None

    def _reposition(self, dt: float, enemy: Enemy, target: Entity, dist: float, state: GameState) -> None:
        edef = enemy.enemy_def
        if enemy.reposition_target is None:
            # Brief recovery step back after a swing, then re-engage.
            if enemy.state_timer < 0.35:
                enemy.velocity = (enemy.position - target.position).normalized() * (enemy.speed * 0.4)
            else:
                enemy.set_state(EnemyState.CHASE)
            return
        diff = enemy.reposition_target - enemy.position
        if diff.length() < 10 or enemy.state_timer > 0.9:
            enemy.set_state(EnemyState.CHASE)
            enemy.velocity = Vec2()
        else:
            speed = enemy.speed * (1.2 if edef.behavior is EnemyBehavior.DART else 0.9)
            enemy.velocity = diff.normalized() * speed
            enemy.face(target.position - enemy.position)

    def _retreat(self, enemy: Enemy, target: Entity, dist: float) -> None:
        away = (enemy.position - target.position).normalized()
        enemy.velocity = away * (enemy.speed * 0.9)
        enemy.face(target.position - enemy.position)
        if enemy.state_timer > 2.2 or dist > enemy.enemy_def.aggro_range * 0.9:
            enemy.set_state(EnemyState.CHASE)


def hash_side(entity_id: str) -> bool:
    """Deterministic left/right preference from the id (no RNG consumption)."""
    return sum(ord(c) for c in entity_id) % 2 == 0
