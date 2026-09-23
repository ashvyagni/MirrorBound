import type Phaser from 'phaser';

import {
  ARROWCAST_ANCHOR, ARROWCAST_BODY_RATIO, ARROWCAST_FRAMES, ARROWCAST_FRAME_SIZE, ARROWCAST_TEXTURE_KEY,
} from './arrowCastAtlas.generated';
import {
  BOW_ANCHOR, BOW_BODY_RATIO, BOW_FRAMES, BOW_FRAME_SIZE, BOW_TEXTURE_KEY,
} from './bowAtlas.generated';
import { animationKey, registerClips, type ClipDef } from './clips';
import {
  FIREBALLCAST_ANCHOR, FIREBALLCAST_BODY_RATIO, FIREBALLCAST_FRAMES, FIREBALLCAST_FRAME_SIZE, FIREBALLCAST_TEXTURE_KEY,
} from './fireBallCastAtlas.generated';
import {
  FIREWAVECAST_ANCHOR, FIREWAVECAST_BODY_RATIO, FIREWAVECAST_FRAMES, FIREWAVECAST_FRAME_SIZE, FIREWAVECAST_TEXTURE_KEY,
} from './fireWaveCastAtlas.generated';
import {
  ICEBEAMCAST_ANCHOR, ICEBEAMCAST_BODY_RATIO, ICEBEAMCAST_FRAMES, ICEBEAMCAST_FRAME_SIZE, ICEBEAMCAST_TEXTURE_KEY,
} from './iceBeamCastAtlas.generated';
import {
  ICENOVACAST_ANCHOR, ICENOVACAST_BODY_RATIO, ICENOVACAST_FRAMES, ICENOVACAST_FRAME_SIZE, ICENOVACAST_TEXTURE_KEY,
} from './iceNovaCastAtlas.generated';
import {
  ICESHARDSCAST_ANCHOR, ICESHARDSCAST_BODY_RATIO, ICESHARDSCAST_FRAMES, ICESHARDSCAST_FRAME_SIZE, ICESHARDSCAST_TEXTURE_KEY,
} from './iceShardsCastAtlas.generated';
import {
  FIRESTAFF_ANCHOR, FIRESTAFF_BODY_RATIO, FIRESTAFF_FRAMES, FIRESTAFF_FRAME_SIZE, FIRESTAFF_TEXTURE_KEY,
} from './fireStaffAtlas.generated';
import {
  ICESTAFF_ANCHOR, ICESTAFF_BODY_RATIO, ICESTAFF_FRAMES, ICESTAFF_FRAME_SIZE, ICESTAFF_TEXTURE_KEY,
} from './iceStaffAtlas.generated';
import {
  SWORDA_ANCHOR, SWORDA_BODY_RATIO, SWORDA_FRAMES, SWORDA_FRAME_SIZE, SWORDA_TEXTURE_KEY,
} from './swordAAtlas.generated';
import {
  SWORDB_ANCHOR, SWORDB_BODY_RATIO, SWORDB_FRAMES, SWORDB_FRAME_SIZE, SWORDB_TEXTURE_KEY,
} from './swordBAtlas.generated';
import {
  SWORDC_ANCHOR, SWORDC_BODY_RATIO, SWORDC_FRAMES, SWORDC_FRAME_SIZE, SWORDC_TEXTURE_KEY,
} from './swordCAtlas.generated';

/** One swing: the sheet it lives on, and how to place and play it. */
export interface SwingDef {
  texture: string;
  frames: readonly string[];
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  /** How much of the frame box the weapon itself fills, 0..1. */
  bodyRatio: number;
  frameRate: number;
  /** The sheet is drawn facing left, so flip it to match the others. */
  mirror?: boolean;
  /** Overrides the weapon's length, for a swing whose effect inflates its box. */
  lengthRatio?: number;
  /** Overrides where the grip sits, for a swing that has to reach somewhere. */
  offset?: { x: number; y: number };
  /** Play the sheet's frames in this order instead of the drawn one. */
  order?: readonly number[];
}

