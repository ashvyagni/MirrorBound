"""Deterministic obstacle-aware steering for AI, using the server's collision geometry.

Straight paths are free of search. Blocked paths use a four-neighbour grid with
stable tie-breaking; each actor keeps its route until its goal or room changes.
No RNG, wall clock, or client geometry participates.
"""
from heapq import heappop, heappush
from math import ceil

from mirrorbound.game.dungeon.room import Room, TILE
from mirrorbound.game.entities.entity import Entity, Vec2


def clear_segment(room: Room, start: Vec2, end: Vec2, radius: float) -> bool:
    """Whether an actor of `radius` can walk straight from `start` to `end`.

    Only the props whose blocks the segment passes through are tested. It used to
    walk the entire decor list, which is the single hottest loop in the
    simulation: the navigator calls this several times per steering decision and
    once per grid edge it considers, and a region has three hundred and forty
    props where a dungeon room has seventy.
    """
    if room.is_wall(end.x - radius, end.y - radius) or room.is_wall(end.x + radius, end.y + radius):
        return False
    delta = end - start
    length_sq = delta.dot(delta)
    near = room.blocking_near(
        min(start.x, end.x) - radius, min(start.y, end.y) - radius,
        max(start.x, end.x) + radius, max(start.y, end.y) + radius)
    for decor in near:
        centre = decor.collision_center
        fraction = max(0.0, min(1.0, (centre - start).dot(delta) / length_sq)) if length_sq else 0.0
        if (start + delta * fraction - centre).length() < decor.collision_radius + radius:
            return False
    return True


class Navigator:
    def __init__(self):
        self._room = None
        self._geometry = -1
        self._routes = {}
        self._grids = {}

    def velocity(self, room: Room, actor: Entity, goal: Vec2, speed: float) -> Vec2:
        goal = room.clamp(goal, actor.radius + 1)
        if clear_segment(room, actor.position, goal, actor.radius):
            self._routes.pop(actor.id, None)
            return (goal - actor.position).normalized() * speed
        # A cheap stand-in for the old full-geometry tuple, which was rebuilt over
        # every prop in the room on every steering call. Decor is appended while a
        # room is built and never moves afterwards, so its count is enough to
        # notice a room whose contents changed -- and the room identity catches
        # everything else.
        geometry = len(room.decor)
        if self._room is not room or geometry != self._geometry:
            self._room, self._geometry = room, geometry
            self._routes.clear()
            self._grids.clear()
        # A small clearance prevents rubbing on corners between grid centres.
        radius = actor.radius + 2
        if radius not in self._grids:
            self._grids[radius] = {
                (x, y): Vec2((x + .5) * TILE, (y + .5) * TILE)
                for y in range(1, ceil(room.height / TILE) - 1)
                for x in range(1, ceil(room.width / TILE) - 1)
                if not room.is_blocked(Vec2((x + .5) * TILE, (y + .5) * TILE), radius)
            }
        grid = self._grids[radius]
        if not grid:
            return Vec2()
        goal_cell = (int(goal.x // TILE), int(goal.y // TILE))
        cached = self._routes.get(actor.id)
        path = cached[1] if cached and cached[0] == goal_cell else []
        while path and (path[0] - actor.position).length() < 6:
            path.pop(0)
        if not path or not clear_segment(room, actor.position, path[0], actor.radius):
            path = self._search(room, grid, actor.position, goal, radius)
            self._routes[actor.id] = (goal_cell, path)
        # Smooth only through verified clearance; diagonals cannot cut corners.
        while len(path) > 1 and clear_segment(room, actor.position, path[1], radius):
            path.pop(0)
        if not path:
            return Vec2()
        return (path[0] - actor.position).normalized() * speed

    @staticmethod
    def _nearest_cell(grid, point: Vec2):
        """The walkable cell closest to a point, found by spiralling out from it.

        A sort -- or a `min` -- over the whole grid was fine on 1,200 cells and is
        not on 4,480: the profile had `_search` at 104 ms a call, most of it
        ordering every walkable cell in the region twice. The cell a point is in
        is arithmetic, and the answer is almost always that cell or one beside it,
        so the ring search exits on the first or second ring.

        Ties are broken by cell coordinate, exactly as the sort did, so routes
        stay deterministic.
        """
        cx, cy = int(point.x // TILE), int(point.y // TILE)
        if (cx, cy) in grid:
            return (cx, cy)
        for ring in range(1, 40):
            best, best_d = None, float("inf")
            for dy in range(-ring, ring + 1):
                for dx in range(-ring, ring + 1):
                    # Only the shell, so a cell is never considered twice.
                    if max(abs(dx), abs(dy)) != ring:
                        continue
                    cell = (cx + dx, cy + dy)
                    if cell not in grid:
                        continue
                    distance = (grid[cell] - point).length()
                    if distance < best_d or (distance == best_d and best is not None and cell < best):
                        best, best_d = cell, distance
            if best is not None:
                return best
        return None

    @classmethod
    def _search(cls, room, grid, start, goal, radius):
        # The walkable cells nearest the actor, in order, so the route can begin
        # somewhere it can actually reach. Twenty-five was the old window and is
        # kept: it is the number of cells in a two-ring neighbourhood.
        cx, cy = int(start.x // TILE), int(start.y // TILE)
        candidates = sorted(
            (cell for dy in range(-2, 3) for dx in range(-2, 3)
             if (cell := (cx + dx, cy + dy)) in grid),
            key=lambda cell: ((grid[cell] - start).length(), cell))
        first = next((cell for cell in candidates if clear_segment(room, start, grid[cell], radius - 2)), None)
        if first is None:
            # Nothing within two rings is reachable in a straight line; fall back
            # to the nearest walkable cell at all rather than giving up, which is
            # what the full sort used to do for free.
            first = cls._nearest_cell(grid, start)
        if first is None:
            return []
        target = cls._nearest_cell(grid, goal)
        if target is None:
            return []
        frontier = [(0.0, 0, first)]
        costs, parent = {first: 0}, {}
        best = first
        while frontier:
            _, cost, cell = heappop(frontier)
            if cost != costs[cell]:
                continue
            if (grid[cell] - goal).length() < (grid[best] - goal).length():
                best = cell
            if cell == target:
                best = cell
                break
            for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                nxt = (cell[0] + dx, cell[1] + dy)
                if nxt not in grid or cost + 1 >= costs.get(nxt, float('inf')):
                    continue
                if not clear_segment(room, grid[cell], grid[nxt], radius):
                    continue
                costs[nxt], parent[nxt] = cost + 1, cell
                heuristic = abs(nxt[0] - target[0]) + abs(nxt[1] - target[1])
                heappush(frontier, (cost + 1 + heuristic, cost + 1, nxt))
        cells = [best]
        while cells[-1] in parent:
            cells.append(parent[cells[-1]])
        return [grid[cell] for cell in reversed(cells)]
