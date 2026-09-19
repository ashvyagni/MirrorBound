import { TILE } from '../constants';
import {
  TILE_DIRT, TILE_GRASS, TILE_PATH, TILE_WALL, TILE_WATER,
  type DecorSnap, type DoorSnap, type RoomFull, type Vec2,
} from '../contracts';

/**
 * A grove room, generated here instead of arriving from the server.
 *
 * A port of `dungeon/generation.py` on `main`, narrowed to the one biome this
 * branch needs and emitting the same `RoomFull` the renderer reads. The point
 * is that `WorldRenderer` cannot tell the difference: when the socket lands,
 * this file is deleted and the snapshot goes straight in.
 *
 * Kept faithful rather than tidied. The blotch radii, the S-bend, the edge
 * biases and the decor counts are the numbers `main` tunes against, and a room
 * that looks different here than it does there is worse than no room at all.
 */

/** How much floor a blocking prop actually occupies, from `room.py`. */
const BLOCKING_RADIUS: Record<string, number> = {
  tree: 22, tree_big: 30, rock: 18, rock_big: 26, pillar: 16,
  broken_pillar: 14, crate: 16, chest: 16, statue: 18, well: 24,
  brazier: 12, gravestone: 12, log: 20, torch: 0, bush: 0,
};

/**
 * Seeded, so a room is the same room every reload.
 *
 * Mulberry32 rather than `Math.random`: the Python side is deterministic from a
 * seed and this has to be too, or the same seed describes two different rooms
 * and the decor stops being something you can reason about.
 */
class Rng {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  float(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inclusive at both ends, matching Python's `randint`. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.float() * (hi - lo + 1));
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.float() * items.length)]!;
  }
}

export interface GroveRoom {
  room: RoomFull;
  playerSpawn: Vec2;
  /** Where a mob may stand: clear of the path, the props and the spawn. */
  enemySpawns: Vec2[];
}

const WIDTH = 1280;
const HEIGHT = 960;

