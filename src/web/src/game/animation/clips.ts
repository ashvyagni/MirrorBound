import { GOAT_FRAMES, TEXTURE_KEY } from './goatAtlas.generated';

/**
 * Animation definitions.
 *
 * `frames` slices the generated frame list, so renaming or reordering frames in
 * the sheet surfaces here as a type error rather than as a silent mis-play.
 * The jump row is one drawn arc -- crouch, launch, apex, descend, descend,
 * land -- so it is split into the three clips the state machine actually needs.
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

const { idle, walk, run, jump, attack, hurt, die } = GOAT_FRAMES;

export const CLIPS = {
  idle: { frames: idle, frameRate: 7, repeat: -1 },
  walk: { frames: walk, frameRate: 11, repeat: -1 },
  run: { frames: run, frameRate: 15, repeat: -1 },
  rise: { frames: jump.slice(0, 3), frameRate: 14, repeat: 0, hold: true },
  fall: { frames: jump.slice(3, 5), frameRate: 9, repeat: 0, hold: true },
  land: { frames: jump.slice(5), frameRate: 12, repeat: 0, hold: true },
  attack: { frames: attack, frameRate: 16, repeat: 0, hold: true },
  hurt: { frames: hurt, frameRate: 1, repeat: 0, hold: true },
  die: { frames: die, frameRate: 1, repeat: 0, hold: true },
} as const satisfies Record<string, ClipDef>;

export type ClipName = keyof typeof CLIPS;

/** Clips the debug dock offers, in the order they appear on the sheet. */
export const CLIP_ORDER: readonly ClipName[] = [
  'idle', 'walk', 'run', 'rise', 'fall', 'land', 'attack', 'hurt', 'die',
];

/** Expression portraits. Not animations -- single frames shown in the UI. */
export const EXPRESSIONS = GOAT_FRAMES.face;

export function animationKey(clip: ClipName): string {
  return `${TEXTURE_KEY}:${clip}`;
}

/**
 * Register every clip on the shared animation manager.
 *
 * Phaser keys animations globally, so this is idempotent -- a scene restart
 * must not try to redefine them.
 */
export function registerAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const [name, def] of Object.entries(CLIPS) as [ClipName, ClipDef][]) {
    const key = animationKey(name);
    if (anims.exists(key)) continue;
    anims.create({
      key,
      frames: def.frames.map((frame) => ({ key: TEXTURE_KEY, frame })),
      frameRate: def.frameRate,
      repeat: def.repeat,
    });
  }
}
