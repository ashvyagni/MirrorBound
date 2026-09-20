/**
 * Logesh's enemy sheets: four states per enemy, plus the shared alert mark.
 *
 * GENERATED shape, hand-tuned numbers. Each sheet is drawn 4 across and 2 down
 * and the generator splits it into two bands, so the two join back into one
 * clip here -- the same arrangement the weapon swings use.
 *
 * `sizeRatio` is the enemy's body height as a fraction of the player's body
 * height. It has to be a *body* ratio rather than a frame height because the
 * four sheets of one enemy are cropped differently: the skeleton's idle box is
 * 285x448 and its attack box 454x385, so matching frame heights alone would
 * make it grow every time it swung.
 */

import type Phaser from 'phaser';

import { BOSS_EFFECT_IDS, EFFECTS, registerBossEffectAnimations } from './abilityClips';
import { animationKey, registerClips, type ClipDef } from './clips';

/** The Mirror's own effect sheets, by texture key. */
const BOSS_EFFECT_TEXTURES: readonly string[] = BOSS_EFFECT_IDS.map((id) => EFFECTS[id].texture);
import {
  ALERTMARK_ANCHOR, ALERTMARK_BODY_RATIO, ALERTMARK_FRAMES, ALERTMARK_FRAME_SIZE, ALERTMARK_TEXTURE_KEY,
} from './alertMarkAtlas.generated';
import {
  ACOLYTEALERT_ANCHOR, ACOLYTEALERT_BODY_RATIO, ACOLYTEALERT_FRAMES, ACOLYTEALERT_FRAME_SIZE, ACOLYTEALERT_TEXTURE_KEY,
} from './acolyteAlertAtlas.generated';
import {
  ACOLYTEATTACK_ANCHOR, ACOLYTEATTACK_BODY_RATIO, ACOLYTEATTACK_FRAMES, ACOLYTEATTACK_FRAME_SIZE, ACOLYTEATTACK_TEXTURE_KEY,
} from './acolyteAttackAtlas.generated';
import {
  ACOLYTEIDLE_ANCHOR, ACOLYTEIDLE_BODY_RATIO, ACOLYTEIDLE_FRAMES, ACOLYTEIDLE_FRAME_SIZE, ACOLYTEIDLE_TEXTURE_KEY,
} from './acolyteIdleAtlas.generated';
import {
  ACOLYTEWALK_ANCHOR, ACOLYTEWALK_BODY_RATIO, ACOLYTEWALK_FRAMES, ACOLYTEWALK_FRAME_SIZE, ACOLYTEWALK_TEXTURE_KEY,
} from './acolyteWalkAtlas.generated';
import {
  ARCHERALERT_ANCHOR, ARCHERALERT_BODY_RATIO, ARCHERALERT_FRAMES, ARCHERALERT_FRAME_SIZE, ARCHERALERT_TEXTURE_KEY,
} from './archerAlertAtlas.generated';
import {
  ARCHERATTACK_ANCHOR, ARCHERATTACK_BODY_RATIO, ARCHERATTACK_FRAMES, ARCHERATTACK_FRAME_SIZE, ARCHERATTACK_TEXTURE_KEY,
} from './archerAttackAtlas.generated';
import {
  ARCHERIDLE_ANCHOR, ARCHERIDLE_BODY_RATIO, ARCHERIDLE_FRAMES, ARCHERIDLE_FRAME_SIZE, ARCHERIDLE_TEXTURE_KEY,
} from './archerIdleAtlas.generated';
import {
  ARCHERWALK_ANCHOR, ARCHERWALK_BODY_RATIO, ARCHERWALK_FRAMES, ARCHERWALK_FRAME_SIZE, ARCHERWALK_TEXTURE_KEY,
} from './archerWalkAtlas.generated';
import {
  BRUTEALERT_ANCHOR, BRUTEALERT_BODY_RATIO, BRUTEALERT_FRAMES, BRUTEALERT_FRAME_SIZE, BRUTEALERT_TEXTURE_KEY,
} from './bruteAlertAtlas.generated';
import {
  BRUTEATTACK_ANCHOR, BRUTEATTACK_BODY_RATIO, BRUTEATTACK_FRAMES, BRUTEATTACK_FRAME_SIZE, BRUTEATTACK_TEXTURE_KEY,
} from './bruteAttackAtlas.generated';
import {
  BRUTEIDLE_ANCHOR, BRUTEIDLE_BODY_RATIO, BRUTEIDLE_FRAMES, BRUTEIDLE_FRAME_SIZE, BRUTEIDLE_TEXTURE_KEY,
} from './bruteIdleAtlas.generated';
import {
  BRUTEWALK_ANCHOR, BRUTEWALK_BODY_RATIO, BRUTEWALK_FRAMES, BRUTEWALK_FRAME_SIZE, BRUTEWALK_TEXTURE_KEY,
} from './bruteWalkAtlas.generated';
import {
  HOUNDALERT_ANCHOR, HOUNDALERT_BODY_RATIO, HOUNDALERT_FRAMES, HOUNDALERT_FRAME_SIZE, HOUNDALERT_TEXTURE_KEY,
} from './houndAlertAtlas.generated';
import {
  HOUNDATTACK_ANCHOR, HOUNDATTACK_BODY_RATIO, HOUNDATTACK_FRAMES, HOUNDATTACK_FRAME_SIZE, HOUNDATTACK_TEXTURE_KEY,
} from './houndAttackAtlas.generated';
import {
  HOUNDIDLE_ANCHOR, HOUNDIDLE_BODY_RATIO, HOUNDIDLE_FRAMES, HOUNDIDLE_FRAME_SIZE, HOUNDIDLE_TEXTURE_KEY,
} from './houndIdleAtlas.generated';
import {
  HOUNDWALK_ANCHOR, HOUNDWALK_BODY_RATIO, HOUNDWALK_FRAMES, HOUNDWALK_FRAME_SIZE, HOUNDWALK_TEXTURE_KEY,
} from './houndWalkAtlas.generated';
import {
  MIRRORCAST_ANCHOR, MIRRORCAST_BODY_RATIO, MIRRORCAST_FRAMES, MIRRORCAST_FRAME_SIZE, MIRRORCAST_TEXTURE_KEY,
} from './mirrorCastAtlas.generated';
import {
  MIRRORDEATH_ANCHOR, MIRRORDEATH_BODY_RATIO, MIRRORDEATH_FRAMES, MIRRORDEATH_FRAME_SIZE, MIRRORDEATH_TEXTURE_KEY,
} from './mirrorDeathAtlas.generated';
import {
  MIRRORDRIFT_ANCHOR, MIRRORDRIFT_BODY_RATIO, MIRRORDRIFT_FRAMES, MIRRORDRIFT_FRAME_SIZE, MIRRORDRIFT_TEXTURE_KEY,
} from './mirrorDriftAtlas.generated';
import {
  MIRRORIDLE_ANCHOR, MIRRORIDLE_BODY_RATIO, MIRRORIDLE_FRAMES, MIRRORIDLE_FRAME_SIZE, MIRRORIDLE_TEXTURE_KEY,
} from './mirrorIdleAtlas.generated';
import {
  MIRRORSTRIKE_ANCHOR, MIRRORSTRIKE_BODY_RATIO, MIRRORSTRIKE_FRAMES, MIRRORSTRIKE_FRAME_SIZE, MIRRORSTRIKE_TEXTURE_KEY,
} from './mirrorStrikeAtlas.generated';
import {
  SCARABALERT_ANCHOR, SCARABALERT_BODY_RATIO, SCARABALERT_FRAMES, SCARABALERT_FRAME_SIZE, SCARABALERT_TEXTURE_KEY,
} from './scarabAlertAtlas.generated';
import {
  SCARABATTACK_ANCHOR, SCARABATTACK_BODY_RATIO, SCARABATTACK_FRAMES, SCARABATTACK_FRAME_SIZE, SCARABATTACK_TEXTURE_KEY,
} from './scarabAttackAtlas.generated';
import {
  SCARABIDLE_ANCHOR, SCARABIDLE_BODY_RATIO, SCARABIDLE_FRAMES, SCARABIDLE_FRAME_SIZE, SCARABIDLE_TEXTURE_KEY,
} from './scarabIdleAtlas.generated';
import {
  SCARABWALK_ANCHOR, SCARABWALK_BODY_RATIO, SCARABWALK_FRAMES, SCARABWALK_FRAME_SIZE, SCARABWALK_TEXTURE_KEY,
} from './scarabWalkAtlas.generated';
import {
  SHARDLINGALERT_ANCHOR, SHARDLINGALERT_BODY_RATIO, SHARDLINGALERT_FRAMES, SHARDLINGALERT_FRAME_SIZE, SHARDLINGALERT_TEXTURE_KEY,
} from './shardlingAlertAtlas.generated';
import {
  SHARDLINGATTACK_ANCHOR, SHARDLINGATTACK_BODY_RATIO, SHARDLINGATTACK_FRAMES, SHARDLINGATTACK_FRAME_SIZE, SHARDLINGATTACK_TEXTURE_KEY,
} from './shardlingAttackAtlas.generated';
import {
  SHARDLINGIDLE_ANCHOR, SHARDLINGIDLE_BODY_RATIO, SHARDLINGIDLE_FRAMES, SHARDLINGIDLE_FRAME_SIZE, SHARDLINGIDLE_TEXTURE_KEY,
} from './shardlingIdleAtlas.generated';
import {
  SHARDLINGWALK_ANCHOR, SHARDLINGWALK_BODY_RATIO, SHARDLINGWALK_FRAMES, SHARDLINGWALK_FRAME_SIZE, SHARDLINGWALK_TEXTURE_KEY,
} from './shardlingWalkAtlas.generated';
import {
  SKELETONALERT_ANCHOR, SKELETONALERT_BODY_RATIO, SKELETONALERT_FRAMES, SKELETONALERT_FRAME_SIZE, SKELETONALERT_TEXTURE_KEY,
} from './skeletonAlertAtlas.generated';
import {
  SKELETONATTACK_ANCHOR, SKELETONATTACK_BODY_RATIO, SKELETONATTACK_FRAMES, SKELETONATTACK_FRAME_SIZE, SKELETONATTACK_TEXTURE_KEY,
} from './skeletonAttackAtlas.generated';
import {
  SKELETONIDLE_ANCHOR, SKELETONIDLE_BODY_RATIO, SKELETONIDLE_FRAMES, SKELETONIDLE_FRAME_SIZE, SKELETONIDLE_TEXTURE_KEY,
} from './skeletonIdleAtlas.generated';
import {
  SKELETONWALK_ANCHOR, SKELETONWALK_BODY_RATIO, SKELETONWALK_FRAMES, SKELETONWALK_FRAME_SIZE, SKELETONWALK_TEXTURE_KEY,
} from './skeletonWalkAtlas.generated';
import {
  SLIMEALERT_ANCHOR, SLIMEALERT_BODY_RATIO, SLIMEALERT_FRAMES, SLIMEALERT_FRAME_SIZE, SLIMEALERT_TEXTURE_KEY,
} from './slimeAlertAtlas.generated';
import {
  SLIMEATTACK_ANCHOR, SLIMEATTACK_BODY_RATIO, SLIMEATTACK_FRAMES, SLIMEATTACK_FRAME_SIZE, SLIMEATTACK_TEXTURE_KEY,
} from './slimeAttackAtlas.generated';
import {
  SLIMEIDLE_ANCHOR, SLIMEIDLE_BODY_RATIO, SLIMEIDLE_FRAMES, SLIMEIDLE_FRAME_SIZE, SLIMEIDLE_TEXTURE_KEY,
} from './slimeIdleAtlas.generated';
import {
  SLIMEWALK_ANCHOR, SLIMEWALK_BODY_RATIO, SLIMEWALK_FRAMES, SLIMEWALK_FRAME_SIZE, SLIMEWALK_TEXTURE_KEY,
} from './slimeWalkAtlas.generated';
import {
  SPITTERALERT_ANCHOR, SPITTERALERT_BODY_RATIO, SPITTERALERT_FRAMES, SPITTERALERT_FRAME_SIZE, SPITTERALERT_TEXTURE_KEY,
} from './spitterAlertAtlas.generated';
import {
  SPITTERATTACK_ANCHOR, SPITTERATTACK_BODY_RATIO, SPITTERATTACK_FRAMES, SPITTERATTACK_FRAME_SIZE, SPITTERATTACK_TEXTURE_KEY,
} from './spitterAttackAtlas.generated';
import {
  SPITTERIDLE_ANCHOR, SPITTERIDLE_BODY_RATIO, SPITTERIDLE_FRAMES, SPITTERIDLE_FRAME_SIZE, SPITTERIDLE_TEXTURE_KEY,
} from './spitterIdleAtlas.generated';
import {
  SPITTERWALK_ANCHOR, SPITTERWALK_BODY_RATIO, SPITTERWALK_FRAMES, SPITTERWALK_FRAME_SIZE, SPITTERWALK_TEXTURE_KEY,
} from './spitterWalkAtlas.generated';
import {
  SPROUTALERT_ANCHOR, SPROUTALERT_BODY_RATIO, SPROUTALERT_FRAMES, SPROUTALERT_FRAME_SIZE, SPROUTALERT_TEXTURE_KEY,
} from './sproutAlertAtlas.generated';
import {
  SPROUTATTACK_ANCHOR, SPROUTATTACK_BODY_RATIO, SPROUTATTACK_FRAMES, SPROUTATTACK_FRAME_SIZE, SPROUTATTACK_TEXTURE_KEY,
} from './sproutAttackAtlas.generated';
import {
  SPROUTIDLE_ANCHOR, SPROUTIDLE_BODY_RATIO, SPROUTIDLE_FRAMES, SPROUTIDLE_FRAME_SIZE, SPROUTIDLE_TEXTURE_KEY,
} from './sproutIdleAtlas.generated';
import {
  SPROUTWALK_ANCHOR, SPROUTWALK_BODY_RATIO, SPROUTWALK_FRAMES, SPROUTWALK_FRAME_SIZE, SPROUTWALK_TEXTURE_KEY,
} from './sproutWalkAtlas.generated';
import {
  WARDENALERT_ANCHOR, WARDENALERT_BODY_RATIO, WARDENALERT_FRAMES, WARDENALERT_FRAME_SIZE, WARDENALERT_TEXTURE_KEY,
} from './wardenAlertAtlas.generated';
import {
  WARDENATTACK_ANCHOR, WARDENATTACK_BODY_RATIO, WARDENATTACK_FRAMES, WARDENATTACK_FRAME_SIZE, WARDENATTACK_TEXTURE_KEY,
} from './wardenAttackAtlas.generated';
import {
  WARDENDEATH_ANCHOR, WARDENDEATH_BODY_RATIO, WARDENDEATH_FRAMES, WARDENDEATH_FRAME_SIZE, WARDENDEATH_TEXTURE_KEY,
} from './wardenDeathAtlas.generated';
import {
  WARDENHURT_ANCHOR, WARDENHURT_BODY_RATIO, WARDENHURT_FRAMES, WARDENHURT_FRAME_SIZE, WARDENHURT_TEXTURE_KEY,
} from './wardenHurtAtlas.generated';
import {
  WARDENSLAM_ANCHOR, WARDENSLAM_BODY_RATIO, WARDENSLAM_FRAMES, WARDENSLAM_FRAME_SIZE, WARDENSLAM_TEXTURE_KEY,
} from './wardenSlamAtlas.generated';
import {
  WARDENIDLE_ANCHOR, WARDENIDLE_BODY_RATIO, WARDENIDLE_FRAMES, WARDENIDLE_FRAME_SIZE, WARDENIDLE_TEXTURE_KEY,
} from './wardenIdleAtlas.generated';
import {
  WARDENWALK_ANCHOR, WARDENWALK_BODY_RATIO, WARDENWALK_FRAMES, WARDENWALK_FRAME_SIZE, WARDENWALK_TEXTURE_KEY,
} from './wardenWalkAtlas.generated';

