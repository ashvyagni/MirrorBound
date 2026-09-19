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
  water: 8,
  shadow: 10,
  entityBase: 100,
  entityTop: 2000,
  /** `fx` is kept as the name this branch already uses; `fxLow` is the same
   *  layer under the name `main`'s world renderer asks for. */
  fx: 2100,
  fxLow: 2100,
  fxHigh: 2600,
  weather: 2800,
  vignette: 3000,
  debug: 3500,
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
  /** Default zoom; the settings screen exposes the range. */
  zoom: 1.0,
  minZoom: 0.7,
  maxZoom: 1.5,
  shake: { hit: 0.004, heavy: 0.008, duration: 120 },
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

/** Sampled from the palette swatches on the source character sheet. */
export const PALETTE = {
  cream: 0xf2e8df,
  taupe: 0xbdafa6,
  magenta: 0xd62e6c,
  pink: 0xf5a4c0,
  night: 0x14111a,
  dusk: 0x241d2e,
  /**
   * Mana.
   *
   * The only colour here that is not on the character sheet. Nothing sampled
   * from the goat is cool, and a mana bar sharing the health bar's magenta is
   * a mana bar nobody can read at a glance. It matches the diamond drawn on
   * the mana trough in `assets/ui/status-bars.png`, so the bar and its own
   * emblem agree.
   */
  frost: 0x6fd8e8,

  // Added for main's VFX, damage numbers and bars. `frost` above is the art's
  // cool tone and stays the mana colour; `mana` is kept as the name main's
  // views ask for and points at the same idea.
  cyan: 0xa0cae4,
  violet: 0x7c6add,
  gold: 0xf0c060,
  ember: 0xff7a3d,
  ice: 0x9fe3ff,
  arcane: 0xb48cff,
  healthRed: 0xd9413f,
  healthGreen: 0x63c26d,
  mana: 0x4f8fe6,
} as const;

/**
 * Health and mana.
 *
 * Field names match the wire contract on `main` -- `health`, `maxHealth`,
 * `mana`, `maxMana` -- so when this branch starts taking snapshots from the
 * server the local model is deleted rather than translated. Nothing here is
 * balance; it exists so the bars have something true to draw.
 */
export const VITALS = {
  maxHealth: 100,
  maxMana: 60,
  /** Mana per second, once the delay below has passed. */
  manaRegen: 4.5,
  /** Quiet seconds after a cast before mana starts coming back. */
  manaRegenDelay: 1.2,
  /** What a hit costs, until there is real incoming damage to price. */
  hitDamage: 12,
  /** Seconds the bar keeps showing where it was before a change, as a pale
   *  trailing edge. This is the whole reason a hit reads as a hit. */
  chaseTime: 0.45,
} as const;

/**
 * Where the art-drawn HUD sits, in canvas pixels.
 *
 * Canvas pixels for the same reason the bar above uses them: the HUD scene
 * runs on an unzoomed camera over a canvas of `VIEW * RENDER_SCALE`. Sizes are
 * given as the drawn size of each piece rather than as a scale factor, because
 * the pieces come off the atlas at whatever size their source art trimmed to
 * and a factor would silently change meaning the next time the art is redrawn.
 */
