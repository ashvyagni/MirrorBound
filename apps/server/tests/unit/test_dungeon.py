from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.generation import DungeonGenerator
from mirrorbound.game.dungeon.room import T_PATH, T_WALL, T_WATER, TILE
from mirrorbound.game.dungeon.templates import DEFAULT_SEQUENCE
from mirrorbound.game.entities.enemy import get_archetype
from mirrorbound.game.entities.entity import Vec2
from mirrorbound.game.world.village import build_village


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


# --- the per-room art contract ----------------------------------------------
#
# The client fetches enemy atlases per room from `enemySprites` rather than
# loading all twelve families at boot. That makes this field load-bearing: a
# room that under-reports leaves its enemies drawn as painted stand-ins, and a
# room that over-reports pulls megabytes it never draws. These pin both ends.


def test_every_room_names_the_sprites_its_spawns_will_use():
    run = gen()
    for room in run.rooms:
        sprites = room.enemy_sprites()
        assert sprites == sorted(set(sprites)), "must be sorted and distinct, so the snapshot is stable"
        wanted = {get_archetype(s.enemy_type).sprite for s in room.enemy_spawns}
        assert set(sprites) == wanted


def test_the_boss_room_names_the_mirror():
    run = gen()
    assert run.rooms[-1].enemy_sprites() == ["mirror"]


def test_a_village_names_no_enemy_art_at_all():
    village = build_village("hollow_reach", DeterministicRNG(3))
    assert village.enemy_spawns == []
    assert village.enemy_sprites() == []
    assert village.to_dict()["enemySprites"] == []


def test_the_snapshot_carries_the_same_list_the_method_returns():
    for room in gen().rooms:
        assert room.to_dict()["enemySprites"] == room.enemy_sprites()


# --- the tutorial's first fight -------------------------------------------------


def test_the_tutorial_runs_first_fight_is_authored_not_rolled():
    """That fight is taken alone, at level one, before the twin is found.

    Any combat room may roll any of the four templates; rolling the five-enemy
    sanctum into the room that teaches fighting is the difference between a
    tutorial and a wall. Every seed must give the same opening.
    """
    for seed in range(12):
        run = DungeonGenerator(DeterministicRNG(seed)).generate(room_count=7, tutorial=True)
        first = next(r for r in run.rooms if r.room_type == "combat")
        assert first.enemy_sprites() == sorted({"skeleton", "hound", "archer"})
        assert len(first.enemy_spawns) == 4
        assert not any(s.enemy_type == "brute" for s in first.enemy_spawns)


def test_only_the_first_combat_room_is_pinned():
    """The second one rolls, or the whole dungeon is the same fight twice."""
    seen = set()
    for seed in range(30):
        run = DungeonGenerator(DeterministicRNG(seed)).generate(room_count=7, tutorial=True)
        combats = [r for r in run.rooms if r.room_type == "combat"]
        assert len(combats) >= 2
        seen.add(tuple(combats[1].enemy_sprites()))
    assert len(seen) > 1, "later combat rooms still vary by seed"


def test_without_the_tutorial_flag_the_first_fight_rolls_like_any_other():
    seen = set()
    for seed in range(30):
        run = DungeonGenerator(DeterministicRNG(seed)).generate(room_count=7)
        first = next(r for r in run.rooms if r.room_type == "combat")
        seen.add(tuple(first.enemy_sprites()))
    assert len(seen) > 1
