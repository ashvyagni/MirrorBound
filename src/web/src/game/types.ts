import type { ClipName } from './animation/clips';

/** What the character is doing. One of these is always true, and only one. */
export type PlayerState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'hurt'
  | 'die';

export type Facing = 1 | -1;

/**
 * One frame of "what should the character try to do".
 *
 * Nothing downstream knows whether this came from a keyboard, a replay, or an
 * agent on the other end of a socket -- which is the point. The AI service can
 * drive the character through exactly this shape, with no special path through
 * the game code.
 */
export interface Intent {
  /** -1 full left, 0 neutral, 1 full right. */
  moveX: number;
  /** -1 full up, 0 neutral, 1 full down. */
  moveY: number;
  /** True only on the frame the attack was requested. */
  attack: boolean;
  /** Hold to run instead of walk. */
  run: boolean;
  /** Mouse aim angle in radians (0 = right, PI/2 = down). */
  aimAngle: number;
  /** Ability key pressed (1-4). */
  ability: number | null;
}

export const NEUTRAL_INTENT: Readonly<Intent> = Object.freeze({
  moveX: 0,
  moveY: 0,
  attack: false,
  run: false,
  aimAngle: 0,
  ability: null,
});

/** Anything that can drive the character. */
export interface IntentSource {
  /** Called once per frame, before physics. */
  sample(deltaSeconds: number): Intent;
  destroy?(): void;
}

/** Snapshot pushed to the UI each time something meaningful changes. */
export interface PlayerSnapshot {
  state: PlayerState;
  clip: ClipName;
  facing: Facing;
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
}

/** Snapshot of an enemy for rendering. */
export interface EnemySnapshot {
  id: string;
  type: string;
  positionX: number;
  positionY: number;
  health: number;
  maxHealth: number;
  state: string;
}

/** Snapshot of the twin for rendering. */
export interface TwinSnapshot {
  positionX: number;
  positionY: number;
  health: number;
  maxHealth: number;
  state: string;
}

/** Full game snapshot from server. */
export interface GameSnapshot {
  tick: number;
  player: PlayerSnapshot;
  twin: TwinSnapshot;
  enemies: EnemySnapshot[];
  room: RoomSnapshot;
}

/** Room snapshot for rendering. */
export interface RoomSnapshot {
  width: number;
  height: number;
  tiles: number[][];
  roomType: string;
}
