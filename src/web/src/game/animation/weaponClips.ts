import type Phaser from 'phaser';

import { SHIELD } from '../constants';
import { ABILITIES, type AbilityId } from './abilityClips';
import type { IconName } from './icons';

import { BOW_ANCHOR, BOW_BODY_RATIO, BOW_FRAMES, BOW_FRAME_SIZE, BOW_TEXTURE_KEY } from './bowAtlas.generated';
import { BOWIDLE_ANCHOR, BOWIDLE_BODY_RATIO, BOWIDLE_FRAMES, BOWIDLE_FRAME_SIZE, BOWIDLE_TEXTURE_KEY } from './bowIdleAtlas.generated';
import { FIRESTAFF_ANCHOR, FIRESTAFF_BODY_RATIO, FIRESTAFF_FRAMES, FIRESTAFF_FRAME_SIZE, FIRESTAFF_TEXTURE_KEY } from './fireStaffAtlas.generated';
import { FIRESTAFFIDLE_ANCHOR, FIRESTAFFIDLE_BODY_RATIO, FIRESTAFFIDLE_FRAMES, FIRESTAFFIDLE_FRAME_SIZE, FIRESTAFFIDLE_TEXTURE_KEY } from './fireStaffIdleAtlas.generated';
import { ICESTAFF_ANCHOR, ICESTAFF_BODY_RATIO, ICESTAFF_FRAMES, ICESTAFF_FRAME_SIZE, ICESTAFF_TEXTURE_KEY } from './iceStaffAtlas.generated';
import { ICESTAFFIDLE_ANCHOR, ICESTAFFIDLE_BODY_RATIO, ICESTAFFIDLE_FRAMES, ICESTAFFIDLE_FRAME_SIZE, ICESTAFFIDLE_TEXTURE_KEY } from './iceStaffIdleAtlas.generated';
import { SWORDA_ANCHOR, SWORDA_BODY_RATIO, SWORDA_FRAMES, SWORDA_FRAME_SIZE, SWORDA_TEXTURE_KEY } from './swordAAtlas.generated';
import { SWORDB_ANCHOR, SWORDB_BODY_RATIO, SWORDB_FRAMES, SWORDB_FRAME_SIZE, SWORDB_TEXTURE_KEY } from './swordBAtlas.generated';
import { SWORDC_ANCHOR, SWORDC_BODY_RATIO, SWORDC_FRAMES, SWORDC_FRAME_SIZE, SWORDC_TEXTURE_KEY } from './swordCAtlas.generated';
import { SWORDIDLE_ANCHOR, SWORDIDLE_BODY_RATIO, SWORDIDLE_FRAMES, SWORDIDLE_FRAME_SIZE, SWORDIDLE_TEXTURE_KEY } from './swordIdleAtlas.generated';

import { ARROWCAST_ANCHOR, ARROWCAST_BODY_RATIO, ARROWCAST_FRAMES, ARROWCAST_FRAME_SIZE, ARROWCAST_TEXTURE_KEY } from './arrowCastAtlas.generated';
import { FIREBALLCAST_ANCHOR, FIREBALLCAST_BODY_RATIO, FIREBALLCAST_FRAMES, FIREBALLCAST_FRAME_SIZE, FIREBALLCAST_TEXTURE_KEY } from './fireBallCastAtlas.generated';
import { FIREPILLARCAST_ANCHOR, FIREPILLARCAST_BODY_RATIO, FIREPILLARCAST_FRAMES, FIREPILLARCAST_FRAME_SIZE, FIREPILLARCAST_TEXTURE_KEY } from './firePillarCastAtlas.generated';
import { FIREWAVECAST_ANCHOR, FIREWAVECAST_BODY_RATIO, FIREWAVECAST_FRAMES, FIREWAVECAST_FRAME_SIZE, FIREWAVECAST_TEXTURE_KEY } from './fireWaveCastAtlas.generated';
import { ICEBEAMCAST_ANCHOR, ICEBEAMCAST_BODY_RATIO, ICEBEAMCAST_FRAMES, ICEBEAMCAST_FRAME_SIZE, ICEBEAMCAST_TEXTURE_KEY } from './iceBeamCastAtlas.generated';
import { ICENOVACAST_ANCHOR, ICENOVACAST_BODY_RATIO, ICENOVACAST_FRAMES, ICENOVACAST_FRAME_SIZE, ICENOVACAST_TEXTURE_KEY } from './iceNovaCastAtlas.generated';
import { ICESHARDSCAST_ANCHOR, ICESHARDSCAST_BODY_RATIO, ICESHARDSCAST_FRAMES, ICESHARDSCAST_FRAME_SIZE, ICESHARDSCAST_TEXTURE_KEY } from './iceShardsCastAtlas.generated';