/** One sheet: everything needed to draw and size it. */
export interface EnemySheet {
  texture: string;
  frames: readonly string[];
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  /** How much of the frame box the creature itself fills, 0..1. */
  bodyRatio: number;
  frameRate: number;
}

export type EnemyStateName = 'idle' | 'walk' | 'alert' | 'attack';

export interface EnemyArt extends Record<EnemyStateName, EnemySheet> {
  /** Body height as a fraction of the player's body height. */
  sizeRatio: number;
  /**
   * A drawn death, for the one enemy that has one.
   *
   * Optional because ten of the eleven families do not: they get the squash
   * tween, which is uniform and readable. The Mirror is the end of the run and
   * Logesh drew it a death, so it plays that instead.
   */
  death?: EnemySheet;
  /**
   * A drawn flinch, for the one enemy big enough to need one.
   *
   * Ordinary creatures get the white fill flash, which is uniform and reads at
   * any size. A 420-health guardian that only flashed looked unhurt, which is
   * the opposite of what a health bar coming down should feel like. Never
   * played over a wind-up: the telegraph outranks it.
   */
  hurt?: EnemySheet;
  /**
   * A telegraphed heavy attack, played instead of `attack` when the family has
   * one. The Warden's is its whole design -- five frames of raising both arms
   * so you can leave, and one of bringing them down.
   */
  slam?: EnemySheet;
  /**
   * Sheets this family needs that are not its own body.
   *
   * The Mirror's bolt and shard ring: effect art, loaded and registered with
   * the boss rather than at boot, because they are wanted in one room in the
   * game and nothing else ever draws them.
   */
  extras?: readonly string[];
  /**
   * Anchored on its middle rather than its feet.
   *
   * The Mirror floats, so it has no ground contact; pinning its lowest pixel
   * to the floor would make it bob every time its mantle changed length. The
   * shadow under it becomes a hint rather than a contact point.
   */
  floats?: boolean;
}