export type WeaponId = 'sword' | 'bow' | 'fireStaff' | 'iceStaff';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Shown in the picker. */
  blurb: string;
  /** Swings played in order on consecutive hits. More than one means a combo. */
  swings: readonly SwingDef[];
  /** Weapon length as a fraction of the goat's own body height.
   *  Solved per sheet from its body ratio, because the frame boxes are padded
   *  by trails and each sheet is padded differently -- matching frame heights
   *  would draw a 0.56-ratio sword at two thirds the size of a 0.84 one. */
  lengthRatio: number;
  /** Where the weapon sits relative to the goat's origin (its feet). */
  offset: { x: number; y: number };
  /**
   * The motion for a shot rather than a bash.
   *
   * Only the weapons that actually throw something have one. Without it a bow
   * plays its melee bash while an arrow leaves it, which reads as the arrow
   * arriving from somewhere else.
   */
  cast?: SwingDef;
}

/** Each sheet is drawn as 4 across and 2 down, so the two rows join into one swing. */
function swing(
  texture: string,
  rows: { readonly swing: readonly string[]; readonly swing_b: readonly string[] },
  anchor: SwingDef['anchor'],
  frameSize: SwingDef['frameSize'],
  bodyRatio: number,
  frameRate = 20,
  extra: Partial<Pick<SwingDef, 'mirror' | 'lengthRatio' | 'offset' | 'order'>> = {},
): SwingDef {
  const drawn = [...rows.swing, ...rows.swing_b];
  const frames = extra.order ? extra.order.map((i) => drawn[i] ?? drawn[0]!) : drawn;
  return {
    texture, frames,
    anchor, frameSize, bodyRatio, frameRate, ...extra,
  };
}

/**
 * Cast motions.
 *
 * Every `lengthRatio` here is Logesh's own measurement, not a guess. It has to
 * be solved per sheet rather than shared, because it is divided by the sheet's
 * body ratio -- which measures the artwork's *vertical* extent, and a staff
 * drawn horizontal mid-cast has a short one. The beam was the extreme case: at
 * 1.3 it drew a staff half again as tall as the goat.
 */
const CASTS = {
  arrow: swing(ARROWCAST_TEXTURE_KEY, ARROWCAST_FRAMES, ARROWCAST_ANCHOR, ARROWCAST_FRAME_SIZE, ARROWCAST_BODY_RATIO, 18,
    { lengthRatio: 1.0, offset: { x: 50, y: -92 } }),
  fireBall: swing(FIREBALLCAST_TEXTURE_KEY, FIREBALLCAST_FRAMES, FIREBALLCAST_ANCHOR, FIREBALLCAST_FRAME_SIZE, FIREBALLCAST_BODY_RATIO, 17,
    { lengthRatio: 1.11, offset: { x: 50, y: -92 } }),
  fireWave: swing(FIREWAVECAST_TEXTURE_KEY, FIREWAVECAST_FRAMES, FIREWAVECAST_ANCHOR, FIREWAVECAST_FRAME_SIZE, FIREWAVECAST_BODY_RATIO, 16,
    { lengthRatio: 0.95, offset: { x: 50, y: -88 } }),
  iceShards: swing(ICESHARDSCAST_TEXTURE_KEY, ICESHARDSCAST_FRAMES, ICESHARDSCAST_ANCHOR, ICESHARDSCAST_FRAME_SIZE, ICESHARDSCAST_BODY_RATIO, 18,
    { lengthRatio: 0.96, offset: { x: 50, y: -92 } }),
  iceNova: swing(ICENOVACAST_TEXTURE_KEY, ICENOVACAST_FRAMES, ICENOVACAST_ANCHOR, ICENOVACAST_FRAME_SIZE, ICENOVACAST_BODY_RATIO, 16,
    { lengthRatio: 0.98, offset: { x: 46, y: -92 } }),
  // Frame 1 of this sheet winds up with the head low and *behind* the caster,
  // then snaps 135 degrees to level, so the staff enters from below and leaves
  // from above. Logesh's reorder borrows the recovery frame for the wind-up
  // rather than redrawing the sheet.
  iceBeam: swing(ICEBEAMCAST_TEXTURE_KEY, ICEBEAMCAST_FRAMES, ICEBEAMCAST_ANCHOR, ICEBEAMCAST_FRAME_SIZE, ICEBEAMCAST_BODY_RATIO, 14,
    { order: [0, 6, 2, 3, 4, 5, 6, 7], lengthRatio: 0.66, offset: { x: 50, y: -92 } }),
} as const;

