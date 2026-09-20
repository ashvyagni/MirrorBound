/**
 * Spell and projectile art: Logesh's effect sheets, adapted for main.
 *
 * His version of this file carried the gameplay numbers too -- speed, lifetime,
 * cooldown, mana cost -- because on his branch the client simulated the spell.
 * Here the server owns all four, so they are gone and only the art survives:
 * which sheet, how big, which way up, and where it leaves the caster.
 *
 * Every sheet is drawn 4 across and 2 down (the beam is 2 across and 4 down),
 * and the generator splits each into bands; they join back into one clip here.
 */

import type Phaser from 'phaser';

import { ARROW_ANCHOR, ARROW_BODY_RATIO, ARROW_FRAMES, ARROW_FRAME_SIZE, ARROW_TEXTURE_KEY } from './arrowAtlas.generated';
import { animationKey, registerClips, type ClipDef } from './clips';
import { COAL_ANCHOR, COAL_BODY_RATIO, COAL_FRAMES, COAL_FRAME_SIZE, COAL_TEXTURE_KEY } from './coalAtlas.generated';
import { FIREBALL_ANCHOR, FIREBALL_BODY_RATIO, FIREBALL_FRAMES, FIREBALL_FRAME_SIZE, FIREBALL_TEXTURE_KEY } from './fireBallAtlas.generated';
import { FIREPILLAR_ANCHOR, FIREPILLAR_BODY_RATIO, FIREPILLAR_FRAMES, FIREPILLAR_FRAME_SIZE, FIREPILLAR_TEXTURE_KEY } from './firePillarAtlas.generated';
import { FIREWAVE_ANCHOR, FIREWAVE_BODY_RATIO, FIREWAVE_FRAMES, FIREWAVE_FRAME_SIZE, FIREWAVE_TEXTURE_KEY } from './fireWaveAtlas.generated';
import { ICEBEAM_ANCHOR, ICEBEAM_BODY_RATIO, ICEBEAM_FRAMES, ICEBEAM_FRAME_SIZE, ICEBEAM_TEXTURE_KEY } from './iceBeamAtlas.generated';
import { ICENOVA_ANCHOR, ICENOVA_BODY_RATIO, ICENOVA_FRAMES, ICENOVA_FRAME_SIZE, ICENOVA_TEXTURE_KEY } from './iceNovaAtlas.generated';
import { ICESHARDS_ANCHOR, ICESHARDS_BODY_RATIO, ICESHARDS_FRAMES, ICESHARDS_FRAME_SIZE, ICESHARDS_TEXTURE_KEY } from './iceShardsAtlas.generated';
import { MIRRORBOLT_ANCHOR, MIRRORBOLT_BODY_RATIO, MIRRORBOLT_FRAMES, MIRRORBOLT_FRAME_SIZE, MIRRORBOLT_TEXTURE_KEY } from './mirrorBoltAtlas.generated';
import { SHARDRING_ANCHOR, SHARDRING_BODY_RATIO, SHARDRING_FRAMES, SHARDRING_FRAME_SIZE, SHARDRING_TEXTURE_KEY } from './shardRingAtlas.generated';
import { THORN_ANCHOR, THORN_BODY_RATIO, THORN_FRAMES, THORN_FRAME_SIZE, THORN_TEXTURE_KEY } from './thornAtlas.generated';

/** How long an effect lasts. */
export type EffectKind =
  /** In flight for as long as the server keeps it alive: the clip loops. */
  | 'thrown'
  /** Plays through once and is done. */
  | 'burst';

export interface EffectDef {
  id: string;
  kind: EffectKind;
  /**
   * Stand it on the floor and never turn it.
   *
   * One flag for both, because they are the same question. A flame pillar
   * tipped forty degrees is a pillar falling over, and a wave that rolls along
   * the ground rolls along it at every angle.
   */
  ground?: boolean;
  texture: string;
  frames: readonly string[];
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  bodyRatio: number;
  frameRate: number;
  /**
   * Drawn *height* as a fraction of the player's body height. Width follows
   * from the frame's own aspect, so for a long horizontal effect this sets the
   * thickness and the length comes out of it.
   */
  sizeRatio: number;
  /**
   * Where along the frame box the effect emanates from, 0..1. Defaults to the
   * sheet's own anchor. An effect that hangs off the staff wants its *source*
   * pinned instead, so lengthening it reaches further out rather than growing
   * backwards through the caster.
   */
  anchorX?: number;
}

type Bands = Readonly<Record<string, readonly string[]>>;