/** Two bands, in play order, joined into one clip. */
import {
  DUMMY_ANCHOR, DUMMY_BODY_RATIO, DUMMY_FRAMES, DUMMY_FRAME_SIZE, DUMMY_TEXTURE_KEY,
} from './dummyAtlas.generated';

/**
 * The dummy standing still: frame zero of its only clip, held.
 *
 * A one-frame band rather than the whole sheet at frame rate zero, because a
 * looping clip with no frame rate is not a definition of "hold still" that
 * Phaser has any reason to honour. Its four inert states all share this, and
 * only the flinch runs the full eight.
 */
const DUMMY_REST_FRAMES = { rest: [DUMMY_FRAMES.hit[0]!] } as const;

function sheet(
  texture: string,
  bands: Readonly<Record<string, readonly string[]>>,
  anchor: EnemySheet['anchor'],
  frameSize: EnemySheet['frameSize'],
  bodyRatio: number,
  frameRate: number,
): EnemySheet {
  return { texture, frames: Object.values(bands).flat(), anchor, frameSize, bodyRatio, frameRate };
}

const DUMMY_REST = sheet(
  DUMMY_TEXTURE_KEY, DUMMY_REST_FRAMES, DUMMY_ANCHOR, DUMMY_FRAME_SIZE, DUMMY_BODY_RATIO, 1,
);

