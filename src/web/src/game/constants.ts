/** Every tunable number in one place. Nothing else should hold a magic value. */

/** The world the camera looks at. Rendering scales this to fit the viewport. */
export const VIEW = { width: 960, height: 540 } as const;

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

/** Sampled from the palette swatches on the source character sheet. */
export const PALETTE = {
  cream: 0xf2e8df,
  taupe: 0xbdafa6,
  magenta: 0xd62e6c,
  pink: 0xf5a4c0,
  night: 0x14111a,
  dusk: 0x241d2e,
} as const;
