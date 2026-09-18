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
  /** Drawn size as a fraction of the goat's body height. */
  sizeRatio: number;
  /** Spawn point relative to the goat's origin, its feet. */
  offset: { x: number; y: number };
  /** World units per second. Zero for a burst that stays put. */
  speed: number;
  /** Seconds before it despawns. Bursts end with their clip instead. */
  life: number;
}

type Src = {
  T: string;
  F: { readonly cast: readonly string[]; readonly cast_b: readonly string[] };
  A: { readonly x: number; readonly y: number };
  S: { readonly width: number; readonly height: number };
  R: number;
};

/** Every sheet is 4 across and 2 down, so the two rows join into one clip. */
function ability(
  id: string, name: string, kind: AbilityKind, src: Src,
  opts: { frameRate: number; sizeRatio: number; offset: { x: number; y: number }; speed: number; life: number },
): AbilityDef {
  return {
    id, name, kind,
    texture: src.T,
    frames: [...src.F.cast, ...src.F.cast_b],
    anchor: src.A, frameSize: src.S, bodyRatio: src.R,
    ...opts,
  };
}

const s = (T: string, F: Src['F'], A: Src['A'], S: Src['S'], R: number): Src => ({ T, F, A, S, R });

export const ABILITIES = {
  arrow: ability('arrow', 'Arrow', 'projectile',
    s(ARROW_TEXTURE_KEY, ARROW_FRAMES, ARROW_ANCHOR, ARROW_FRAME_SIZE, ARROW_BODY_RATIO),
    { frameRate: 18, sizeRatio: 0.34, offset: { x: 54, y: -92 }, speed: 760, life: 1.6 }),

  fireBall: ability('fireBall', 'Fireball', 'projectile',
    s(FIREBALL_TEXTURE_KEY, FIREBALL_FRAMES, FIREBALL_ANCHOR, FIREBALL_FRAME_SIZE, FIREBALL_BODY_RATIO),
    { frameRate: 16, sizeRatio: 0.52, offset: { x: 56, y: -96 }, speed: 470, life: 1.9 }),
  firePillar: ability('firePillar', 'Flame pillar', 'burst',
    s(FIREPILLAR_TEXTURE_KEY, FIREPILLAR_FRAMES, FIREPILLAR_ANCHOR, FIREPILLAR_FRAME_SIZE, FIREPILLAR_BODY_RATIO),
    { frameRate: 15, sizeRatio: 1.5, offset: { x: 150, y: -62 }, speed: 0, life: 1.2 }),
  fireWave: ability('fireWave', 'Flame wave', 'projectile',
    s(FIREWAVE_TEXTURE_KEY, FIREWAVE_FRAMES, FIREWAVE_ANCHOR, FIREWAVE_FRAME_SIZE, FIREWAVE_BODY_RATIO),
    { frameRate: 14, sizeRatio: 0.78, offset: { x: 74, y: -34 }, speed: 300, life: 1.5 }),

  iceNova: ability('iceNova', 'Frost nova', 'burst',
    s(ICENOVA_TEXTURE_KEY, ICENOVA_FRAMES, ICENOVA_ANCHOR, ICENOVA_FRAME_SIZE, ICENOVA_BODY_RATIO),
    { frameRate: 15, sizeRatio: 1.05, offset: { x: 18, y: -26 }, speed: 0, life: 1.1 }),
  iceShards: ability('iceShards', 'Shard volley', 'projectile',
    s(ICESHARDS_TEXTURE_KEY, ICESHARDS_FRAMES, ICESHARDS_ANCHOR, ICESHARDS_FRAME_SIZE, ICESHARDS_BODY_RATIO),
    { frameRate: 17, sizeRatio: 0.42, offset: { x: 54, y: -94 }, speed: 620, life: 1.7 }),
  iceBeam: ability('iceBeam', 'Freezing beam', 'burst',
    s(ICEBEAM_TEXTURE_KEY, ICEBEAM_FRAMES, ICEBEAM_ANCHOR, ICEBEAM_FRAME_SIZE, ICEBEAM_BODY_RATIO),
    { frameRate: 16, sizeRatio: 0.46, offset: { x: 176, y: -92 }, speed: 0, life: 1.0 }),
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
