"""Builds an `AgentObservation` from the authoritative `GameState`."""

from __future__ import annotations

from mirrorbound.agent.observation import (
    AgentObservation,
    EntitySnapshot,
    PickupSnapshot,
    RoomSnapshot,
)
from mirrorbound.game.core.events import Event
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.state import GameState


def build_observation(
    state: GameState,
    recent_events: list[Event],
    player_model: dict | None = None,
    twin_style: dict | None = None,
    player_last_action: str | None = None,
    seconds_since_decision: float = 0.1,
) -> AgentObservation:
    """Build an observation from the current game state."""
    player = state.player
    twin = state.twin

    player_snapshot = EntitySnapshot(
        id=player.id,
        position=player.position.copy(),
        health=player.health,
        max_health=player.max_health,
        velocity=player.velocity.copy(),
        facing=player.facing.copy(),
        radius=player.radius,
        state=player.state,
        role="player",
        target_id=player.target_id,
        attack_range=player.weapon.range,
        weapon_is_melee=player.weapon.is_melee,
        status_effects=sorted(player.status_effects),
    )

    twin_snapshot = EntitySnapshot(
        id=twin.id,
        position=twin.position.copy(),
        health=twin.health,
        max_health=twin.max_health,
        velocity=twin.velocity.copy(),
        facing=twin.facing.copy(),
        radius=twin.radius,
        state=twin.state,
        role="twin",
        target_id=twin.intent.target_id,
        attack_range=twin.weapon.range,
        weapon_is_melee=twin.weapon.is_melee,
        status_effects=sorted(twin.status_effects),
    )

    enemy_snapshots = [
        EntitySnapshot(
            id=enemy.id,
            position=enemy.position.copy(),
            health=enemy.health,
            max_health=enemy.max_health,
            velocity=enemy.velocity.copy(),
            facing=enemy.facing.copy(),
            radius=enemy.radius,
            state=enemy.state.value,
            role=enemy.enemy_def.role,
            target_id=enemy.target_id,
            winding_up=enemy.is_winding_up,
            windup=enemy.windup_timer,
            attack_range=enemy.enemy_def.attack_range,
            weapon_is_melee=enemy.enemy_def.projectile is None,
            elite=enemy.enemy_def.elite,
            boss=enemy.enemy_def.boss,
            status_effects=sorted(enemy.status_effects),
        )
        for enemy in state.get_active_enemies()
    ]

    room_snapshot = RoomSnapshot(
        room_type=state.room.room_type,
        width=state.room.width,
        height=state.room.height,
        doors=[Vec2(d.x, d.y) for d in state.room.doors],
        index=state.room.index,
        cleared=state.room.cleared,
    )

    pickups = [PickupSnapshot(p.id, p.kind, p.position.copy()) for p in state.pickups if p.active]

    return AgentObservation(
        tick=state.tick,
        player_state=player_snapshot,
        twin_state=twin_snapshot,
        enemies=enemy_snapshots,
        recent_events=[e.to_json_dict() for e in recent_events[-20:]],
        room_context=room_snapshot,
        pickups=pickups,
        player_model=player_model or {},
        twin_style=twin_style or {},
        player_target_id=player.target_id,
        player_last_action=player_last_action,
        player_mana_fraction=player.mana / player.max_mana if player.max_mana > 0 else 1.0,
        twin_can_attack=twin.can_attack(),
        twin_weapon_range=twin.weapon.range,
        twin_weapon_is_melee=twin.weapon.is_melee,
        seconds_since_decision=seconds_since_decision,
        twin_weapon_id=twin.weapon.id,
        twin_owned_weapons=list(twin.inventory.weapons),
    )
