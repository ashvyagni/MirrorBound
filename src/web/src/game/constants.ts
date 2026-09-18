/** Every tunable number in one place. Nothing else should hold a magic value. */

/** The world the camera looks at. Rendering scales this to fit the viewport. */
export const VIEW = { width: 960, height: 540 } as const;

/** Room dimensions in world units. */
export const ROOM = { width: 1280, height: 960, tileSize: 32 } as const;

/** How tall the player is drawn on screen, in world units. */
export const PLAYER_DISPLAY_HEIGHT = 190;

export const PHYSICS = {
  /** Body box, as a fraction of the drawn sprite. */
  bodyWidthRatio: 0.34,
  bodyHeightRatio: 0.72,
} as const;

export const MOVEMENT = {
  walkSpeed: 150,
  runSpeed: 280,
  /** Time to reach full speed from a standstill, in seconds. */
  accelTime: 0.09,
  stopTime: 0.07,
  /** Below this speed the player is treated as standing still. */
  idleThreshold: 12,
  /** Above this fraction of run speed, the run cycle replaces the walk cycle. */
  runBlendThreshold: 0.62,
  /** Diagonal movement normalization factor. */
  diagonalFactor: 0.707,
} as const;

export const COMBAT = {
  attackDuration: 0.42,
  /** Fraction of normal control retained while swinging. */
  attackMoveScale: 0.25,
  hurtDuration: 0.36,
  hurtKnockback: 240,
  respawnDelay: 1.1,
} as const;

/** Dark fantasy palette. */
export const PALETTE = {
  cream: 0xf2e8df,
  taupe: 0xbdafa6,
  magenta: 0xd62e6c,
  pink: 0xf5a4c0,
  night: 0x14111a,
  dusk: 0x241d2e,
  floor: 0x1a1a2e,
  wall: 0x16213e,
  wallEdge: 0x0f3460,
  player: 0x00ff88,
  twin: 0x4488ff,
  skeleton: 0xaaaaaa,
  slime: 0x44ff44,
  healthRed: 0xff0000,
  healthGreen: 0x00ff00,
} as const;