import { animationKey, registerClips, type ClipDef } from './clips';

/** One clip of a weapon: the sheet it lives on, and how to place and play it. */
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
  /** Overrides the weapon's length, for a clip whose effect inflates its box. */
  lengthRatio?: number;
  /** Overrides where the grip sits, for a clip that has to reach somewhere. */
  offset?: { x: number; y: number };
  /** Loop instead of playing once. Held clips do -- an idle, a raised guard. */
  loop?: boolean;
  /**
   * Play the sheet's frames in this order instead of straight through.
   *
   * A last resort, for a sheet whose motion is drawn wrong in a way the art
   * already contains the fix for. Reordering beats regenerating when the right
   * pose is sitting in another cell.
   */
  order?: readonly number[];
  /**
   * The frame, 0-based, on which the spell actually leaves the weapon.
   *
   * Without it a cast fires on frame 0, while the staff is still upright and
   * winding up, so the spell arrives a moment before the motion that threw it.
   * This is the frame where the head reaches its forward pose -- found by
   * measuring which frame puts the tip of the shaft furthest ahead of the
   * grip, or lowest, for a cast that slams downward.
   */
  releaseFrame?: number;
}

export type WeaponId = 'sword' | 'bow' | 'fireStaff' | 'iceStaff';

/**
 * What can sit in an ability slot.
 *
 * Every slot but one casts a spell. The sword's is `guard`, which raises a
 * shield instead -- it throws nothing, so it is deliberately not an `AbilityId`
 * and the scene has to decide what a slot means rather than assuming.
 */
export const GUARD = 'guard' as const;

export type SlotId = AbilityId | typeof GUARD;

/** Whether a slot casts a spell, as opposed to raising the shield. */
export function isSpell(slot: SlotId): slot is AbilityId {
  return slot !== GUARD;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Shown in the picker. */
  blurb: string;
  /** Icon for the picker. A caster shows what it casts; the sword, which has
   *  no spell to borrow from, has its own. */
  icon: IconName;
  /** Swings played in order on consecutive hits. More than one means a combo. */
  swings: readonly SwingDef[];
  /** Loop shown while the weapon is held but not swinging. */
  idle: SwingDef;
  /**
   * The weapon's own motion while an ability fires, keyed by ability.
   *
   * Without one the weapon carries on idling through a cast, which is what
   * made the earlier build read as the spell arriving from somewhere else --
   * the fireball appeared beside a staff that never moved.
   */
  casts?: Partial<Record<AbilityId, SwingDef>>;
  /** What keys 1, 2 and 3 do, in that order. */
  abilities: readonly SlotId[];
  /** Weapon length as a fraction of the goat's own body height.
   *  Solved per sheet from its body ratio, because the frame boxes are padded
   *  by trails and each sheet is padded differently -- matching frame heights
   *  would draw a 0.56-ratio sword at two thirds the size of a 0.84 one. */
  lengthRatio: number;
  /**
   * Where the grip sits relative to the goat's origin (its feet).
   *
   * Staffs and bows are held at their middle rather than at one end like a
   * sword, so they are carried further forward: anchored at the goat's centre,
   * half the weapon ends up drawn inside its body.
   *
   * A swing that bakes a ground effect into its own sheet is placed by where
   * that effect has to land rather than by where the grip looks comfortable.
   * The staffs both burst against the floor at the bottom of their arc, and
   * hanging them off the grip left the fire floating a few units clear of it.
   */
  offset: { x: number; y: number };
}