/**
 * Every enemy Logesh drew, keyed by the server's `sprite` id.
 *
 * All twelve families are live on the server or one spawn table away. Their
 * atlases are fetched per room rather than at boot -- twelve families at four
 * sheets each is 51 MB, and a room uses at most a few of them. The Mirror is
 * the heaviest and is only ever wanted in one room in the game.
 */
export const ENEMY_ART = {
  /**
   * The practice dummy, which is a prop pretending to be a creature.
   *
   * Its sheet holds one clip -- eight frames of being struck -- because that is
   * the only thing it does. So every state points at the same sheet and the
   * clip is played as the *flinch*: standing still it holds frame zero, and a
   * hit runs the straw flying off. Registering it as an enemy family rather
   * than as decor is what puts it through the ordinary damage path, which is
   * the entire point of having one: the numbers that come off it are the
   * numbers a real enemy would take.
   */
  dummy: {
    idle: DUMMY_REST,
    walk: DUMMY_REST,
    alert: DUMMY_REST,
    attack: DUMMY_REST,
    hurt: sheet(DUMMY_TEXTURE_KEY, DUMMY_FRAMES, DUMMY_ANCHOR, DUMMY_FRAME_SIZE, DUMMY_BODY_RATIO, 16),
    sizeRatio: 1.05,
  },
  skeleton: {
    idle: sheet(SKELETONIDLE_TEXTURE_KEY, SKELETONIDLE_FRAMES, SKELETONIDLE_ANCHOR, SKELETONIDLE_FRAME_SIZE, SKELETONIDLE_BODY_RATIO, 7),
    walk: sheet(SKELETONWALK_TEXTURE_KEY, SKELETONWALK_FRAMES, SKELETONWALK_ANCHOR, SKELETONWALK_FRAME_SIZE, SKELETONWALK_BODY_RATIO, 11),
    alert: sheet(SKELETONALERT_TEXTURE_KEY, SKELETONALERT_FRAMES, SKELETONALERT_ANCHOR, SKELETONALERT_FRAME_SIZE, SKELETONALERT_BODY_RATIO, 12),
    attack: sheet(SKELETONATTACK_TEXTURE_KEY, SKELETONATTACK_FRAMES, SKELETONATTACK_ANCHOR, SKELETONATTACK_FRAME_SIZE, SKELETONATTACK_BODY_RATIO, 14),
    sizeRatio: 1.00,
  },
  archer: {
    idle: sheet(ARCHERIDLE_TEXTURE_KEY, ARCHERIDLE_FRAMES, ARCHERIDLE_ANCHOR, ARCHERIDLE_FRAME_SIZE, ARCHERIDLE_BODY_RATIO, 7),
    walk: sheet(ARCHERWALK_TEXTURE_KEY, ARCHERWALK_FRAMES, ARCHERWALK_ANCHOR, ARCHERWALK_FRAME_SIZE, ARCHERWALK_BODY_RATIO, 11),
    alert: sheet(ARCHERALERT_TEXTURE_KEY, ARCHERALERT_FRAMES, ARCHERALERT_ANCHOR, ARCHERALERT_FRAME_SIZE, ARCHERALERT_BODY_RATIO, 12),
    attack: sheet(ARCHERATTACK_TEXTURE_KEY, ARCHERATTACK_FRAMES, ARCHERATTACK_ANCHOR, ARCHERATTACK_FRAME_SIZE, ARCHERATTACK_BODY_RATIO, 14),
    sizeRatio: 0.95,
  },
  hound: {
    idle: sheet(HOUNDIDLE_TEXTURE_KEY, HOUNDIDLE_FRAMES, HOUNDIDLE_ANCHOR, HOUNDIDLE_FRAME_SIZE, HOUNDIDLE_BODY_RATIO, 7),
    walk: sheet(HOUNDWALK_TEXTURE_KEY, HOUNDWALK_FRAMES, HOUNDWALK_ANCHOR, HOUNDWALK_FRAME_SIZE, HOUNDWALK_BODY_RATIO, 11),
    alert: sheet(HOUNDALERT_TEXTURE_KEY, HOUNDALERT_FRAMES, HOUNDALERT_ANCHOR, HOUNDALERT_FRAME_SIZE, HOUNDALERT_BODY_RATIO, 12),
    attack: sheet(HOUNDATTACK_TEXTURE_KEY, HOUNDATTACK_FRAMES, HOUNDATTACK_ANCHOR, HOUNDATTACK_FRAME_SIZE, HOUNDATTACK_BODY_RATIO, 14),
    sizeRatio: 0.78,
  },
  slime: {
    idle: sheet(SLIMEIDLE_TEXTURE_KEY, SLIMEIDLE_FRAMES, SLIMEIDLE_ANCHOR, SLIMEIDLE_FRAME_SIZE, SLIMEIDLE_BODY_RATIO, 7),
    walk: sheet(SLIMEWALK_TEXTURE_KEY, SLIMEWALK_FRAMES, SLIMEWALK_ANCHOR, SLIMEWALK_FRAME_SIZE, SLIMEWALK_BODY_RATIO, 11),
    alert: sheet(SLIMEALERT_TEXTURE_KEY, SLIMEALERT_FRAMES, SLIMEALERT_ANCHOR, SLIMEALERT_FRAME_SIZE, SLIMEALERT_BODY_RATIO, 12),
    attack: sheet(SLIMEATTACK_TEXTURE_KEY, SLIMEATTACK_FRAMES, SLIMEATTACK_ANCHOR, SLIMEATTACK_FRAME_SIZE, SLIMEATTACK_BODY_RATIO, 14),
    sizeRatio: 0.72,
  },
  acolyte: {
    idle: sheet(ACOLYTEIDLE_TEXTURE_KEY, ACOLYTEIDLE_FRAMES, ACOLYTEIDLE_ANCHOR, ACOLYTEIDLE_FRAME_SIZE, ACOLYTEIDLE_BODY_RATIO, 7),
    walk: sheet(ACOLYTEWALK_TEXTURE_KEY, ACOLYTEWALK_FRAMES, ACOLYTEWALK_ANCHOR, ACOLYTEWALK_FRAME_SIZE, ACOLYTEWALK_BODY_RATIO, 11),
    alert: sheet(ACOLYTEALERT_TEXTURE_KEY, ACOLYTEALERT_FRAMES, ACOLYTEALERT_ANCHOR, ACOLYTEALERT_FRAME_SIZE, ACOLYTEALERT_BODY_RATIO, 12),
    attack: sheet(ACOLYTEATTACK_TEXTURE_KEY, ACOLYTEATTACK_FRAMES, ACOLYTEATTACK_ANCHOR, ACOLYTEATTACK_FRAME_SIZE, ACOLYTEATTACK_BODY_RATIO, 14),
    sizeRatio: 1.00,
  },
  brute: {
    idle: sheet(BRUTEIDLE_TEXTURE_KEY, BRUTEIDLE_FRAMES, BRUTEIDLE_ANCHOR, BRUTEIDLE_FRAME_SIZE, BRUTEIDLE_BODY_RATIO, 7),
    walk: sheet(BRUTEWALK_TEXTURE_KEY, BRUTEWALK_FRAMES, BRUTEWALK_ANCHOR, BRUTEWALK_FRAME_SIZE, BRUTEWALK_BODY_RATIO, 11),
    alert: sheet(BRUTEALERT_TEXTURE_KEY, BRUTEALERT_FRAMES, BRUTEALERT_ANCHOR, BRUTEALERT_FRAME_SIZE, BRUTEALERT_BODY_RATIO, 12),
    attack: sheet(BRUTEATTACK_TEXTURE_KEY, BRUTEATTACK_FRAMES, BRUTEATTACK_ANCHOR, BRUTEATTACK_FRAME_SIZE, BRUTEATTACK_BODY_RATIO, 14),
    sizeRatio: 1.35,
  },
  scarab: {
    idle: sheet(SCARABIDLE_TEXTURE_KEY, SCARABIDLE_FRAMES, SCARABIDLE_ANCHOR, SCARABIDLE_FRAME_SIZE, SCARABIDLE_BODY_RATIO, 7),
    walk: sheet(SCARABWALK_TEXTURE_KEY, SCARABWALK_FRAMES, SCARABWALK_ANCHOR, SCARABWALK_FRAME_SIZE, SCARABWALK_BODY_RATIO, 11),
    alert: sheet(SCARABALERT_TEXTURE_KEY, SCARABALERT_FRAMES, SCARABALERT_ANCHOR, SCARABALERT_FRAME_SIZE, SCARABALERT_BODY_RATIO, 12),
    attack: sheet(SCARABATTACK_TEXTURE_KEY, SCARABATTACK_FRAMES, SCARABATTACK_ANCHOR, SCARABATTACK_FRAME_SIZE, SCARABATTACK_BODY_RATIO, 14),
    sizeRatio: 0.62,
  },
  shardling: {
    idle: sheet(SHARDLINGIDLE_TEXTURE_KEY, SHARDLINGIDLE_FRAMES, SHARDLINGIDLE_ANCHOR, SHARDLINGIDLE_FRAME_SIZE, SHARDLINGIDLE_BODY_RATIO, 7),
    walk: sheet(SHARDLINGWALK_TEXTURE_KEY, SHARDLINGWALK_FRAMES, SHARDLINGWALK_ANCHOR, SHARDLINGWALK_FRAME_SIZE, SHARDLINGWALK_BODY_RATIO, 11),
    alert: sheet(SHARDLINGALERT_TEXTURE_KEY, SHARDLINGALERT_FRAMES, SHARDLINGALERT_ANCHOR, SHARDLINGALERT_FRAME_SIZE, SHARDLINGALERT_BODY_RATIO, 12),
    attack: sheet(SHARDLINGATTACK_TEXTURE_KEY, SHARDLINGATTACK_FRAMES, SHARDLINGATTACK_ANCHOR, SHARDLINGATTACK_FRAME_SIZE, SHARDLINGATTACK_BODY_RATIO, 14),
    sizeRatio: 0.70,
  },
  spitter: {
    idle: sheet(SPITTERIDLE_TEXTURE_KEY, SPITTERIDLE_FRAMES, SPITTERIDLE_ANCHOR, SPITTERIDLE_FRAME_SIZE, SPITTERIDLE_BODY_RATIO, 7),
    walk: sheet(SPITTERWALK_TEXTURE_KEY, SPITTERWALK_FRAMES, SPITTERWALK_ANCHOR, SPITTERWALK_FRAME_SIZE, SPITTERWALK_BODY_RATIO, 11),
    alert: sheet(SPITTERALERT_TEXTURE_KEY, SPITTERALERT_FRAMES, SPITTERALERT_ANCHOR, SPITTERALERT_FRAME_SIZE, SPITTERALERT_BODY_RATIO, 12),
    attack: sheet(SPITTERATTACK_TEXTURE_KEY, SPITTERATTACK_FRAMES, SPITTERATTACK_ANCHOR, SPITTERATTACK_FRAME_SIZE, SPITTERATTACK_BODY_RATIO, 14),
    sizeRatio: 0.90,
  },
  sprout: {
    idle: sheet(SPROUTIDLE_TEXTURE_KEY, SPROUTIDLE_FRAMES, SPROUTIDLE_ANCHOR, SPROUTIDLE_FRAME_SIZE, SPROUTIDLE_BODY_RATIO, 7),
    walk: sheet(SPROUTWALK_TEXTURE_KEY, SPROUTWALK_FRAMES, SPROUTWALK_ANCHOR, SPROUTWALK_FRAME_SIZE, SPROUTWALK_BODY_RATIO, 11),
    alert: sheet(SPROUTALERT_TEXTURE_KEY, SPROUTALERT_FRAMES, SPROUTALERT_ANCHOR, SPROUTALERT_FRAME_SIZE, SPROUTALERT_BODY_RATIO, 12),
    attack: sheet(SPROUTATTACK_TEXTURE_KEY, SPROUTATTACK_FRAMES, SPROUTATTACK_ANCHOR, SPROUTATTACK_FRAME_SIZE, SPROUTATTACK_BODY_RATIO, 14),
    sizeRatio: 0.80,
  },
  /**
   * The final boss, and the only enemy drawn from more than four sheets.
   *
   * Its six map onto the same four states every other family uses, so nothing
   * about loading, scaling or state resolution is special-cased for it:
   *
   * - `mirrorDrift` is the walk. It does not walk; it drifts.
   * - `mirrorCast` is the alert, which is what it does while it has your
   *   measure and has not committed yet -- the readable half of every
   *   predictive counter.
   * - `mirrorStrike` is the attack.
   * - `mirrorDeath` is the one drawn death in the game.
   *
   * `mirrorHurt` is on disk and not used: the white fill flash every enemy
   * shares already reads, and a second reaction layer would fight it.
   */
  mirror: {
    idle: sheet(MIRRORIDLE_TEXTURE_KEY, MIRRORIDLE_FRAMES, MIRRORIDLE_ANCHOR, MIRRORIDLE_FRAME_SIZE, MIRRORIDLE_BODY_RATIO, 8),
    walk: sheet(MIRRORDRIFT_TEXTURE_KEY, MIRRORDRIFT_FRAMES, MIRRORDRIFT_ANCHOR, MIRRORDRIFT_FRAME_SIZE, MIRRORDRIFT_BODY_RATIO, 10),
    alert: sheet(MIRRORCAST_TEXTURE_KEY, MIRRORCAST_FRAMES, MIRRORCAST_ANCHOR, MIRRORCAST_FRAME_SIZE, MIRRORCAST_BODY_RATIO, 13),
    attack: sheet(MIRRORSTRIKE_TEXTURE_KEY, MIRRORSTRIKE_FRAMES, MIRRORSTRIKE_ANCHOR, MIRRORSTRIKE_FRAME_SIZE, MIRRORSTRIKE_BODY_RATIO, 16),
    death: sheet(MIRRORDEATH_TEXTURE_KEY, MIRRORDEATH_FRAMES, MIRRORDEATH_ANCHOR, MIRRORDEATH_FRAME_SIZE, MIRRORDEATH_BODY_RATIO, 11),
    // Taller than you, but not a wall: it has to stay readable against its own
    // nova telegraph, which is 150 units across.
    sizeRatio: 1.30,
    floats: true,
    extras: BOSS_EFFECT_TEXTURES,
  },
  warden: {
    idle: sheet(WARDENIDLE_TEXTURE_KEY, WARDENIDLE_FRAMES, WARDENIDLE_ANCHOR, WARDENIDLE_FRAME_SIZE, WARDENIDLE_BODY_RATIO, 7),
    walk: sheet(WARDENWALK_TEXTURE_KEY, WARDENWALK_FRAMES, WARDENWALK_ANCHOR, WARDENWALK_FRAME_SIZE, WARDENWALK_BODY_RATIO, 11),
    alert: sheet(WARDENALERT_TEXTURE_KEY, WARDENALERT_FRAMES, WARDENALERT_ANCHOR, WARDENALERT_FRAME_SIZE, WARDENALERT_BODY_RATIO, 12),
    attack: sheet(WARDENATTACK_TEXTURE_KEY, WARDENATTACK_FRAMES, WARDENATTACK_ANCHOR, WARDENATTACK_FRAME_SIZE, WARDENATTACK_BODY_RATIO, 14),
    // The guardian's own three. It had the same four sheets as a skeleton
    // until now, so it flinched by flashing and died by vanishing.
    hurt: sheet(WARDENHURT_TEXTURE_KEY, WARDENHURT_FRAMES, WARDENHURT_ANCHOR, WARDENHURT_FRAME_SIZE, WARDENHURT_BODY_RATIO, 13),
    death: sheet(WARDENDEATH_TEXTURE_KEY, WARDENDEATH_FRAMES, WARDENDEATH_ANCHOR, WARDENDEATH_FRAME_SIZE, WARDENDEATH_BODY_RATIO, 9),
    // Slow on purpose: five of its eight frames are the wind-up, and the whole
    // encounter is built on having time to read it and move.
    slam: sheet(WARDENSLAM_TEXTURE_KEY, WARDENSLAM_FRAMES, WARDENSLAM_ANCHOR, WARDENSLAM_FRAME_SIZE, WARDENSLAM_BODY_RATIO, 10),
    sizeRatio: 1.20,
  },
} as const satisfies Record<string, EnemyArt>;

