import type Phaser from 'phaser';

import { BUILDINGS_TEXTURE_KEY } from '../animation/buildingsAtlas.generated';
import { CHEST_FRAMES, CHEST_TEXTURE_KEY } from '../animation/chestAtlas.generated';
import { TILES_TEXTURE_KEY } from '../animation/tilesAtlas.generated';
import { CRYPT_TEXTURE_KEY } from '../animation/cryptAtlas.generated';
import { CRYPTPROPS_TEXTURE_KEY } from '../animation/cryptPropsAtlas.generated';
import { GROVEPROPS_TEXTURE_KEY } from '../animation/grovePropsAtlas.generated';
import { RUINSPROPS_TEXTURE_KEY } from '../animation/ruinsPropsAtlas.generated';
import { DOORS_TEXTURE_KEY } from '../animation/doorsAtlas.generated';
import { FLORA_TEXTURE_KEY } from '../animation/floraAtlas.generated';
import { GROUNDCOVER_TEXTURE_KEY } from '../animation/groundcoverAtlas.generated';
import { LIGHTS_TEXTURE_KEY } from '../animation/lightsAtlas.generated';
import { RUINS_TEXTURE_KEY } from '../animation/ruinsAtlas.generated';
import { STONE_TEXTURE_KEY } from '../animation/stoneAtlas.generated';
import { VILLAGERS_TEXTURE_KEY } from '../animation/villagersAtlas.generated';
import { VILLAGERSSIDE_TEXTURE_KEY } from '../animation/villagersSideAtlas.generated';

/**
 * Drawn world art, by the decor kind the server sends.
 *
 * Every one of these was a few dozen lines of Canvas2D in `PropPainter.ts` --
 * ellipses, polygons and seeded speckle, painted at runtime. That still works
 * and is still the fallback, but it was the one part of the game that did not
 * look drawn by the same hand as the goat.
 *
 * Two things here are not replacements at all. `hut`, `hut_big`, `forge`,
 * `stall` and `banner` are what `village.py` has been placing since villages
 * existed, and the client had no texture for any of them, so `#textureFor`
 * returned null and the loop skipped them without a word -- every village was
 * an empty field with a crossroads painted on it. The same was true of every
 * NPC, which is why you could not walk up to anybody: there was nothing drawn
 * to walk up to.
 */

interface Art {
  texture: string;
  /** Frame stem; the variant index is appended. */
  stem: string;
  /** How many variants the sheet actually holds. */
  variants: number;
  /**
   * Drawn height in world units.
   *
   * This is the number that matters, and leaving it out is what made a crate
   * bigger than a house. Every frame on these sheets is around 190 pixels tall
   * because that is what a 384px cell downscaled by a half comes to -- it says
   * nothing about how big the thing is. A crate is 36 units and a big tree is
   * 150, and without that stated somewhere they all draw the same size.
   *
   * The values are `PropPainter.ts`'s canvas sizes verbatim, which are what the
   * world was built and balanced around: a tree 104, a bush 34, a rock 30. The
   * five village buildings and the people had no painted size to inherit, so
   * theirs are set against the player, who is 76.
   */
  height: number;
}

