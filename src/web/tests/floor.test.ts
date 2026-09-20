import { describe, expect, it, vi } from 'vitest';

// `floor.ts` reaches the real Phaser through `paint.ts`, which wants a canvas
// this environment has no reason to provide. The variant picker below is pure
// integer arithmetic and touches none of it.
vi.mock('phaser', () => ({
  default: { Display: { Color: { HexStringToColor: () => ({ red: 0, green: 0, blue: 0 }) } } },
}));

const { tileVariant } = await import('../src/game/world/floor');

/**
 * The floor's variant picker, which is the thing that decides whether a room
 * reads as ground or as a grid of stamps.
 *
 * What is tested here is a *statistical* property rather than any particular
 * cell's value, because the bug this replaced was invisible cell by cell. The
 * old picker was `(x * 7 + y * 13 + seed) % 3`, and 7 and 13 are both 1 mod 3 --
 * so it collapsed to `(x + y + seed) % 3`, which steps by exactly one every
 * time you move right or down. Every cell differed from its neighbour, always,
 * in the same order: diagonal corduroy across the whole floor.
 */
describe('tileVariant', () => {
  const SEED = 2770889388;
  const SPAN = 120;

  function survey(count = 3) {
    const hist = new Array<number>(count).fill(0);
    let matchesLeft = 0;
    let matchesDiagonal = 0;
    let cells = 0;
    for (let y = 1; y < SPAN; y++) {
      for (let x = 1; x < SPAN; x++) {
        const v = tileVariant(x, y, SEED, count);
        hist[v] = (hist[v] ?? 0) + 1;
        if (v === tileVariant(x - 1, y, SEED, count)) matchesLeft++;
        if (v === tileVariant(x - 1, y - 1, SEED, count)) matchesDiagonal++;
        cells++;
      }
    }
    return { hist, left: matchesLeft / cells, diagonal: matchesDiagonal / cells };
  }

  it('is in range, and uses every variant about equally', () => {
    const { hist } = survey(3);
    expect(hist).toHaveLength(3);
    for (const n of hist) expect(n / (119 * 119)).toBeGreaterThan(0.3);
    for (const n of hist) expect(n / (119 * 119)).toBeLessThan(0.37);
  });

  it('does not lay down a pattern: neighbours agree as often as chance', () => {
    const { left, diagonal } = survey(3);
    // A strict cycle scores 0 here -- never the same twice in a row is just as
    // much a pattern as always the same. Scatter scores 1/3.
    expect(left).toBeGreaterThan(0.28);
    expect(left).toBeLessThan(0.39);
    expect(diagonal).toBeGreaterThan(0.28);
    expect(diagonal).toBeLessThan(0.39);
  });

  it('is stable: the same cell and seed always give the same variant', () => {
    expect(tileVariant(7, 11, SEED)).toBe(tileVariant(7, 11, SEED));
    expect(tileVariant(7, 11, SEED)).not.toBe(tileVariant(7, 11, SEED + 1));
  });

  it('honours a variant count other than three', () => {
    for (let x = 0; x < 50; x++) {
      expect(tileVariant(x, 3, SEED, 2)).toBeLessThan(2);
    }
  });
});