/** Join a sheet's bands, in order, into one clip. */
function clip(
  texture: string,
  rows: Record<string, readonly string[]>,
  anchor: SwingDef['anchor'],
  frameSize: SwingDef['frameSize'],
  bodyRatio: number,
  frameRate = 20,
  extra: Partial<Pick<SwingDef, 'mirror' | 'lengthRatio' | 'offset' | 'loop' | 'releaseFrame' | 'order'>> = {},
): SwingDef {
  const sheet = Object.values(rows).flat();
  return {
    texture,
    frames: extra.order ? extra.order.map((i) => sheet[i]!) : sheet,
    anchor, frameSize, bodyRatio, frameRate, ...extra,
  };
}

/** Held loops, shown while a weapon is carried. */
const IDLES = {
  sword: clip(SWORDIDLE_TEXTURE_KEY, SWORDIDLE_FRAMES, SWORDIDLE_ANCHOR, SWORDIDLE_FRAME_SIZE, SWORDIDLE_BODY_RATIO, 9,
    { loop: true, lengthRatio: 0.95, offset: { x: 40, y: -92 } }),
  bow: clip(BOWIDLE_TEXTURE_KEY, BOWIDLE_FRAMES, BOWIDLE_ANCHOR, BOWIDLE_FRAME_SIZE, BOWIDLE_BODY_RATIO, 9,
    { loop: true, lengthRatio: 1.0, offset: { x: 50, y: -92 } }),
  fireStaff: clip(FIRESTAFFIDLE_TEXTURE_KEY, FIRESTAFFIDLE_FRAMES, FIRESTAFFIDLE_ANCHOR, FIRESTAFFIDLE_FRAME_SIZE, FIRESTAFFIDLE_BODY_RATIO, 10,
    { loop: true, lengthRatio: 1.1, offset: { x: 50, y: -92 } }),
  iceStaff: clip(ICESTAFFIDLE_TEXTURE_KEY, ICESTAFFIDLE_FRAMES, ICESTAFFIDLE_ANCHOR, ICESTAFFIDLE_FRAME_SIZE, ICESTAFFIDLE_BODY_RATIO, 10,
    { loop: true, lengthRatio: 1.1, offset: { x: 50, y: -92 } }),
} as const;

/**
 * Cast motions, one per ability.
 *
 * Every `lengthRatio` on this page -- swings and casts alike -- is solved so
 * the weapon is drawn at the same length it is when simply carried, rather
 * than picked by eye. It has to be solved rather than shared because
 * `lengthRatio` is divided by the sheet's body ratio, which measures the
 * artwork's *vertical* extent: a staff drawn horizontal mid-cast has a short
 * one, so the same number blows it up. The beam cast was the extreme case, at
 * 1.3 it drew a staff half again as tall as the goat.
 *
 * To solve a new sheet, measure the distance from the grip to the far end of
 * the bone shaft, ignoring trails and gems, and scale it to match the idle
 * sheet's. Rotation cannot change that distance, which is why it is the one
 * measurement worth taking.
 */
