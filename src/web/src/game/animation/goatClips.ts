import type Phaser from 'phaser';

import { animationKey, registerClips, type ClipDef } from './clips';
import {
  GOAT_ANCHOR, GOAT_BODY_RATIO, GOAT_FRAMES, GOAT_FRAME_SIZE, GOAT_TEXTURE_KEY,
} from './goatAtlas.generated';
import {
  GOATBACK_ANCHOR, GOATBACK_BODY_RATIO, GOATBACK_FRAMES, GOATBACK_FRAME_SIZE,
  GOATBACK_TEXTURE_KEY,
} from './goatBackAtlas.generated';
import {
  GOATFRONT_ANCHOR, GOATFRONT_BODY_RATIO, GOATFRONT_FRAMES, GOATFRONT_FRAME_SIZE,
  GOATFRONT_TEXTURE_KEY,
} from './goatFrontAtlas.generated';

export { GOAT_TEXTURE_KEY as GOAT_TEXTURE } from './goatAtlas.generated';

/**
 * The goat's animations.
 *
 * `frames` slices the generated frame list, so renaming or reordering frames in
 * the sheet surfaces here as a type error rather than a silent mis-play. The
 * jump row is one drawn arc -- crouch, launch, apex, descend, descend, land --
 * so it is split into the three clips the state machine actually needs.
 */
const { idle, walk, run, jump, attack, strike, hurt, die } = GOAT_FRAMES;

export const CLIPS = {
  idle: { frames: idle, frameRate: 7, repeat: -1 },
  walk: { frames: walk, frameRate: 11, repeat: -1 },
  run: { frames: run, frameRate: 15, repeat: -1 },
  rise: { frames: jump.slice(0, 3), frameRate: 14, repeat: 0, hold: true },
  fall: { frames: jump.slice(3, 5), frameRate: 9, repeat: 0, hold: true },
  land: { frames: jump.slice(5), frameRate: 12, repeat: 0, hold: true },
  attack: { frames: attack, frameRate: 16, repeat: 0, hold: true },
  // The same poses with the goat's own swirl removed, for when it is
  // holding something. Otherwise it throws a bare-handed effect while
  // swinging a sword, because the sheet bakes the effect into the pose.
  strike: { frames: strike, frameRate: 16, repeat: 0, hold: true },
  hurt: { frames: hurt, frameRate: 1, repeat: 0, hold: true },
  die: { frames: die, frameRate: 1, repeat: 0, hold: true },
} as const satisfies Record<string, ClipDef>;

export type ClipName = keyof typeof CLIPS;

/** Clips the debug dock offers, in the order they appear on the sheet.
 *  `rise`, `fall` and `land` are the jump row: nothing plays them now that the
 *  world is seen from above, but they are still on the sheet and still worth
 *  being able to look at. */
export const CLIP_ORDER: readonly ClipName[] = [
  'idle', 'walk', 'run', 'rise', 'fall', 'land', 'attack', 'strike', 'hurt', 'die',
];

/** Expression portraits. Not animations -- single frames shown in the UI. */
export const EXPRESSIONS = GOAT_FRAMES.face;

export function goatAnimationKey(clip: ClipName): string {
  return animationKey(GOAT_TEXTURE_KEY, clip);
}

export function registerGoatAnimations(anims: Phaser.Animations.AnimationManager): void {
  registerClips(anims, GOAT_TEXTURE_KEY, CLIPS);
}


// --- facings ----------------------------------------------------------------

/**
 * Which drawing of the goat the camera is looking at.
 *
 * The original sheet is side-on, which cannot show a creature walking away
 * from the camera or toward it -- and with two axes of movement it does both.
 * Two more sheets cover those, and this is how the three are told apart.
 */
export type FacingRow = 'side' | 'up' | 'down';

export interface FacingSheet {
  texture: string;
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  /** How tall the goat itself is inside the frame box, 0..1. Sizing by this
   *  rather than by frame height keeps the creature the same size on all three
   *  sheets, whose boxes are cropped differently. */
  bodyRatio: number;
  /**
   * Whether the sprite may be mirrored.
   *
   * False for the front and back views: they are symmetrical, so flipping one
   * changes nothing except which way the horns spiral, which then flickers as
   * the goat strafes.
   */
  flippable: boolean;
  /** Animation keys for the three locomotion states. */
  idle: string;
  walk: string;
  run: string;
}

const facingKeys = (texture: string) => ({
  idle: animationKey(texture, 'idle'),
  walk: animationKey(texture, 'walk'),
  run: animationKey(texture, 'run'),
});

export const FACINGS: Record<FacingRow, FacingSheet> = {
  side: {
    texture: GOAT_TEXTURE_KEY,
    anchor: GOAT_ANCHOR,
    frameSize: GOAT_FRAME_SIZE,
    bodyRatio: GOAT_BODY_RATIO,
    flippable: true,
    ...facingKeys(GOAT_TEXTURE_KEY),
  },
  up: {
    texture: GOATBACK_TEXTURE_KEY,
    anchor: GOATBACK_ANCHOR,
    frameSize: GOATBACK_FRAME_SIZE,
    bodyRatio: GOATBACK_BODY_RATIO,
    flippable: false,
    ...facingKeys(GOATBACK_TEXTURE_KEY),
  },
  down: {
    texture: GOATFRONT_TEXTURE_KEY,
    anchor: GOATFRONT_ANCHOR,
    frameSize: GOATFRONT_FRAME_SIZE,
    bodyRatio: GOATFRONT_BODY_RATIO,
    flippable: false,
    ...facingKeys(GOATFRONT_TEXTURE_KEY),
  },
};

/**
 * Which row to draw, from the way the goat is pointing.
 *
 * The bias keeps a mostly-sideways diagonal on the side sheet, which is the
 * only one with any character in it -- a face, a profile, a direction. Without
 * it a gentle diagonal flips to the back view and the goat turns its face away
 * for no good reason.
 */
export function rowFor(aim: { x: number; y: number }): FacingRow {
  if (Math.abs(aim.y) <= Math.abs(aim.x) + 0.2) return 'side';
  return aim.y < 0 ? 'up' : 'down';
}

/** The two new sheets hold one walk cycle each; run replays it faster, and
 *  standing holds its first frame, which is drawn as a settled contact pose. */
export function registerFacingAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const [texture, frames] of [
    [GOATBACK_TEXTURE_KEY, GOATBACK_FRAMES],
    [GOATFRONT_TEXTURE_KEY, GOATFRONT_FRAMES],
  ] as const) {
    const cycle = [...frames.walk, ...frames.walk_b];
    registerClips(anims, texture, {
      idle: { frames: [cycle[0]!], frameRate: 1, repeat: -1 },
      walk: { frames: cycle, frameRate: 11, repeat: -1 },
      run: { frames: cycle, frameRate: 16, repeat: -1 },
    });
  }
}

/** Every texture the character needs loaded. */
export const GOAT_TEXTURES: readonly string[] = [
  GOAT_TEXTURE_KEY, GOATBACK_TEXTURE_KEY, GOATFRONT_TEXTURE_KEY,
];
