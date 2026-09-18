import type Phaser from 'phaser';

import { ARROW_ANCHOR, ARROW_BODY_RATIO, ARROW_FRAMES, ARROW_FRAME_SIZE, ARROW_TEXTURE_KEY } from './arrowAtlas.generated';
import { animationKey, registerClips, type ClipDef } from './clips';
import { FIREBALL_ANCHOR, FIREBALL_BODY_RATIO, FIREBALL_FRAMES, FIREBALL_FRAME_SIZE, FIREBALL_TEXTURE_KEY } from './fireBallAtlas.generated';
import { FIREPILLAR_ANCHOR, FIREPILLAR_BODY_RATIO, FIREPILLAR_FRAMES, FIREPILLAR_FRAME_SIZE, FIREPILLAR_TEXTURE_KEY } from './firePillarAtlas.generated';
import { FIREWAVE_ANCHOR, FIREWAVE_BODY_RATIO, FIREWAVE_FRAMES, FIREWAVE_FRAME_SIZE, FIREWAVE_TEXTURE_KEY } from './fireWaveAtlas.generated';
import { ICEBEAM_ANCHOR, ICEBEAM_BODY_RATIO, ICEBEAM_FRAMES, ICEBEAM_FRAME_SIZE, ICEBEAM_TEXTURE_KEY } from './iceBeamAtlas.generated';
import { ICENOVA_ANCHOR, ICENOVA_BODY_RATIO, ICENOVA_FRAMES, ICENOVA_FRAME_SIZE, ICENOVA_TEXTURE_KEY } from './iceNovaAtlas.generated';
import { ICESHARDS_ANCHOR, ICESHARDS_BODY_RATIO, ICESHARDS_FRAMES, ICESHARDS_FRAME_SIZE, ICESHARDS_TEXTURE_KEY } from './iceShardsAtlas.generated';

/** How an ability behaves once cast. */
export type AbilityKind =
  /** Flies forward until it expires. Its clip loops as it travels. */
  | 'projectile'
  /** Plays once where it lands. */
  | 'burst';

export interface AbilityDef {
  id: string;
  name: string;
  kind: AbilityKind;
  texture: string;
  frames: readonly string[];
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  bodyRatio: number;
  frameRate: number;
  /** Drawn *height* as a fraction of the goat's body height. Width follows
   *  from the frame's own aspect, so for a long horizontal effect this sets
   *  the thickness and the length comes out of it. */
  sizeRatio: number;
  /**
   * Extra scaling along the travel axis only. 1 leaves the art untouched.
   *
   * Reach is a gameplay number and the length the art happens to be drawn at
   * is not, so this is where the two are reconciled. Prefer redrawing the
   * sheet at the right aspect when it matters -- a large stretch visibly
   * smears whatever detail the effect has across its own length.
   */
  stretchX?: number;
  /**
   * Where along the frame box the effect emanates from, 0..1.
   *
   * Defaults to the sheet's own anchor, its middle, which is right for
   * anything that travels. An effect that stays attached to the caster wants
   * its *source* pinned instead, so that making it longer sends it further
   * out rather than growing it backwards through the goat.
   */
  anchorX?: number;
  /**
   * Stand this effect on the floor, frame by frame.
   *
   * Anything that erupts from the ground needs it. The sheet's own anchor is
   * the frame's middle, so a centre-pinned pillar hangs half of itself below
   * wherever it is placed -- which buried 118 world units of the flame pillar,
   * a third of its height, under the ground.
   *
   * A fixed origin of 1 is not the fix either, and is worse: the atlas shares
   * one source box across a whole sheet, and only whichever frame reaches
   * lowest actually touches its bottom edge. Pinning to that box grounds that
   * one frame and leaves the other seven hovering by the difference -- ninety
   * units of it, in the nova's first frame. So the origin is recomputed from
   * each frame's own trim instead; see `Projectile.#standOnFloor`.
   */
  ground?: boolean;
  /**
   * Spawn point relative to the goat's origin, its feet.
   *
   * For anything thrown from a staff this is where the *head* is at the frame
   * that throws it, not where the goat is -- measured off the cast sheet. A
   * spell that spawns at the body appears to come out of the shaft.
   */
  offset: { x: number; y: number };
  /** World units per second. Zero for a burst that stays put. */
  speed: number;
  /** Seconds before it despawns. Bursts end with their clip instead. */
  life: number;
  /**
   * Seconds before it can be cast again.
   *
   * Set against what the effect does rather than how long it lasts: the cheap
   * repeatable shots recharge in well under a second so they still feel like
   * a weapon's normal output, and the big area effects are slow enough that
   * choosing to spend one matters.
   */
  cooldown: number;
  /**
   * Mana spent per cast.
   *
   * Priced off the cooldown rather than invented per spell: the two are
   * answering the same question -- how often this should be reachable -- and
   * letting them disagree gives you an ability that is cheap and rare, or
   * expensive and constant, neither of which anyone asked for. Roughly five
   * mana per second of cooldown, floored so nothing is free.
   */
  cost: number;
}

type Src = {
  T: string;
  /** The sheet's bands, in play order. Most sheets are 4 across and 2 down, so
   *  there are two; the beam is drawn 2 across and 4 down and has four. */
  F: Record<string, readonly string[]>;
  A: { readonly x: number; readonly y: number };
  S: { readonly width: number; readonly height: number };
  R: number;
};

