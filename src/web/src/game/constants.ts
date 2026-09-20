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
  /**
   * The Proving: flat, cold and obviously unreal.
   *
   * Deliberately the one biome that does not look like a place. Every variant
   * is the same value, so the floor reads as a grid rather than as ground, and
   * nothing here suggests cover or a route -- which is the whole point of
   * testing in it.
   */
  sandbox: {
    grass: ['#3a2f55', '#3a2f55', '#3a2f55'],
    grassDark: '#2c2442',
    grassLight: '#4a3d6b',
    dirt: '#3a2f55',
    dirtLight: '#4a3d6b',
    path: '#4a3d6b',
    stone: '#3a2f55',
    stoneLight: '#5a4b80',
    wall: '#191428',
    wallTop: '#4a3d6b',
    water: '#2c2f52',
    waterLight: '#5b5fa0',
    ambient: 'dust',
    fog: 0x191428,
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


/**
 * Which way the world is lit, as an angle in radians.
 *
 * Every sheet in `Block 0-WORLD` is drawn with one soft light from the upper
 * left -- highlights on upper-left faces, the shadow tone on lower-right ones.
 * Shadows therefore fall down and to the right. It lives here rather than in
 * either renderer because the props and the creatures have to agree: two
 * light sources in one room is the thing that reads as wrong even when nobody
 * can say why.
 */
export const LIGHT_ANGLE = Math.atan2(0.62, 0.78);

// --- the interface --------------------------------------------------------
//
// Everything below is the in-canvas HUD's own geometry -- ring diameters, slot
// centres, bar insets -- measured off the drawn art rather than chosen. It
// lives here with the rest of the constants because the HUD is a scene like
// any other, and none of it means anything to the server.

export const ROOM = { cols: 40, rows: 26 } as const;

export function depthAt(y: number): number {
  return DEPTH.entityBase + y * 0.01;
}

export const GOAT_DISPLAY_HEIGHT = PLAYER_DISPLAY_HEIGHT;

export const ART_RATIO = GOAT_DISPLAY_HEIGHT / 190;

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

export const COMPANION_DISPLAY_HEIGHT =
  (GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO * COMPANION.sizeRatio) / BRO_BODY_RATIO;

export const MIRROR = {
  /**
   * Drawn size as a multiple of the goat's display height.
   *
   * Two and a half, between the two and three the design asks for. Measured
   * against the goat rather than against the companion it grew from, because
   * the goat is the thing it will be standing next to.
   */
  sizeRatio: 2.5,
  /** Seconds to close most of the gap to its target. Slower than the
   *  companion's: it is enormous, and enormous things turn late. */
  responseTime: 0.42,
  /** Limit chase speed and ease acceleration and braking. */
  maxSpeed: 125,
  accelTime: 0.24,
  /** It stops this far out. `main` gives it an attack range of 70 and both
   *  ranged and spell tags, so it has no reason to close all the way. */
  keepDistance: 190,
  /** Where its shadow sits below it, as a fraction of its drawn height. */
  shadowDrop: 0.46,
} as const;

export const MOB = {
  frameRate: { idle: 9, alert: 14, walk: 12, attack: 16 },
  /** Where the creature's feet sit in its frame. The sheets are anchored on
   *  their own lowest body pixel, so this is very near the bottom. */
  footAnchor: 0.94,
  /** How close the player gets before it notices. */
  aggroRange: 320,
  /** Seconds between swings once it is in reach. */
  swingCooldown: 1.1,
  /** The alert mark, as a multiple of the creature's drawn height. */
  markScale: 0.55,
  markLift: 1.05,
  /** Milliseconds the mark holds before the game fades it -- the sheet's own
   *  fade frames keyed out entirely, so this is where the fade lives. */
  markHold: 420,
  markFade: 260,
} as const;

export const PAUSE = {
  /** How hard the play camera blurs behind the panel. */
  blur: 2,
  blurStrength: 1.1,
} as const;

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

export const PIXEL_FONT = {
  family: 'Silkscreen',
  stack: '"Silkscreen", "Courier New", ui-monospace, monospace',
} as const;

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
    /**
     * Centre-to-centre of the health and mana troughs.
     *
     * Widened from 46 to make room for the twin's bar between them. At 46 the
     * clear space between the two was eleven pixels and the companion trough
     * is nineteen, so every bar in the stack overlapped its neighbour.
     */
    gap: 58,
    /** The trough's inner opening, as a fraction of the drawn piece. The fill
     *  is a rectangle inside the art, so it has to know where the art's own
     *  walls are. */
    inset: { left: 0.108, right: 0.028, top: 0.3, bottom: 0.3 },
  },
  /**
   * The twin's pair, tucked under the player's own.
   *
   * Narrower and indented so the two stacks read as "yours" and "theirs" at a
   * glance rather than as four bars of equal weight. Sheet 92's troughs are
   * chunkier than the player's (aspect 4.1 against 7.7), so matching the
   * player's height means a much shorter bar -- which is the right read for a
   * companion's vitals anyway.
   */
  twinBars: {
    /** Indent from the player's own bar, and how far below it. */
    indent: 20, drop: 30, width: 74,
    /** Where the mark sits, measured from the player's bar left edge. */
    markX: 2, markSize: 12,
    /** The opening inside the drawn trough. Measured off the art. */
    inset: { left: 0.05, right: 0.10, top: 0.26, bottom: 0.26 },
  },
  /**
   * The level bar, under everything.
   *
   * Deliberately not a third health bar: ten drawn segments rather than one
   * smooth capsule, because progress toward something is a different kind of
   * fact from a resource being spent.
   */
  level: {
    y: 216, width: 200,
    /** The hexagonal plate the number sits in, and where it overlaps the bar. */
    plateX: 200, plateSize: 42,
    inset: { left: 0.045, right: 0.045, top: 0.26, bottom: 0.26 },
  },
  minimap: {
    x: 1920 - 150, y: 150, size: 228,
    /**
     * The ring's opening, as a fraction of the drawn ring.
     *
     * The map is painted to exactly this and no larger. Guessing it is how the
     * floor ends up either tucked inside the frame with a gap or running under
     * it -- the same measurement the rail's channel and the socket's opening
     * already get. Measured: 263px of opening in 300px of ring.
     */
    innerRatio: 0.8767,
  },
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
    socket: 58,
    /**
     * The socket's inner opening, as fractions of the drawn socket.
     *
     * Measured off `assets/ui/cooldown-rail.png`: 119px of opening in 172px of
     * socket across, 123 in 173 down, with the opening's bottom edge 85% of
     * the way down. The recharge sweep and the countdown are bounded by this
     * rather than by the socket -- a sweep sized to the socket is a black
     * rectangle hanging out through the frame on every side, which is exactly
     * what it was doing.
     */
    opening: { w: 0.692, h: 0.711 },
    openingBottom: 0.85,
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
