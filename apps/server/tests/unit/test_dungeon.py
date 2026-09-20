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


# --- how a room is dressed ----------------------------------------------------

def _decor_of(room, *kinds: str):
    return [d for d in room.decor if d.kind in kinds]


def _spread(points) -> float:
    """Mean distance from the centroid: how gathered a set of props is."""
    if len(points) < 2:
        return 0.0
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    return sum(((p[0] - cx) ** 2 + (p[1] - cy) ** 2) ** 0.5 for p in points) / len(points)


def test_undergrowth_gathers_where_the_trees_are():
    """Bushes belong under trees, not sprinkled evenly across the floor.

    The old placement was one uniform scatter per kind, so nothing grew near
    anything. This is the difference between a wood and noise.
    """
    from mirrorbound.game.core.rng import DeterministicRNG
    from mirrorbound.game.dungeon.generation import DungeonGenerator

    close = 0
    total = 0
    for seed in range(6):
        run = DungeonGenerator(DeterministicRNG(seed)).generate(room_count=4, biome="grove")
        for room in run.rooms:
            trees = [(d.x, d.y) for d in _decor_of(room, "tree", "tree_big")]
            bushes = [(d.x, d.y) for d in _decor_of(room, "bush", "fern_clump")]
            if not trees or not bushes:
                continue
            for b in bushes:
                total += 1
                nearest = min(((b[0] - t[0]) ** 2 + (b[1] - t[1]) ** 2) ** 0.5 for t in trees)
                if nearest < 180:
                    close += 1
    assert total > 0, "grove rooms should have undergrowth"
    assert close / total > 0.7, f"only {close}/{total} of the undergrowth grew near a tree"


def test_a_colonnade_is_a_line_rather_than_a_sprinkle():
    """Pillars were put there by someone, so they stand in a row."""
    from mirrorbound.game.core.rng import DeterministicRNG
    from mirrorbound.game.dungeon.generation import DungeonGenerator

    lined_up = 0
    rooms = 0
    for seed in range(6):
        run = DungeonGenerator(DeterministicRNG(seed)).generate(room_count=4, biome="ruins")
        for room in run.rooms:
            pillars = [(d.x, d.y) for d in _decor_of(room, "pillar")]
            if len(pillars) < 3:
                continue
            rooms += 1
            # A row is narrow on one axis and long on the other.
            xs = [p[0] for p in pillars]
            ys = [p[1] for p in pillars]
            if min(max(xs) - min(xs), max(ys) - min(ys)) < 120:
                lined_up += 1
    assert rooms > 0, "ruins rooms should have pillars"
    assert lined_up / rooms > 0.8, f"only {lined_up}/{rooms} colonnades were actually rows"


def test_rubble_lies_at_the_foot_of_what_shed_it():
    from mirrorbound.game.core.rng import DeterministicRNG
    from mirrorbound.game.dungeon.generation import DungeonGenerator

    close = total = 0
    for seed in range(6):
        run = DungeonGenerator(DeterministicRNG(seed)).generate(room_count=4, biome="ruins")
        for room in run.rooms:
            hosts = [(d.x, d.y) for d in _decor_of(room, "pillar", "broken_pillar", "column_fallen")]
            rubble = [(d.x, d.y) for d in _decor_of(room, "rubble")]
            if not hosts or not rubble:
                continue
            for r in rubble:
                total += 1
                nearest = min(((r[0] - hp[0]) ** 2 + (r[1] - hp[1]) ** 2) ** 0.5 for hp in hosts)
                if nearest < 200:
                    close += 1
    assert total > 0 and close / total > 0.8, f"{close}/{total} rubble near its source"


def test_two_rooms_of_one_biome_are_not_the_same_room():
    """Composed, not cloned: the seed still decides where everything sits."""
    from mirrorbound.game.core.rng import DeterministicRNG
    from mirrorbound.game.dungeon.generation import DungeonGenerator

    run = DungeonGenerator(DeterministicRNG(11)).generate(room_count=5, biome="grove")
    prints = {
        tuple(sorted((d.kind, round(d.x / 64), round(d.y / 64)) for d in room.decor))
        for room in run.rooms
    }
    assert len(prints) == len(run.rooms), "every room laid out differently"


def test_the_middle_of_a_room_stays_walkable():
    """Copses go in corners: the middle is where the fight happens."""
    from mirrorbound.game.core.rng import DeterministicRNG
    from mirrorbound.game.dungeon.generation import DungeonGenerator

    for biome in ("grove", "ruins", "crypt"):
        run = DungeonGenerator(DeterministicRNG(4)).generate(room_count=4, biome=biome)
        for room in run.rooms:
            cx, cy = room.width / 2, room.height / 2
            blocking_in_middle = [
                d for d in room.decor
                if d.blocking and abs(d.x - cx) < room.width * 0.16 and abs(d.y - cy) < room.height * 0.16
            ]
            assert len(blocking_in_middle) <= 2, f"{biome} room {room.index} clogged its centre"


def test_a_treasure_room_announces_its_chest_opening():
    """The chest has eight drawn frames of a lid coming up and no interaction.

    Treasure bursts onto the floor the instant a room is first entered -- there
    is no "open the chest" action anywhere in the game -- so that burst *is*
    the moment the chest opens, and it has to be announced or the client has
    nothing to play the animation against.
    """
    from mirrorbound.game.core.events import EventBus
    from mirrorbound.game.state import GameState

    rooms = gen().rooms
    vault = next(r for r in rooms if any(kind == "chest" for kind, _ in r.treasure))
    state = GameState(rng=DeterministicRNG(11), bus=EventBus())
    state.room = vault
    state.spawn_room_treasure(vault)

    opened = [e for e in state.pending_events if e.type == "CHEST_OPENED"]
    assert len(opened) == 1, "one chest, one announcement"
    assert opened[0].data["room_id"] == vault.id
    assert "x" in opened[0].data["position"], "and where to play it"


def test_a_room_without_a_chest_announces_nothing():
    from mirrorbound.game.core.events import EventBus
    from mirrorbound.game.state import GameState

    rooms = gen().rooms
    plain = next(r for r in rooms if not any(kind == "chest" for kind, _ in r.treasure))
    state = GameState(rng=DeterministicRNG(11), bus=EventBus())
    state.room = plain
    state.spawn_room_treasure(plain)
    assert not [e for e in state.pending_events if e.type == "CHEST_OPENED"]