export type EnemySpriteName = keyof typeof ENEMY_ART;

export function hasEnemyArt(sprite: string): sprite is EnemySpriteName {
  return sprite in ENEMY_ART;
}

/**
 * The clip key for one state of one family.
 *
 * Keyed by texture *and* state rather than by texture alone. Most families
 * draw every state on its own sheet, so the old texture-only key was unique by
 * accident -- but a family that reuses one sheet for several states collapsed
 * them all onto a single animation, and the last one registered won. The
 * practice dummy is exactly that case: one sheet, and it must still hold still
 * when idle and run the straw off when struck.
 */
export function enemyStateKey(sheetDef: EnemySheet, state: string): string {
  return animationKey(sheetDef.texture, state);
}

/**
 * The "!" that pops over an enemy as it starts a wind-up.
 *
 * Six frames, not eight: the sheet's last two came back with the fade baked
 * out -- frame 7 held thirteen pixels above half opacity and frame 8 keyed to
 * nothing at all. The fade is a tween on top of these six instead.
 */
export const ALERT_MARK: EnemySheet = sheet(
  ALERTMARK_TEXTURE_KEY, ALERTMARK_FRAMES, ALERTMARK_ANCHOR, ALERTMARK_FRAME_SIZE, ALERTMARK_BODY_RATIO, 14,
);

