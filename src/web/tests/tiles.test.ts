import { describe, expect, it, vi } from 'vitest';

// `TextureFactory` reaches Phaser through `paint.ts`, which wants a canvas.
// Everything asserted here is the key arithmetic, which touches none of it.
vi.mock('phaser', () => ({
  default: { Display: { Color: { HexStringToColor: () => ({ red: 0, green: 0, blue: 0 }) } } },
}));

const { T, TextureFactory } = await import('../src/game/world/TextureFactory');
const { TILES_FRAMES, TILES_SIZE, TILES_TEXTURE_KEY } =
  await import('../src/game/animation/tilesAtlas.generated');
const { TILE } = await import('../src/game/constants');

/**
 * The drawn floor and the painted one have to be interchangeable.
 *
 * `TextureFactory` slices a biome's tile sheet into canvas textures named
 * exactly the way the painted ones are named, which is what lets the renderer,
 * the edge fringing and the water ripples all stay ignorant of which they got.
 * That agreement is a string transform in one place and a `switch` in another,
 * so it is worth holding down.
 */
const BIOMES = ['grove', 'ruins', 'crypt'] as const;

/** The same transform `#sliceTiles` applies: `grass0` -> `grass:0`. */
function keyFor(biome: string, frame: string): string {
  return `tile:${biome}:${frame.replace(/(\d)$/, ':$1')}`;
}

describe('drawn floor tiles', () => {
  it('covers every key the renderer can ask for', () => {
    const made = new Set(BIOMES.flatMap((b) => TILES_FRAMES.map((f) => keyFor(b, f))));
    for (const biome of BIOMES) {
      for (const tile of Object.values(T)) {
        // Variants beyond each tile's own count wrap, so ten is well past the
        // widest family and proves the wrap lands somewhere real.
        for (let variant = 0; variant < 10; variant++) {
          const key = TextureFactory.tileKey(biome, tile, variant);
          if (tile === T.WALL) continue;   // the wall tile is the room border, drawn separately
          expect(made, `${key} has no drawn tile`).toContain(key);
        }
      }
    }
  });

  it('draws tiles at exactly the world grid size', () => {
    // `drawFrame` does not resample, so a frame of any other size would not
    // line up with the floor grid at all.
    expect(TILES_SIZE).toBe(TILE);
  });

  it('has a sheet for every biome the renderer draws floors for', () => {
    for (const biome of BIOMES) expect(TILES_TEXTURE_KEY[biome]).toBeTruthy();
  });

  it('carries the twelve tiles the floor is built from', () => {
    expect(TILES_FRAMES).toHaveLength(12);
    expect(TILES_FRAMES).toContain('water');
    expect(TILES_FRAMES).toContain('wall');
    // Three grass, two dirt, two path, three stone: the counts `tileKey`
    // takes its modulo against.
    expect(TILES_FRAMES.filter((f) => f.startsWith('grass'))).toHaveLength(3);
    expect(TILES_FRAMES.filter((f) => f.startsWith('dirt'))).toHaveLength(2);
    expect(TILES_FRAMES.filter((f) => f.startsWith('path'))).toHaveLength(2);
    expect(TILES_FRAMES.filter((f) => f.startsWith('stone'))).toHaveLength(3);
  });
});

/**
 * Sheet 85 ended the borrowing. Nothing should quietly start again.
 */
describe('ability icons', () => {
  it('gives every ability its own mark', async () => {
    const { abilityIcon, BORROWED_ICONS } = await import('../src/game/animation/abilityIcons');
    const { ABILITYICONS_TEXTURE_KEY } = await import('../src/game/animation/abilityIconsAtlas.generated');

    expect(BORROWED_ICONS).toEqual([]);
    // The four that had no art of their own until sheet 85.
    for (const id of ['arcane_bolt', 'shadow_dash', 'mending_light', 'aegis']) {
      const art = abilityIcon(id);
      expect(art.texture, `${id} is still borrowing`).toBe(ABILITYICONS_TEXTURE_KEY);
      expect(art.frame).toBe(id);
    }
  });

  it('leaves the six spells on the sheet drawn for them', async () => {
    const { abilityIcon } = await import('../src/game/animation/abilityIcons');
    const { ICONS_TEXTURE_KEY } = await import('../src/game/animation/iconsAtlas.generated');
    for (const id of ['ember_bolt', 'flame_burst', 'flame_pillar', 'frost_bolt', 'binding_nova']) {
      expect(abilityIcon(id).texture).toBe(ICONS_TEXTURE_KEY);
    }
  });

  it('falls back to a plain mark rather than an empty socket', async () => {
    const { abilityIcon } = await import('../src/game/animation/abilityIcons');
    expect(abilityIcon('an_ability_added_later').frame).toBe('sword');
  });
});

/**
 * Sheet 87's portraits are the villagers, not six strangers.
 */
describe('speaker portraits', () => {
  it('names a frame for every speaker the dialogue can ask for', async () => {
    const { SPEAKERS_FRAMES } = await import('../src/game/animation/speakersAtlas.generated');
    const frames = [...SPEAKERS_FRAMES.a, ...SPEAKERS_FRAMES.b];
    // The ids the server sends, plus the fallback any unnamed speaker uses.
    for (const id of ['elder_mara', 'smith_oren', 'apothecary_siv', 'hearth', 'twin', 'villager']) {
      expect(frames, `no portrait for ${id}`).toContain(id);
    }
  });
});