export const HUD_ART = {
  portrait: {
    x: 128, y: 120, size: 188,
    /** How much of the ring's opening the face fills. */
    faceScale: 0.72,
    /**
     * How far the head is raised out of the ring, as a fraction of its size.
     *
     * The head is drawn *over* the ring rather than inside it, so this is what
     * decides how much of the crown and horns clears the top edge. Too little
     * and the ring reads as a closed hole with a face at the bottom of it; too
     * much and the chin lifts off the lower arc and the head floats.
     */
    faceLift: 0.36,
    /** Nudged right, so it is the horn that breaks the rim rather than the
     *  middle of the skull -- the horn is the readable silhouette. */
    faceShiftX: 0.05,
    /** Seconds each expression holds before the next. */
    faceHold: 2.4,
  },
  bars: {
    /** Left edge, measured from the portrait ring's centre. */
    x: 214, y: 92,
    width: 268,
    /** Centre-to-centre of the health and mana troughs. */
    gap: 46,
    /** The trough's inner opening, as a fraction of the drawn piece. The fill
     *  is a rectangle inside the art, so it has to know where the art's own
     *  walls are. */
    inset: { left: 0.108, right: 0.028, top: 0.3, bottom: 0.3 },
  },
  minimap: { x: 1920 - 150, y: 150, size: 228 },
  settings: { x: 78, y: 1080 - 78, size: 80 },
  hotbar: {
    /**
     * Small on purpose.
     *
     * Three slots is all this holds, and a plate sized to look substantial ate
     * a sixth of the screen -- in a game where the thing you need to see is
     * directly above it. Everything else here is a fraction of `width`, so
     * this is the only number to change if it wants resizing again.
     */
    x: 960, y: 1080 - 86, width: 380,
    /**
     * Where the three recesses actually are, measured off
     * `assets/ui/hotbar.png` as fractions of the plate's own box.
     *
     * Per slot rather than a symmetric spacing, because they are not
     * symmetric: the art has them at -0.2948, -0.0027 and +0.2908, and sitting
     * a pixel low. That is hand-drawn art doing what hand-drawn art does, and
     * the fix is to read it rather than to assume it -- an item centred on
     * where a slot *ought* to be is visibly off the one that is there.
     */
    slots: [
      { x: -0.2948, y: 0.0041, w: 0.1698 },
      { x: -0.0027, y: 0.0061, w: 0.1807 },
      { x: +0.2908, y: 0.0041, w: 0.1698 },
    ],
    /** How much of a slot's opening the item fills. */
    itemFill: 0.78,
    /** The dial rings the middle slot, so it is sized to the plate's height
     *  rather than to the opening -- it sits *around* the recess, not in it. */
    dialRatio: 0.225,
    /** Degrees the dial turns per potion in the carousel. */
    dialStep: 60,
  },
  rail: {
    x: 1920 - 96,
    /** Gap between the bottom of the rail and the bottom of the canvas. */
    bottom: 34,
    /**
     * Drawn size of one socket. Every other dimension of the rail is solved
     * from it.
     *
     * This way round because the rail exists to hold these: sized the other
     * way -- a height picked by eye, the socket taken from whatever channel
     * that left -- a 360-tall rail came out 64 wide and its sockets 32, which
     * is smaller than the countdown that has to fit inside one.
     */
    socket: 48,
    /**
     * The gap between the rail's two walls, as a fraction of its drawn width.
     *
     * Measured off `assets/ui/cooldown-rail.png` -- 64px of channel in 118px of
     * rail. A socket is sized from this rather than given its own number,
     * because the two describe the same opening and a socket that does not know
     * how wide the channel is grows straight through the walls.
     */
    channelRatio: 0.542,
    /** How much of the channel a socket fills. */
    socketFill: 0.92,
    /** Centre-to-centre of stacked sockets, as a multiple of socket size. */
    pitchRatio: 1.16,
    /** Most sockets the rail shows at once. */
    capacity: 4,
  },
} as const;

// --- network + main's naming ----------------------------------------------
// The client is snapshot-driven, so the renderer needs to know the rate it is
// interpolating against. Kept here rather than in the socket client because the
// entity views read it and never touch the socket.

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

/**
 * `main`'s names for the two drawn heights above.
 *
 * Identical values -- the art is the same art -- but `main`'s entity views say
 * "player"/"twin" where this branch's sheets say "goat"/"companion". Aliasing
 * is cheaper and less error-prone than renaming either vocabulary, and keeps
 * both sets of call sites readable in their own terms.
 */
export const PLAYER_DISPLAY_HEIGHT = GOAT_DISPLAY_HEIGHT;
export const TWIN_SIZE_RATIO = COMPANION.sizeRatio;
export const TWIN_DISPLAY_HEIGHT = COMPANION_DISPLAY_HEIGHT;
