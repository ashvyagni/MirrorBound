"""People with somewhere to be.

§4 asks for villages that are not static level hubs, and is explicit about the
budget: "do not build an unnecessarily expensive simulation -- prioritize the
illusion of life". So this is not a schedule system, a needs model or an economy.
It is a handful of people walking between a handful of places, and the illusion
comes from *where* they walk rather than from how they decide to.

Deliberately separate from `Npc`. A vendor is someone you walk up to and talk to,
and a smith who wanders off mid-conversation is worse than a smith who stands at
his forge -- so the people with dialogue stay put and are drawn as decor, while
these have no dialogue, no shop and no collision, and exist to be seen in the
middle distance doing something.

Deterministic like everything else in `game/`: routes are authored per role, and
the update is arithmetic on a fixed timestep with no RNG in it at all.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from mirrorbound.game.entities.entity import Vec2

#: How close counts as arrived. Generous, so nobody jitters on a waypoint.
ARRIVED = 10.0

#: A walking pace. Slower than the player on purpose: villagers going about their
#: day should never look like they are hurrying somewhere, and a person moving at
#: the player's speed reads as another adventurer.
WALK_SPEED = 42.0


@dataclass(frozen=True)
class Routine:
    """What one kind of villager does, as a round of places and pauses.

    Stops are offsets from the settlement's centre in world units, so one routine
    works in any village. The loop is closed -- after the last stop they walk back
    to the first -- because a round trip is what makes it read as a day rather
    than as a character walking off the map.
    """
    role: str
    stops: tuple[tuple[float, float], ...]
    #: Seconds paused at each stop. This is most of the illusion: someone who
    #: never stops is patrolling, and someone who stops is working.
    dwell: float = 3.0
    speed: float = WALK_SPEED
    #: Which villager sheet to draw them with, 0-3.
    sprite: int = 0


#: The people a village has, and the shape of their day.
#:
#: Each one exists to say something about how the place works, which is what §3
#: asks placement to communicate. The farmer goes out to the fields and comes
#: back; the carter shuttles between the stall and the road, because goods arrive
#: from somewhere; the guard walks the entrance, because the village has one; the
#: children stay on the green, because that is where children are.
ROUTINES: tuple[Routine, ...] = (
    Routine("farmer", ((-330.0, 250.0), (-120.0, 330.0), (-60.0, 120.0)), dwell=5.0, sprite=0),
    Routine("carter", ((215.0, 60.0), (330.0, -160.0), (60.0, -210.0)), dwell=3.5, sprite=1),
    Routine("guard", ((0.0, 330.0), (240.0, 300.0), (0.0, 330.0), (-240.0, 300.0)), dwell=6.0,
            speed=34.0, sprite=2),
    Routine("child", ((-70.0, 40.0), (80.0, 90.0), (30.0, -60.0), (-110.0, -20.0)), dwell=1.2,
            speed=58.0, sprite=3),
    Routine("gatherer", ((-260.0, -120.0), (-340.0, 60.0), (-150.0, 200.0)), dwell=4.0, sprite=1),
    Routine("smith_hand", ((-210.0, 40.0), (-60.0, 150.0), (-210.0, 40.0)), dwell=4.5, sprite=2),
)


@dataclass
class Villager:
    """One person, walking their round."""
    id: str
    role: str
    sprite: int
    position: Vec2
    route: list[Vec2]
    speed: float
    dwell: float
    leg: int = 0
    waiting: float = 0.0
    facing: Vec2 = field(default_factory=lambda: Vec2(0.0, 1.0))

    @property
    def target(self) -> Vec2:
        return self.route[self.leg]

    def update(self, dt: float) -> None:
        """Walk toward the current stop, pause on arrival, then take the next.

        No pathfinding. The routes are authored inside the village, where the
        ground is open by construction, and a villager who clips the corner of a
        hut is a villager nobody looks at twice -- where one who stops dead
        against it is the thing that breaks the illusion. They do not collide
        with anything for the same reason: they are scenery that moves.
        """
        if self.waiting > 0.0:
            self.waiting = max(0.0, self.waiting - dt)
            return
        to_target = self.target - self.position
        distance = to_target.length()
        if distance <= ARRIVED:
            self.leg = (self.leg + 1) % len(self.route)
            self.waiting = self.dwell
            return
        step = to_target.normalized()
        self.facing = step
        self.position = self.position + step * min(self.speed * dt, distance)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "role": self.role,
            "sprite": self.sprite,
            "position": {"x": round(self.position.x, 1), "y": round(self.position.y, 1)},
            "facing": {"x": round(self.facing.x, 2), "y": round(self.facing.y, 2)},
            # So the client can tell someone at work from someone on their way,
            # and stop their walk cycle when they stop.
            "moving": self.waiting <= 0.0,
        }


def populate(settlement, room, count: int | None = None) -> list[Villager]:
    """Put a village's people on their rounds.

    `room` is used only to keep a stop inside the map and out of water -- a
    routine authored at ±330 units is fine in the middle of a region and reaches
    off the edge of a small one.
    """
    people: list[Villager] = []
    routines = ROUTINES if count is None else ROUTINES[:count]
    for index, routine in enumerate(routines):
        stops = [_reachable(room, Vec2(settlement.x + ox, settlement.y + oy)) for ox, oy in routine.stops]
        people.append(Villager(
            id=f"{settlement.id}_villager_{index}",
            role=routine.role,
            sprite=routine.sprite,
            # Started at their first stop, and staggered through their round, so
            # a village does not look like six people setting off at once.
            position=stops[index % len(stops)].copy(),
            route=stops,
            speed=routine.speed,
            dwell=routine.dwell,
            leg=(index + 1) % len(stops),
            waiting=routine.dwell * (index / max(1, len(routines))),
        ))
    return people


def _reachable(room, point: Vec2) -> Vec2:
    """Keep a stop on dry land inside the room."""
    from mirrorbound.game.dungeon.room import TILE, T_WATER

    point = room.clamp(point, TILE)
    if room.tile_at(point.x, point.y) != T_WATER:
        return point
    for step in range(1, 8):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            probe = room.clamp(Vec2(point.x + dx * TILE * step, point.y + dy * TILE * step), TILE)
            if room.tile_at(probe.x, probe.y) != T_WATER:
                return probe
    return point


def update_all(villagers: list[Villager], dt: float) -> None:
    for villager in villagers:
        villager.update(dt)


__all__ = ["Villager", "Routine", "ROUTINES", "populate", "update_all", "WALK_SPEED"]
