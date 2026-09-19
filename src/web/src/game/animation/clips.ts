import type Phaser from 'phaser';

/**
 * Shared animation plumbing.
 *
 * Both characters describe their animations as a table of `ClipDef`s keyed by
 * name; everything specific to one of them lives in `goatClips` / `broClips`.
 */
export interface ClipDef {
  /** Frame names, in play order. */
  frames: readonly string[];
  frameRate: number;
  /** -1 loops forever, 0 plays once. */
  repeat: number;
  /** Hold the final frame instead of reverting when the clip ends. */
  hold?: boolean;
}

/** Which of the three drawn views a direction lands on. */
export type ViewDirection = 'side' | 'front' | 'back';

/**
 * Pick a view from a direction, biased toward the side.
 *
 * The side sheets are the only ones drawn in profile, so a diagonal belongs on
 * them: a direction counts as vertical only when it is within about thirty
 * degrees of straight up or down, which leaves a clean 45 reading as a profile.
 * `bias` is how far `x` may run before the direction stops counting as
 * vertical, as a fraction of `y`.
 */
export function viewForDirection(v: { x: number; y: number }, bias = 0.58): ViewDirection {
  if (v.y === 0) return 'side';
  if (Math.abs(v.x) > Math.abs(v.y) * bias) return 'side';
  return v.y < 0 ? 'back' : 'front';
}

/** Animation keys are global in Phaser, so they are namespaced by texture. */
export function animationKey(texture: string, clip: string): string {
  return `${texture}:${clip}`;
}

/**
 * Register a clip table on the animation manager.
 *
 * Idempotent: Phaser keys animations globally, so a scene restart must not try
 * to redefine them.
 */
export function registerClips(
  anims: Phaser.Animations.AnimationManager,
  texture: string,
  clips: Record<string, ClipDef>,
): void {
  for (const [name, def] of Object.entries(clips)) {
    const key = animationKey(texture, name);
    if (anims.exists(key)) continue;
    anims.create({
      key,
      frames: def.frames.map((frame) => ({ key: texture, frame })),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
}
