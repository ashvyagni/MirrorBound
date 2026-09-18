import { BRO_BODY_RATIO } from './animation/broAtlas.generated';
import { GOAT_BODY_RATIO } from './animation/goatAtlas.generated';

/** Every tunable number in one place. Nothing else should hold a magic value. */

/** The world the camera looks at, in world units. */
export const VIEW = { width: 960, height: 540 } as const;

/**
 * Supersampling factor.
 *
 * The canvas is built this many times larger than `VIEW` and the camera is
 * zoomed by the same amount, so world coordinates are untouched while the
 * artwork is rasterised at higher density. Without it the canvas renders at
 * 960x540 and the browser stretches it to fill the page, which is what made
 * everything look soft -- a stretch is blur no matter how good the source art
 * is.
 */
export const RENDER_SCALE = 2;

/** World-unit size of one floor tile. */
export const TILE = 32;

/** The arena, in tiles. Walls occupy the outermost ring. */
export const ROOM = { cols: 40, rows: 26 } as const;

/**
 * Depth layers.
 *
 * Entities sit in a band and add their own `y` to it, so whatever is further
 * down the screen draws in front. That painter's ordering is the whole of the
 * 2.5D look: there is no projection anywhere, only sorting.
 */
export const DEPTH = {
  floor: 0,
  floorDecal: 5,
  shadow: 10,
  entityBase: 100,
  entityTop: 2000,
  fx: 2100,
  vignette: 3000,
} as const;

/** Depth for something standing at `y` on the floor. */
export function depthAt(y: number): number {
  return DEPTH.entityBase + y * 0.01;
}

/**
 * How tall the goat is drawn on screen, in world units.
 *
 * Much smaller than a side-scroller wants. The visible goat is
 * `GOAT_BODY_RATIO` of this, a little under two tiles, so it reads as a
 * character standing in a world rather than a sprite covering it.
 */
export const GOAT_DISPLAY_HEIGHT = 76;

/** Offsets on the weapon sheets were tuned against a 190-unit goat. */
export const ART_RATIO = GOAT_DISPLAY_HEIGHT / 190;

export const PHYSICS = {
  /** Body box, as a fraction of the drawn sprite. The art has a wide fur skirt
   *  and tall horns that should not collide with anything. */
  bodyWidthRatio: 0.34,
  /** Shallow, because only the goat's footing occupies the floor -- its head
   *  hangs over whatever is behind it rather than colliding with it. */
  bodyHeightRatio: 0.3,
} as const;

export const MOVEMENT = {
  walkSpeed: 105,
  runSpeed: 190,
  /** Time to reach full speed from a standstill, in seconds. */
  accelTime: 0.08,
  stopTime: 0.06,
  /** Below this speed the goat is treated as standing still. */
  idleThreshold: 10,
  /** Above this fraction of run speed, the run cycle replaces the walk cycle. */
  runBlendThreshold: 0.62,
} as const;

export const COMBAT = {
  attackDuration: 0.42,
  /** Fraction of normal control retained while swinging. */
  attackMoveScale: 0.25,
  hurtDuration: 0.36,
  hurtKnockback: 150,
  respawnDelay: 1.1,
  /** Time after a swing in which the next hit continues the combo. */
  comboWindow: 0.62,
} as const;

export const CAMERA = {
  /** Smoothing toward the goat, per axis. */
  lerp: 0.1,
  /** How far it may drift from centre before the camera moves. */
  deadzone: { width: 120, height: 90 },
} as const;

/**
 * The floating companion.
 *
 * Offsets are measured from the goat's origin, which sits at its feet, so
 * `neckOffsetY` is negative. Following is deliberately soft: the companion
 * chases a point *behind* the goat and gets there slowly, which is what makes
 * it read as tagging along rather than being welded on.
 */