const ART: Readonly<Record<string, Art>> = {
  // Flora.
  tree: { texture: FLORA_TEXTURE_KEY, stem: 'tree', variants: 3, height: 104 },
  tree_big: { texture: FLORA_TEXTURE_KEY, stem: 'treeBig', variants: 2, height: 150 },
  bush: { texture: FLORA_TEXTURE_KEY, stem: 'bush', variants: 3, height: 34 },

  // Ground cover.
  flowers: { texture: GROUNDCOVER_TEXTURE_KEY, stem: 'flowers', variants: 4, height: 20 },
  grass_tuft: { texture: GROUNDCOVER_TEXTURE_KEY, stem: 'grassTuft', variants: 3, height: 20 },
  log: { texture: GROUNDCOVER_TEXTURE_KEY, stem: 'log', variants: 1, height: 26 },

  // Stone.
  rock: { texture: STONE_TEXTURE_KEY, stem: 'rock', variants: 3, height: 30 },
  rock_big: { texture: STONE_TEXTURE_KEY, stem: 'rockBig', variants: 2, height: 50 },
  rubble: { texture: STONE_TEXTURE_KEY, stem: 'rubble', variants: 3, height: 22 },

  // Ruins.
  pillar: { texture: RUINS_TEXTURE_KEY, stem: 'pillar', variants: 2, height: 118 },
  broken_pillar: { texture: RUINS_TEXTURE_KEY, stem: 'brokenPillar', variants: 2, height: 64 },
  statue: { texture: RUINS_TEXTURE_KEY, stem: 'statue', variants: 1, height: 108 },
  well: { texture: RUINS_TEXTURE_KEY, stem: 'well', variants: 1, height: 60 },
  crate: { texture: RUINS_TEXTURE_KEY, stem: 'crate', variants: 2, height: 36 },

  // Grove clutter. The grove used to dress every room from three trees, three
  // bushes and three rocks, which is most of why its rooms read as one room.
  fallen_trunk: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'fallenTrunk', variants: 1, height: 30 },
  stump: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'stump', variants: 1, height: 28 },
  berry_bush: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'berryBush', variants: 1, height: 34 },
  reeds: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'reeds', variants: 1, height: 46 },
  fern_clump: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'fernClump', variants: 1, height: 30 },
  moss_rock: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'mossRock', variants: 1, height: 30 },
  fence_post: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'fencePost', variants: 1, height: 52 },
  cart_wheel: { texture: GROVEPROPS_TEXTURE_KEY, stem: 'cartWheel', variants: 1, height: 42 },

  // More ruined stonework.
  arch_broken: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'archBroken', variants: 1, height: 110 },
  column_fallen: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'columnFallen', variants: 1, height: 34 },
  stone_bench: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'stoneBench', variants: 1, height: 34 },
  urn_cracked: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'urnCracked', variants: 1, height: 48 },
  stair_fragment: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'stairFragment', variants: 1, height: 44 },
  rune_stone: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'runeStone', variants: 1, height: 72 },
  sarcophagus: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'sarcophagus', variants: 1, height: 44 },
  bannered_rubble: { texture: RUINSPROPS_TEXTURE_KEY, stem: 'banneredRubble', variants: 1, height: 40 },

  // More crypt dressing. The candles are drawn cold; the game lights them.
  bone_pile: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'bonePile', variants: 1, height: 26 },
  skull_stack: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'skullStack', variants: 1, height: 34 },
  cobweb: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'cobweb', variants: 1, height: 40 },
  hanging_chain: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'hangingChain', variants: 1, height: 66 },
  coffin_cracked: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'coffinCracked', variants: 1, height: 78 },
  candle_cluster: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'candleCluster', variants: 1, height: 24 },
  iron_cage: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'ironCage', variants: 1, height: 52 },
  root_intrusion: { texture: CRYPTPROPS_TEXTURE_KEY, stem: 'rootIntrusion', variants: 1, height: 24 },

  // Crypt.
  gravestone: { texture: CRYPT_TEXTURE_KEY, stem: 'gravestone', variants: 3, height: 44 },
  bones: { texture: CRYPT_TEXTURE_KEY, stem: 'bones', variants: 2, height: 18 },
  mushrooms: { texture: CRYPT_TEXTURE_KEY, stem: 'mushrooms', variants: 2, height: 18 },
  // Its own sheet rather than the crypt's one static frame: the chest atlas is
  // eight frames of a lid coming up, and `chest0` is that sequence closed. The
  // frame names happen to match the stem scheme exactly, so nothing else about
  // the lookup changes.
  chest: { texture: CHEST_TEXTURE_KEY, stem: 'chest', variants: 1, height: 36 },

  // Fire holders. Drawn cold -- the flame is a separate animated effect.
  brazier: { texture: LIGHTS_TEXTURE_KEY, stem: 'brazier', variants: 1, height: 56 },
  candles: { texture: LIGHTS_TEXTURE_KEY, stem: 'candles', variants: 2, height: 18 },
  torch: { texture: LIGHTS_TEXTURE_KEY, stem: 'torch', variants: 2, height: 44 },

  // The village -- none of this had art before.
  hut: { texture: BUILDINGS_TEXTURE_KEY, stem: 'hut', variants: 3, height: 88 },
  hut_big: { texture: BUILDINGS_TEXTURE_KEY, stem: 'hutBig', variants: 2, height: 128 },
  forge: { texture: BUILDINGS_TEXTURE_KEY, stem: 'forge', variants: 1, height: 76 },
  stall: { texture: BUILDINGS_TEXTURE_KEY, stem: 'stall', variants: 1, height: 52 },
  banner: { texture: BUILDINGS_TEXTURE_KEY, stem: 'banner', variants: 1, height: 92 },

  // The people. `village.py` places an NPC as blocking decor under its own
  // sprite name, so these are decor kinds like anything else.
  // The sprite names are `npc.py`'s verbatim, so a definition indexes its own
  // art with nothing in between.
  villager: { texture: VILLAGERS_TEXTURE_KEY, stem: 'villager', variants: 4, height: 58 },
  npc_elder: { texture: VILLAGERS_TEXTURE_KEY, stem: 'elder', variants: 1, height: 58 },
  npc_smith: { texture: VILLAGERS_TEXTURE_KEY, stem: 'smith', variants: 1, height: 58 },
  npc_apothecary: { texture: VILLAGERS_TEXTURE_KEY, stem: 'apothecary', variants: 1, height: 58 },
  hearth: { texture: VILLAGERS_TEXTURE_KEY, stem: 'hearth', variants: 1, height: 40 },
};

