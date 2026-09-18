/**
 * The twin: Logesh's floating companion ("Bro") sheet, now positioned by the
 * server's twin entity and reacting to its decisions.
 *
 * Kept from the original: the bob, the emote system, the swirl-over-spin
 * attack, and the never-mirror rule (its bow would swap sides). Changed: it
 * no longer chases the player itself -- the server decides where it goes.
 */

import Phaser from 'phaser';

import { BRO_ANCHOR, BRO_FRAME_SIZE } from '../animation/broAtlas.generated';
import { GOAT_FRAME_SIZE } from '../animation/goatAtlas.generated';
import { BRO_CLIPS, BRO_TEXTURE, broAnimationKey, type BroClipName } from '../animation/broClips';
import { FX_TEXTURE, fxAnimationKey } from '../animation/fx';
import { DEPTH, TWIN_DISPLAY_HEIGHT } from '../constants';
import type { TwinSnap, Vec2 } from '../contracts';
import { EntityView } from './EntityView';

const INTENT_GLYPH: Record<string, string> = {
  ATTACK: '⚔', ASSIST: '⚔', INTERCEPT: '⛨', PROTECT: '⛨', DISTRACT: '!', FLANK: '↻', RETREAT: '↩',
  REPOSITION: '…', FOLLOW: '', EXPLORE: '✦', COMBO: '⚔', HEAL: '✚',
};

export class TwinView extends EntityView {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly #swirl: Phaser.GameObjects.Sprite;
  readonly #bubble: Phaser.GameObjects.Text;
  #bobPhase = Math.random() * Math.PI * 2;
  #clip: BroClipName = 'idle';
  #emote: BroClipName | null = null;
  #bubbleTimer = 0;
  #lastIntent = '';
  snap: TwinSnap | null = null;
  showThoughts = true;

  constructor(scene: Phaser.Scene, pos: Vec2) {
    super(scene, 'twin_1', pos, 0.6);
    this.sprite = scene.add.sprite(pos.x, pos.y, BRO_TEXTURE, BRO_CLIPS.idle.frames[0]);
    this.sprite.setOrigin(BRO_ANCHOR.x, BRO_ANCHOR.y);
    this.sprite.setScale(TWIN_DISPLAY_HEIGHT / BRO_FRAME_SIZE.height);
    this.sprite.play(broAnimationKey('idle'));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onClipComplete, this);

    this.#swirl = scene.add.sprite(pos.x, pos.y, FX_TEXTURE).setOrigin(0.5, 0.5)
      .setScale((TWIN_DISPLAY_HEIGHT * 1.3) / GOAT_FRAME_SIZE.height).setVisible(false).setDepth(DEPTH.fxLow);
    this.#swirl.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.#swirl.setVisible(false));

    this.#bubble = scene.add.text(pos.x, pos.y, '', {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', color: '#e8f4ff',
      stroke: '#14111a', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(DEPTH.fxHigh).setAlpha(0);
  }

  get clip(): BroClipName {
    return this.#clip;
  }

  applySnapshot(snap: TwinSnap): void {
    this.snap = snap;
    this.syncTarget(snap.position, snap.velocity);
    const intent = snap.intent.intentType;
    if (intent !== this.#lastIntent) {
      this.#lastIntent = intent;
      this.#showThought(intent, snap.intent.confidence);
    }
    if (snap.state === 'downed') {
      this.sprite.setTint(0x555566).setAlpha(0.5);
    } else if (this.sprite.alpha !== 1) {
      this.sprite.clearTint().setAlpha(1);
    }
  }

  #showThought(intent: string, confidence: number): void {
    if (!this.showThoughts) return;
    const glyph = INTENT_GLYPH[intent] ?? '';
    if (!glyph) return;
    this.#bubble.setText(`${glyph} ${intent.toLowerCase()}`);
    this.#bubble.setAlpha(Math.min(1, 0.55 + confidence * 0.5));
    this.#bubbleTimer = 1.4;
  }

  /** Reactions to what happened in the world. */
  onAttack(): void {
    this.#perform('danceSpin');
    this.#swirl.setVisible(true).setFlipX(this.sprite.x > (this.snap?.intent.position?.x ?? this.sprite.x))
      .play(fxAnimationKey('swirl'), true);
  }

  onHurt(): void {
    this.#perform('surprised');
  }

  onCelebrate(): void {
    this.#perform(Math.random() < 0.5 ? 'danceHappy' : 'danceExcited');
  }

  onLookAround(): void {
    this.#perform('lookAround');
  }

  update(dt: number): void {
    this.follow(dt, 16);
    this.#bobPhase += dt * 2.3;
    const bob = Math.sin(this.#bobPhase) * 3.5;
    // The twin hovers a little above its logical position so its shadow sits below.
    const hover = -18;
    this.sprite.setPosition(this.x, this.y + hover + bob);
    this.sprite.setDepth(this.depthFor(this.y));
    this.placeShadow(this.x, this.y);
    this.#swirl.setPosition(this.x, this.y + hover + bob - 4);
    this.#bubble.setPosition(this.x, this.y + hover + bob - TWIN_DISPLAY_HEIGHT * 0.55);
    if (this.#bubbleTimer > 0) {
      this.#bubbleTimer -= dt;
      if (this.#bubbleTimer < 0.4) this.#bubble.setAlpha(Math.max(0, this.#bubbleTimer / 0.4));
    }
    if (!this.#emote) this.#play(this.#travelClip());
  }

  #travelClip(): BroClipName {
    if (this.snap?.state === 'downed') return 'surprised';
    const { x: vx, y: vy } = this.velocity;
    if (Math.abs(vx) > 40) return vx > 0 ? 'moveRight' : 'moveLeft';
    if (Math.abs(vy) > 60) return vy < 0 ? 'moveUp' : 'moveDown';
    return Math.hypot(vx, vy) < 12 ? 'idle' : 'hover';
  }

  #perform(clip: BroClipName): void {
    if (BRO_CLIPS[clip].repeat !== 0) return;
    if (this.snap?.state === 'downed') return;
    this.#emote = clip;
    this.#play(clip, true);
  }

  #onClipComplete(animation: Phaser.Animations.Animation): void {
    if (this.#emote && animation.key === broAnimationKey(this.#emote)) {
      this.#emote = null;
      this.#play(this.#travelClip(), true);
    }
  }

  #play(clip: BroClipName, restart = false): void {
    if (!restart && this.#clip === clip) return;
    this.#clip = clip;
    this.sprite.play(broAnimationKey(clip), !restart);
  }

  override destroy(): void {
    super.destroy();
    this.sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onClipComplete, this);
    this.sprite.destroy();
    this.#swirl.destroy();
    this.#bubble.destroy();
  }
}
