/**
 * How the ground is composed, once the individual tiles have been painted.
 *
 * `TextureFactory` draws one 32px tile per material and variant. Laying those
 * down edge to edge is what a tilemap does, and it is also what makes a floor
 * read as a grid of stamps rather than as ground. Three things fix that, and
 * all three happen here rather than inside the tile art, because none of them
 * can be seen from inside a single tile:
 *
 *  - **which variant a cell takes**, which has to look scattered;
 *  - **what happens where two materials meet**, which has to not be a straight
 *    line;
 *  - **variation at a scale larger than one tile**, which is what stops a big
 *    room reading as uniform even when every tile in it is subtly different.
 *
 * Everything is seeded off the room, so a floor looks the same on every reload
 * and for every player -- the same rule the rest of the art follows.
 */

import { BIOMES, TILE, type BiomeName } from '../constants';
import { rgba, seeded, shade, type Ctx } from './paint';
import { T } from './TextureFactory';

/**
 * Which variant a cell takes.
 *
 * The obvious `(x * 7 + y * 13 + seed) % 3` is not random at all: 7 and 13 are
 * both 1 mod 3, so it collapses to `(x + y) % 3` and paints the entire floor in
 * diagonal stripes one tile wide. It is invisible while you are looking at one
 * tile and unmissable once the room is on screen.
 *
 * This is an integer hash instead -- the bits are mixed before the modulo, so
 * neighbouring cells land on unrelated variants.
 */
export function tileVariant(x: number, y: number, seed: number, count = 3): number {
  let h = (x * 0x27d4eb2d) ^ (y * 0x165667b1) ^ (seed * 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2d);
  return ((h ^ (h >>> 16)) >>> 0) % count;
}

/**
 * Which material creeps over which where they meet.
 *
 * Ground does not change material along a ruled line. Grass grows over the lip
 * of a path; loose earth spills onto flagstones; nothing grows out over water.
 * So the looser material is given the higher rank and is the one that fringes
 * onto its neighbour, which is both how it looks outdoors and the cheapest way
 * to destroy a straight edge.
 */
const RANK: Record<number, number> = {
  [T.GRASS]: 3,
  [T.DIRT]: 2,
  [T.PATH]: 1,
  [T.STONE]: 1,
  [T.WATER]: 0,
  [T.WALL]: 0,
};

/** The two tones a material fringes with: its own body colour and its shadow. */
function fringeTones(biome: BiomeName, tile: number): [string, string] {
  const b = BIOMES[biome];
  switch (tile) {
    case T.DIRT: return [b.dirt, shade(b.dirt, 0.78)];
    case T.PATH: return [b.path, shade(b.path, 0.8)];
    case T.STONE: return [b.stone, shade(b.stone, 0.8)];
    default: return [b.grass[0] ?? '#4b7944', b.grassDark];
  }
}

/** The four neighbours, as (dx, dy) and the direction index the seed uses. */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/**
 * Break every boundary between two different materials.
 *
 * For each cell, each neighbour of a lower rank gets a handful of small blobs
 * of this cell's material scattered along the shared edge and pushed a little
 * way over it. They are drawn under nothing and over the base pass, so the
 * result is an edge that wanders by a few pixels instead of turning a corner at
 * exactly 32.
 *
 * Deliberately blobs rather than an alpha gradient: the house idiom is painted
 * shapes with hard-ish edges, and a feathered fade reads as blur -- which is
 * the one thing that would make this look like a filter rather than like art.
 */
export function featherEdges(
  ctx: Ctx, tiles: readonly (readonly number[])[], biome: BiomeName, seed: number,
): void {
  const rows = tiles.length;
  const cols = tiles[0]?.length ?? 0;
  ctx.save();
  for (let y = 0; y < rows; y++) {
    const row = tiles[y];
    if (!row) continue;
    for (let x = 0; x < cols; x++) {
      const here = row[x] ?? T.GRASS;
      const rank = RANK[here] ?? 0;
      if (rank === 0) continue;
      const [body, dark] = fringeTones(biome, here);

      for (let d = 0; d < NEIGHBOURS.length; d++) {
        const [dx, dy] = NEIGHBOURS[d]!;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const there = tiles[ny]?.[nx] ?? T.GRASS;
        if (there === here || (RANK[there] ?? 0) >= rank) continue;

        // One stream per edge, so an edge looks the same however the floor is
        // walked -- and two neighbouring edges never share a pattern.
        const rng = seeded((x * 73856093) ^ (y * 19349663) ^ (d * 83492791) ^ seed);
        const count = 5 + Math.floor(rng() * 4);
        for (let i = 0; i < count; i++) {
          // Along the shared edge, then a little way across it.
          const along = (i + rng() * 0.8) / count;
          const over = 0.12 + rng() * 0.42;
          const cx = (x + 0.5 + dx * (0.5 + over) + (dy !== 0 ? (along - 0.5) : 0)) * TILE;
          const cy = (y + 0.5 + dy * (0.5 + over) + (dx !== 0 ? (along - 0.5) : 0)) * TILE;
          const r = 4 + rng() * 5;
          ctx.globalAlpha = 0.85 - over * 0.9;
          ctx.fillStyle = rng() < 0.3 ? dark : body;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * (0.6 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
}

/**
 * Slow, large-scale light and shade over the whole floor.
 *
 * Every tile already differs from its neighbours, and a big room still reads as
 * flat, because all that variation lives at one frequency -- 32 pixels. Real
 * ground varies at every scale: a damp hollow here, a sun-bleached stretch
 * there, both many tiles across.
 *
 * This lays a handful of very large, very soft patches of darker and lighter
 * tone over the finished floor. Alpha is kept low enough that no individual
 * patch is findable; what you notice is only that the floor stopped being even.
 */
export function mottle(ctx: Ctx, width: number, height: number, biome: BiomeName, seed: number): void {
  const b = BIOMES[biome];
  const rng = seeded((seed ^ 0x5bf03635) >>> 0);
  // Scaled to area rather than fixed, so a corridor is not as busy as a hall.
  const patches = Math.round((width * height) / (420 * 420)) + 3;
  ctx.save();
  for (let i = 0; i < patches; i++) {
    const cx = rng() * width;
    const cy = rng() * height;
    const r = Math.min(width, height) * (0.18 + rng() * 0.3);
    const light = rng() < 0.45;
    const colour = light ? b.grassLight : b.wall;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(colour, light ? 0.1 : 0.16));
    g.addColorStop(1, rgba(colour, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * (0.6 + rng() * 0.7), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
