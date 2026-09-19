import Phaser from 'phaser';

import { animationKey, registerClips } from '../animation/clips';
import {
  MIRRORIDLE_ANCHOR, MIRRORIDLE_BODY_RATIO, MIRRORIDLE_FRAMES,
  MIRRORIDLE_FRAME_SIZE, MIRRORIDLE_TEXTURE_KEY,
} from '../animation/mirrorIdleAtlas.generated';
import { depthAt, DEPTH, GOAT_DISPLAY_HEIGHT, MIRROR } from '../constants';
import { FX } from '../world/textures';

/**
 * The Mirror: the twin, corrupted.
 *
 * `main` defines it -- 520 health, speed 190, tagged `MELEE`, `RANGED` and
 * `SPELL` -- and this is the body those stats will eventually drive. Today it
 * is the art, the clips and the state machine; there is no AI behind it yet,
 * because the branch has no enemy system to hang one on.
 *
 * It floats, so it has no ground contact and no walk cycle. Every sheet is
 * anchored on its middle, and the shadow under it is a hint rather than a
 * contact point.
 */
export type MirrorClip = 'idle' | 'drift' | 'strike' | 'cast' | 'hurt' | 'death';

/** One sheet per clip, each its own texture. */
const SHEETS: Record<MirrorClip, string> = {
  idle: 'mirrorIdle',
  drift: 'mirrorDrift',
  strike: 'mirrorStrike',
  cast: 'mirrorCast',
  hurt: 'mirrorHurt',
  death: 'mirrorDeath',
};

/** Frames per second per clip. Slow where it is heavy, fast where it is not. */
const RATES: Record<MirrorClip, number> = {
  idle: 8, drift: 10, strike: 16, cast: 13, hurt: 15, death: 11,
};

/** Only the two resting loops repeat; everything else plays once. */
const LOOPS: ReadonlySet<MirrorClip> = new Set<MirrorClip>(['idle', 'drift']);

export const MIRROR_TEXTURES: readonly string[] = Object.values(SHEETS);

/** The eight frame names every Mirror sheet carries, in play order. */
const MIRROR_FRAMES: readonly string[] = [
  ...MIRRORIDLE_FRAMES.a, ...MIRRORIDLE_FRAMES.b,
];

export function mirrorKey(clip: MirrorClip): string {
  return animationKey(SHEETS[clip], clip);
}

export function registerMirrorAnimations(anims: Phaser.Animations.AnimationManager): void {
  for (const clip of Object.keys(SHEETS) as MirrorClip[]) {
    const texture = SHEETS[clip];
    registerClips(anims, texture, {
      [clip]: {
        // Every one of these sheets is eight frames named the same way, so
        // one frame list serves every texture.
        frames: MIRROR_FRAMES,
        frameRate: RATES[clip],
        repeat: LOOPS.has(clip) ? -1 : 0,
      },
    });
  }
}

export class Mirror extends Phaser.GameObjects.Sprite {
  #clip: MirrorClip = 'idle';
  #busy = false;
  readonly #shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, MIRRORIDLE_TEXTURE_KEY, MIRRORIDLE_FRAMES.a[0]);
    scene.add.existing(this);

    this.setOrigin(MIRRORIDLE_ANCHOR.x, MIRRORIDLE_ANCHOR.y);

    // Sized by body ratio against the goat, exactly as everything else on this
    // branch is: the sheets are cropped differently and matching frame heights
    // would draw the same creature at different sizes.
    const body = GOAT_DISPLAY_HEIGHT * MIRROR.sizeRatio;
    // The generated shared box and body ratio, not the frame in hand -- the
    // frames trim differently and sizing on one makes the creature breathe.
    this.setScale(body / (MIRRORIDLE_FRAME_SIZE.height * MIRRORIDLE_BODY_RATIO));

    // It floats, so its shadow sits below it and is small and soft -- a hint
    // that it is over the floor rather than a claim that it touches it.
    this.#shadow = scene.add
      .image(x, y + body * MIRROR.shadowDrop, FX.shadow)
      .setDepth(DEPTH.shadow)
      .setScale((body * 0.32) / 64)
      .setAlpha(0.4);

    this.play(mirrorKey('idle'), true);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onDone, this);
  }

  get clip(): MirrorClip {
    return this.#clip;
  }

  /** Play a one-shot, unless something more important is already playing. */
  #play(clip: MirrorClip, interrupting = false): void {
    if (this.#busy && !interrupting) return;
    this.#clip = clip;
    this.#busy = !LOOPS.has(clip);
    this.setTexture(SHEETS[clip]);
    this.play(mirrorKey(clip), true);
  }

  #onDone(): void {
    if (this.#clip === 'death') return;   // the last frame is the resting pose
    this.#busy = false;
    this.#play('idle');
  }

  strike(): void { this.#play('strike'); }
  cast(): void { this.#play('cast'); }
  hit(): void { this.#play('hurt', true); }

  kill(): void {
    this.#play('death', true);
  }

  get dead(): boolean {
    return this.#clip === 'death';
  }

  /**
   * Drift toward a point.
   *
   * No physics body: it floats, nothing collides with it yet, and a body would
   * only be a second place its position is decided.
   */
  step(deltaSeconds: number, toward: { x: number; y: number } | null): void {
    if (!this.dead && toward) {
      const dx = toward.x - this.x;
      const dy = toward.y - this.y;
      const distance = Math.hypot(dx, dy);

      if (distance > MIRROR.keepDistance) {
        const blend = 1 - Math.exp(-deltaSeconds / MIRROR.responseTime);
        this.x += dx * blend * MIRROR.followScale;
        this.y += dy * blend * MIRROR.followScale;
        if (!this.#busy && this.#clip !== 'drift') this.#play('drift');
      } else if (!this.#busy && this.#clip !== 'idle') {
        this.#play('idle');
      }

      // It faces the way it is going, and only the side profile is mirrored.
      if (Math.abs(dx) > 4) this.setFlipX(dx < 0);
    }

    this.setDepth(depthAt(this.y));
    this.#shadow.setPosition(this.x, this.y + this.displayHeight * MIRROR.shadowDrop);
    this.#shadow.setVisible(!this.dead);
  }

  override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onDone, this);
    this.#shadow.destroy();
    super.destroy(fromScene);
  }
}
