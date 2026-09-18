import Phaser from 'phaser';

import { DUMMY_ANCHOR, DUMMY_FRAMES, DUMMY_FRAME_SIZE, DUMMY_TEXTURE_KEY } from '../animation/dummyAtlas.generated';
import { animationKey, registerClips } from '../animation/clips';
import { depthAt, DEPTH, DUMMY_HEIGHT } from '../constants';
import { FX } from '../world/textures';

const CLIP = animationKey(DUMMY_TEXTURE_KEY, 'hit');

/**
 * A practice target.
 *
 * Its sheet is one reaction: struck, recoil, wobble, settle. Frame 0 is the
 * upright pose, so it rests on that and replays the whole clip when hit rather
 * than needing a separate idle.
 */
export class Dummy extends Phaser.GameObjects.Sprite {
  #reacting = false;

  static register(anims: Phaser.Animations.AnimationManager): void {
    registerClips(anims, DUMMY_TEXTURE_KEY, {
      hit: { frames: DUMMY_FRAMES.hit, frameRate: 16, repeat: 0 },
    });
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, DUMMY_TEXTURE_KEY, DUMMY_FRAMES.hit[0]);
    scene.add.existing(this);
    this.setOrigin(DUMMY_ANCHOR.x, DUMMY_ANCHOR.y);
    this.setScale(DUMMY_HEIGHT / DUMMY_FRAME_SIZE.height);
    this.setDepth(depthAt(y));
    // Set once: a dummy is planted, so nothing about it ever moves.
    scene.add
      .image(x, y, FX.shadow)
      .setDepth(DEPTH.shadow)
      .setScale((DUMMY_HEIGHT * 0.5) / 64)
      .setAlpha(0.6);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.#reacting = false;
      this.setFrame(DUMMY_FRAMES.hit[0]);
    });
  }

  get reacting(): boolean {
    return this.#reacting;
  }

  /** Take a hit. Ignored while already reacting, so it cannot stutter. */
  hit(): void {
    if (this.#reacting) return;
    this.#reacting = true;
    this.play(CLIP, true);
  }
}
