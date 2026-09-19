// Wiring for the eleven enemy sheets.
//
// The atlases themselves are generated (`npm run assets`); this table is not --
// it says which sheet is which enemy's idle/walk/alert/attack, and how fast
// each one plays. The sheets arrived with the art but nothing loaded them, so
// this is the module that puts them on screen.
//
// Every sheet is laid out the same way: eight frames split `a` (f-00..f-03) and
// `b` (f-04..f-07). They are one continuous cycle, not two variants, so the two
// halves are concatenated into a single clip.

import type Phaser from 'phaser';

import { animationKey, registerClips, type ClipDef } from './clips';

import {
  ACOLYTEIDLE_ANCHOR, ACOLYTEIDLE_BODY_RATIO, ACOLYTEIDLE_FRAMES, ACOLYTEIDLE_FRAME_SIZE, ACOLYTEIDLE_TEXTURE_KEY,
} from './acolyteIdleAtlas.generated';
import {
  ACOLYTEWALK_ANCHOR, ACOLYTEWALK_BODY_RATIO, ACOLYTEWALK_FRAMES, ACOLYTEWALK_FRAME_SIZE, ACOLYTEWALK_TEXTURE_KEY,
} from './acolyteWalkAtlas.generated';
import {
  ACOLYTEALERT_ANCHOR, ACOLYTEALERT_BODY_RATIO, ACOLYTEALERT_FRAMES, ACOLYTEALERT_FRAME_SIZE, ACOLYTEALERT_TEXTURE_KEY,
} from './acolyteAlertAtlas.generated';
import {
  ACOLYTEATTACK_ANCHOR, ACOLYTEATTACK_BODY_RATIO, ACOLYTEATTACK_FRAMES, ACOLYTEATTACK_FRAME_SIZE, ACOLYTEATTACK_TEXTURE_KEY,
} from './acolyteAttackAtlas.generated';
import {
  ARCHERIDLE_ANCHOR, ARCHERIDLE_BODY_RATIO, ARCHERIDLE_FRAMES, ARCHERIDLE_FRAME_SIZE, ARCHERIDLE_TEXTURE_KEY,
} from './archerIdleAtlas.generated';
import {
  ARCHERWALK_ANCHOR, ARCHERWALK_BODY_RATIO, ARCHERWALK_FRAMES, ARCHERWALK_FRAME_SIZE, ARCHERWALK_TEXTURE_KEY,
} from './archerWalkAtlas.generated';
import {
  ARCHERALERT_ANCHOR, ARCHERALERT_BODY_RATIO, ARCHERALERT_FRAMES, ARCHERALERT_FRAME_SIZE, ARCHERALERT_TEXTURE_KEY,
} from './archerAlertAtlas.generated';
import {
  ARCHERATTACK_ANCHOR, ARCHERATTACK_BODY_RATIO, ARCHERATTACK_FRAMES, ARCHERATTACK_FRAME_SIZE, ARCHERATTACK_TEXTURE_KEY,
} from './archerAttackAtlas.generated';
import {
  BRUTEIDLE_ANCHOR, BRUTEIDLE_BODY_RATIO, BRUTEIDLE_FRAMES, BRUTEIDLE_FRAME_SIZE, BRUTEIDLE_TEXTURE_KEY,
} from './bruteIdleAtlas.generated';
import {
  BRUTEWALK_ANCHOR, BRUTEWALK_BODY_RATIO, BRUTEWALK_FRAMES, BRUTEWALK_FRAME_SIZE, BRUTEWALK_TEXTURE_KEY,
} from './bruteWalkAtlas.generated';
import {
  BRUTEALERT_ANCHOR, BRUTEALERT_BODY_RATIO, BRUTEALERT_FRAMES, BRUTEALERT_FRAME_SIZE, BRUTEALERT_TEXTURE_KEY,
} from './bruteAlertAtlas.generated';
import {
  BRUTEATTACK_ANCHOR, BRUTEATTACK_BODY_RATIO, BRUTEATTACK_FRAMES, BRUTEATTACK_FRAME_SIZE, BRUTEATTACK_TEXTURE_KEY,
} from './bruteAttackAtlas.generated';
import {
  HOUNDIDLE_ANCHOR, HOUNDIDLE_BODY_RATIO, HOUNDIDLE_FRAMES, HOUNDIDLE_FRAME_SIZE, HOUNDIDLE_TEXTURE_KEY,
} from './houndIdleAtlas.generated';
import {
  HOUNDWALK_ANCHOR, HOUNDWALK_BODY_RATIO, HOUNDWALK_FRAMES, HOUNDWALK_FRAME_SIZE, HOUNDWALK_TEXTURE_KEY,
} from './houndWalkAtlas.generated';
import {
  HOUNDALERT_ANCHOR, HOUNDALERT_BODY_RATIO, HOUNDALERT_FRAMES, HOUNDALERT_FRAME_SIZE, HOUNDALERT_TEXTURE_KEY,
} from './houndAlertAtlas.generated';
import {
  HOUNDATTACK_ANCHOR, HOUNDATTACK_BODY_RATIO, HOUNDATTACK_FRAMES, HOUNDATTACK_FRAME_SIZE, HOUNDATTACK_TEXTURE_KEY,
} from './houndAttackAtlas.generated';
import {
  SCARABIDLE_ANCHOR, SCARABIDLE_BODY_RATIO, SCARABIDLE_FRAMES, SCARABIDLE_FRAME_SIZE, SCARABIDLE_TEXTURE_KEY,
} from './scarabIdleAtlas.generated';
import {
  SCARABWALK_ANCHOR, SCARABWALK_BODY_RATIO, SCARABWALK_FRAMES, SCARABWALK_FRAME_SIZE, SCARABWALK_TEXTURE_KEY,
} from './scarabWalkAtlas.generated';
import {
  SCARABALERT_ANCHOR, SCARABALERT_BODY_RATIO, SCARABALERT_FRAMES, SCARABALERT_FRAME_SIZE, SCARABALERT_TEXTURE_KEY,
} from './scarabAlertAtlas.generated';
import {
  SCARABATTACK_ANCHOR, SCARABATTACK_BODY_RATIO, SCARABATTACK_FRAMES, SCARABATTACK_FRAME_SIZE, SCARABATTACK_TEXTURE_KEY,
} from './scarabAttackAtlas.generated';
import {
  SHARDLINGIDLE_ANCHOR, SHARDLINGIDLE_BODY_RATIO, SHARDLINGIDLE_FRAMES, SHARDLINGIDLE_FRAME_SIZE, SHARDLINGIDLE_TEXTURE_KEY,
} from './shardlingIdleAtlas.generated';
import {
  SHARDLINGWALK_ANCHOR, SHARDLINGWALK_BODY_RATIO, SHARDLINGWALK_FRAMES, SHARDLINGWALK_FRAME_SIZE, SHARDLINGWALK_TEXTURE_KEY,
} from './shardlingWalkAtlas.generated';
import {
  SHARDLINGALERT_ANCHOR, SHARDLINGALERT_BODY_RATIO, SHARDLINGALERT_FRAMES, SHARDLINGALERT_FRAME_SIZE, SHARDLINGALERT_TEXTURE_KEY,
} from './shardlingAlertAtlas.generated';
import {
  SHARDLINGATTACK_ANCHOR, SHARDLINGATTACK_BODY_RATIO, SHARDLINGATTACK_FRAMES, SHARDLINGATTACK_FRAME_SIZE, SHARDLINGATTACK_TEXTURE_KEY,
} from './shardlingAttackAtlas.generated';
import {
  SKELETONIDLE_ANCHOR, SKELETONIDLE_BODY_RATIO, SKELETONIDLE_FRAMES, SKELETONIDLE_FRAME_SIZE, SKELETONIDLE_TEXTURE_KEY,
} from './skeletonIdleAtlas.generated';
import {
  SKELETONWALK_ANCHOR, SKELETONWALK_BODY_RATIO, SKELETONWALK_FRAMES, SKELETONWALK_FRAME_SIZE, SKELETONWALK_TEXTURE_KEY,
} from './skeletonWalkAtlas.generated';
import {
  SKELETONALERT_ANCHOR, SKELETONALERT_BODY_RATIO, SKELETONALERT_FRAMES, SKELETONALERT_FRAME_SIZE, SKELETONALERT_TEXTURE_KEY,
} from './skeletonAlertAtlas.generated';
import {
  SKELETONATTACK_ANCHOR, SKELETONATTACK_BODY_RATIO, SKELETONATTACK_FRAMES, SKELETONATTACK_FRAME_SIZE, SKELETONATTACK_TEXTURE_KEY,
} from './skeletonAttackAtlas.generated';
import {
  SLIMEIDLE_ANCHOR, SLIMEIDLE_BODY_RATIO, SLIMEIDLE_FRAMES, SLIMEIDLE_FRAME_SIZE, SLIMEIDLE_TEXTURE_KEY,
} from './slimeIdleAtlas.generated';
import {
  SLIMEWALK_ANCHOR, SLIMEWALK_BODY_RATIO, SLIMEWALK_FRAMES, SLIMEWALK_FRAME_SIZE, SLIMEWALK_TEXTURE_KEY,
} from './slimeWalkAtlas.generated';
import {
  SLIMEALERT_ANCHOR, SLIMEALERT_BODY_RATIO, SLIMEALERT_FRAMES, SLIMEALERT_FRAME_SIZE, SLIMEALERT_TEXTURE_KEY,
} from './slimeAlertAtlas.generated';
import {
  SLIMEATTACK_ANCHOR, SLIMEATTACK_BODY_RATIO, SLIMEATTACK_FRAMES, SLIMEATTACK_FRAME_SIZE, SLIMEATTACK_TEXTURE_KEY,
} from './slimeAttackAtlas.generated';
import {
  SPITTERIDLE_ANCHOR, SPITTERIDLE_BODY_RATIO, SPITTERIDLE_FRAMES, SPITTERIDLE_FRAME_SIZE, SPITTERIDLE_TEXTURE_KEY,
} from './spitterIdleAtlas.generated';
import {
  SPITTERWALK_ANCHOR, SPITTERWALK_BODY_RATIO, SPITTERWALK_FRAMES, SPITTERWALK_FRAME_SIZE, SPITTERWALK_TEXTURE_KEY,
} from './spitterWalkAtlas.generated';
import {
  SPITTERALERT_ANCHOR, SPITTERALERT_BODY_RATIO, SPITTERALERT_FRAMES, SPITTERALERT_FRAME_SIZE, SPITTERALERT_TEXTURE_KEY,
} from './spitterAlertAtlas.generated';
import {
  SPITTERATTACK_ANCHOR, SPITTERATTACK_BODY_RATIO, SPITTERATTACK_FRAMES, SPITTERATTACK_FRAME_SIZE, SPITTERATTACK_TEXTURE_KEY,
} from './spitterAttackAtlas.generated';
import {
  SPROUTIDLE_ANCHOR, SPROUTIDLE_BODY_RATIO, SPROUTIDLE_FRAMES, SPROUTIDLE_FRAME_SIZE, SPROUTIDLE_TEXTURE_KEY,
} from './sproutIdleAtlas.generated';
import {
  SPROUTWALK_ANCHOR, SPROUTWALK_BODY_RATIO, SPROUTWALK_FRAMES, SPROUTWALK_FRAME_SIZE, SPROUTWALK_TEXTURE_KEY,
} from './sproutWalkAtlas.generated';
import {
  SPROUTALERT_ANCHOR, SPROUTALERT_BODY_RATIO, SPROUTALERT_FRAMES, SPROUTALERT_FRAME_SIZE, SPROUTALERT_TEXTURE_KEY,
} from './sproutAlertAtlas.generated';
import {
  SPROUTATTACK_ANCHOR, SPROUTATTACK_BODY_RATIO, SPROUTATTACK_FRAMES, SPROUTATTACK_FRAME_SIZE, SPROUTATTACK_TEXTURE_KEY,
} from './sproutAttackAtlas.generated';
import {
  WARDENIDLE_ANCHOR, WARDENIDLE_BODY_RATIO, WARDENIDLE_FRAMES, WARDENIDLE_FRAME_SIZE, WARDENIDLE_TEXTURE_KEY,
} from './wardenIdleAtlas.generated';
import {
  WARDENWALK_ANCHOR, WARDENWALK_BODY_RATIO, WARDENWALK_FRAMES, WARDENWALK_FRAME_SIZE, WARDENWALK_TEXTURE_KEY,
} from './wardenWalkAtlas.generated';
import {
  WARDENALERT_ANCHOR, WARDENALERT_BODY_RATIO, WARDENALERT_FRAMES, WARDENALERT_FRAME_SIZE, WARDENALERT_TEXTURE_KEY,
} from './wardenAlertAtlas.generated';
import {
  WARDENATTACK_ANCHOR, WARDENATTACK_BODY_RATIO, WARDENATTACK_FRAMES, WARDENATTACK_FRAME_SIZE, WARDENATTACK_TEXTURE_KEY,
} from './wardenAttackAtlas.generated';

