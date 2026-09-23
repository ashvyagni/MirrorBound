import type Phaser from 'phaser';

import { BRO_FRAMES, BRO_TEXTURE_KEY } from './broAtlas.generated';
import { animationKey, registerClips, type ClipDef } from './clips';

export { BRO_TEXTURE_KEY as BRO_TEXTURE } from './broAtlas.generated';

/**
 * The companion's animations.
 *
 * The sheet draws left and right travel separately rather than expecting a
 * flip, so `moveLeft` / `moveRight` are real clips and the sprite is never
 * mirrored -- mirroring would put its bow on the wrong side.
 */
const {
  idle, hover, moveLeft, moveRight, moveUp, moveDown,
  danceHappy, danceSpin, danceExcited, surprised, lookAround,
} = BRO_FRAMES;

export const BRO_CLIPS = {
  idle: { frames: idle, frameRate: 8, repeat: -1 },
  hover: { frames: hover, frameRate: 7, repeat: -1 },
  moveRight: { frames: moveRight, frameRate: 12, repeat: -1 },
  moveLeft: { frames: moveLeft, frameRate: 12, repeat: -1 },
  moveUp: { frames: moveUp, frameRate: 12, repeat: -1 },
  moveDown: { frames: moveDown, frameRate: 12, repeat: -1 },
  danceHappy: { frames: danceHappy, frameRate: 14, repeat: 0 },
  // Faster than the other dances: this one doubles as the attack, so it
  // has to land inside the swirl's timing rather than drag past it.
  danceSpin: { frames: danceSpin, frameRate: 24, repeat: 0 },
  danceExcited: { frames: danceExcited, frameRate: 15, repeat: 0 },
  surprised: { frames: surprised, frameRate: 13, repeat: 0 },
  lookAround: { frames: lookAround, frameRate: 6, repeat: 0 },
} as const satisfies Record<string, ClipDef>;

export type BroClipName = keyof typeof BRO_CLIPS;

/**
 * One-shot clips the companion performs on its own while nothing is happening,
 * and reacts with when something does.
 *
 * Weighted: the dances are what it mostly does, the two "special" reactions are
 * rarer so they stay surprising when they turn up.
 */
export const BRO_EMOTES: readonly { clip: BroClipName; weight: number }[] = [
  { clip: 'danceHappy', weight: 4 },
  { clip: 'danceSpin', weight: 3 },
  { clip: 'danceExcited', weight: 3 },
  { clip: 'lookAround', weight: 2 },
  { clip: 'surprised', weight: 1 },
];

/**
 * The companion's attack.
 *
 * Its sheet has no strike pose -- eleven rows, none of them combat -- so the
 * spin stands in for one, and the goat's swirl is drawn over it so the move
 * reads as an attack rather than a trick, and so the pair share a visual
 * language.
 */
export const BRO_ATTACK_CLIP = 'danceSpin' satisfies BroClipName;

/** Clip order for the debug dock. */
export const BRO_CLIP_ORDER: readonly BroClipName[] = [
  'idle', 'hover', 'moveRight', 'moveLeft', 'moveUp', 'moveDown',
  'danceHappy', 'danceSpin', 'danceExcited', 'surprised', 'lookAround',
];

export function broAnimationKey(clip: BroClipName): string {
  return animationKey(BRO_TEXTURE_KEY, clip);
}

export function registerBroAnimations(anims: Phaser.Animations.AnimationManager): void {
  registerClips(anims, BRO_TEXTURE_KEY, BRO_CLIPS);
}

/** Pick a weighted emote. Separate from the entity so it stays easy to test. */
export function pickEmote(random: () => number = Math.random): BroClipName {
  const total = BRO_EMOTES.reduce((sum, e) => sum + e.weight, 0);
  let roll = random() * total;
  for (const entry of BRO_EMOTES) {
    roll -= entry.weight;
    if (roll <= 0) return entry.clip;
  }
  return 'danceHappy';
}
