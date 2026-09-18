import Phaser from 'phaser';

import {
  SHIELDBLOCK_ANCHOR, SHIELDBLOCK_BODY_RATIO, SHIELDBLOCK_FRAMES,
  SHIELDBLOCK_FRAME_SIZE, SHIELDBLOCK_TEXTURE_KEY,
} from '../animation/shieldBlockAtlas.generated';
import {
  SHIELDPARRY_ANCHOR, SHIELDPARRY_BODY_RATIO, SHIELDPARRY_FRAMES,
  SHIELDPARRY_FRAME_SIZE, SHIELDPARRY_TEXTURE_KEY,
} from '../animation/shieldParryAtlas.generated';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { animationKey, registerClips } from '../animation/clips';
import { depthAt, GOAT_DISPLAY_HEIGHT, SHIELD } from '../constants';
import { flippedFor, mirroredOriginX } from '../facing';
import type { Facing, Vec2 } from '../types';

const BLOCK = animationKey(SHIELDBLOCK_TEXTURE_KEY, 'block');
const PARRY = animationKey(SHIELDPARRY_TEXTURE_KEY, 'parry');

/** Where the shield is in its own little life. */
export type ShieldState = 'away' | 'guarding' | 'parrying';

/**
 * The sword's shield.
 *
 * Its own entity rather than a second clip on `Weapon`, because it is on
 * screen at the same time as the sword and has its own timing. Like the
 * weapon it carries no physics -- nothing collides with it, and a body would
 * only be a second opinion about where it is.
 *
 * Guard is a press, not a hold: the intent stream reports abilities as edge
 * triggers, so raising the shield starts a timer and pressing again inside
 * the parry window turns the block into a counter.
 */
export class Shield extends Phaser.GameObjects.Sprite {
  #state: ShieldState = 'away';
  /** Seconds the guard has been up. Drives both the parry window and the
   *  point at which it drops on its own. */
  #held = 0;

  static register(anims: Phaser.Animations.AnimationManager): void {
    // The block sheet raises the shield over four frames and then holds it for
    // four. Only the hold repeats, so the raise plays once and the guard can
    // sit up for as long as it likes -- which a single looping clip could not
    // do without replaying the raise.
    registerClips(anims, SHIELDBLOCK_TEXTURE_KEY, {
      block: { frames: SHIELDBLOCK_FRAMES.block, frameRate: 22, repeat: 0 },
      hold: { frames: SHIELDBLOCK_FRAMES.block_b, frameRate: 8, repeat: -1 },
    });
    registerClips(anims, SHIELDPARRY_TEXTURE_KEY, {
      parry: {
        frames: [...SHIELDPARRY_FRAMES.parry, ...SHIELDPARRY_FRAMES.parry_b],
        frameRate: 24,
        repeat: 0,
      },
    });
  }

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, SHIELDBLOCK_TEXTURE_KEY, SHIELDBLOCK_FRAMES.block[0]);
    scene.add.existing(this);
    this.setVisible(false).setActive(false);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onClipEnd, this);
  }

  /** Named `guard`, not `state`: Phaser's GameObject already owns `state`. */
  get guard(): ShieldState {
    return this.#state;
  }

  get up(): boolean {
    return this.#state !== 'away';
  }

  /** True while a second press would parry rather than be ignored. */
  get parryOpen(): boolean {
    return this.#state === 'guarding' && this.#held <= SHIELD.parryWindow;
  }

  /**
   * Raise the guard, or parry if one is already up and still fresh.
   *
   * Returns what it did, so the scene can report the right thing and start the
   * right cooldown.
   */
  trigger(): ShieldState {
    if (this.#state === 'parrying') return 'parrying';

    if (this.#state === 'guarding') {
      if (!this.parryOpen) return 'guarding';
      this.#state = 'parrying';
      this.#dress(SHIELDPARRY_FRAME_SIZE, SHIELDPARRY_BODY_RATIO, SHIELDPARRY_ANCHOR);
      this.play(PARRY, true);
      return 'parrying';
    }

    this.#state = 'guarding';
    this.#held = 0;
    this.setVisible(true).setActive(true);
    this.#dress(SHIELDBLOCK_FRAME_SIZE, SHIELDBLOCK_BODY_RATIO, SHIELDBLOCK_ANCHOR);
    this.play(BLOCK, true);
    return 'guarding';
  }

  /** Put it away now, whatever it was doing. */
  lower(): void {
    this.#state = 'away';
    this.#held = 0;
    this.setVisible(false).setActive(false);
  }

  /** Follow the goat. Returns true on the frame the guard drops by itself, so
   *  the scene can start its cooldown from when it actually ended. */
  step(deltaSeconds: number, host: { x: number; y: number; aim: Vec2; facing: Facing }): boolean {
    if (this.#state === 'away') return false;

    if (this.#state === 'guarding') {
      this.#held += deltaSeconds;
      if (this.#held >= SHIELD.holdTime) {
        this.lower();
        return true;
      }
    }

    const flipped = flippedFor(host.facing);
    const anchor = this.#state === 'parrying' ? SHIELDPARRY_ANCHOR : SHIELDBLOCK_ANCHOR;
    this.setFlipX(flipped);
    this.setOrigin(mirroredOriginX(anchor.x, flipped), anchor.y);

    // Held between the goat and whatever it is facing, so it belongs on the
    // aim rather than on a fixed side.
    const aim = host.aim;
    this.setPosition(
      host.x + aim.x * SHIELD.offset.x,
      host.y + aim.y * SHIELD.offset.x + SHIELD.offset.y,
    );
    this.setDepth(depthAt(this.y) + (aim.y < 0 ? -1 : 1));
    return false;
  }

  /** Point at a sheet and size it against the goat, the same way a weapon is. */
  #dress(
    frameSize: { readonly width: number; readonly height: number },
    bodyRatio: number,
    anchor: { readonly x: number; readonly y: number },
  ): void {
    const goatBody = GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    this.setScale((goatBody * SHIELD.sizeRatio) / (frameSize.height * bodyRatio));
    this.setOrigin(anchor.x, anchor.y);
  }

  #onClipEnd(animation: Phaser.Animations.Animation): void {
    // The raise hands over to the looping hold; the parry ends the whole thing.
    if (animation.key === BLOCK && this.#state === 'guarding') {
      this.play(animationKey(SHIELDBLOCK_TEXTURE_KEY, 'hold'), true);
    } else if (animation.key === PARRY) {
      this.lower();
    }
  }

  override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onClipEnd, this);
    super.destroy(fromScene);
  }
}
