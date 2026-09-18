"""Dungeon generation system."""

from __future__ import annotations

from dataclasses import dataclass

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.templates import (
    RoomTemplate,
    RoomType,
    get_random_template,
)
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.state import Room


@dataclass
class DungeonRun:
    """A complete dungeon run with multiple rooms."""
    seed: int
    rooms: list[Room]
    current_room_index: int = 0

    @property
    def current_room(self) -> Room:
        return self.rooms[self.current_room_index]

    @property
    def is_complete(self) -> bool:
        return self.current_room_index >= len(self.rooms)

    def next_room(self) -> Room | None:
        """Advance to the next room."""
        if self.current_room_index < len(self.rooms) - 1:
            self.current_room_index += 1
            return self.current_room
        return None


class DungeonGenerator:
    """Generates dungeon runs with procedural room ordering."""

    def __init__(self, rng: DeterministicRNG):
        self.rng = rng

    def generate(self, room_count: int = 7) -> DungeonRun:
        """Generate a dungeon run with the specified number of rooms."""
        # Always start with entrance
        room_sequence = [RoomType.ENTRANCE]

        # Add combat rooms
        combat_count = max(1, room_count - 3)  # Leave room for treasure, elite, boss
        for _ in range(combat_count):
            room_sequence.append(RoomType.COMBAT)

        # Add treasure room
        if room_count > 3:
            room_sequence.insert(2, RoomType.TREASURE)

        # Add elite room before boss
        if room_count > 5:
            room_sequence.insert(-1, RoomType.ELITE)

        # Always end with boss
        room_sequence.append(RoomType.BOSS)

        # Trim to desired length
        room_sequence = room_sequence[:room_count]

        # Shuffle middle rooms (keep entrance first and boss last)
        if len(room_sequence) > 2:
            middle = room_sequence[1:-1]
            middle = self.rng.shuffled(middle)
            room_sequence = [room_sequence[0]] + middle + [room_sequence[-1]]

        # Generate rooms from templates
        rooms = []
        for room_type in room_sequence:
            template = get_random_template(room_type, self.rng)
            room = self._create_room(template)
            rooms.append(room)

        return DungeonRun(
            seed=self.rng.seed,
            rooms=rooms,
            current_room_index=0,
        )

    def _create_room(self, template: RoomTemplate) -> Room:
        """Create a Room from a template."""
        # Create tile grid (0 = floor, 1 = wall)
        tile_width = template.width // 32
        tile_height = template.height // 32
        tiles = [[0 for _ in range(tile_width)] for _ in range(tile_height)]

        # Add walls around edges
        for x in range(tile_width):
            tiles[0][x] = 1  # Top wall
            tiles[tile_height - 1][x] = 1  # Bottom wall
        for y in range(tile_height):
            tiles[y][0] = 1  # Left wall
            tiles[y][tile_width - 1] = 1  # Right wall

        return Room(
            width=template.width,
            height=template.height,
            room_type=template.room_type.value,
            tiles=tiles,
            door_positions=template.door_positions.copy(),
        )
