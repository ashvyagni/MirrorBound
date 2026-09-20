/**
 * The two shield sheets: holding the ward, and turning a hit aside with it.
 *
 * Kept apart from `weaponClips` because a shield is not a weapon -- it is not
 * equipped, it has no combo and it is not what the `animation` field on a
 * server weapon names. It belongs to the Aegis ability, which any weapon can
 * be carrying when it fires.
 */

import type Phaser from 'phaser';

import { animationKey, registerClips } from './clips';
import {
  SHIELDBLOCK_ANCHOR, SHIELDBLOCK_BODY_RATIO, SHIELDBLOCK_FRAMES, SHIELDBLOCK_FRAME_SIZE, SHIELDBLOCK_TEXTURE_KEY,
} from './shieldBlockAtlas.generated';
import {
  SHIELDPARRY_ANCHOR, SHIELDPARRY_BODY_RATIO, SHIELDPARRY_FRAMES, SHIELDPARRY_FRAME_SIZE, SHIELDPARRY_TEXTURE_KEY,
} from './shieldParryAtlas.generated';

export interface ShieldDef {
  texture: string;
  frames: readonly string[];
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  bodyRatio: number;
  frameRate: number;
  /** Shield height as a fraction of the goat's own body height. */
  lengthRatio: number;
  /** Where the shield sits relative to the goat's origin (its feet). */
  offset: { readonly x: number; readonly y: number };
}

/**
 * The ward held up. Loops for as long as the server says the status is on.
 *
 * Slow, because it is a hold rather than a motion -- eight frames at the swing
 * rate would read as the shield being shaken rather than braced.
 *
 * Both offsets here are a starting point measured against the goat's body, not
 * per-sheet measurements off the art: they are the thing most likely to want a
 * nudge by eye.
 */
export const SHIELD_BLOCK: ShieldDef = {
  texture: SHIELDBLOCK_TEXTURE_KEY,
  frames: [...SHIELDBLOCK_FRAMES.block, ...SHIELDBLOCK_FRAMES.block_b],
  anchor: SHIELDBLOCK_ANCHOR,
  frameSize: SHIELDBLOCK_FRAME_SIZE,
  bodyRatio: SHIELDBLOCK_BODY_RATIO,
  frameRate: 9,
  lengthRatio: 0.62,
  offset: { x: 30, y: -78 },
};

/** One hit turned aside. Plays once, then the hold resumes. */
export const SHIELD_PARRY: ShieldDef = {
  texture: SHIELDPARRY_TEXTURE_KEY,
  frames: [...SHIELDPARRY_FRAMES.parry, ...SHIELDPARRY_FRAMES.parry_b],
  anchor: SHIELDPARRY_ANCHOR,
  frameSize: SHIELDPARRY_FRAME_SIZE,
  bodyRatio: SHIELDPARRY_BODY_RATIO,
  frameRate: 20,
  lengthRatio: 0.7,
  offset: { x: 34, y: -78 },
};

export const SHIELD_TEXTURES: readonly string[] = [SHIELD_BLOCK.texture, SHIELD_PARRY.texture];

export function shieldBlockKey(): string {
  return animationKey(SHIELD_BLOCK.texture, 'block');
}

export function shieldParryKey(): string {
  return animationKey(SHIELD_PARRY.texture, 'parry');
}

export function registerShieldAnimations(anims: Phaser.Animations.AnimationManager): void {
  registerClips(anims, SHIELD_BLOCK.texture, {
    block: { frames: SHIELD_BLOCK.frames, frameRate: SHIELD_BLOCK.frameRate, repeat: -1 },
  });
  registerClips(anims, SHIELD_PARRY.texture, {
    parry: { frames: SHIELD_PARRY.frames, frameRate: SHIELD_PARRY.frameRate, repeat: 0 },
  });
}
