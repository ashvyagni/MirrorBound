import Phaser from 'phaser';

import { BRO_ANCHOR, BRO_FRAME_SIZE } from '../animation/broAtlas.generated';
import { GOAT_FRAME_SIZE } from '../animation/goatAtlas.generated';
import {
  BRO_ATTACK_CLIP, BRO_CLIPS, BRO_TEXTURE, broAnimationKey, pickEmote, type BroClipName,
} from '../animation/broClips';
import { FX_TEXTURE, fxAnimationKey } from '../animation/fx';
import { COMPANION, COMPANION_DISPLAY_HEIGHT } from '../constants';
import type { Facing } from '../types';

/** What the companion needs to know about whoever it is following. */
export interface FollowTarget {
  x: number;
  y: number;
  facing: Facing;
  /** True while the host is doing nothing worth reacting to. */
  resting: boolean;
  speed: number;
}

export type BroMood = 'travelling' | 'resting' | 'emoting';

/**
 * The floating companion.
 *
 * Deliberately not a physics body: it never collides with anything, so giving
 * it one would only add a body to resolve every frame and a second source of
 * truth for where it is. Position is integrated directly instead.
 */
export class Bro extends Phaser.GameObjects.Sprite {
  /** Follow position, kept apart from the rendered position so the idle bob
   *  does not feed back into the velocity that picks the animation. */
  #anchor = new Phaser.Math.Vector2();
  #velocity = new Phaser.Math.Vector2();
  #bobPhase = Math.random() * Math.PI * 2;
  #clip: BroClipName = 'idle';
  #emote: BroClipName | null = null;
  #calmFor = 0;
  #emoteCountdown: number;
  #facing: Facing = 1;
  /** Swirl drawn over the companion while it attacks. */
  readonly #swirl: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, BRO_TEXTURE, BRO_CLIPS.idle.frames[0]);
    scene.add.existing(this);

    this.setOrigin(BRO_ANCHOR.x, BRO_ANCHOR.y);
    this.setScale(COMPANION_DISPLAY_HEIGHT / BRO_FRAME_SIZE.height);
    this.#anchor.set(x, y);
    this.#emoteCountdown = this.#nextEmoteDelay();

    // The swirl is a separate sprite rather than part of the clip: it is the
    // goat's effect, lifted out of its sheet, so it has its own texture and its
    // own timing.
    this.#swirl = scene.add
      .sprite(x, y, FX_TEXTURE)
      .setOrigin(0.5, 0.5)
      .setScale((COMPANION_DISPLAY_HEIGHT * COMPANION.attackFxScale) / GOAT_FRAME_SIZE.height)
      .setVisible(false)
      .setDepth(this.depth + 1);

