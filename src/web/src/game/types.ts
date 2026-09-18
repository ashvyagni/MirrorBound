import type { ClipName } from './animation/goatClips';

/** What the goat is doing. One of these is always true, and only one. */
export type PlayerState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'hurt'
  | 'die';

/** Which way the sprite is flipped. The art is drawn side-on even though the
 *  world is seen from above, so left and right is all a sheet can express. */
export type Facing = 1 | -1;

/** Where the character is actually pointing, which the sheet cannot show. */
export interface Vec2 {
  x: number;
  y: number;
}

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
  /** -1 full up the screen, 0 neutral, 1 full down. Up the screen is further
   *  away: this is depth into the scene, not height above a floor. */
  moveY: number;
  /** True only on the frame the attack was requested. */
  attack: boolean;
  /** Hold to run instead of walk. */
  run: boolean;
  /** Ability slot requested this frame: 0, 1 or 2. Null for none. */
  ability: number | null;
  /** True only on the frame the companion was told to attack. */
  companionAttack: boolean;
  /**
   * Step through the weapon carousel: -1 back, 1 forward, 0 stay.
   *
   * Switching is an intent like any other, so the same feed that walks and
   * swings can also change what is in hand -- rather than weapons being a
   * thing only a mouse on a React panel can reach.
   */
  weaponCycle: -1 | 0 | 1;
}

export const NEUTRAL_INTENT: Readonly<Intent> = Object.freeze({
  moveX: 0,
  moveY: 0,
  attack: false,
  run: false,
  companionAttack: false,
  ability: null,
  weaponCycle: 0,
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
  /** Where the character is aiming, normalised. */
  aim: Vec2;
  velocityX: number;
  velocityY: number;
}
