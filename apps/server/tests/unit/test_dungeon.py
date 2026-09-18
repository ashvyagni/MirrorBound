from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.generation import DungeonGenerator
from mirrorbound.game.dungeon.room import T_PATH, T_WALL, T_WATER, TILE
from mirrorbound.game.dungeon.templates import DEFAULT_SEQUENCE
from mirrorbound.game.entities.entity import Vec2


def gen(seed: int = 7, count: int = 7):
    return DungeonGenerator(DeterministicRNG(seed)).generate(room_count=count)


def test_default_run_follows_the_designed_progression():
    run = gen()
    assert [r.room_type for r in run.rooms] == [t.value for t in DEFAULT_SEQUENCE]
    assert run.rooms[0].room_type == "entrance" and run.rooms[-1].room_type == "boss"


def test_generation_is_deterministic_per_seed_and_differs_across_seeds():
    a, b, c = gen(11), gen(11), gen(12)
    assert [r.to_dict() for r in a.rooms] == [r.to_dict() for r in b.rooms]
    assert [r.to_dict() for r in a.rooms] != [r.to_dict() for r in c.rooms]


def test_doors_link_rooms_in_a_chain():
    run = gen()
    for i, room in enumerate(run.rooms):
        north = room.door_to(i + 1)
        south = room.door_to(i - 1)
        if i + 1 < len(run.rooms):
            assert north is not None and north.side == "north"
        if i > 0:
            assert south is not None and south.side == "south"


def test_rooms_have_walls_paths_and_dressing():
    run = gen()
    for room in run.rooms:
        rows, cols = len(room.tiles), len(room.tiles[0])
        assert rows == room.height // TILE and cols == room.width // TILE
        assert all(t == T_WALL for t in room.tiles[0]) and all(t == T_WALL for t in room.tiles[-1])
        assert any(T_PATH in row for row in room.tiles)
        assert len(room.decor) >= 10, f"{room.name} is undressed"
        assert any(d.kind == "torch" for d in room.decor)
    entrance = run.rooms[0]
    assert any(T_WATER in row for row in entrance.tiles)


def test_decor_never_blocks_spawns_doors_or_the_path():
    run = gen()
    for room in run.rooms:
        for d in room.blocking_decor():
            centre = Vec2(d.x, d.y)
            assert (centre - room.player_spawn).length() > d.radius + 40
            for spawn in room.enemy_spawns:
                assert (centre - spawn.position).length() > d.radius + 20
            for door in room.doors:
                assert (centre - Vec2(door.x, door.y)).length() > d.radius + 60
        assert not room.is_blocked(room.player_spawn, 14)


def test_rooms_without_enemies_start_open_and_combat_rooms_start_locked():
    run = gen()
    entrance, combat = run.rooms[0], run.rooms[1]
    assert entrance.cleared and all(not d.locked for d in entrance.doors)
    assert not combat.cleared and all(d.locked for d in combat.doors)
    assert combat.enemy_spawns
    # Spawn specs resolve to real archetypes.
    from mirrorbound.game.entities.enemy import get_archetype
    for room in run.rooms:
        for s in room.enemy_spawns:
            get_archetype(s.enemy_type)


def test_arbitrary_room_counts_still_bookend_correctly():
    run = gen(3, count=4)
    assert run.rooms[0].room_type == "entrance" and run.rooms[-1].room_type == "boss"
    assert len(run.rooms) == 4
