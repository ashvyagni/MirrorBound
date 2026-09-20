import type Phaser from 'phaser';

import { animationKey, registerClips, type ClipDef } from './clips';
import { GOAT_FRAMES, GOAT_TEXTURE_KEY } from './goatAtlas.generated';

/**
 * Effects that belong to no one character.
 *
 * The swirl is lifted out of the goat's attack row by the asset pipeline with
 * the goat itself removed, so it can be drawn over anything. The companion's
 * own sheet has no combat art, and this is what lets its attack read as an
 * attack while keeping the two characters in one visual language.
 */
export const FX_CLIPS = {
  // Four frames at 14fps leads the companion's 10-frame spin slightly, so
  // the effect punctuates the start of the move and clears before it ends.
  swirl: { frames: GOAT_FRAMES.swirl, frameRate: 14, repeat: 0 },
} as const satisfies Record<string, ClipDef>;

export type FxName = keyof typeof FX_CLIPS;

/** Effects live in the goat atlas, since that is the sheet they were drawn on. */
export const FX_TEXTURE = GOAT_TEXTURE_KEY;

export function fxAnimationKey(name: FxName): string {
  return animationKey(GOAT_TEXTURE_KEY, name);
}

export function registerFxAnimations(anims: Phaser.Animations.AnimationManager): void {
  registerClips(anims, GOAT_TEXTURE_KEY, FX_CLIPS);
}