/** The enemy sprite ids the server can send as `EnemySnap.sprite`. */
export const ENEMY_KINDS = [
  'acolyte',
  'archer',
  'brute',
  'hound',
  'scarab',
  'shardling',
  'skeleton',
  'slime',
  'spitter',
  'sprout',
  'warden',
] as const;

export type EnemyKind = (typeof ENEMY_KINDS)[number];
export type EnemyClipName = 'idle' | 'walk' | 'alert' | 'attack';

export interface EnemySheet extends ClipDef {
  texture: string;
  /** Origin on the body centre and its feet, from the generated atlas. */
  anchor: { readonly x: number; readonly y: number };
  frameSize: { readonly width: number; readonly height: number };
  /** How tall the body is inside the padded frame, 0..1 -- what two enemies
   *  must be compared on to size them relative to each other. */
  bodyRatio: number;
}

export const ENEMY_SHEETS: Record<EnemyKind, Record<EnemyClipName, EnemySheet>> = {
  acolyte: {
    idle: {
      texture: ACOLYTEIDLE_TEXTURE_KEY,
      frames: [...ACOLYTEIDLE_FRAMES.a, ...ACOLYTEIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: ACOLYTEIDLE_ANCHOR,
      frameSize: ACOLYTEIDLE_FRAME_SIZE,
      bodyRatio: ACOLYTEIDLE_BODY_RATIO,
    },
    walk: {
      texture: ACOLYTEWALK_TEXTURE_KEY,
      frames: [...ACOLYTEWALK_FRAMES.a, ...ACOLYTEWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: ACOLYTEWALK_ANCHOR,
      frameSize: ACOLYTEWALK_FRAME_SIZE,
      bodyRatio: ACOLYTEWALK_BODY_RATIO,
    },
    alert: {
      texture: ACOLYTEALERT_TEXTURE_KEY,
      frames: [...ACOLYTEALERT_FRAMES.a, ...ACOLYTEALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: ACOLYTEALERT_ANCHOR,
      frameSize: ACOLYTEALERT_FRAME_SIZE,
      bodyRatio: ACOLYTEALERT_BODY_RATIO,
    },
    attack: {
      texture: ACOLYTEATTACK_TEXTURE_KEY,
      frames: [...ACOLYTEATTACK_FRAMES.a, ...ACOLYTEATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: ACOLYTEATTACK_ANCHOR,
      frameSize: ACOLYTEATTACK_FRAME_SIZE,
      bodyRatio: ACOLYTEATTACK_BODY_RATIO,
    },
  },
  archer: {
    idle: {
      texture: ARCHERIDLE_TEXTURE_KEY,
      frames: [...ARCHERIDLE_FRAMES.a, ...ARCHERIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: ARCHERIDLE_ANCHOR,
      frameSize: ARCHERIDLE_FRAME_SIZE,
      bodyRatio: ARCHERIDLE_BODY_RATIO,
    },
    walk: {
      texture: ARCHERWALK_TEXTURE_KEY,
      frames: [...ARCHERWALK_FRAMES.a, ...ARCHERWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: ARCHERWALK_ANCHOR,
      frameSize: ARCHERWALK_FRAME_SIZE,
      bodyRatio: ARCHERWALK_BODY_RATIO,
    },
    alert: {
      texture: ARCHERALERT_TEXTURE_KEY,
      frames: [...ARCHERALERT_FRAMES.a, ...ARCHERALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: ARCHERALERT_ANCHOR,
      frameSize: ARCHERALERT_FRAME_SIZE,
      bodyRatio: ARCHERALERT_BODY_RATIO,
    },
    attack: {
      texture: ARCHERATTACK_TEXTURE_KEY,
      frames: [...ARCHERATTACK_FRAMES.a, ...ARCHERATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: ARCHERATTACK_ANCHOR,
      frameSize: ARCHERATTACK_FRAME_SIZE,
      bodyRatio: ARCHERATTACK_BODY_RATIO,
    },
  },
  brute: {
    idle: {
      texture: BRUTEIDLE_TEXTURE_KEY,
      frames: [...BRUTEIDLE_FRAMES.a, ...BRUTEIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: BRUTEIDLE_ANCHOR,
      frameSize: BRUTEIDLE_FRAME_SIZE,
      bodyRatio: BRUTEIDLE_BODY_RATIO,
    },
    walk: {
      texture: BRUTEWALK_TEXTURE_KEY,
      frames: [...BRUTEWALK_FRAMES.a, ...BRUTEWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: BRUTEWALK_ANCHOR,
      frameSize: BRUTEWALK_FRAME_SIZE,
      bodyRatio: BRUTEWALK_BODY_RATIO,
    },
    alert: {
      texture: BRUTEALERT_TEXTURE_KEY,
      frames: [...BRUTEALERT_FRAMES.a, ...BRUTEALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: BRUTEALERT_ANCHOR,
      frameSize: BRUTEALERT_FRAME_SIZE,
      bodyRatio: BRUTEALERT_BODY_RATIO,
    },
    attack: {
      texture: BRUTEATTACK_TEXTURE_KEY,
      frames: [...BRUTEATTACK_FRAMES.a, ...BRUTEATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: BRUTEATTACK_ANCHOR,
      frameSize: BRUTEATTACK_FRAME_SIZE,
      bodyRatio: BRUTEATTACK_BODY_RATIO,
    },
  },
  hound: {
    idle: {
      texture: HOUNDIDLE_TEXTURE_KEY,
      frames: [...HOUNDIDLE_FRAMES.a, ...HOUNDIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: HOUNDIDLE_ANCHOR,
      frameSize: HOUNDIDLE_FRAME_SIZE,
      bodyRatio: HOUNDIDLE_BODY_RATIO,
    },
    walk: {
      texture: HOUNDWALK_TEXTURE_KEY,
      frames: [...HOUNDWALK_FRAMES.a, ...HOUNDWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: HOUNDWALK_ANCHOR,
      frameSize: HOUNDWALK_FRAME_SIZE,
      bodyRatio: HOUNDWALK_BODY_RATIO,
    },
    alert: {
      texture: HOUNDALERT_TEXTURE_KEY,
      frames: [...HOUNDALERT_FRAMES.a, ...HOUNDALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: HOUNDALERT_ANCHOR,
      frameSize: HOUNDALERT_FRAME_SIZE,
      bodyRatio: HOUNDALERT_BODY_RATIO,
    },
    attack: {
      texture: HOUNDATTACK_TEXTURE_KEY,
      frames: [...HOUNDATTACK_FRAMES.a, ...HOUNDATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: HOUNDATTACK_ANCHOR,
      frameSize: HOUNDATTACK_FRAME_SIZE,
      bodyRatio: HOUNDATTACK_BODY_RATIO,
    },
  },
  scarab: {
    idle: {
      texture: SCARABIDLE_TEXTURE_KEY,
      frames: [...SCARABIDLE_FRAMES.a, ...SCARABIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: SCARABIDLE_ANCHOR,
      frameSize: SCARABIDLE_FRAME_SIZE,
      bodyRatio: SCARABIDLE_BODY_RATIO,
    },
    walk: {
      texture: SCARABWALK_TEXTURE_KEY,
      frames: [...SCARABWALK_FRAMES.a, ...SCARABWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: SCARABWALK_ANCHOR,
      frameSize: SCARABWALK_FRAME_SIZE,
      bodyRatio: SCARABWALK_BODY_RATIO,
    },
    alert: {
      texture: SCARABALERT_TEXTURE_KEY,
      frames: [...SCARABALERT_FRAMES.a, ...SCARABALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: SCARABALERT_ANCHOR,
      frameSize: SCARABALERT_FRAME_SIZE,
      bodyRatio: SCARABALERT_BODY_RATIO,
    },
    attack: {
      texture: SCARABATTACK_TEXTURE_KEY,
      frames: [...SCARABATTACK_FRAMES.a, ...SCARABATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: SCARABATTACK_ANCHOR,
      frameSize: SCARABATTACK_FRAME_SIZE,
      bodyRatio: SCARABATTACK_BODY_RATIO,
    },
  },
  shardling: {
    idle: {
      texture: SHARDLINGIDLE_TEXTURE_KEY,
      frames: [...SHARDLINGIDLE_FRAMES.a, ...SHARDLINGIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: SHARDLINGIDLE_ANCHOR,
      frameSize: SHARDLINGIDLE_FRAME_SIZE,
      bodyRatio: SHARDLINGIDLE_BODY_RATIO,
    },
    walk: {
      texture: SHARDLINGWALK_TEXTURE_KEY,
      frames: [...SHARDLINGWALK_FRAMES.a, ...SHARDLINGWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: SHARDLINGWALK_ANCHOR,
      frameSize: SHARDLINGWALK_FRAME_SIZE,
      bodyRatio: SHARDLINGWALK_BODY_RATIO,
    },
    alert: {
      texture: SHARDLINGALERT_TEXTURE_KEY,
      frames: [...SHARDLINGALERT_FRAMES.a, ...SHARDLINGALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: SHARDLINGALERT_ANCHOR,
      frameSize: SHARDLINGALERT_FRAME_SIZE,
      bodyRatio: SHARDLINGALERT_BODY_RATIO,
    },
    attack: {
      texture: SHARDLINGATTACK_TEXTURE_KEY,
      frames: [...SHARDLINGATTACK_FRAMES.a, ...SHARDLINGATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: SHARDLINGATTACK_ANCHOR,
      frameSize: SHARDLINGATTACK_FRAME_SIZE,
      bodyRatio: SHARDLINGATTACK_BODY_RATIO,
    },
  },
  skeleton: {
    idle: {
      texture: SKELETONIDLE_TEXTURE_KEY,
      frames: [...SKELETONIDLE_FRAMES.a, ...SKELETONIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: SKELETONIDLE_ANCHOR,
      frameSize: SKELETONIDLE_FRAME_SIZE,
      bodyRatio: SKELETONIDLE_BODY_RATIO,
    },
    walk: {
      texture: SKELETONWALK_TEXTURE_KEY,
      frames: [...SKELETONWALK_FRAMES.a, ...SKELETONWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: SKELETONWALK_ANCHOR,
      frameSize: SKELETONWALK_FRAME_SIZE,
      bodyRatio: SKELETONWALK_BODY_RATIO,
    },
    alert: {
      texture: SKELETONALERT_TEXTURE_KEY,
      frames: [...SKELETONALERT_FRAMES.a, ...SKELETONALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: SKELETONALERT_ANCHOR,
      frameSize: SKELETONALERT_FRAME_SIZE,
      bodyRatio: SKELETONALERT_BODY_RATIO,
    },
    attack: {
      texture: SKELETONATTACK_TEXTURE_KEY,
      frames: [...SKELETONATTACK_FRAMES.a, ...SKELETONATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: SKELETONATTACK_ANCHOR,
      frameSize: SKELETONATTACK_FRAME_SIZE,
      bodyRatio: SKELETONATTACK_BODY_RATIO,
    },
  },
  slime: {
    idle: {
      texture: SLIMEIDLE_TEXTURE_KEY,
      frames: [...SLIMEIDLE_FRAMES.a, ...SLIMEIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: SLIMEIDLE_ANCHOR,
      frameSize: SLIMEIDLE_FRAME_SIZE,
      bodyRatio: SLIMEIDLE_BODY_RATIO,
    },
    walk: {
      texture: SLIMEWALK_TEXTURE_KEY,
      frames: [...SLIMEWALK_FRAMES.a, ...SLIMEWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: SLIMEWALK_ANCHOR,
      frameSize: SLIMEWALK_FRAME_SIZE,
      bodyRatio: SLIMEWALK_BODY_RATIO,
    },
    alert: {
      texture: SLIMEALERT_TEXTURE_KEY,
      frames: [...SLIMEALERT_FRAMES.a, ...SLIMEALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: SLIMEALERT_ANCHOR,
      frameSize: SLIMEALERT_FRAME_SIZE,
      bodyRatio: SLIMEALERT_BODY_RATIO,
    },
    attack: {
      texture: SLIMEATTACK_TEXTURE_KEY,
      frames: [...SLIMEATTACK_FRAMES.a, ...SLIMEATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: SLIMEATTACK_ANCHOR,
      frameSize: SLIMEATTACK_FRAME_SIZE,
      bodyRatio: SLIMEATTACK_BODY_RATIO,
    },
  },
  spitter: {
    idle: {
      texture: SPITTERIDLE_TEXTURE_KEY,
      frames: [...SPITTERIDLE_FRAMES.a, ...SPITTERIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: SPITTERIDLE_ANCHOR,
      frameSize: SPITTERIDLE_FRAME_SIZE,
      bodyRatio: SPITTERIDLE_BODY_RATIO,
    },
    walk: {
      texture: SPITTERWALK_TEXTURE_KEY,
      frames: [...SPITTERWALK_FRAMES.a, ...SPITTERWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: SPITTERWALK_ANCHOR,
      frameSize: SPITTERWALK_FRAME_SIZE,
      bodyRatio: SPITTERWALK_BODY_RATIO,
    },
    alert: {
      texture: SPITTERALERT_TEXTURE_KEY,
      frames: [...SPITTERALERT_FRAMES.a, ...SPITTERALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: SPITTERALERT_ANCHOR,
      frameSize: SPITTERALERT_FRAME_SIZE,
      bodyRatio: SPITTERALERT_BODY_RATIO,
    },
    attack: {
      texture: SPITTERATTACK_TEXTURE_KEY,
      frames: [...SPITTERATTACK_FRAMES.a, ...SPITTERATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: SPITTERATTACK_ANCHOR,
      frameSize: SPITTERATTACK_FRAME_SIZE,
      bodyRatio: SPITTERATTACK_BODY_RATIO,
    },
  },
  sprout: {
    idle: {
      texture: SPROUTIDLE_TEXTURE_KEY,
      frames: [...SPROUTIDLE_FRAMES.a, ...SPROUTIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: SPROUTIDLE_ANCHOR,
      frameSize: SPROUTIDLE_FRAME_SIZE,
      bodyRatio: SPROUTIDLE_BODY_RATIO,
    },
    walk: {
      texture: SPROUTWALK_TEXTURE_KEY,
      frames: [...SPROUTWALK_FRAMES.a, ...SPROUTWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: SPROUTWALK_ANCHOR,
      frameSize: SPROUTWALK_FRAME_SIZE,
      bodyRatio: SPROUTWALK_BODY_RATIO,
    },
    alert: {
      texture: SPROUTALERT_TEXTURE_KEY,
      frames: [...SPROUTALERT_FRAMES.a, ...SPROUTALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: SPROUTALERT_ANCHOR,
      frameSize: SPROUTALERT_FRAME_SIZE,
      bodyRatio: SPROUTALERT_BODY_RATIO,
    },
    attack: {
      texture: SPROUTATTACK_TEXTURE_KEY,
      frames: [...SPROUTATTACK_FRAMES.a, ...SPROUTATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: SPROUTATTACK_ANCHOR,
      frameSize: SPROUTATTACK_FRAME_SIZE,
      bodyRatio: SPROUTATTACK_BODY_RATIO,
    },
  },
  warden: {
    idle: {
      texture: WARDENIDLE_TEXTURE_KEY,
      frames: [...WARDENIDLE_FRAMES.a, ...WARDENIDLE_FRAMES.b],
      frameRate: 8,
      repeat: -1,
      anchor: WARDENIDLE_ANCHOR,
      frameSize: WARDENIDLE_FRAME_SIZE,
      bodyRatio: WARDENIDLE_BODY_RATIO,
    },
    walk: {
      texture: WARDENWALK_TEXTURE_KEY,
      frames: [...WARDENWALK_FRAMES.a, ...WARDENWALK_FRAMES.b],
      frameRate: 12,
      repeat: -1,
      anchor: WARDENWALK_ANCHOR,
      frameSize: WARDENWALK_FRAME_SIZE,
      bodyRatio: WARDENWALK_BODY_RATIO,
    },
    alert: {
      texture: WARDENALERT_TEXTURE_KEY,
      frames: [...WARDENALERT_FRAMES.a, ...WARDENALERT_FRAMES.b],
      frameRate: 10,
      repeat: 0,
      anchor: WARDENALERT_ANCHOR,
      frameSize: WARDENALERT_FRAME_SIZE,
      bodyRatio: WARDENALERT_BODY_RATIO,
    },
    attack: {
      texture: WARDENATTACK_TEXTURE_KEY,
      frames: [...WARDENATTACK_FRAMES.a, ...WARDENATTACK_FRAMES.b],
      frameRate: 14,
      repeat: 0,
      anchor: WARDENATTACK_ANCHOR,
      frameSize: WARDENATTACK_FRAME_SIZE,
      bodyRatio: WARDENATTACK_BODY_RATIO,
    },
  },
};

/** Every enemy texture key, for the preloader. */
export const ENEMY_TEXTURES: readonly string[] = ENEMY_KINDS.flatMap(
  (kind) => Object.values(ENEMY_SHEETS[kind]).map((sheet) => sheet.texture),
);

export function isEnemyKind(value: string): value is EnemyKind {
  return (ENEMY_KINDS as readonly string[]).includes(value);
}

/** Animation key for one enemy clip. Each clip is its own texture, so the
 *  clip name inside that texture is always the same. */
export function enemyAnimationKey(kind: EnemyKind, clip: EnemyClipName): string {
  return animationKey(ENEMY_SHEETS[kind][clip].texture, 'play');
}

export function registerEnemyAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const kind of ENEMY_KINDS) {
    for (const sheet of Object.values(ENEMY_SHEETS[kind])) {
      registerClips(anims, sheet.texture, {
        play: { frames: sheet.frames, frameRate: sheet.frameRate, repeat: sheet.repeat },
      });
    }
  }
}
