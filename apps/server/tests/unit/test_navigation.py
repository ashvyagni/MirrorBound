import pytest

from mirrorbound.game.core.rng import DeterministicRNG
from mirrorbound.game.dungeon.room import Decor, Room
from mirrorbound.game.entities.entity import Entity, Vec2
from mirrorbound.game.movement.navigation import Navigator, clear_segment
from mirrorbound.game.world.village import build_village


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
@pytest.mark.parametrize('area', ['hollow_reach', 'emberfall'])
def test_village_npcs_and_portals_remain_reachable_with_building_footprints(seed, area):
    room = build_village(area, DeterministicRNG(seed))
    targets = [Vec2(n.x, n.y + 55) for n in room.npcs]
    targets.extend(Vec2(p.x, p.y + 15) for p in room.portals)
    for target in targets:
        actor, _ = travel(room, room.player_spawn, target)
        assert (actor.position - target).length() < 12, (seed, area, target, actor.position)