export const COMPANION = {
  /**
   * How big the companion is beside the goat, comparing the creatures
   * themselves rather than their frame boxes -- its cell is padded by thruster
   * trails and bob range, so matching cell heights would draw it far smaller
   * than intended.
   */
  sizeRatio: 1 / 3,
  /** How far up the screen it hovers from the goat's footing. Small: in a
   *  top-down view this is a position on the floor, not a height. */
  neckOffsetY: -18,
  /** How far behind the goat the companion aims to sit. */
  trailDistance: 26,
  /** Seconds to close most of the gap to its target. Higher drifts further. */
  responseTime: 0.22,
  /** Extra trailing proportional to the goat's speed, so a sprint stretches it. */
  trailPerSpeed: 0.06,
  /** Idle bob, layered on top of following so it never looks frozen. */
  bobSpeed: 2.3,
  bobAmplitude: 2.5,
  /** Follow speed above which the travel clips replace the resting ones. */
  moveThreshold: 26,
  climbThreshold: 34,
  /** Below this it is considered still enough to start an emote. */
  restThreshold: 9,
  /** How long everything must stay calm before emotes may begin, in seconds. */
  settleTime: 0.6,
  /** Swirl size, as a multiple of the companion's own frame height. */
  attackFxScale: 1.3,
  /** Nudge so the swirl wraps the body rather than sitting under it. */
  attackFxOffsetY: -3,
  /** Random wait between idle emotes, in seconds. */
  emoteDelayMin: 3.5,
  emoteDelayMax: 9,
} as const;

/**
 * Drawn height of the companion's frame box, in world units.
 *
 * Solved from `COMPANION.sizeRatio` so the *visible creature* lands at exactly
 * that fraction of the visible goat. Both body ratios are generated from the
 * sheets, so re-exporting either one keeps this true with no retuning.
 */
export const COMPANION_DISPLAY_HEIGHT =
  (GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO * COMPANION.sizeRatio) / BRO_BODY_RATIO;

/** Drawn height of the practice dummy, in world units. */
export const DUMMY_HEIGHT = 68;

/** How close a swing or a shot has to be to register on the dummy. */
export const HIT_RANGE = 34;

/**
 * The sword's shield.
 *
 * Guard is a press rather than a hold: the intent stream reports abilities as
 * edge-triggered, and a held variant would be a second kind of ability for one
 * mechanic. So raising it starts a timer, and pressing again inside the parry
 * window turns the block into a counter.
 */
export const SHIELD = {
  /** How long the guard stays up before dropping on its own, in seconds. */
  holdTime: 1.1,
  /** Press again within this long of raising it to parry instead. */
  parryWindow: 0.45,
  /** Seconds before guard can be raised again, measured from when it drops. */
  cooldown: 1.2,
  /** Drawn size as a fraction of the goat's body height. */
  sizeRatio: 0.66,
  /** Where it sits relative to the goat's origin, its footing. */
  offset: { x: 20, y: -22 },
} as const;

/**
 * The in-game bar, in canvas pixels.
 *
 * Canvas pixels, not world units: the HUD runs in its own scene on an unzoomed
 * camera, so one unit here is one pixel of the backing canvas -- which is
 * `VIEW` multiplied by `RENDER_SCALE`. That is also why it survives fullscreen
 * unchanged: the canvas is scaled to fit, and the bar scales with it.
 */
export const HUD = {
  /**
   * The grid everything in the bar snaps to.
   *
   * Every size below is a multiple of it, which is the whole trick behind the
   * frames reading as pixel art: an edge that lands between units is an edge
   * the renderer has to antialias, and one soft edge is enough to give the
   * whole bar away.
   */
  pixel: 4,
  slot: 104,
  gap: 12,
  margin: 32,
  /** Space between a slot and its label. */
  labelGap: 10,
  /** Weapon names, which have to fit under a slot. */
  nameSize: 14,
  /** Key numbers and countdowns, which are short and want to be read fast. */
  labelSize: 18,
  hintSize: 15,
  /** Border thickness and corner cut, in `pixel` units. */
  border: 2,
  chamfer: 3,
  /** How much of a slot the icon fills. */
  iconFill: 0.62,
  /** Seconds a refused cast flashes its slot for. */
  blockFlash: 0.35,
  frameLine: 0x53456a,
  frameFill: 0x191322,
  ink: '#cfc3d4',
  dimInk: '#7d7188',
  activeInk: '#f5a4c0',
} as const;

/**
 * The bar's typeface.
 *
 * A pixel face, to sit with the frames. Canvas text has no fallback chain of
 * its own once it has rasterised, so the stack matters only until the webfont
 * arrives -- after which the scene redraws every label against `family`.
 */
export const PIXEL_FONT = {
  family: 'Silkscreen',
  stack: '"Silkscreen", "Courier New", ui-monospace, monospace',
} as const;

/** Sampled from the palette swatches on the source character sheet. */
export const PALETTE = {
  cream: 0xf2e8df,
  taupe: 0xbdafa6,
  magenta: 0xd62e6c,
  pink: 0xf5a4c0,
  night: 0x14111a,
  dusk: 0x241d2e,
} as const;