function effect(
  id: string,
  kind: EffectKind,
  texture: string,
  bands: Bands,
  anchor: EffectDef['anchor'],
  frameSize: EffectDef['frameSize'],
  bodyRatio: number,
  frameRate: number,
  sizeRatio: number,
  extra: Partial<Pick<EffectDef, 'ground' | 'anchorX'>> = {},
): EffectDef {
  return {
    id, kind, texture, frames: Object.values(bands).flat(),
    anchor, frameSize, bodyRatio, frameRate, sizeRatio, ...extra,
  };
}

/** Every effect sheet, by its own name. */
export const EFFECTS = {
  // The sheet draws the arrow across a wide frame, so a ratio that sounds
  // modest as a *height* comes out longer than the player is tall. Logesh's
  // 0.16 lands it at roughly half the body, which is what an arrow looks like.
  arrow: effect('arrow', 'thrown', ARROW_TEXTURE_KEY, ARROW_FRAMES, ARROW_ANCHOR, ARROW_FRAME_SIZE, ARROW_BODY_RATIO, 18, 0.16),
  thorn: effect('thorn', 'thrown', THORN_TEXTURE_KEY, THORN_FRAMES, THORN_ANCHOR, THORN_FRAME_SIZE, THORN_BODY_RATIO, 18, 0.2),
  coal: effect('coal', 'thrown', COAL_TEXTURE_KEY, COAL_FRAMES, COAL_ANCHOR, COAL_FRAME_SIZE, COAL_BODY_RATIO, 16, 0.32),
  fireBall: effect('fireBall', 'thrown', FIREBALL_TEXTURE_KEY, FIREBALL_FRAMES, FIREBALL_ANCHOR, FIREBALL_FRAME_SIZE, FIREBALL_BODY_RATIO, 16, 0.52),
  iceShards: effect('iceShards', 'thrown', ICESHARDS_TEXTURE_KEY, ICESHARDS_FRAMES, ICESHARDS_ANCHOR, ICESHARDS_FRAME_SIZE, ICESHARDS_BODY_RATIO, 17, 0.55),
  // Stands on the floor. Its base belongs on the floor line rather than a third
  // of the pillar below it -- see `Vfx.#standOnFloor`.
  firePillar: effect('firePillar', 'burst', FIREPILLAR_TEXTURE_KEY, FIREPILLAR_FRAMES, FIREPILLAR_ANCHOR, FIREPILLAR_FRAME_SIZE, FIREPILLAR_BODY_RATIO, 15, 1.5, { ground: true }),
  fireWave: effect('fireWave', 'burst', FIREWAVE_TEXTURE_KEY, FIREWAVE_FRAMES, FIREWAVE_ANCHOR, FIREWAVE_FRAME_SIZE, FIREWAVE_BODY_RATIO, 14, 0.78, { ground: true }),
  iceNova: effect('iceNova', 'burst', ICENOVA_TEXTURE_KEY, ICENOVA_FRAMES, ICENOVA_ANCHOR, ICENOVA_FRAME_SIZE, ICENOVA_BODY_RATIO, 15, 1.05, { ground: true }),
  // Turns with the aim and is anchored at its bright source rather than its
  // middle, so it grows forwards out of the staff instead of backwards over
  // the caster's head. Not a `ground` effect: it is thrown, it just stays put.
  iceBeam: effect('iceBeam', 'burst', ICEBEAM_TEXTURE_KEY, ICEBEAM_FRAMES, ICEBEAM_ANCHOR, ICEBEAM_FRAME_SIZE, ICEBEAM_BODY_RATIO, 16, 0.5, { anchorX: 0.03 }),
  // The Mirror's two, listed in `BOSS_EFFECTS` below and therefore not fetched
  // at boot: they are wanted in one room in the game, so they ride along with
  // the boss's own sheets and until then its bolt draws as the painted
  // texture, the way any kind with no sheet does.
  mirrorBolt: effect('mirrorBolt', 'thrown', MIRRORBOLT_TEXTURE_KEY, MIRRORBOLT_FRAMES, MIRRORBOLT_ANCHOR, MIRRORBOLT_FRAME_SIZE, MIRRORBOLT_BODY_RATIO, 17, 0.34),
  shardRing: effect('shardRing', 'burst', SHARDRING_TEXTURE_KEY, SHARDRING_FRAMES, SHARDRING_ANCHOR, SHARDRING_FRAME_SIZE, SHARDRING_BODY_RATIO, 15, 1.9, { ground: true }),
} as const satisfies Record<string, EffectDef>;

/**
 * Effects that belong to the final boss and load with it rather than at boot.
 *
 * `EnemyAtlasLoader` fetches these with the mirror family and registers their
 * clips at the same time, which is why they are named here rather than in that
 * file: this is where an effect's texture and frames live.
 */
