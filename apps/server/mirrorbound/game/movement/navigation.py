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
    if room.is_wall(end.x - radius, end.y - radius) or room.is_wall(end.x + radius, end.y + radius):
        return False
    delta = end - start
    length_sq = delta.dot(delta)
    for decor in room.decor:
        if not decor.blocking:
            continue
        centre = decor.collision_center
        fraction = max(0.0, min(1.0, (centre - start).dot(delta) / length_sq)) if length_sq else 0.0
        if (start + delta * fraction - centre).length() < decor.collision_radius + radius:
            return False
    return True


class Navigator:
    def __init__(self):
        self._room = None
        self._geometry = ()
        self._routes = {}
        self._grids = {}

    def velocity(self, room: Room, actor: Entity, goal: Vec2, speed: float) -> Vec2:
        goal = room.clamp(goal, actor.radius + 1)
        if clear_segment(room, actor.position, goal, actor.radius):
            self._routes.pop(actor.id, None)
            return (goal - actor.position).normalized() * speed
        geometry = tuple((d.x, d.y, d.collision_radius, d.collision_center.y) for d in room.decor if d.blocking)
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
    def _search(room, grid, start, goal, radius):
        nearby = sorted(grid, key=lambda cell: ((grid[cell] - start).length(), cell))
        first = next((cell for cell in nearby[:25] if clear_segment(room, start, grid[cell], radius - 2)), None)
        if first is None:
            return []
        target = min(grid, key=lambda cell: ((grid[cell] - goal).length(), cell))
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
