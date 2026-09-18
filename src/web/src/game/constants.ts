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

/** Distance from the top of the view down to the ground line, in world units. */
export const GROUND_Y = 452;

/** How tall the goat is drawn on screen, in world units. Everything about the
 *  character scales from this, so the art can change resolution without
 *  touching the physics. */
export const GOAT_DISPLAY_HEIGHT = 190;

export const PHYSICS = {
  gravity: 2100,
  /** Body box, as a fraction of the drawn sprite. The art has a wide fur skirt
   *  and tall horns that should not collide with anything. */
  bodyWidthRatio: 0.34,
  bodyHeightRatio: 0.72,
} as const;

export const MOVEMENT = {
  walkSpeed: 150,
  runSpeed: 320,
  /** Time to reach full speed from a standstill, in seconds. */
  groundAccelTime: 0.09,
  groundStopTime: 0.07,
  airAccelTime: 0.22,
  jumpVelocity: -760,
  /** Releasing jump early cuts the remaining rise by this much. */
  jumpCutMultiplier: 0.45,
  maxFallSpeed: 1250,
  /** Jump still registers this long after walking off a ledge. */
  coyoteTime: 0.1,
  /** Jump pressed this long before landing still fires on touchdown. */
  jumpBufferTime: 0.12,
  /** Below this speed the goat is treated as standing still. */
  idleThreshold: 12,
  /** Above this fraction of run speed, the run cycle replaces the walk cycle. */
  runBlendThreshold: 0.62,
  /** How long the landing pose holds before control resumes, in seconds. */
  landRecovery: 0.11,
} as const;

export const COMBAT = {
  attackDuration: 0.42,
  /** Fraction of normal control retained while swinging. */
  attackMoveScale: 0.25,
  hurtDuration: 0.36,
  hurtKnockback: 240,
  respawnDelay: 1.1,
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
  /** Height above the goat's feet to hover at -- level with its neck. */
  neckOffsetY: -122,
  /** How far behind the goat the companion aims to sit. */
  trailDistance: 58,
  /** Seconds to close most of the gap to its target. Higher drifts further. */
  responseTime: 0.22,
  /** Extra trailing proportional to the goat's speed, so a sprint stretches it. */
  trailPerSpeed: 0.075,
  /** Idle bob, layered on top of following so it never looks frozen. */
  bobSpeed: 2.3,
  bobAmplitude: 5,
  /** Follow speed above which the travel clips replace the resting ones. */
  moveThreshold: 42,
  climbThreshold: 62,
  /** Below this it is considered still enough to start an emote. */
  restThreshold: 14,
  /** How long everything must stay calm before emotes may begin, in seconds. */
  settleTime: 0.6,
  /** Swirl size, as a multiple of the companion's own frame height. */
  attackFxScale: 1.3,
  /** Nudge so the swirl wraps the body rather than sitting under it. */
  attackFxOffsetY: -6,
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

/** Sampled from the palette swatches on the source character sheet. */
export const PALETTE = {
  cream: 0xf2e8df,
  taupe: 0xbdafa6,
  magenta: 0xd62e6c,
  pink: 0xf5a4c0,
  night: 0x14111a,
  dusk: 0x241d2e,
} as const;
