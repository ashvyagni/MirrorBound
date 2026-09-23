import type Phaser from 'phaser';

import { animationKey, registerClips, viewForDirection, type ClipDef, type ViewDirection } from './clips';
import {
  GOAT_ANCHOR, GOAT_BODY_RATIO, GOAT_FRAMES, GOAT_FRAME_SIZE, GOAT_TEXTURE_KEY,
} from './goatAtlas.generated';
import {
  GOATBACK_ANCHOR, GOATBACK_BODY_RATIO, GOATBACK_FRAMES, GOATBACK_FRAME_SIZE, GOATBACK_TEXTURE_KEY,
} from './goatBackAtlas.generated';
import {
  GOATFRONT_ANCHOR, GOATFRONT_BODY_RATIO, GOATFRONT_FRAMES, GOATFRONT_FRAME_SIZE, GOATFRONT_TEXTURE_KEY,
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

// --- the three views ---------------------------------------------------------

/**
 * Which of the three sheets a facing lands on.
 *
 * `side` is the only one drawn in profile and the only one with a full clip
 * table, so a diagonal stays on it.
 */
export type GoatView = ViewDirection;

export function goatViewFor(facing: { x: number; y: number }): GoatView {
  return viewForDirection(facing);
}

/**
 * How each sheet is drawn and measured.
 *
 * The three are cropped differently -- 251x289, 259x374 and 268x364 -- so the
 * scale is solved against each sheet's own *body* ratio rather than its frame
 * height. Matching frame heights instead would shrink the goat by a quarter
 * the moment it turned to walk upward.
 */
export const GOAT_VIEWS: Readonly<Record<GoatView, {
  texture: string;
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  bodyRatio: number;
  /** Only the side sheet is drawn in profile, so only it is ever mirrored. */
  mirrors: boolean;
}>> = {
  side: { texture: GOAT_TEXTURE_KEY, anchor: GOAT_ANCHOR, frameSize: GOAT_FRAME_SIZE, bodyRatio: GOAT_BODY_RATIO, mirrors: true },
  front: { texture: GOATFRONT_TEXTURE_KEY, anchor: GOATFRONT_ANCHOR, frameSize: GOATFRONT_FRAME_SIZE, bodyRatio: GOATFRONT_BODY_RATIO, mirrors: false },
  back: { texture: GOATBACK_TEXTURE_KEY, anchor: GOATBACK_ANCHOR, frameSize: GOATBACK_FRAME_SIZE, bodyRatio: GOATBACK_BODY_RATIO, mirrors: false },
};

/**
 * The vertical sheets hold one eight-frame walk row and nothing else -- no
 * idle, no attack, no hurt. So they carry locomotion only and every other
 * state falls back to the side sheet, which has the full table.
 */
export const VERTICAL_CLIPS = ['walk', 'run'] as const satisfies readonly ClipName[];
export type VerticalClip = (typeof VERTICAL_CLIPS)[number];

export function isVerticalClip(clip: ClipName): clip is VerticalClip {
  return (VERTICAL_CLIPS as readonly string[]).includes(clip);
}

/** The animation key for a clip on a given sheet. */
export function goatViewKey(view: GoatView, clip: ClipName): string {
  if (view === 'side' || !isVerticalClip(clip)) return goatAnimationKey(clip);
  return animationKey(GOAT_VIEWS[view].texture, clip);
}

export function registerGoatAnimations(anims: Phaser.Animations.AnimationManager): void {
  registerClips(anims, GOAT_TEXTURE_KEY, CLIPS);
  for (const [texture, frames] of [
    [GOATFRONT_TEXTURE_KEY, [...GOATFRONT_FRAMES.walk, ...GOATFRONT_FRAMES.walk_b]],
    [GOATBACK_TEXTURE_KEY, [...GOATBACK_FRAMES.walk, ...GOATBACK_FRAMES.walk_b]],
  ] as const) {
    registerClips(anims, texture, {
      walk: { frames, frameRate: CLIPS.walk.frameRate, repeat: -1 },
      run: { frames, frameRate: CLIPS.run.frameRate, repeat: -1 },
    });
  }
}

/** Every texture the player needs loaded. */
export const GOAT_TEXTURES: readonly string[] = [
  GOAT_TEXTURE_KEY, GOATFRONT_TEXTURE_KEY, GOATBACK_TEXTURE_KEY,
];
