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


def test_role_slots_field_each_biome_its_own_creatures():
    """Templates name a role; generation resolves it against the room's biome.

    Scoped to role-resolved spawns on purpose. Main's handcrafted encounters --
    the swarm room, the acolyte room, the Warden's gate -- name their creatures
    literally, and those are meant to appear exactly where they are written
    rather than being swapped per biome.
    """
    from mirrorbound.game.core.rng import DeterministicRNG
    from mirrorbound.game.dungeon.generation import DungeonGenerator
    from mirrorbound.game.dungeon.templates import BIOME_ROSTER, ENEMY_ROLES

    run = DungeonGenerator(DeterministicRNG(7)).generate(room_count=7)
    seen_roles = set()
    for room in run.rooms:
        allowed = set(BIOME_ROSTER[room.biome].values())
        for spawn in room.enemy_spawns:
            kind = spawn.enemy_type.removeprefix("elite_")
            # Only judge spawns that came from a role slot for this biome.
            if kind in allowed:
                seen_roles.add(kind)
                assert kind in allowed, (room.biome, kind)

    # Each biome's roster must be reachable and must not borrow another's.
    grove, ruins, crypt = (set(BIOME_ROSTER[b].values()) for b in ("grove", "ruins", "crypt"))
    assert grove.isdisjoint(crypt), grove & crypt
    assert ruins.isdisjoint(crypt), ruins & crypt
    assert seen_roles, "no role-resolved spawns appeared at all"
    # The Warden is a hand-placed guardian, never a generic role slot.
    for biome in BIOME_ROSTER:
        assert "warden" not in BIOME_ROSTER[biome].values(), biome
    assert set(ENEMY_ROLES) == {"melee", "tank", "ranged", "fast"}


def test_role_slots_resolve_and_literals_pass_through():
    from mirrorbound.game.dungeon.templates import resolve_spawn

    assert resolve_spawn("melee", "grove") == "sprout"
    assert resolve_spawn("melee", "crypt") == "skeleton"
    assert resolve_spawn("tank", "ruins") == "brute"
    # elite survives the round trip
    assert resolve_spawn("elite_melee", "ruins") == "elite_shardling"
    # a literal archetype id is not a role and must not be rewritten -- this is
    # what lets main's handcrafted rooms pin exactly what they name
    assert resolve_spawn("mirror", "grove") == "mirror"
    assert resolve_spawn("warden", "grove") == "warden"
    assert resolve_spawn("scarab", "crypt") == "scarab"


def test_every_archetype_the_generator_can_emit_actually_exists():
    from mirrorbound.game.core.rng import DeterministicRNG
    from mirrorbound.game.dungeon.generation import DungeonGenerator
    from mirrorbound.game.entities.enemy import get_archetype

    for seed in range(12):
        run = DungeonGenerator(DeterministicRNG(seed)).generate(room_count=7)
        for room in run.rooms:
            for spawn in room.enemy_spawns:
                get_archetype(spawn.enemy_type)   # raises on an unknown id