export const ENEMY_STATES = ['idle', 'walk', 'alert', 'attack'] as const;

/**
 * Every sheet one enemy family needs, in a fixed order.
 *
 * The four states, plus a drawn death for the family that has one. This is
 * what decides both what gets fetched and what has to be present before the
 * family counts as ready, so a family with a death sheet is not announced
 * until its death sheet has landed too.
 */
export function enemySheets(sprite: EnemySpriteName): readonly EnemySheet[] {
  const art = ENEMY_ART[sprite] as EnemyArt;
  // Every optional sheet counts too. They were left out, so `hurt` and `slam`
  // were declared on the Warden and then never fetched -- which is why sheet 86
  // shipped and its flinch and its slam did nothing at all. A sheet that is in
  // the table is a sheet the family needs.
  const sheets = [
    ...ENEMY_STATES.map((state) => art[state]),
    ...(art.hurt ? [art.hurt] : []),
    ...(art.slam ? [art.slam] : []),
    ...(art.death ? [art.death] : []),
  ];
  // De-duplicated: a family may point several states at one sheet (the
  // practice dummy points all of them at its single sheet), and asking the
  // loader for the same atlas five times is five requests.
  return [...new Map(sheets.map((sheet) => [sheet.texture, sheet])).values()];
}

/** The atlas keys one enemy family needs loaded. */
export function enemyTextures(sprite: EnemySpriteName): readonly string[] {
  const art = ENEMY_ART[sprite] as EnemyArt;
  return [...enemySheets(sprite).map((s) => s.texture), ...(art.extras ?? [])];
}