    this.play(broAnimationKey('idle'));
    // A one-shot emote hands control back the moment it finishes.
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onClipComplete, this);
    this.#swirl.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onSwirlComplete, this);
  }

  get mood(): BroMood {
    if (this.#emote) return 'emoting';
    return this.#isCalm() ? 'resting' : 'travelling';
  }

  get clip(): BroClipName {
    return this.#clip;
  }

  #nextEmoteDelay(): number {
    const { emoteDelayMin, emoteDelayMax } = COMPANION;
    return emoteDelayMin + Math.random() * (emoteDelayMax - emoteDelayMin);
  }

  #isCalm(): boolean {
    return this.#velocity.length() < COMPANION.restThreshold;
  }

  // --- following -------------------------------------------------------------

  /**
   * Advance one frame.
   *
   * The companion aims at a point behind the host rather than at the host
   * itself, and closes on it slowly, so the lag comes from two places: the
   * static offset sets where it settles, and the soft chase makes it swing out
   * on direction changes and stretch further behind at speed.
   */
  step(deltaSeconds: number, target: FollowTarget): void {
    const trail = COMPANION.trailDistance + target.speed * COMPANION.trailPerSpeed;
    const wantX = target.x - target.facing * trail;
    const wantY = target.y + COMPANION.neckOffsetY;

    // Exponential approach, so the lag is identical at any frame rate.
    const blend = 1 - Math.exp(-deltaSeconds / COMPANION.responseTime);
    const nextX = this.#anchor.x + (wantX - this.#anchor.x) * blend;
    const nextY = this.#anchor.y + (wantY - this.#anchor.y) * blend;

    this.#velocity.set(
      (nextX - this.#anchor.x) / deltaSeconds,
      (nextY - this.#anchor.y) / deltaSeconds,
    );
    this.#anchor.set(nextX, nextY);

    this.#bobPhase += deltaSeconds * COMPANION.bobSpeed;
    this.setPosition(
      this.#anchor.x,
      this.#anchor.y + Math.sin(this.#bobPhase) * COMPANION.bobAmplitude,
    );

    this.#facing = target.facing;
    this.#swirl.setPosition(this.x, this.y + COMPANION.attackFxOffsetY);
    this.#updateMood(deltaSeconds, target);
  }

  #updateMood(deltaSeconds: number, target: FollowTarget): void {
    const calm = this.#isCalm() && target.resting;
    this.#calmFor = calm ? this.#calmFor + deltaSeconds : 0;

    if (this.#emote) {
      // Travelling cancels a performance -- it should look like it noticed.
      if (!this.#isCalm()) this.#endEmote();
      return;
    }

    this.#play(this.#travelClip());

    if (this.#calmFor < COMPANION.settleTime) {
      this.#emoteCountdown = this.#nextEmoteDelay();
      return;
    }
    this.#emoteCountdown -= deltaSeconds;
    if (this.#emoteCountdown <= 0) this.perform(pickEmote());
  }

  /** Which travel clip matches how it is currently moving. */
  #travelClip(): BroClipName {
    const { x: vx, y: vy } = this.#velocity;
    // Horizontal wins ties: the host mostly runs, and reading a climb during a
    // sprint would flicker between the two every time it bobs.
    if (Math.abs(vx) > COMPANION.moveThreshold) return vx > 0 ? 'moveRight' : 'moveLeft';
    if (Math.abs(vy) > COMPANION.climbThreshold) return vy < 0 ? 'moveUp' : 'moveDown';
    return this.#isCalm() ? 'idle' : 'hover';
  }

  // --- performing ------------------------------------------------------------

  /** Play a one-shot emote now, interrupting whatever it was doing. */
  perform(clip: BroClipName): void {
    if (BRO_CLIPS[clip].repeat !== 0) return;   // looping clips are not emotes
    this.#emote = clip;
    this.#calmFor = 0;
    this.#emoteCountdown = this.#nextEmoteDelay();
    this.#play(clip, true);
  }

  /**
   * Strike.
   *
   * Its sheet has no attack pose, so the spin stands in for one and the goat's
   * swirl is layered over it -- which is also what stops the move reading as
   * just another dance.
   */
  attack(): void {
    this.perform(BRO_ATTACK_CLIP);
    this.#swirl
      .setVisible(true)
      .setFlipX(this.#facing === -1)
      .play(fxAnimationKey('swirl'), true);
  }

  #endEmote(): void {
    this.#emote = null;
    this.#emoteCountdown = this.#nextEmoteDelay();
    this.#play(this.#travelClip(), true);
  }

  #onClipComplete(animation: Phaser.Animations.Animation): void {
    if (this.#emote && animation.key === broAnimationKey(this.#emote)) this.#endEmote();
  }

  #onSwirlComplete(): void {
    this.#swirl.setVisible(false);
  }

  #play(clip: BroClipName, restart = false): void {
    if (!restart && this.#clip === clip) return;
    this.#clip = clip;
    this.play(broAnimationKey(clip), !restart);
  }

  /** Drop it back beside the host without an easing swoop across the level. */
  snapTo(target: FollowTarget): void {
    this.#anchor.set(
      target.x - target.facing * COMPANION.trailDistance,
      target.y + COMPANION.neckOffsetY,
    );
    this.#velocity.reset();
    this.setPosition(this.#anchor.x, this.#anchor.y);
    this.#swirl.setVisible(false);
    this.#endEmote();
  }

  override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onClipComplete, this);
    this.#swirl.destroy();
    super.destroy(fromScene);
  }
}