export const BOSS_EFFECT_IDS = ['mirrorBolt', 'shardRing'] as const;

export type EffectId = keyof typeof EFFECTS;

/**
 * The server's projectile `kind` to the sheet that draws it.
 *
 * These are the ids `mirrorbound.game.combat.weapons` and `enemy.py` already
 * put on the wire; a kind that is not here keeps the painted `proj:` texture.
 */
export const PROJECTILE_ART: Readonly<Record<string, EffectId>> = {
  arrow: 'arrow',
  bone_arrow: 'arrow',
  fire_bolt: 'fireBall',
  ice_bolt: 'iceShards',
  mirror_bolt: 'mirrorBolt',
  // The Fen Spitter's pod and the Kiln Shardling's shell fragments. Both
  // borrow a sheet whose *shape* is right -- a thrown seed and a hard chip --
  // and take their own colour from the tint table below, which is the same
  // trade the bone arrow makes.
  spore_pod: 'thorn',
  shell_shard: 'coal',
};

/** Extra tint for a sheet standing in for a kind it was not drawn as. */
export const PROJECTILE_TINT: Readonly<Record<string, number>> = {
  bone_arrow: 0xd8d2c2,
  // Sickly plant green, and the shardling's own kiln orange.
  spore_pod: 0x9fbf5a,
  shell_shard: 0xe0733a,
  // `mirror_bolt` is no longer here: it was tinted because `coal` was standing
  // in for it, and its own sheet is already the colour it should be.
};

export function effectKey(def: EffectDef): string {
  return animationKey(def.texture, 'cast');
}

/** Loaded at boot: everything except the boss's own two. */
export const EFFECT_TEXTURES: readonly string[] = Object.entries(EFFECTS)
  .filter(([id]) => !(BOSS_EFFECT_IDS as readonly string[]).includes(id))
  .map(([, e]) => e.texture);

function registerEffect(anims: Phaser.Animations.AnimationManager, def: EffectDef): void {
  registerClips(anims, def.texture, {
    cast: {
      frames: def.frames,
      frameRate: def.frameRate,
      // A travelling effect loops for as long as the server keeps it alive; a
      // burst plays through once and is done.
      repeat: def.kind === 'thrown' ? -1 : 0,
    } satisfies ClipDef,
  });
}

/**
 * Register every effect whose sheet is loaded at boot.
 *
 * The boss's two are skipped here on purpose: a clip whose frames name a
 * texture that has not arrived is a clip that draws nothing, and Phaser keys
 * animations globally so it would not be replaced later.
 */
export function registerEffectAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const [id, def] of Object.entries(EFFECTS)) {
    if ((BOSS_EFFECT_IDS as readonly string[]).includes(id)) continue;
    registerEffect(anims, def);
  }
}

/** Register the boss's, once `EnemyAtlasLoader` has its sheets. */
export function registerBossEffectAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const id of BOSS_EFFECT_IDS) registerEffect(anims, EFFECTS[id]);
}

// --- the Mirror's copies -----------------------------------------------------

/**
 * The same effects, drawn blackened, for a boss fighting with your weapons.
 *
 * The companion to `darkSwing` in `weaponClips`: that puts your sword in the
 * Mirror's hands, and this makes what leaves the staff match it. A Mirror
 * holding a blackened staff that throws a bright orange fireball reads as two
 * different fights happening at once.
 *
 * Seven of the effect sheets were drawn dark; the rest -- the thorn, the coal,
 * the boss's own bolt and ring -- were not, and fall through to their originals
 * rather than to a wrong colour.
 */
const DARK_EFFECTS: ReadonlySet<string> = new Set([
  ARROW_TEXTURE_KEY, FIREBALL_TEXTURE_KEY, ICESHARDS_TEXTURE_KEY,
  FIREPILLAR_TEXTURE_KEY, FIREWAVE_TEXTURE_KEY, ICENOVA_TEXTURE_KEY, ICEBEAM_TEXTURE_KEY,
]);

/** The blackened sheet for an effect, or the same effect back. */
export function darkEffect(def: EffectDef): EffectDef {
  if (!DARK_EFFECTS.has(def.texture)) return def;
  return { ...def, texture: `${def.texture}Dark` };
}

/** Fetched with the dark weapon sheets, and only when something is armed. */
export const DARK_EFFECT_TEXTURES: readonly string[] = [...DARK_EFFECTS].map((t) => `${t}Dark`);

export function registerDarkEffectAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const def of Object.values(EFFECTS)) {
    const dark = darkEffect(def);
    if (dark.texture !== def.texture) registerEffect(anims, dark);
  }
}