/**
 * Loaded at boot rather than per room: every enemy shares it, so paying for it
 * once up front costs 0.2 MB and saves deciding who owns it.
 */
export const SHARED_ENEMY_TEXTURES: readonly string[] = [ALERT_MARK.texture];

export function registerAlertMarkAnimation(anims: Phaser.Animations.AnimationManager): void {
  registerClips(anims, ALERT_MARK.texture, {
    play: { frames: ALERT_MARK.frames, frameRate: ALERT_MARK.frameRate, repeat: 0 },
  });
}

/**
 * Register one family's four clips.
 *
 * Called once its atlases are in the texture cache, not at boot: Phaser keys
 * animations globally and `registerClips` is idempotent, so a family entered,
 * left and re-entered is registered once and thereafter skipped.
 */
export function registerEnemyAnimations(
  anims: Phaser.Animations.AnimationManager,
  sprite: EnemySpriteName,
): void {
  const art = ENEMY_ART[sprite] as EnemyArt;
  for (const state of ENEMY_STATES) {
    const def = art[state];
    // Idle and walk loop; alert and attack play once and hold, because the
    // snapshot that put the enemy in them is what takes it out again.
    const clip: ClipDef = {
      frames: def.frames,
      frameRate: def.frameRate,
      repeat: state === 'idle' || state === 'walk' ? -1 : 0,
    };
    registerClips(anims, def.texture, { [state]: clip });
  }
  // The optional three. `hurt` and `slam` were never registered, so the Warden
  // asked for animations that did not exist and silently kept standing there.
  if (art.hurt) {
    registerClips(anims, art.hurt.texture, {
      hurt: { frames: art.hurt.frames, frameRate: art.hurt.frameRate, repeat: 0 },
    });
  }
  if (art.slam) {
    registerClips(anims, art.slam.texture, {
      slam: { frames: art.slam.frames, frameRate: art.slam.frameRate, repeat: 0 },
    });
  }
  // Effect sheets that came down with this family, if it has any: the same
  // rule as the body sheets -- registered once the textures are in the cache,
  // never at boot.
  if (art.extras) registerBossEffectAnimations(anims);
  // A death plays once and holds on its last frame; the view fades it out
  // from there, so it must not loop back to standing.
  if (art.death) {
    registerClips(anims, art.death.texture, {
      death: { frames: art.death.frames, frameRate: art.death.frameRate, repeat: 0 },
    });
  }
}