/**
 * The cast motion for each of the server's ability ids.
 *
 * Only the abilities whose element the art actually shows are here. Healing,
 * the shield and the dash have no drawn motion, and borrowing a fire sheet for
 * one of them would say the wrong thing about what is happening.
 */
export const ABILITY_CASTS: Readonly<Record<string, SwingDef>> = {
  flame_burst: CASTS.fireWave,
  binding_nova: CASTS.iceNova,
  arcane_bolt: CASTS.iceBeam,
};

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sword: {
    id: 'sword',
    name: 'Sword',
    blurb: 'Three-hit combo. Keep swinging and it chains.',
    // Sweep, then chop, then the spin finisher -- each trail is a different
    // shape, which is what keeps them apart at this speed.
    swings: [
      swing(SWORDA_TEXTURE_KEY, SWORDA_FRAMES, SWORDA_ANCHOR, SWORDA_FRAME_SIZE, SWORDA_BODY_RATIO, 22),
      swing(SWORDB_TEXTURE_KEY, SWORDB_FRAMES, SWORDB_ANCHOR, SWORDB_FRAME_SIZE, SWORDB_BODY_RATIO, 21,
        { lengthRatio: 1.45, offset: { x: 34, y: -58 } }),
      swing(SWORDC_TEXTURE_KEY, SWORDC_FRAMES, SWORDC_ANCHOR, SWORDC_FRAME_SIZE, SWORDC_BODY_RATIO, 19,
        { lengthRatio: 1.2 }),
    ],
    lengthRatio: 0.95,
    offset: { x: 38, y: -84 },
  },
  bow: {
    id: 'bow',
    name: 'Bow',
    blurb: 'Bashes up close. Ranged shot comes later.',
    swings: [swing(BOW_TEXTURE_KEY, BOW_FRAMES, BOW_ANCHOR, BOW_FRAME_SIZE, BOW_BODY_RATIO, 20)],
    cast: CASTS.arrow,
    lengthRatio: 0.86,
    offset: { x: 34, y: -84 },
  },
  fireStaff: {
    id: 'fireStaff',
    name: 'Fire staff',
    blurb: 'Overhead smash, embers on impact.',
    swings: [swing(FIRESTAFF_TEXTURE_KEY, FIRESTAFF_FRAMES, FIRESTAFF_ANCHOR, FIRESTAFF_FRAME_SIZE, FIRESTAFF_BODY_RATIO, 19,
      { lengthRatio: 1.35, offset: { x: 34, y: -60 } })],
    cast: CASTS.fireBall,
    lengthRatio: 1.0,
    offset: { x: 36, y: -86 },
  },
  iceStaff: {
    id: 'iceStaff',
    name: 'Ice staff',
    blurb: 'Wide frost sweep, shards along the arc.',
    swings: [swing(ICESTAFF_TEXTURE_KEY, ICESTAFF_FRAMES, ICESTAFF_ANCHOR, ICESTAFF_FRAME_SIZE, ICESTAFF_BODY_RATIO, 19,
      { mirror: true, lengthRatio: 1.15 })],
    cast: CASTS.iceShards,
    lengthRatio: 0.95,
    offset: { x: 38, y: -84 },
  },
};

export const WEAPON_ORDER: readonly WeaponId[] = ['sword', 'bow', 'fireStaff', 'iceStaff'];

/** Every texture that must be loaded for weapons to work. */
export const WEAPON_TEXTURES: readonly string[] = [
  SWORDA_TEXTURE_KEY, SWORDB_TEXTURE_KEY, SWORDC_TEXTURE_KEY,
  BOW_TEXTURE_KEY, FIRESTAFF_TEXTURE_KEY, ICESTAFF_TEXTURE_KEY,
  ...new Set(Object.values(CASTS).map((def) => def.texture)),
];

export function swingKey(texture: string): string {
  return animationKey(texture, 'swing');
}

export function registerWeaponAnimations(anims: Phaser.Animations.AnimationManager): void {
  const sheets = [
    ...Object.values(WEAPONS).flatMap((weapon) => weapon.swings),
    ...Object.values(CASTS),
  ];
  for (const def of sheets) {
    const clip: ClipDef = { frames: def.frames, frameRate: def.frameRate, repeat: 0 };
    registerClips(anims, def.texture, { swing: clip });
  }
}