/** Join a sheet's bands, in order, into one clip. */
function ability(
  id: string, name: string, kind: AbilityKind, src: Src,
  opts: Pick<AbilityDef, 'frameRate' | 'sizeRatio' | 'offset' | 'speed' | 'life' | 'cooldown' | 'cost'>
      & Partial<Pick<AbilityDef, 'stretchX' | 'anchorX' | 'ground'>>,
): AbilityDef {
  return {
    id, name, kind,
    texture: src.T,
    frames: Object.values(src.F).flat(),
    anchor: src.A, frameSize: src.S, bodyRatio: src.R,
    ...opts,
  };
}

const s = (
  T: string, F: Record<string, readonly string[]>, A: Src['A'], S: Src['S'], R: number,
): Src => ({ T, F, A, S, R });

export const ABILITIES = {
  // The sheet draws the arrow across a wide frame, so a ratio that sounds
  // modest as a *height* came out 273 units long -- longer than the goat is
  // tall, and better than a quarter of the screen. This lands it at roughly
  // half the goat's height, which is what an arrow should look like.
  arrow: ability('arrow', 'Arrow', 'projectile',
    s(ARROW_TEXTURE_KEY, ARROW_FRAMES, ARROW_ANCHOR, ARROW_FRAME_SIZE, ARROW_BODY_RATIO),
    { frameRate: 18, sizeRatio: 0.16, offset: { x: 54, y: -88 }, speed: 760, life: 1.6, cooldown: 0.4, cost: 4 }),

  fireBall: ability('fireBall', 'Fireball', 'projectile',
    s(FIREBALL_TEXTURE_KEY, FIREBALL_FRAMES, FIREBALL_ANCHOR, FIREBALL_FRAME_SIZE, FIREBALL_BODY_RATIO),
    { frameRate: 16, sizeRatio: 0.52, offset: { x: 134, y: -101 }, speed: 470, life: 1.9, cooldown: 0.9, cost: 8 }),
  // Stands on the floor. `y: 0` is the goat's own footing, and `anchorY: 1`
  // puts the fire's base there instead of its middle -- which is what was
  // burying 118 units of it, a third of the pillar, under the ground.
  firePillar: ability('firePillar', 'Flame pillar', 'burst',
    s(FIREPILLAR_TEXTURE_KEY, FIREPILLAR_FRAMES, FIREPILLAR_ANCHOR, FIREPILLAR_FRAME_SIZE, FIREPILLAR_BODY_RATIO),
    { frameRate: 15, sizeRatio: 1.5, ground: true,
      offset: { x: 138, y: 0 }, speed: 0, life: 1.2, cooldown: 3.4, cost: 18 }),
  // Rolls along the floor, so it is pinned to it the same way.
  fireWave: ability('fireWave', 'Flame wave', 'projectile',
    s(FIREWAVE_TEXTURE_KEY, FIREWAVE_FRAMES, FIREWAVE_ANCHOR, FIREWAVE_FRAME_SIZE, FIREWAVE_BODY_RATIO),
    { frameRate: 14, sizeRatio: 0.78, ground: true,
      offset: { x: 74, y: 0 }, speed: 300, life: 1.5, cooldown: 2.1, cost: 14 }),

  // Erupts from the ground at the goat's own feet, so its base belongs on the
  // floor line rather than a third of it below.
  iceNova: ability('iceNova', 'Frost nova', 'burst',
    s(ICENOVA_TEXTURE_KEY, ICENOVA_FRAMES, ICENOVA_ANCHOR, ICENOVA_FRAME_SIZE, ICENOVA_BODY_RATIO),
    { frameRate: 15, sizeRatio: 1.05, ground: true,
      offset: { x: 18, y: 0 }, speed: 0, life: 1.1, cooldown: 4.0, cost: 20 }),
  iceShards: ability('iceShards', 'Shard volley', 'projectile',
    s(ICESHARDS_TEXTURE_KEY, ICESHARDS_FRAMES, ICESHARDS_ANCHOR, ICESHARDS_FRAME_SIZE, ICESHARDS_BODY_RATIO),
    { frameRate: 17, sizeRatio: 0.55, offset: { x: 135, y: -141 }, speed: 620, life: 1.7, cooldown: 0.75, cost: 6 }),
  // Still anchored at its bright source rather than its middle, so it grows
  // forwards out of the staff instead of backwards over the goat's head.
  //
  // `stretchX` is gone. The old sheet drew a stubby lance and the reach was
  // faked by scaling one axis 2.2x, which smeared the crystals along their own
  // length; this sheet is drawn 2 across and 4 down, giving a 6.35:1 frame that
  // is simply long to begin with.
  iceBeam: ability('iceBeam', 'Freezing beam', 'burst',
    s(ICEBEAM_TEXTURE_KEY, ICEBEAM_FRAMES, ICEBEAM_ANCHOR, ICEBEAM_FRAME_SIZE, ICEBEAM_BODY_RATIO),
    { frameRate: 16, sizeRatio: 0.5, anchorX: 0.03,
      offset: { x: 128, y: -94 }, speed: 0, life: 1.1, cooldown: 2.8, cost: 15 }),
} as const satisfies Record<string, AbilityDef>;

export type AbilityId = keyof typeof ABILITIES;

export function abilityKey(id: AbilityId): string {
  return animationKey(ABILITIES[id].texture, 'cast');
}

export function registerAbilityAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const def of Object.values(ABILITIES)) {
    const clip: ClipDef = {
      frames: def.frames,
      frameRate: def.frameRate,
      // A travelling effect loops its clip for as long as it is in the air; a
      // burst plays through once and is done.
      repeat: def.kind === 'projectile' ? -1 : 0,
    };
    registerClips(anims, def.texture, { cast: clip });
  }
}

export const ABILITY_TEXTURES: readonly string[] =
  Object.values(ABILITIES).map((a) => a.texture);
