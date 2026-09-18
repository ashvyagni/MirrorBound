"""Observation builder for AI integration."""

from __future__ import annotations

from mirrorbound.agent.observation import (
    AgentObservation,
    EntitySnapshot,
    RoomSnapshot,
)
from mirrorbound.game.state import GameState, Room
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.core.events import Event


def build_observation(
    state: GameState,
    recent_events: list[Event],
) -> AgentObservation:
    """Build an observation from the current game state."""
    # Build player snapshot
    player_snapshot = EntitySnapshot(
        id=state.player.id,
        position=Vec2(state.player.position.x, state.player.position.y),
        health=state.player.health,
        max_health=state.player.max_health,
        velocity=Vec2(state.player.velocity.x, state.player.velocity.y),
        status_effects=state.player.status_effects.copy(),
    )

    # Build twin snapshot
    twin_snapshot = EntitySnapshot(
        id=state.twin.id,
        position=Vec2(state.twin.position.x, state.twin.position.y),
        health=state.twin.health,
        max_health=state.twin.max_health,
        velocity=Vec2(state.twin.velocity.x, state.twin.velocity.y),
        status_effects=state.twin.status_effects.copy(),
    )

    # Build enemy snapshots
    enemy_snapshots = []
    for enemy in state.get_active_enemies():
        snapshot = EntitySnapshot(
            id=enemy.id,
            position=Vec2(enemy.position.x, enemy.position.y),
            health=enemy.health,
            max_health=enemy.max_health,
            velocity=Vec2(enemy.velocity.x, enemy.velocity.y),
            status_effects=enemy.status_effects.copy(),
        )
        enemy_snapshots.append(snapshot)

    # Build room snapshot
    room_snapshot = RoomSnapshot(
        room_type=state.room.room_type,
        width=state.room.width,
        height=state.room.height,
        doors=state.room.door_positions.copy(),
    )

    # Convert recent events to dicts
    event_dicts = []
    for event in recent_events[-20:]:  # Last 20 events
        event_dicts.append(event.to_json_dict())

    return AgentObservation(
        tick=state.tick,
        player_state=player_snapshot,
        twin_state=twin_snapshot,
        enemies=enemy_snapshots,
        recent_events=event_dicts,
        room_context=room_snapshot,
    )
