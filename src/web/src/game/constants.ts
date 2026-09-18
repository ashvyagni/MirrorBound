import { BRO_BODY_RATIO } from './animation/broAtlas.generated';
import { GOAT_BODY_RATIO } from './animation/goatAtlas.generated';

/** Every tunable number in one place. Nothing else should hold a magic value. */

/** The world the camera looks at at zoom 1, in world units. */
export const VIEW = { width: 960, height: 540 } as const;

/**
 * Supersampling factor: the canvas is this many times larger than VIEW and the
 * camera zoom is multiplied by it, so painted art is rasterised at full density
 * instead of being stretched by the browser.
 */
export const RENDER_SCALE = 2;

/** World-unit size of one floor tile; must match the server's TILE. */
export const TILE = 32;

/**
 * Drawn height of the player's frame box, in world units. The visible goat is
 * GOAT_BODY_RATIO of that (~56 units): a little under two tiles, so it reads as
 * a character standing in a world instead of a sprite covering it.
 */
export const PLAYER_DISPLAY_HEIGHT = 76;

/** The twin is drawn as a smaller spirit-like figure beside the player. */
export const TWIN_SIZE_RATIO = 0.62;
export const TWIN_DISPLAY_HEIGHT =
  (PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO * TWIN_SIZE_RATIO) / BRO_BODY_RATIO;

export const CAMERA = {
  /** Smoothing toward the player, 0..1 per frame at 60fps. */
  lerp: 0.12,
  /** Default zoom; the settings screen exposes the range. */
  zoom: 1.0,
  minZoom: 0.7,
  maxZoom: 1.5,
  /** The player may drift this far from centre before the camera moves. */
  deadzone: { width: 60, height: 40 },
  shake: { hit: 0.004, heavy: 0.008, duration: 120 },
} as const;

export const NET = {
  /** Server snapshots arrive at this rate; interpolation is tuned against it. */
  snapshotHz: 20,
  /** How strongly remote entities chase their latest server position per second. */
  followRate: 14,
  /** Player prediction reconciles this fraction of the error per snapshot. */
  reconcile: 0.35,
  /** Above this error the prediction snaps instead of easing. */
  snapDistance: 90,
  inputHz: 60,
} as const;

/** Depth layers. Entities use their y within the ENTITY band. */
export const DEPTH = {
  floor: 0,
  floorDecal: 5,
  water: 8,
  shadow: 10,
  entityBase: 100,      // + y * 0.01 keeps painter's order
  entityTop: 2000,
  fxLow: 2100,
  fxHigh: 2600,
  weather: 2800,
  vignette: 3000,
  debug: 3500,
} as const;

/** Palette sampled from the goat and companion sheets, plus world tones. */
export const PALETTE = {
  cream: 0xf2e8df,
  taupe: 0xbdafa6,
  magenta: 0xd62e6c,
  pink: 0xf5a4c0,
  cyan: 0xa0cae4,
  violet: 0x7c6add,
  night: 0x14111a,
  dusk: 0x1e1926,
  gold: 0xf0c060,
  ember: 0xff7a3d,
  ice: 0x9fe3ff,
  arcane: 0xb48cff,
  healthRed: 0xd9413f,
  healthGreen: 0x63c26d,
  mana: 0x4f8fe6,
} as const;

/** Per-biome world colours (as CSS strings for the canvas texture painter). */
export const BIOMES = {
  grove: {
    // Variants share one base; only the speckle pattern differs, so the floor
    // reads as one meadow rather than a checkerboard.
    grass: ['#4b7944', '#4c7a45', '#4a7843'],
    grassDark: '#3a6337',
    grassLight: '#6f9e5c',
    dirt: '#5f6140',
    dirtLight: '#7a7650',
    path: '#7c6448',
    stone: '#6f6d70',
    stoneLight: '#8c898c',
    wall: '#2a3a2a',
    wallTop: '#4a6b46',
    water: '#2a5f7a',
    waterLight: '#5f9fbf',
    ambient: 'fireflies',
    fog: 0x1a2a1a,
  },
  ruins: {
    grass: ['#5b6a49', '#5a6948', '#5c6b4a'],
    grassDark: '#48553a',
    grassLight: '#8a9866',
    dirt: '#6d5b46',
    dirtLight: '#877357',
    path: '#8a7860',
    stone: '#7a7370',
    stoneLight: '#9a938f',
    wall: '#3a332e',
    wallTop: '#6b5f55',
    water: '#3b5e6f',
    waterLight: '#6d97ab',
    ambient: 'dust',
    fog: 0x24201c,
  },
  crypt: {
    grass: ['#3b3b49', '#3c3c4a', '#3a3a48'],
    grassDark: '#2c2c38',
    grassLight: '#585870',
    dirt: '#4a4250',
    dirtLight: '#5d5364',
    path: '#5f5670',
    stone: '#4d4a5a',
    stoneLight: '#6b6880',
    wall: '#1c1a26',
    wallTop: '#3e3a52',
    water: '#2c2f52',
    waterLight: '#5b5fa0',
    ambient: 'embers',
    fog: 0x120f1a,
  },
} as const;

export type BiomeName = keyof typeof BIOMES;
