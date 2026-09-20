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
import { viewForDirection } from '../animation/clips';
import { FX_TEXTURE, fxAnimationKey } from '../animation/fx';
import { weaponSheetFor, type WeaponId } from '../animation/weaponClips';
import { DEPTH, PALETTE, TWIN_DISPLAY_HEIGHT } from '../constants';
import type { TwinSnap, Vec2 } from '../contracts';
import { EntityView } from './EntityView';

const INTENT_GLYPH: Record<string, string> = {
  ATTACK: '⚔', ASSIST: '⚔', INTERCEPT: '⛨', PROTECT: '⛨', DISTRACT: '!', FLANK: '↻', RETREAT: '↩',
  REPOSITION: '…', FOLLOW: '', EXPLORE: '✦', COMBO: '⚔', HEAL: '✚',
};

/** The shard's colour on the twin: the Mirror's own magenta, darkened. */
const CORRUPT_BRIGHT = PALETTE.magenta;
const CORRUPT_DIM = 0x7a1838;

/**
 * What the twin's strike is made of, by the weapon it is fighting with.
 *
 * The twin picks weapons on the server -- `currentWeapon` arrives every
 * snapshot and its controller has opinions about which one it wants -- and
 * none of that was visible. The obvious fix, drawing the weapon in its hands,
 * is not available: it is a floating spirit with no arms, which is why its
 * attack was drawn as a swirl in the first place. So the swirl carries the
 * element instead. Ember reads warm, frost reads cold, a blade reads as plain
 * bright steel, and an empty hand stays the sheet's own untinted white.
 */
const STRIKE_TINT: Record<WeaponId, number> = {
  fireStaff: 0xff9a4d,
  iceStaff: 0x9fe3ff,
  bow: 0xd8e8a0,
  sword: 0xf2e8df,
};

/** Blend two packed RGB colours. Phaser's own helper wants `Color` objects. */
function mixTint(from: number, to: number, t: number): number {
  const mix = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * t) << shift;
  };
  return mix(16) | mix(8) | mix(0);
}

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

  /** True while the twin is carrying the Warden's shard. */
  #corrupted = false;
  /** Phase of the shard tint's slow breath. */
  #corruptPhase = 0;

  applySnapshot(snap: TwinSnap): void {
    this.snap = snap;
    this.syncTarget(snap.position, snap.velocity);
    const intent = snap.intent.intentType;
    if (intent !== this.#lastIntent) {
      this.#lastIntent = intent;
      this.#showThought(intent, snap.intent.confidence);
    }
    // Downed reads first: a downed twin carrying the shard is still downed,
    // and grey-and-faded says the thing the player has to act on.
    if (snap.state === 'downed') {
      this.sprite.setTint(0x555566).setAlpha(0.5);
    } else if (!snap.corrupted && (this.#corrupted || this.sprite.alpha !== 1)) {
      this.sprite.clearTint().setAlpha(1);
    }
    // The tint itself is painted in `update`, where there is a real `dt` to
    // breathe against; snapshots arrive at 20Hz and would make it stutter.
    this.#corrupted = snap.corrupted === true;
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
    // Cleared rather than left set: a twin that swapped from the ember staff
    // to a sword must not keep swinging orange.
    const sheet = this.snap ? weaponSheetFor(this.snap.currentWeapon) : null;
    const tint = sheet ? STRIKE_TINT[sheet] : null;
    if (tint === null) this.#swirl.clearTint();
    else this.#swirl.setTint(tint);
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
    if (this.#corrupted && this.snap?.state !== 'downed') {
      // A slow pull between two reds rather than a flat wash, so the shard
      // reads as something working on the twin rather than a palette swap.
      this.#corruptPhase += dt * 1.6;
      const t = 0.5 + 0.5 * Math.sin(this.#corruptPhase);
      this.sprite.setTint(mixTint(CORRUPT_DIM, CORRUPT_BRIGHT, t));
    }
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

  /**
   * Which way the companion is drawn travelling.
   *
   * Its sheet has all four directions drawn, so it gets the same treatment as
   * the player: the side rows are the only ones with a profile, so a diagonal
   * stays on them and only a near-vertical heading uses up or down. Unlike the
   * player it is never mirrored -- the sheet draws left and right separately
   * because mirroring would put its bow on the wrong side.
   */
  #travelClip(): BroClipName {
    if (this.snap?.state === 'downed') return 'surprised';
    const { x: vx, y: vy } = this.velocity;
    const speed = Math.hypot(vx, vy);
    if (speed < 12) return 'idle';
    if (speed < 40) return 'hover';
    return viewForDirection({ x: vx, y: vy }) === 'side'
      ? (vx >= 0 ? 'moveRight' : 'moveLeft')
      : (vy < 0 ? 'moveUp' : 'moveDown');
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
