"""Combat system - handles attacks, damage, and abilities."""

from __future__ import annotations

import math

from mirrorbound.game.core.events import Event, EventBus
from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.entities.player import Player
from mirrorbound.game.entities.twin import Twin
from mirrorbound.game.entities.enemy import Enemy
from mirrorbound.game.entities.projectile import Projectile
from mirrorbound.game.combat.weapons import WeaponDef, get_weapon, SWORD
from mirrorbound.game.combat.abilities import AbilityDef, get_ability_by_slot
from mirrorbound.game.combat.hitbox import Hitbox, HitboxShape
from mirrorbound.game.state import GameState


class CombatSystem:
    """Handles all combat operations."""

    def __init__(self, bus: EventBus, rng: DeterministicRNG):
        self.bus = bus
        self.rng = rng

    def update(self, dt: float, state: GameState) -> None:
        """Update combat state (cooldowns, etc.)."""
        state.player.update_cooldowns(dt)

        # Update enemy attack timers
        for enemy in state.get_active_enemies():
            if enemy.attack_timer > 0:
                enemy.attack_timer -= dt

    def process_player_attack(self, state: GameState, aim_angle: float) -> None:
        """Process a player attack."""
        player = state.player
        weapon = get_weapon(player.current_weapon)

        if not player.can_attack():
            return

        player.start_attack()

        if weapon.type.value in ["melee"]:
            self._process_melee_attack(player, weapon, aim_angle, state)
        else:
            self._process_ranged_attack(player, weapon, aim_angle, state)

    def _process_melee_attack(self, player: Player, weapon: WeaponDef, aim_angle: float, state: GameState) -> None:
        """Process a melee attack."""
        # Create arc hitbox
        hitbox = Hitbox(
            shape=HitboxShape.ARC,
            position=player.position,
            size=weapon.range,
            direction=aim_angle,
            arc_angle=math.pi / 2,  # 90 degree arc
        )

        # Check hits against enemies
        hits = []
        for enemy in state.get_active_enemies():
            if hitbox.overlaps_circle(enemy.position, enemy.radius):
                hits.append(enemy)

        # Apply damage to hits
        for enemy in hits:
            damage = self._calculate_damage(player, weapon, enemy)
            actual = enemy.take_damage(damage)

            # Apply knockback
            diff = enemy.position - player.position
            if diff.length() > 0:
                knockback_dir = diff.normalized()
                enemy.velocity = Vec2(
                    knockback_dir.x * weapon.knockback,
                    knockback_dir.y * weapon.knockback,
                )

            # Publish events
            self.bus.publish(Event(
                tick=state.tick,
                type="DAMAGE_DEALT",
                data={
                    "attacker": player.id,
                    "target": enemy.id,
                    "damage": actual,
                    "remaining": enemy.health,
                    "position": enemy.position.to_dict(),
                }
            ))

            if not enemy.active:
                self.bus.publish(Event(
                    tick=state.tick,
                    type="ENEMY_KILLED",
                    data={
                        "enemy_id": enemy.id,
                        "enemy_type": enemy.enemy_def.name,
                        "xp_reward": enemy.xp_reward,
                        "position": enemy.position.to_dict(),
                    }
                ))

        # Publish player attack event
        self.bus.publish(Event(
            tick=state.tick,
            type="PLAYER_ATTACKED",
            data={
                "action_token": f"{weapon.name.upper()}_STRIKE",
                "tags": weapon.get_tags(),
                "distance": weapon.range,
                "targets": [e.id for e in hits],
                "hitCount": len(hits),
                "aimAngle": aim_angle,
            }
        ))

    def _process_ranged_attack(self, player: Player, weapon: WeaponDef, aim_angle: float, state: GameState) -> None:
        """Process a ranged attack."""
        for i in range(weapon.projectile_count):
            # Calculate spread for multiple projectiles
            spread = 0
            if weapon.projectile_count > 1:
                spread = (i - (weapon.projectile_count - 1) / 2) * 0.2

            projectile = Projectile(
                id=state.ids.next("projectile"),
                owner_id=player.id,
                position=Vec2(player.position.x, player.position.y),
                velocity=Vec2(
                    math.cos(aim_angle + spread) * weapon.projectile_speed,
                    math.sin(aim_angle + spread) * weapon.projectile_speed,
                ),
                damage=weapon.damage,
                speed=weapon.projectile_speed,
                radius=weapon.hitbox_size,
                lifetime=2.0,
            )
            state.projectiles.append(projectile)

        # Publish player attack event
        self.bus.publish(Event(
            tick=state.tick,
            type="PLAYER_ATTACKED",
            data={
                "action_token": f"{weapon.name.upper()}_SHOT",
                "tags": weapon.get_tags(),
                "distance": weapon.range,
                "projectileCount": weapon.projectile_count,
                "aimAngle": aim_angle,
            }
        ))

    def process_ability(self, state: GameState, slot: int) -> None:
        """Process an ability use."""
        player = state.player
        ability = get_ability_by_slot(slot)

        if ability is None or not player.can_use_ability(slot):
            return

        player.start_ability(slot, ability.cooldown)

        if ability.type.value == "dash":
            self._process_dash(player, ability, state)
        elif ability.type.value == "aoe":
            self._process_aoe(player, ability, state)
        elif ability.type.value == "heal":
            self._process_heal(player, ability, state)

        # Publish ability cast event
        self.bus.publish(Event(
            tick=state.tick,
            type="PLAYER_ABILITY_CAST",
            data={
                "ability": ability.name.upper(),
                "tags": ability.tags,
                "slot": slot,
            }
        ))

    def _process_dash(self, player: Player, ability: AbilityDef, state: GameState) -> None:
        """Process dash ability."""
        # Dash in the direction the player is facing or moving
        dash_distance = ability.effect_value
        direction = player.velocity.normalized()
        if direction.length() == 0:
            # Default dash forward based on last facing
            direction = Vec2(1, 0)  # Could be improved with facing direction

        dash_velocity = Vec2(
            direction.x * dash_distance * 2,
            direction.y * dash_distance * 2,
        )
        player.velocity = dash_velocity

    def _process_aoe(self, player: Player, ability: AbilityDef, state: GameState) -> None:
        """Process AoE ability."""
        radius = ability.range
        damage = ability.effect_value

        for enemy in state.get_active_enemies():
            dist = player.distance_to(enemy)
            if dist <= radius:
                # Damage falls off with distance
                damage_mult = 1.0 - (dist / radius) * 0.5
                actual = enemy.take_damage(damage * damage_mult)

                self.bus.publish(Event(
                    tick=state.tick,
                    type="DAMAGE_DEALT",
                    data={
                        "attacker": player.id,
                        "target": enemy.id,
                        "damage": actual,
                        "remaining": enemy.health,
                        "position": enemy.position.to_dict(),
                        "ability": ability.name,
                    }
                ))

                if not enemy.active:
                    self.bus.publish(Event(
                        tick=state.tick,
                        type="ENEMY_KILLED",
                        data={
                            "enemy_id": enemy.id,
                            "enemy_type": enemy.enemy_def.name,
                            "xp_reward": enemy.xp_reward,
                            "position": enemy.position.to_dict(),
                        }
                    ))

    def _process_heal(self, player: Player, ability: AbilityDef, state: GameState) -> None:
        """Process heal ability."""
        healed = player.heal(ability.effect_value)
        if healed > 0:
            self.bus.publish(Event(
                tick=state.tick,
                type="PLAYER_HEALED",
                data={
                    "amount": healed,
                    "remaining": player.health,
                }
            ))

    def _calculate_damage(self, attacker: Player, weapon: WeaponDef, target: Enemy) -> float:
        """Calculate damage with crit chance."""
        base_damage = weapon.damage

        # Crit check
        if self.rng.chance(weapon.crit_chance):
            base_damage *= weapon.crit_multiplier

        return base_damage
