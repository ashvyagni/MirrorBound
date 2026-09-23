import Phaser from 'phaser';

import { animationKey, registerClips } from '../animation/clips';
import {
  HATCHBURST_ANCHOR, HATCHBURST_BODY_RATIO, HATCHBURST_FRAME_SIZE,
  HATCHBURST_TEXTURE_KEY,
} from '../animation/hatchBurstAtlas.generated';
import {
  HATCHCRACK_ANCHOR, HATCHCRACK_BODY_RATIO, HATCHCRACK_FRAMES,
  HATCHCRACK_FRAME_SIZE, HATCHCRACK_TEXTURE_KEY,
} from '../animation/hatchCrackAtlas.generated';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import {
  COMPANION, depthAt, DEPTH, GOAT_DISPLAY_HEIGHT, MIRROR,
} from '../constants';
import { FX } from '../world/textures';

/**
 * The companion cracking open into the Mirror.
 *
 * Sixteen frames across two sheets, and the whole point of it is the size
 * change: it starts as the small creature that has been following you around
 * all game and ends as the thing that is two and a half times your height. A
 * boss that simply appeared at full size would be a boss you never saw arrive.
 *
 * The two sheets are scaled independently, by the same body-ratio rule as
 * every other creature on this branch: `crack` is drawn at the companion's
 * visible size, `burst` at the Mirror's. That means there *is* a step in size
 * where one sheet hands over to the other -- `crack` ends on a shell about to
 * give and `burst` opens on one already gone, and no amount of arithmetic
 * makes two separately drawn sheets line up across that cut.
 *
 * So the cut is covered rather than hidden: a white flash and a camera shake
 * land exactly on it. That is also where the beat belongs dramatically, which
 * is why this reads as staging rather than as a patch over a seam.
 */

/** Each phase has time to read, with a held breath before the shell breaks. */
const CRACK_RATE = 5;
const BURST_RATE = 6;
const ANTICIPATION = 0.85;
const CRACK_HOLD = 0.35;
const REVEAL_HOLD = 0.7;

/** The flash over the cut, in seconds. */
const FLASH_IN = 0.06;
const FLASH_OUT = 0.34;

const SHAKE = { duration: 520, intensity: 0.004 } as const;

const FRAMES: readonly string[] = [...HATCHCRACK_FRAMES.a, ...HATCHCRACK_FRAMES.b];

export const HATCH_TEXTURES: readonly string[] = [
  HATCHCRACK_TEXTURE_KEY, HATCHBURST_TEXTURE_KEY,
];

export function registerHatchAnimations(anims: Phaser.Animations.AnimationManager): void {
  // Both sheets are the same eight frame names, like every other sheet here.
  registerClips(anims, HATCHCRACK_TEXTURE_KEY, {
    crack: { frames: FRAMES, frameRate: CRACK_RATE, repeat: 0 },
  });
  registerClips(anims, HATCHBURST_TEXTURE_KEY, {
    burst: { frames: FRAMES, frameRate: BURST_RATE, repeat: 0 },
  });
}

/** How long the whole thing runs, so a caller can time anything against it. */
export const HATCH_SECONDS = ANTICIPATION + FRAMES.length / CRACK_RATE
  + CRACK_HOLD + FRAMES.length / BURST_RATE + REVEAL_HOLD;

export class Hatch extends Phaser.GameObjects.Sprite {
  readonly #shadow: Phaser.GameObjects.Image;
  #done: (() => void) | null;
  #burst = false;
  #timer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, done: () => void) {
    super(scene, x, y, HATCHCRACK_TEXTURE_KEY, FRAMES[0]);
    scene.add.existing(this);
    this.#done = done;

    this.setOrigin(HATCHCRACK_ANCHOR.x, HATCHCRACK_ANCHOR.y);
    this.setScale(this.#scaleFor('crack'));
    this.setDepth(depthAt(y));

    // Grows with the creature, so the thing on the floor under it keeps
    // agreeing with the thing above it.
    this.#shadow = scene.add
      .image(x, y, FX.shadow)
      .setDepth(DEPTH.shadow)
      .setAlpha(0.45);
    this.#fitShadow();

    this.#timer = scene.time.delayedCall(ANTICIPATION * 1000, () => {
      this.play(animationKey(HATCHCRACK_TEXTURE_KEY, 'crack'), true);
    });
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#next, this);
  }

  /**
   * Scale for one sheet, from its own generated box and body ratio.
   *
   * Never from the frame in hand: these frames trim from 260 to 437, and
   * sizing on whichever one is showing would make the creature pulse as it
   * animated.
   */
  #scaleFor(clip: 'crack' | 'burst'): number {
    if (clip === 'crack') {
      const body = GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO * COMPANION.sizeRatio;
      return body / (HATCHCRACK_FRAME_SIZE.height * HATCHCRACK_BODY_RATIO);
    }
    // The same target the Mirror itself uses, so the last frame of the burst
    // and the first frame of the boss are the same size.
    const body = GOAT_DISPLAY_HEIGHT * MIRROR.sizeRatio;
    return body / (HATCHBURST_FRAME_SIZE.height * HATCHBURST_BODY_RATIO);
  }

  #fitShadow(): void {
    this.#shadow.setScale((this.displayHeight * 0.3) / 64);
    this.#shadow.setY(this.y + this.displayHeight * MIRROR.shadowDrop);
  }

  #next(): void {
    if (!this.#burst) {
      this.#burst = true;
      this.#timer = this.scene.time.delayedCall(CRACK_HOLD * 1000, () => {
        this.setTexture(HATCHBURST_TEXTURE_KEY, FRAMES[0]);
        this.setOrigin(HATCHBURST_ANCHOR.x, HATCHBURST_ANCHOR.y);
        this.setScale(this.#scaleFor('burst'));
        this.#fitShadow();
        this.play(animationKey(HATCHBURST_TEXTURE_KEY, 'burst'), true);
        this.#flash();
        this.scene.cameras.main.shake(SHAKE.duration, SHAKE.intensity);
      });
      return;
    }

    // Let the fully revealed silhouette read before the chase begins.
    this.#timer = this.scene.time.delayedCall(REVEAL_HOLD * 1000, () => {
      const done = this.#done;
      this.#done = null;
      this.destroy();
      done?.();
    });
  }

  #flash(): void {
    const cam = this.scene.cameras.main;
    cam.flash(FLASH_IN * 1000 + FLASH_OUT * 1000, 255, 255, 255, true);
  }

  override destroy(fromScene?: boolean): void {
    this.#timer?.remove(false);
    this.#done = null;
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#next, this);
    this.#shadow.destroy();
    super.destroy(fromScene);
  }
}
