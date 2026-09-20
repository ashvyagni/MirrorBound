"""Movement system: integrates velocity + knockback into position, keeps
entities inside the room and out of blocking decor, separates crowding
enemies, and emits sampled movement telemetry.
"""

from __future__ import annotations

from math import ceil

from mirrorbound.game.core.events import EventBus
from mirrorbound.game.entities.enemy import Enemy
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.state import GameState

MOVE_SAMPLE_TICKS = 20          # emit PLAYER_MOVED at most every third of a second
RETREAT_HOLD_SECONDS = 0.6      # moving away from a threat for this long counts as a retreat
RETREAT_COOLDOWN_SECONDS = 2.5


class MovementSystem:
    """Handles entity movement and room-bounds collision."""

    def __init__(self, bus: EventBus):
        self.bus = bus
        self._moved_since_sample = 0.0
        self._last_sample_tick = 0
        self._retreat_hold = 0.0
        self._retreat_cooldown = 0.0

    def update(self, dt: float, state: GameState) -> None:
        room = state.room
        player = state.player

        self._move(dt, player, state)
        if state.twin.available:
            self._move(dt, state.twin, state)
        enemies = state.get_active_enemies()
        for enemy in enemies:
            self._move(dt, enemy, state)
        self._separate(enemies, state)

        for projectile in state.projectiles:
            if projectile.active:
                projectile.update(dt)
                if room.is_wall(projectile.position.x, projectile.position.y):
                    projectile.active = False
                    state.emit("PROJECTILE_EXPIRED", projectile=projectile.id, kind=projectile.kind,
                               position=projectile.position.to_dict(), reason="wall")
                else:
                    for d in room.decor:
                        if d.blocking and d.kind != "pond" and (projectile.position - d.collision_center).length() < d.collision_radius + projectile.radius:
                            projectile.active = False
                            state.emit("PROJECTILE_EXPIRED", projectile=projectile.id, kind=projectile.kind,
                                       position=projectile.position.to_dict(), reason="decor")
                            break

        self._player_telemetry(dt, state)

    def _move(self, dt: float, entity: Entity, state: GameState) -> None:
        if not entity.active:
            return
        room = state.room
        motion = (entity.velocity + entity.knockback) * dt
        if motion.is_zero():
            return
        # Substeps stop fast dashes and knockback tunnelling through small props.
        steps = max(1, ceil(motion.length() / max(4.0, entity.radius * .5)))
        new_pos = entity.position
        for _ in range(steps):
            candidate = room.clamp(new_pos + motion * (1 / steps), entity.radius)
            candidate = room.resolve_decor_collision(candidate, entity.radius)
            candidate = room.clamp(candidate, entity.radius)
            if not room.is_blocked(candidate, entity.radius - .001):
                new_pos = candidate
        if entity.id == state.player.id:
            self._moved_since_sample += (new_pos - entity.position).length()
        entity.position = new_pos

    def _separate(self, enemies: list[Enemy], state: GameState) -> None:
        """Soft push-apart so enemies don't stack into one sprite."""
        n = len(enemies)
        for i in range(n):
            a = enemies[i]
            for j in range(i + 1, n):
                b = enemies[j]
                diff = b.position - a.position
                dist = diff.length()
                min_dist = a.radius + b.radius
                if 0 < dist < min_dist:
                    push = diff.normalized() * ((min_dist - dist) * 0.5)
                    a.position = state.room.clamp(a.position - push, a.radius)
                    b.position = state.room.clamp(b.position + push, b.radius)
        # Keep enemies from standing inside the player/twin as well.
        for who in (state.player, state.twin):
            if who.id == state.twin.id and not state.twin.available:
                continue
            for e in enemies:
                diff = e.position - who.position
                dist = diff.length()
                min_dist = e.radius + who.radius - 2
                if 0 < dist < min_dist:
                    e.position = state.room.clamp(e.position + diff.normalized() * (min_dist - dist), e.radius)

    def _player_telemetry(self, dt: float, state: GameState) -> None:
        player = state.player
        if player.state == "dead":
            return
        # Sampled movement: one event per MOVE_SAMPLE_TICKS with the distance covered.
        if state.tick - self._last_sample_tick >= MOVE_SAMPLE_TICKS:
            if self._moved_since_sample > 4:
                state.emit("PLAYER_MOVED", position=player.position.to_dict(),
                           distance=round(self._moved_since_sample, 1),
                           direction=player.facing.to_dict(), running=player.is_running)
            self._moved_since_sample = 0.0
            self._last_sample_tick = state.tick

        # Retreat detection: moving away from the nearest engaged enemy.
        if self._retreat_cooldown > 0:
            self._retreat_cooldown -= dt
        nearest = state.nearest_enemy(player.position, max_dist=320)
        if nearest is not None and not player.velocity.is_zero():
            away = (player.position - nearest.position).normalized()
            if player.velocity.normalized().dot(away) > 0.6:
                self._retreat_hold += dt
            else:
                self._retreat_hold = 0.0
        else:
            self._retreat_hold = 0.0
        if self._retreat_hold >= RETREAT_HOLD_SECONDS and self._retreat_cooldown <= 0 and nearest is not None:
            self._retreat_cooldown = RETREAT_COOLDOWN_SECONDS
            self._retreat_hold = 0.0
            state.emit("PLAYER_RETREATED", tags=["DEFENSIVE"], position=player.position.to_dict(),
                       from_enemy=nearest.id, distance=round((player.position - nearest.position).length(), 1),
                       health_fraction=round(player.health / max(1.0, player.max_health), 2))
