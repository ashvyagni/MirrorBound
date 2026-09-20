import { describe, expect, it, vi } from 'vitest';

// The clip tables reach Phaser through `clips.ts`, which wants a canvas this
// environment has no reason to provide. Everything asserted below is data.
vi.mock('phaser', () => ({
  default: { Display: { Color: { HexStringToColor: () => ({ red: 0, green: 0, blue: 0 }) } } },
}));

const { ENEMY_ART, enemySheets, enemyStateKey } = await import('../src/game/animation/enemyClips');

type Family = keyof typeof ENEMY_ART;
const FAMILIES = Object.keys(ENEMY_ART) as Family[];

/**
 * The rule these tests exist for: **a sheet named in the table is a sheet the
 * loader fetches and the animation manager registers.**
 *
 * It was not true. `enemySheets` returned the four required states plus the
 * optional death, and silently dropped `hurt` and `slam` -- so the Warden's
 * flinch and its slam were drawn, sliced, listed in `ENEMY_ART`, and then
 * never downloaded. The view asked for animations that did not exist and
 * Phaser declined quietly, which is exactly the kind of failure nothing
 * reports.
 */
describe('enemy art tables', () => {
  it('fetches every sheet a family declares, optional ones included', () => {
    for (const family of FAMILIES) {
      const art = ENEMY_ART[family] as Record<string, { texture: string } | undefined>;
      const fetched = new Set(enemySheets(family).map((sheet) => sheet.texture));
      for (const state of ['idle', 'walk', 'alert', 'attack', 'hurt', 'slam', 'death']) {
        const sheet = art[state];
        if (!sheet) continue;
        expect(fetched, `${family}.${state} is declared but never loaded`).toContain(sheet.texture);
      }
    }
  });

  it('asks for each atlas once, however many states share it', () => {
    for (const family of FAMILIES) {
      const textures = enemySheets(family).map((sheet) => sheet.texture);
      expect(new Set(textures).size, `${family} would be fetched twice`).toBe(textures.length);
    }
  });

  it('gives two states on one sheet two different clips', () => {
    // The practice dummy is the case: one atlas, and it must still hold still
    // when idle and run the straw off when struck. Keying a clip by its
    // texture alone collapsed those onto one animation.
    const dummy = ENEMY_ART.dummy;
    expect(dummy.idle.texture).toBe(dummy.hurt!.texture);
    expect(enemyStateKey(dummy.idle, 'idle')).not.toBe(enemyStateKey(dummy.hurt!, 'hurt'));
  });

  it('every family still declares the four required states', () => {
    for (const family of FAMILIES) {
      const art = ENEMY_ART[family] as Record<string, unknown>;
      for (const state of ['idle', 'walk', 'alert', 'attack']) {
        expect(art[state], `${family} has no ${state}`).toBeTruthy();
      }
    }
  });
});
