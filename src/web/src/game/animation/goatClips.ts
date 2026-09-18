import type Phaser from 'phaser';

import { animationKey, registerClips, type ClipDef } from './clips';
import { GOAT_FRAMES, GOAT_TEXTURE_KEY } from './goatAtlas.generated';

export { GOAT_TEXTURE_KEY as GOAT_TEXTURE } from './goatAtlas.generated';

/**
 * The goat's animations.
 *
 * `frames` slices the generated frame list, so renaming or reordering frames in
 * the sheet surfaces here as a type error rather than a silent mis-play. The
 * jump row is one drawn arc -- crouch, launch, apex, descend, descend, land --
 * so it is split into the three clips the state machine actually needs.
 */
const { idle, walk, run, jump, attack, hurt, die } = GOAT_FRAMES;

export const CLIPS = {
  idle: { frames: idle, frameRate: 7, repeat: -1 },
  walk: { frames: walk, frameRate: 11, repeat: -1 },
  run: { frames: run, frameRate: 15, repeat: -1 },
  rise: { frames: jump.slice(0, 3), frameRate: 14, repeat: 0, hold: true },
  fall: { frames: jump.slice(3, 5), frameRate: 9, repeat: 0, hold: true },
  land: { frames: jump.slice(5), frameRate: 12, repeat: 0, hold: true },
  attack: { frames: attack, frameRate: 16, repeat: 0, hold: true },
  hurt: { frames: hurt, frameRate: 1, repeat: 0, hold: true },
  die: { frames: die, frameRate: 1, repeat: 0, hold: true },
} as const satisfies Record<string, ClipDef>;

export type ClipName = keyof typeof CLIPS;

/** Clips the debug dock offers, in the order they appear on the sheet. */
export const CLIP_ORDER: readonly ClipName[] = [
  'idle', 'walk', 'run', 'rise', 'fall', 'land', 'attack', 'hurt', 'die',
];

/** Expression portraits. Not animations -- single frames shown in the UI. */
export const EXPRESSIONS = GOAT_FRAMES.face;

export function goatAnimationKey(clip: ClipName): string {
  return animationKey(GOAT_TEXTURE_KEY, clip);
}

export function registerGoatAnimations(anims: Phaser.Animations.AnimationManager): void {
  registerClips(anims, GOAT_TEXTURE_KEY, CLIPS);
}