const CASTS = {
  arrow: clip(ARROWCAST_TEXTURE_KEY, ARROWCAST_FRAMES, ARROWCAST_ANCHOR, ARROWCAST_FRAME_SIZE, ARROWCAST_BODY_RATIO, 18,
    { releaseFrame: 4, lengthRatio: 1.0, offset: { x: 50, y: -92 } }),
  fireBall: clip(FIREBALLCAST_TEXTURE_KEY, FIREBALLCAST_FRAMES, FIREBALLCAST_ANCHOR, FIREBALLCAST_FRAME_SIZE, FIREBALLCAST_BODY_RATIO, 17,
    { releaseFrame: 5, lengthRatio: 1.11, offset: { x: 50, y: -92 } }),
  firePillar: clip(FIREPILLARCAST_TEXTURE_KEY, FIREPILLARCAST_FRAMES, FIREPILLARCAST_ANCHOR, FIREPILLARCAST_FRAME_SIZE, FIREPILLARCAST_BODY_RATIO, 16,
    { releaseFrame: 5, lengthRatio: 0.94, offset: { x: 50, y: -92 } }),
  fireWave: clip(FIREWAVECAST_TEXTURE_KEY, FIREWAVECAST_FRAMES, FIREWAVECAST_ANCHOR, FIREWAVECAST_FRAME_SIZE, FIREWAVECAST_BODY_RATIO, 16,
    { releaseFrame: 5, lengthRatio: 0.95, offset: { x: 50, y: -88 } }),
  iceShards: clip(ICESHARDSCAST_TEXTURE_KEY, ICESHARDSCAST_FRAMES, ICESHARDSCAST_ANCHOR, ICESHARDSCAST_FRAME_SIZE, ICESHARDSCAST_BODY_RATIO, 18,
    { releaseFrame: 4, lengthRatio: 0.96, offset: { x: 50, y: -92 } }),
  iceNova: clip(ICENOVACAST_TEXTURE_KEY, ICENOVACAST_FRAMES, ICENOVACAST_ANCHOR, ICENOVACAST_FRAME_SIZE, ICENOVACAST_BODY_RATIO, 16,
    { releaseFrame: 3, lengthRatio: 0.98, offset: { x: 46, y: -92 } }),
  // Frame 1 of this sheet winds up with the head low and *behind* the caster
  // and then snaps 135 degrees to level, while the recovery at frame 6 lifts
  // it up in front -- so the staff enters from below and leaves from above,
  // which reads as swinging the wrong way round.
  //
  // Frame 6 is already the pose the wind-up wants, so it stands in for frame 1
  // as well: the head now comes down from up-in-front into the level hold and
  // lifts back the same way, symmetric about the hold. Reordering costs
  // nothing and uses the sheet as drawn; redrawing it with the wind-up on the
  // forward side would be the cleaner fix if this ever gets regenerated.
  iceBeam: clip(ICEBEAMCAST_TEXTURE_KEY, ICEBEAMCAST_FRAMES, ICEBEAMCAST_ANCHOR, ICEBEAMCAST_FRAME_SIZE, ICEBEAMCAST_BODY_RATIO, 14,
    { order: [0, 6, 2, 3, 4, 5, 6, 7], releaseFrame: 2, lengthRatio: 0.66, offset: { x: 50, y: -92 } }),
} as const satisfies Partial<Record<AbilityId, SwingDef>>;

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  sword: {
    id: 'sword',
    name: 'Sword',
    icon: 'sword',
    blurb: 'Three-hit combo. Guard to raise the shield.',
    // Sweep, then chop, then the spin finisher -- each trail is a different
    // shape, which is what keeps them apart at this speed.
    swings: [
      clip(SWORDA_TEXTURE_KEY, SWORDA_FRAMES, SWORDA_ANCHOR, SWORDA_FRAME_SIZE, SWORDA_BODY_RATIO, 22,
        { lengthRatio: 0.82 }),
      clip(SWORDB_TEXTURE_KEY, SWORDB_FRAMES, SWORDB_ANCHOR, SWORDB_FRAME_SIZE, SWORDB_BODY_RATIO, 21,
        { lengthRatio: 1.05, offset: { x: 38, y: -80 } }),
      clip(SWORDC_TEXTURE_KEY, SWORDC_FRAMES, SWORDC_ANCHOR, SWORDC_FRAME_SIZE, SWORDC_BODY_RATIO, 19,
        { lengthRatio: 0.88 }),
    ],
    idle: IDLES.sword,
    abilities: [GUARD],
    lengthRatio: 1.0,
    offset: { x: 38, y: -88 },
  },
  bow: {
    id: 'bow',
    name: 'Bow',
    icon: 'arrow',
    blurb: 'Bashes up close, looses a bolt at range.',
    swings: [clip(BOW_TEXTURE_KEY, BOW_FRAMES, BOW_ANCHOR, BOW_FRAME_SIZE, BOW_BODY_RATIO, 20,
      { lengthRatio: 0.89 })],
    idle: IDLES.bow,
    casts: { arrow: CASTS.arrow },
    abilities: ['arrow'],
    lengthRatio: 1.05,
    offset: { x: 50, y: -92 },
  },
  fireStaff: {
    id: 'fireStaff',
    name: 'Fire staff',
    icon: 'fireBall',
    blurb: 'Overhead smash, embers on impact.',
    swings: [clip(FIRESTAFF_TEXTURE_KEY, FIRESTAFF_FRAMES, FIRESTAFF_ANCHOR, FIRESTAFF_FRAME_SIZE, FIRESTAFF_BODY_RATIO, 19,
      // `y` puts the burst baked into the swing on the floor line, not the
      // grip at a comfortable height -- see the note on `offset`.
      { lengthRatio: 0.95, offset: { x: 50, y: -79 } })],
    idle: IDLES.fireStaff,
    casts: {
      fireBall: CASTS.fireBall,
      firePillar: CASTS.firePillar,
      fireWave: CASTS.fireWave,
    },
    abilities: ['fireBall', 'firePillar', 'fireWave'],
    lengthRatio: 1.1,
    offset: { x: 50, y: -92 },
  },
  iceStaff: {
    id: 'iceStaff',
    name: 'Ice staff',
    icon: 'iceNova',
    blurb: 'Wide frost sweep, shards along the arc.',
    swings: [clip(ICESTAFF_TEXTURE_KEY, ICESTAFF_FRAMES, ICESTAFF_ANCHOR, ICESTAFF_FRAME_SIZE, ICESTAFF_BODY_RATIO, 19,
      { lengthRatio: 0.94, offset: { x: 50, y: -78 } })],
    idle: IDLES.iceStaff,
    casts: {
      iceNova: CASTS.iceNova,
      iceShards: CASTS.iceShards,
      iceBeam: CASTS.iceBeam,
    },
    abilities: ['iceNova', 'iceShards', 'iceBeam'],
    lengthRatio: 1.1,
    offset: { x: 50, y: -92 },
  },
};