/** The same people in profile, so one can turn to face you. */
const SIDE: ReadonlySet<string> = new Set([
  'villager', 'npc_elder', 'npc_smith', 'npc_apothecary',
]);

export interface PropFrame {
  texture: string;
  frame: string;
  /** Drawn height in world units. The renderer scales the frame to it. */
  height: number;
}

/**
 * The drawn art for a decor kind, or null if the sheet does not cover it.
 *
 * Null is not a failure: `WorldRenderer` falls back to the painted texture,
 * which is what keeps a decor kind the art has never seen -- a `pond`, or
 * whatever the server grows next -- rendering as something rather than nothing.
 */
export function propArt(kind: string, variant: number): PropFrame | null {
  const art = ART[kind];
  if (!art) return null;
  return { texture: art.texture, frame: `${art.stem}${variant % art.variants}`, height: art.height };
}

/**
 * The profile view of a person, for when they turn toward you.
 *
 * Only people have one. Returns null for a hut, which has no opinion about
 * where you are standing.
 */
export function propArtSide(kind: string, variant: number): PropFrame | null {
  if (!SIDE.has(kind)) return null;
  const art = ART[kind];
  if (!art) return null;
  return { texture: VILLAGERSSIDE_TEXTURE_KEY, frame: `${art.stem}${variant % art.variants}`, height: art.height };
}

/** Whether a decor kind is a person who should watch the player. */
export function isPerson(kind: string): boolean {
  return SIDE.has(kind);
}

/** Every world texture the preloader must fetch. */
export const WORLD_TEXTURES: readonly string[] = [
  FLORA_TEXTURE_KEY, GROUNDCOVER_TEXTURE_KEY, STONE_TEXTURE_KEY,
  RUINS_TEXTURE_KEY, CRYPT_TEXTURE_KEY, LIGHTS_TEXTURE_KEY,
  DOORS_TEXTURE_KEY, BUILDINGS_TEXTURE_KEY,
  VILLAGERS_TEXTURE_KEY, VILLAGERSSIDE_TEXTURE_KEY,
  GROVEPROPS_TEXTURE_KEY, RUINSPROPS_TEXTURE_KEY, CRYPTPROPS_TEXTURE_KEY,
  CHEST_TEXTURE_KEY,
  // One drawn floor per biome. Tiny -- twelve 32px tiles in a 384x32 strip --
  // so all three come down at boot rather than per room: a room transition
  // that has to wait for its floor would show the painted one and then swap.
  ...Object.values(TILES_TEXTURE_KEY),
];

/**
 * The chest's lid coming up.
 *
 * Registered here rather than with the character clips because the chest is
 * decor, not a creature, and this is the only prop in the game with a motion of
 * its own. It does not loop and it does not return: a chest that has been
 * emptied stays open, which is also how the player reads a room they have
 * already cleared.
 */
export const CHEST_OPEN_KEY = 'chest:open';

export function registerChestAnimation(anims: Phaser.Animations.AnimationManager): void {
  if (anims.exists(CHEST_OPEN_KEY)) return;
  anims.create({
    key: CHEST_OPEN_KEY,
    frames: [...CHEST_FRAMES.a, ...CHEST_FRAMES.b].map((frame) => ({ key: CHEST_TEXTURE_KEY, frame })),
    frameRate: 14,
    repeat: 0,
  });
}