export function buildGrove(seed = 1337): GroveRoom {
  const rng = new Rng(seed);
  const cols = Math.floor(WIDTH / TILE);
  const rows = Math.floor(HEIGHT / TILE);

  // --- floor --------------------------------------------------------------
  const tiles: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(TILE_GRASS));

  // Blotches of dirt grown from seeds, so the floor is not a flat colour.
  const blotches = Math.max(3, Math.floor((cols * rows) / 90));
  for (let i = 0; i < blotches; i += 1) {
    const cx = rng.int(2, cols - 3);
    const cy = rng.int(2, rows - 3);
    const radius = rng.int(1, 3);
    for (let y = Math.max(1, cy - radius); y < Math.min(rows - 1, cy + radius + 1); y += 1) {
      for (let x = Math.max(1, cx - radius); x < Math.min(cols - 1, cx + radius + 1); x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius && rng.chance(0.75)) {
          tiles[y]![x] = TILE_DIRT;
        }
      }
    }
  }

  // Walls occupy the outermost ring.
  for (let x = 0; x < cols; x += 1) {
    tiles[0]![x] = TILE_WALL;
    tiles[rows - 1]![x] = TILE_WALL;
  }
  for (let y = 0; y < rows; y += 1) {
    tiles[y]![0] = TILE_WALL;
    tiles[y]![cols - 1] = TILE_WALL;
  }

  // A worn path between the two doors, on a gentle S-bend, so the room reads
  // as travelled rather than as a box someone left props in.
  const midCol = Math.floor(cols / 2);
  for (let y = 1; y < rows - 1; y += 1) {
    const offset = Math.round(Math.sin((y / rows) * Math.PI * 2) * 1.5);
    for (const dx of [-1, 0]) {
      const x = midCol + offset + dx;
      if (x >= 1 && x < cols - 1) tiles[y]![x] = TILE_PATH;
    }
  }

  const decor: DecorSnap[] = [];

  // --- pond ---------------------------------------------------------------
  const side = rng.pick([-1, 1]);
  const pondX = midCol + side * rng.int(9, 13);
  const pondY = rng.int(Math.floor(rows / 3), Math.floor(rows / 2));
  const rx = rng.int(2, 3);
  const ry = rng.int(1, 2);
  for (let y = pondY - ry; y <= pondY + ry; y += 1) {
    for (let x = pondX - rx; x <= pondX + rx; x += 1) {
      if (x > 1 && x < cols - 2 && y > 1 && y < rows - 2) {
        if (((x - pondX) / (rx + 0.5)) ** 2 + ((y - pondY) / (ry + 0.5)) ** 2 <= 1) {
          tiles[y]![x] = TILE_WATER;
        }
      }
    }
  }
  // Water blocks movement, so it is decor as well as floor -- one circle for
  // the whole pond rather than one per tile.
  decor.push({
    kind: 'pond', x: (pondX + 0.5) * TILE, y: (pondY + 0.5) * TILE,
    variant: 0, scale: 1, blocking: true, radius: Math.min(rx, ry) * TILE + 10, flip: false,
  });

  // --- doors and spawns ---------------------------------------------------
  const doors: DoorSnap[] = [
    { side: 'south', x: WIDTH / 2, y: HEIGHT - TILE / 2, width: TILE * 3, targetIndex: null, locked: false, kind: 'arch' },
    { side: 'north', x: WIDTH / 2, y: TILE / 2, width: TILE * 3, targetIndex: 1, locked: false, kind: 'gate' },
  ];
  const playerSpawn: Vec2 = { x: WIDTH / 2, y: HEIGHT - TILE * 3.2 };

  // Four standing positions, spread across the room's upper two thirds -- far
  // enough from the door you walk in through to be seen before they matter.
  const enemySpawns: Vec2[] = [
    { x: WIDTH * 0.28, y: HEIGHT * 0.30 },
    { x: WIDTH * 0.70, y: HEIGHT * 0.26 },
    { x: WIDTH * 0.50, y: HEIGHT * 0.46 },
    { x: WIDTH * 0.76, y: HEIGHT * 0.58 },
  ];

  // --- decoration ---------------------------------------------------------
  const reserved: Array<{ p: Vec2; r: number }> = [
    { p: playerSpawn, r: 110 },
    ...enemySpawns.map((p) => ({ p, r: 90 })),
    ...doors.map((d) => ({ p: { x: d.x, y: d.y }, r: 120 })),
  ];

  const tileAt = (x: number, y: number): number => {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (row < 0 || row >= rows || col < 0 || col >= cols) return TILE_WALL;
    return tiles[row]![col]!;
  };
  const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

  /** Nothing stands on the path, in the pond, in a wall, or on anything else. */
  const free = (pos: Vec2, radius: number): boolean => {
    if (tileAt(pos.x - radius, pos.y - radius) === TILE_WALL) return false;
    if (tileAt(pos.x + radius, pos.y + radius) === TILE_WALL) return false;
    const here = tileAt(pos.x, pos.y);
    if (here === TILE_PATH || here === TILE_WATER) return false;
    for (const { p, r } of reserved) if (dist(pos, p) < r + radius) return false;
    for (const d of decor) {
      if (dist(pos, { x: d.x, y: d.y }) < (d.blocking ? d.radius : 14) + radius + 6) return false;
    }
    return true;
  };

  function scatter(
    kind: string, count: number, blocking: boolean,
    variants = 3, scaleRange: [number, number] = [0.85, 1.2], edgeBias = 0,
  ): void {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 12) {
      attempts += 1;
      let x: number;
      let y: number;
      // Trees and pillars frame a room rather than fill it, so most of them are
      // thrown at the walls and only the remainder land in the open middle.
      if (edgeBias > 0 && rng.chance(edgeBias)) {
        if (rng.chance(0.5)) {
          x = rng.chance(0.5) ? rng.int(TILE + 20, TILE * 4) : rng.int(WIDTH - TILE * 4, WIDTH - TILE - 20);
          y = rng.int(TILE + 20, HEIGHT - TILE - 20);
        } else {
          x = rng.int(TILE + 20, WIDTH - TILE - 20);
          y = rng.chance(0.5) ? rng.int(TILE + 20, TILE * 4) : rng.int(HEIGHT - TILE * 4, HEIGHT - TILE - 20);
        }
      } else {
        x = rng.int(TILE + 20, WIDTH - TILE - 20);
        y = rng.int(TILE + 20, HEIGHT - TILE - 20);
      }

      const scale = scaleRange[0] + rng.float() * (scaleRange[1] - scaleRange[0]);
      const radius = blocking ? (BLOCKING_RADIUS[kind] ?? 14) * scale : 0;
      const pos = { x, y };
      if (!free(pos, Math.max(radius, 14))) continue;

      decor.push({
        kind, x, y,
        variant: rng.int(0, variants - 1),
        scale, blocking, radius, flip: rng.chance(0.5),
      });
      placed += 1;
    }
  }

  // Counts and densities from the ENTRANCE template: a clearing, so heavier on
  // trees and flora than a fighting room and lighter on rock.
  const area = (WIDTH * HEIGHT) / (1280 * 960);
  const treeDensity = 1.4;
  const rockDensity = 0.6;
  const floraDensity = 1.6;

  scatter('tree_big', Math.floor(3 * area * treeDensity), true, 2, [0.9, 1.25], 0.85);
  scatter('tree', Math.floor(7 * area * treeDensity), true, 3, [0.8, 1.15], 0.7);
  scatter('bush', Math.floor(8 * area * floraDensity), false, 3);
  scatter('rock', Math.floor(4 * area * rockDensity), true, 3);
  scatter('log', Math.floor(1 * area), true, 1);
  scatter('flowers', Math.floor(14 * area * floraDensity), false, 4, [0.7, 1.1]);
  scatter('grass_tuft', Math.floor(26 * area * floraDensity), false, 3, [0.7, 1.2]);
  scatter('mushrooms', Math.floor(4 * area * floraDensity), false, 2);

  const room: RoomFull = {
    id: 'grove-0',
    index: 0,
    roomType: 'entrance',
    name: 'Wakewood Clearing',
    biome: 'grove',
    width: WIDTH,
    height: HEIGHT,
    tileSize: TILE,
    tiles,
    decor,
    doors,
    cleared: false,
    seed,
  };

  return { room, playerSpawn, enemySpawns };
}

/** Everything a mob or the player must walk around. */
export function blockers(room: RoomFull): Array<{ x: number; y: number; r: number }> {
  return room.decor
    .filter((d) => d.blocking && d.radius > 0)
    .map((d) => ({ x: d.x, y: d.y, r: d.radius }));
}

export { TILE_WALL };