export const WEAPON_ORDER: readonly WeaponId[] = ['sword', 'bow', 'fireStaff', 'iceStaff'];

/** What a slot looks like, whichever kind it holds. */
export interface SlotInfo {
  id: SlotId;
  name: string;
  icon: IconName;
  /** Seconds before it can be used again. */
  cooldown: number;
}

/**
 * Describe a slot without the caller having to know which kind it holds.
 *
 * Both bars render slots, and both used to index `ABILITIES` directly -- which
 * stopped compiling the moment a slot could hold something that is not a
 * spell. One lookup here beats the same branch in two views.
 */
export function slotInfo(slot: SlotId): SlotInfo {
  if (slot === GUARD) {
    return { id: GUARD, name: 'Guard', icon: 'sword', cooldown: SHIELD.cooldown };
  }
  const ability = ABILITIES[slot];
  return { id: slot, name: ability.name, icon: slot, cooldown: ability.cooldown };
}

/** Every texture that must be loaded for weapons to work. */
export const WEAPON_TEXTURES: readonly string[] = [
  SWORDA_TEXTURE_KEY, SWORDB_TEXTURE_KEY, SWORDC_TEXTURE_KEY,
  BOW_TEXTURE_KEY, FIRESTAFF_TEXTURE_KEY, ICESTAFF_TEXTURE_KEY,
  SWORDIDLE_TEXTURE_KEY, BOWIDLE_TEXTURE_KEY,
  FIRESTAFFIDLE_TEXTURE_KEY, ICESTAFFIDLE_TEXTURE_KEY,
  ARROWCAST_TEXTURE_KEY, FIREBALLCAST_TEXTURE_KEY, FIREPILLARCAST_TEXTURE_KEY,
  FIREWAVECAST_TEXTURE_KEY, ICESHARDSCAST_TEXTURE_KEY, ICENOVACAST_TEXTURE_KEY,
  ICEBEAMCAST_TEXTURE_KEY,
];

/** Animation key for a weapon clip. One per texture, since each sheet holds
 *  exactly one clip. */
export function swingKey(texture: string): string {
  return animationKey(texture, 'swing');
}

export function registerWeaponAnimations(anims: Phaser.Animations.AnimationManager): void {
  const all: SwingDef[] = [];
  for (const weapon of Object.values(WEAPONS)) {
    all.push(weapon.idle, ...weapon.swings, ...Object.values(weapon.casts ?? {}));
  }
  for (const def of all) {
    const spec: ClipDef = {
      frames: def.frames,
      frameRate: def.frameRate,
      repeat: def.loop ? -1 : 0,
    };
    registerClips(anims, def.texture, { swing: spec });
  }
}
