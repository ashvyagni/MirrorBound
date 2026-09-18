import type Phaser from 'phaser';

import {
  BOW_ANCHOR, BOW_BODY_RATIO, BOW_FRAMES, BOW_FRAME_SIZE, BOW_TEXTURE_KEY,
} from './bowAtlas.generated';
import { animationKey, registerClips, type ClipDef } from './clips';
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
}

/** Each sheet is drawn as 4 across and 2 down, so the two rows join into one swing. */
function swing(
  texture: string,
  rows: { readonly swing: readonly string[]; readonly swing_b: readonly string[] },
  anchor: SwingDef['anchor'],
  frameSize: SwingDef['frameSize'],
  bodyRatio: number,
  frameRate = 20,
  extra: Partial<Pick<SwingDef, 'mirror' | 'lengthRatio' | 'offset'>> = {},
): SwingDef {
  return {
    texture, frames: [...rows.swing, ...rows.swing_b],
    anchor, frameSize, bodyRatio, frameRate, ...extra,
  };
}

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
    lengthRatio: 0.86,
    offset: { x: 34, y: -84 },
  },
  fireStaff: {
    id: 'fireStaff',
    name: 'Fire staff',
    blurb: 'Overhead smash, embers on impact.',
    swings: [swing(FIRESTAFF_TEXTURE_KEY, FIRESTAFF_FRAMES, FIRESTAFF_ANCHOR, FIRESTAFF_FRAME_SIZE, FIRESTAFF_BODY_RATIO, 19,
      { lengthRatio: 1.35, offset: { x: 34, y: -60 } })],
    lengthRatio: 1.0,
    offset: { x: 36, y: -86 },
  },
  iceStaff: {
    id: 'iceStaff',
    name: 'Ice staff',
    blurb: 'Wide frost sweep, shards along the arc.',
    swings: [swing(ICESTAFF_TEXTURE_KEY, ICESTAFF_FRAMES, ICESTAFF_ANCHOR, ICESTAFF_FRAME_SIZE, ICESTAFF_BODY_RATIO, 19,
      { mirror: true, lengthRatio: 1.15 })],
    lengthRatio: 0.95,
    offset: { x: 38, y: -84 },
  },
};

export const WEAPON_ORDER: readonly WeaponId[] = ['sword', 'bow', 'fireStaff', 'iceStaff'];

/** Every texture that must be loaded for weapons to work. */
export const WEAPON_TEXTURES: readonly string[] = [
  SWORDA_TEXTURE_KEY, SWORDB_TEXTURE_KEY, SWORDC_TEXTURE_KEY,
  BOW_TEXTURE_KEY, FIRESTAFF_TEXTURE_KEY, ICESTAFF_TEXTURE_KEY,
];

export function swingKey(texture: string): string {
  return animationKey(texture, 'swing');
}

export function registerWeaponAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const weapon of Object.values(WEAPONS)) {
    for (const def of weapon.swings) {
      const clip: ClipDef = { frames: def.frames, frameRate: def.frameRate, repeat: 0 };
      registerClips(anims, def.texture, { swing: clip });
    }
  }
}
