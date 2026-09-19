import type { ClipName } from './animation/goatClips';

export type { ClipName };

/** What the player character is doing, as far as the renderer is concerned. */
export type PlayerState = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'die';

export type Facing = 1 | -1;

/**
 * One frame of "what should the character try to do".
 *
 * Nothing downstream knows whether this came from a keyboard, a replay, or an
 * agent -- which is the point. Facing is *not* part of it: the server derives
 * facing from movement, so aiming never depends on the mouse.
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
  /** Ability slot pressed this frame (1-4). */
  ability: number | null;
  /**
   * Unit vector from the player toward the cursor, or zero when there is none.
   *
   * Filled by the play scene rather than the input source: it is the one part
   * of an intent that needs to know where the player is standing and how the
   * camera is placed, and an input source that knew either of those would stop
   * being a description of what the player asked for.
   */
  aimX: number;
  aimY: number;
}

export const NEUTRAL_INTENT: Readonly<Intent> = Object.freeze({
  moveX: 0,
  moveY: 0,
  attack: false,
  run: false,
  ability: null,
  aimX: 0,
  aimY: 0,
});

/** Anything that can drive the character. */
export interface IntentSource {
  /** Called once per frame, before physics. */
  sample(deltaSeconds: number): Intent;
  destroy?(): void;
}

/** Snapshot pushed to the UI each time the local character view changes. */
export interface PlayerSnapshot {
  state: PlayerState;
  clip: ClipName;
  facing: Facing;
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';
