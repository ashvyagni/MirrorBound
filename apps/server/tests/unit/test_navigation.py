import pytest

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import Decor, Room
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.movement.navigation import Navigator, clear_segment
from mirrorbound.game.dungeon.room import TILE
from mirrorbound.game.world.region import build_region


def travel(room, start, goal, actor_id='walker'):
    nav = Navigator()
    actor = Entity(actor_id, position=start.copy(), radius=14)
    trace = []
    for _ in range(900):
        if (actor.position - goal).length() < 12:
            break
        velocity = nav.velocity(room, actor, goal, 150)
        new = actor.position + velocity * (1 / 60)
        assert not room.is_blocked(new, actor.radius - .001)
        actor.position = new
        trace.append(actor.position.to_dict())
    return actor, trace


def test_routes_around_wall_of_props_with_repeatable_results():
    room = Room(decor=[Decor('rock', 600, y, blocking=True, radius=35) for y in range(240, 601, 60)])
    start, goal = Vec2(440, 400), Vec2(760, 400)
    assert not clear_segment(room, start, goal, 14)
    a, trace = travel(room, start, goal)
    b, replay = travel(room, start, goal)
    assert a.distance_to(b) == 0 and trace == replay
    assert (a.position - goal).length() < 12
    assert min(point['y'] for point in trace) < 210 or max(point['y'] for point in trace) > 630


def test_building_footprint_uses_scaled_foundation_and_wire_matches():
    building = Decor('hut_big', 500, 500, scale=1.1, blocking=True, radius=52)
    room = Room(decor=[building])
    wire = building.to_dict()
    assert wire['collisionRadius'] == 57.2
    assert wire['collisionY'] < building.y
    assert room.is_blocked(building.collision_center + Vec2(50, 0), 14)
    resolved = room.resolve_decor_collision(building.collision_center, 14)
    assert not room.is_blocked(resolved, 13.99)


@pytest.mark.parametrize('seed', [1, 5, 19, 42, 2024])
@pytest.mark.parametrize('area', ['hollowreach_vale', 'emberfall_basin'])
def test_everyone_in_a_settlement_stays_reachable_from_where_you_arrive(seed, area):
    """The village is authored now, so its own layout could seal someone in.

    Buildings go down from a fixed plan and the vendors are posted against them,
    which is what makes the place legible -- and also what makes it possible to
    put a forge between the player and the smith. Walked rather than measured:
    the navigator routes around the real collision geometry.
    """
    room = build_region(area, DeterministicRNG(seed), lambda _a: (True, "ok"))
    targets = [Vec2(n.x, n.y + 55) for n in room.npcs]
    assert targets, f"{area} has a settlement with people in it"
    for target in targets:
        actor, _ = travel(room, room.player_spawn, target)
        assert (actor.position - target).length() < 12, (seed, area, target, actor.position)


@pytest.mark.parametrize('seed', [1, 5, 19, 42, 2024])
@pytest.mark.parametrize('area', ['hollowreach_vale', 'wakewood', 'greenmoor',
                                  'drowned_flats', 'emberfall_basin', 'kiln_terraces'])
def test_every_crossing_out_of_a_region_can_be_walked_to(seed, area):
    """A region you can walk into and not out of is a stranded run.

    The boundary is a real barrier -- a river, a flood, a wall of rock -- with one
    narrow gap in it, and the props and the flood are both placed by seeded
    rejection sampling. This is the test that says the gap is still a gap.
    """
    room = build_region(area, DeterministicRNG(seed), lambda _a: (True, "ok"))
    assert room.doors, f"{area} has somewhere to go"
    inward = {"north": (0, 1), "south": (0, -1), "west": (1, 0), "east": (-1, 0)}
    for door in room.doors:
        # Aimed a little inside the boundary, not at the door's own centre: a
        # door sits in the wall ring by construction and the movement system
        # clamps the player to the interior, so the centre is a point nobody can
        # ever stand on. What has to be true is that the player can walk to
        # somewhere the crossing counts as reached.
        dx, dy = inward[door.side]
        goal = Vec2(door.x + dx * TILE * 1.5, door.y + dy * TILE * 1.5)
        actor, _ = travel(room, room.player_spawn, goal)
        assert door.contains(actor.position, actor.radius), (
            seed, area, door.side, door.target_area, actor.position)
