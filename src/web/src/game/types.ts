import type { ClipName } from './animation/clips';

/** What the goat is doing. One of these is always true, and only one. */
export type PlayerState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'rise'
  | 'fall'
  | 'land'
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
  /** True only on the frame the jump was requested. */
  jump: boolean;
  /** True for as long as jump is held; enables variable jump height. */
  jumpHeld: boolean;
  /** True only on the frame the attack was requested. */
  attack: boolean;
  /** Hold to run instead of walk. */
  run: boolean;
}

export const NEUTRAL_INTENT: Readonly<Intent> = Object.freeze({
  moveX: 0,
  jump: false,
  jumpHeld: false,
  attack: false,
  run: false,
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
  grounded: boolean;
  velocityX: number;
  velocityY: number;
}
