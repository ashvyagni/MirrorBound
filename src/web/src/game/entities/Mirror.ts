import Phaser from 'phaser';

import { animationKey, registerClips } from '../animation/clips';
import {
  MIRRORIDLE_ANCHOR, MIRRORIDLE_BODY_RATIO, MIRRORIDLE_FRAMES,
  MIRRORIDLE_FRAME_SIZE, MIRRORIDLE_TEXTURE_KEY,
} from '../animation/mirrorIdleAtlas.generated';
import { MIRRORDRIFT_ANCHOR, MIRRORDRIFT_BODY_RATIO, MIRRORDRIFT_FRAME_SIZE } from '../animation/mirrorDriftAtlas.generated';
import { MIRRORSTRIKE_ANCHOR, MIRRORSTRIKE_BODY_RATIO, MIRRORSTRIKE_FRAME_SIZE } from '../animation/mirrorStrikeAtlas.generated';
import { MIRRORCAST_ANCHOR, MIRRORCAST_BODY_RATIO, MIRRORCAST_FRAME_SIZE } from '../animation/mirrorCastAtlas.generated';
import { MIRRORHURT_ANCHOR, MIRRORHURT_BODY_RATIO, MIRRORHURT_FRAME_SIZE } from '../animation/mirrorHurtAtlas.generated';
import { MIRRORDEATH_ANCHOR, MIRRORDEATH_BODY_RATIO, MIRRORDEATH_FRAME_SIZE } from '../animation/mirrorDeathAtlas.generated';
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
export type MirrorClip = 'idle' | 'drift' | 'settle' | 'strike' | 'cast' | 'hurt' | 'death';

/** One sheet per clip, each its own texture. */
const SHEETS: Record<MirrorClip, string> = {
  idle: 'mirrorIdle',
  drift: 'mirrorDrift',
  settle: 'mirrorDrift',
  strike: 'mirrorStrike',
  cast: 'mirrorCast',
  hurt: 'mirrorHurt',
  death: 'mirrorDeath',
};

/** Frames per second per clip. Slow where it is heavy, fast where it is not. */
const RATES: Record<MirrorClip, number> = {
  idle: 8, drift: 8, settle: 6, strike: 16, cast: 13, hurt: 15, death: 11,
};

/** Drift's first row enters travel; its second row is only the stop sequence. */
const BUSY: ReadonlySet<MirrorClip> = new Set(['strike', 'cast', 'hurt', 'death']);
const ART = {
  idle: { anchor: MIRRORIDLE_ANCHOR, height: MIRRORIDLE_FRAME_SIZE.height * MIRRORIDLE_BODY_RATIO },
  drift: { anchor: MIRRORDRIFT_ANCHOR, height: MIRRORDRIFT_FRAME_SIZE.height * MIRRORDRIFT_BODY_RATIO },
  strike: { anchor: MIRRORSTRIKE_ANCHOR, height: MIRRORSTRIKE_FRAME_SIZE.height * MIRRORSTRIKE_BODY_RATIO },
  cast: { anchor: MIRRORCAST_ANCHOR, height: MIRRORCAST_FRAME_SIZE.height * MIRRORCAST_BODY_RATIO },
  hurt: { anchor: MIRRORHURT_ANCHOR, height: MIRRORHURT_FRAME_SIZE.height * MIRRORHURT_BODY_RATIO },
  death: { anchor: MIRRORDEATH_ANCHOR, height: MIRRORDEATH_FRAME_SIZE.height * MIRRORDEATH_BODY_RATIO },
} as const;

export const MIRROR_TEXTURES: readonly string[] = [...new Set(Object.values(SHEETS))];

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
        frames: clip === 'drift' ? MIRRORIDLE_FRAMES.a
          : clip === 'settle' ? MIRRORIDLE_FRAMES.b : MIRROR_FRAMES,
        frameRate: RATES[clip],
        repeat: clip === 'idle' ? -1 : 0,
      },
    });
  }
}

export class Mirror extends Phaser.GameObjects.Sprite {
  #clip: MirrorClip = 'idle';
  #busy = false;
  #velocity = new Phaser.Math.Vector2();
  readonly #shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, MIRRORIDLE_TEXTURE_KEY, MIRRORIDLE_FRAMES.a[0]);
    scene.add.existing(this);

    this.#fit('idle');

    // Sized by body ratio against the goat, exactly as everything else on this
    // branch is: the sheets are cropped differently and matching frame heights
    // would draw the same creature at different sizes.
    const body = GOAT_DISPLAY_HEIGHT * MIRROR.sizeRatio;
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
    if (this.dead || (this.#busy && !interrupting) || this.#clip === clip) return;
    this.#clip = clip;
    this.#busy = BUSY.has(clip);
    this.setTexture(SHEETS[clip]);
    this.#fit(clip);
    this.play(mirrorKey(clip), true);
  }

  #fit(clip: MirrorClip): void {
    const art = ART[clip === 'settle' ? 'drift' : clip];
    this.setOrigin(art.anchor.x, art.anchor.y);
    this.setScale(GOAT_DISPLAY_HEIGHT * MIRROR.sizeRatio / art.height);
  }

  #onDone(): void {
    if (this.#clip === 'drift' || this.#clip === 'death') return;   // the last frame is the resting pose
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
    const dt = Phaser.Math.Clamp(deltaSeconds, 0, 0.05);
    if (!this.dead && dt > 0) {
      const dx = toward ? toward.x - this.x : 0;
      const dy = toward ? toward.y - this.y : 0;
      const distance = Math.hypot(dx, dy);
      const remaining = Math.max(0, distance - MIRROR.keepDistance);
      // Ease toward a stand-off position rather than the player's centre.
      // This brakes before arrival instead of repeatedly slamming to a stop.
      const speed = this.#busy ? 0 : Math.min(MIRROR.maxSpeed, remaining / MIRROR.responseTime);
      const blend = 1 - Math.exp(-dt / MIRROR.accelTime);
      this.#velocity.x += ((distance ? dx / distance * speed : 0) - this.#velocity.x) * blend;
      this.#velocity.y += ((distance ? dy / distance * speed : 0) - this.#velocity.y) * blend;
      const travel = this.#velocity.length() * dt;
      const limit = travel > remaining && travel > 0 ? remaining / travel : 1;
      this.x += this.#velocity.x * dt * limit;
      this.y += this.#velocity.y * dt * limit;
      if (remaining < 0.25) this.#velocity.set(0, 0);

      const moving = this.#velocity.length();
      if (!this.#busy) {
        if (moving > 6 && this.#clip !== 'drift') this.#play('drift');
        else if (moving < 2 && this.#clip === 'drift') this.#play('settle');
      }
      // Retain facing while braking or moving nearly vertically.
      if (!this.#busy && Math.abs(this.#velocity.x) > 12) this.setFlipX(this.#velocity.x < 0);
    }

    this.setDepth(depthAt(this.y));
    this.#shadow.setPosition(this.x, this.y + GOAT_DISPLAY_HEIGHT * MIRROR.sizeRatio * MIRROR.shadowDrop);
    this.#shadow.setVisible(!this.dead);
  }

  override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onDone, this);
    this.#shadow.destroy();
    super.destroy(fromScene);
  }
}
