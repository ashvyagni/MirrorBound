/**
 * Enemies: Logesh's four-state sheets, driven entirely by the snapshot.
 *
 * Which sheet plays is read off the authoritative fields and nothing else --
 * `windingUp` for the attack, velocity for the walk, `targetId` for the alert,
 * idle otherwise. The client never decides an enemy is doing something.
 *
 * A `sprite` the art does not cover (the mirror boss, today) falls back to the
 * painted texture the whole game used before, so a new enemy type on the server
 * shows up as plain art rather than as a crash or a hole.
 *
 * Every readability feature outranks the art: the wind-up telegraph, the hit
 * flash, the slow and burn tints, the health bar, the elite ring, the boss aura
 * and the death squash all survive unchanged, and the telegraph is drawn on its
 * own layer under the sprite so a decorative frame can never hide it.
 */

import Phaser from 'phaser';

import {
  ALERT_MARK, ENEMY_ART, hasEnemyArt, type EnemyArt, type EnemySheet, type EnemyStateName,
} from '../animation/enemyClips';
import { animationKey } from '../animation/clips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { DEPTH, PALETTE, PLAYER_DISPLAY_HEIGHT } from '../constants';
import type { EnemySnap, Vec2 } from '../contracts';
import { EntityView } from './EntityView';

/** Relative size of the painted fallback sprites, which have no body ratio. */
const PAINTED_SIZE: Record<string, number> = { skeleton: 1.0, archer: 1.0, hound: 0.95, slime: 1.0, mirror: 1.15 };

/** Above this speed the enemy is walking rather than standing. */
const MOVING_SPEED = 12;

/** The player's drawn body height: every enemy is sized as a fraction of it. */
const PLAYER_BODY = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;

/** Sprites the server sent that no sheet covers. Logged once each, not per frame. */
const reportedMissing = new Set<string>();

function reportMissingArt(sprite: string): void {
  if (reportedMissing.has(sprite)) return;
  reportedMissing.add(sprite);
  console.info(`[mirrorbound] no enemy atlas for sprite "${sprite}"; using the painted texture`);
}

export class EnemyView extends EntityView {
  readonly sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  readonly #bar: Phaser.GameObjects.Graphics;
  readonly #telegraph: Phaser.GameObjects.Graphics;
  #ring: Phaser.GameObjects.Image | null = null;
  #aura: Phaser.GameObjects.Image | null = null;
  /** Null when this enemy is falling back to the painted texture. */
  readonly #art: EnemyArt | null;
  #mark: Phaser.GameObjects.Sprite | null = null;
  #markTween: Phaser.Tweens.Tween | null = null;
  #state: EnemyStateName = 'idle';
  snap: EnemySnap;
  #bob = Math.random() * 6;
  #flash = 0;
  #windPulse = 0;
  #baseScale: number;
  /** The creature's drawn height, as opposed to its padded frame box. */
  #bodyHeight: number;
  #lastHealth: number;
  #dying = false;

  constructor(scene: Phaser.Scene, snap: EnemySnap) {
    super(scene, snap.id, snap.position, snap.boss ? 1.4 : snap.elite ? 1.1 : 0.85);
    this.snap = snap;
    this.#lastHealth = snap.health;
    const art = hasEnemyArt(snap.sprite) && scene.textures.exists(ENEMY_ART[snap.sprite].idle.texture)
      ? (ENEMY_ART[snap.sprite] as EnemyArt)
      : null;
    this.#art = art;

    if (art) {
      const sheet = art.idle;
      this.#baseScale = this.#scaleFor(sheet);
      this.#bodyHeight = sheet.frameSize.height * sheet.bodyRatio * this.#baseScale;
      const sprite = scene.add.sprite(snap.position.x, snap.position.y, sheet.texture, sheet.frames[0]);
      // Anchored on the sheet's own measured feet, so the creature stands on
      // its position instead of hovering over it.
      sprite.setOrigin(sheet.anchor.x, sheet.anchor.y).setScale(this.#baseScale);
      sprite.play(animationKey(sheet.texture, 'play'));
      this.sprite = sprite;
    } else {
      if (!hasEnemyArt(snap.sprite)) reportMissingArt(snap.sprite);
      const key = scene.textures.exists(`enemy:${snap.sprite}`) ? `enemy:${snap.sprite}` : 'enemy:skeleton';
      this.#baseScale = (PAINTED_SIZE[snap.sprite] ?? 1) * (snap.elite ? 1.22 : 1) * (snap.boss ? 1.25 : 1);
      this.sprite = scene.add.image(snap.position.x, snap.position.y, key).setOrigin(0.5, 0.92).setScale(this.#baseScale);
      this.#bodyHeight = this.sprite.displayHeight;
    }

    this.#bar = scene.add.graphics().setDepth(DEPTH.fxHigh);
    // Under the entity band: the telegraph is floor paint, so nothing the art
    // does can cover it.
    this.#telegraph = scene.add.graphics().setDepth(DEPTH.floorDecal + 3);
    if (snap.elite) {
      this.#ring = scene.add.image(snap.position.x, snap.position.y, 'enemy:elite_ring').setDepth(DEPTH.shadow + 1).setScale(0.7);
    }
    if (snap.boss) {
      this.#aura = scene.add.image(snap.position.x, snap.position.y - 30, 'fx:glow').setTint(PALETTE.magenta)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(1.6).setDepth(DEPTH.shadow + 1);
      scene.tweens.add({ targets: this.#aura, alpha: { from: 0.25, to: 0.5 }, scale: { from: 1.5, to: 1.8 }, duration: 1300, yoyo: true, repeat: -1 });
    }
  }

  /**
   * Uniform scale for a sheet, solved from the artwork rather than the box.
   *
   * Never `setDisplaySize`: that measures the frame's untrimmed source box, and
   * these sheets pad differently per state -- the skeleton's idle box is
   * 285x448 and its attack box 454x385. Asking for a height in box terms would
   * make it change size every time it swung.
   */
  #scaleFor(sheet: EnemySheet): number {
    const art = this.#art;
    const ratio = (art?.sizeRatio ?? 1) * (this.snap.elite ? 1.22 : 1) * (this.snap.boss ? 1.25 : 1);
    return (PLAYER_BODY * ratio) / (sheet.frameSize.height * sheet.bodyRatio);
  }

  /**
   * Which sheet the snapshot says to play.
   *
   * Four authoritative fields, no client state: `windingUp` is the attack,
   * velocity is the walk, having a target at all is the alert, and the rest is
   * idle.
   */
  #stateFor(): EnemyStateName {
    if (this.snap.windingUp) return 'attack';
    if (Math.hypot(this.velocity.x, this.velocity.y) > MOVING_SPEED) return 'walk';
    if (this.snap.targetId !== null && this.snap.state !== 'dead') return 'alert';
    return 'idle';
  }

  #applyState(state: EnemyStateName): void {
    const art = this.#art;
    if (!art || state === this.#state) return;
    this.#state = state;
    const sheet = art[state];
    // Re-solved per sheet: the four are cropped differently, so keeping one
    // scale across them would resize the creature mid-fight.
    this.#baseScale = this.#scaleFor(sheet);
    this.#bodyHeight = sheet.frameSize.height * sheet.bodyRatio * this.#baseScale;
    const sprite = this.sprite as Phaser.GameObjects.Sprite;
    sprite.setOrigin(sheet.anchor.x, sheet.anchor.y);
    sprite.setScale(this.#baseScale);
    sprite.play(animationKey(sheet.texture, 'play'), true);
  }

  applySnapshot(snap: EnemySnap): void {
    if (snap.health < this.#lastHealth) this.#flash = 0.12;
    this.#lastHealth = snap.health;
    const wasWinding = this.snap.windingUp;
    this.snap = snap;
    this.syncTarget(snap.position, snap.velocity);
    if (Math.abs(snap.facing.x) > 0.2) this.sprite.setFlipX(snap.facing.x < 0);
    if (snap.windingUp && !wasWinding) this.#showMark();
    else if (!snap.windingUp && wasWinding) this.#hideMark();
  }

  hit(): void {
    this.#flash = 0.12;
  }

  // --- the alert mark ----------------------------------------------------------

  /**
   * The "!" over an enemy that has started a wind-up.
   *
   * Six frames, not the eight on the sheet: the last two came back with the
   * fade baked out -- one held thirteen pixels above half opacity and the other
   * keyed to nothing at all. The fade is this tween instead.
   */
  #showMark(): void {
    if (!this.scene.textures.exists(ALERT_MARK.texture)) return;
    if (!this.#mark) {
      const height = this.#bodyHeight * 0.34;
      this.#mark = this.scene.add.sprite(this.x, this.y, ALERT_MARK.texture, ALERT_MARK.frames[0])
        .setOrigin(ALERT_MARK.anchor.x, ALERT_MARK.anchor.y)
        .setScale(height / (ALERT_MARK.frameSize.height * ALERT_MARK.bodyRatio))
        .setDepth(DEPTH.fxHigh - 1);
    }
    this.#markTween?.stop();
    this.#mark.setVisible(true).setAlpha(0);
    this.#mark.play(animationKey(ALERT_MARK.texture, 'play'), true);
    this.#markTween = this.scene.tweens.add({ targets: this.#mark, alpha: 1, duration: 110 });
  }

  #hideMark(): void {
    const mark = this.#mark;
    if (!mark) return;
    this.#markTween?.stop();
    this.#markTween = this.scene.tweens.add({
      targets: mark, alpha: 0, duration: 160, onComplete: () => mark.setVisible(false),
    });
  }

  update(dt: number): void {
    if (this.#dying) return;
    this.follow(dt);
    const moving = Math.hypot(this.velocity.x, this.velocity.y) > MOVING_SPEED;
    this.#applyState(this.#stateFor());
    // The painted sprites are one static frame and need the bob to look alive;
    // the drawn ones animate, so they only keep a trace of it.
    const bobAmount = this.#art ? 0.35 : 1;
    this.#bob += dt * (moving ? 14 : 3);
    const bobY = (moving ? Math.abs(Math.sin(this.#bob)) * 3 : Math.sin(this.#bob) * 1.2) * bobAmount;
    this.sprite.setPosition(this.x, this.y - bobY);
    this.sprite.setDepth(this.depthFor(this.y));
    this.placeShadow(this.x, this.y);
    this.#ring?.setPosition(this.x, this.y);
    this.#aura?.setPosition(this.x, this.y - 30);
    if (this.#mark?.visible) this.#mark.setPosition(this.x, this.y - this.#bodyHeight - 14);

    // Wind-up telegraph.
    this.#telegraph.clear();
    if (this.snap.windingUp) {
      this.#windPulse += dt * 16;
      const pulse = 1 + 0.08 * Math.abs(Math.sin(this.#windPulse));
      this.sprite.setScale(this.#baseScale * pulse, this.#baseScale * (2 - pulse));
      this.sprite.setTint(0xff8a8a).setTintMode(Phaser.TintModes.MULTIPLY);
      const angle = Math.atan2(this.snap.facing.y, this.snap.facing.x);
      const reach = Math.max(36, Math.min(90, this.snap.radius * 3.2));
      this.#telegraph.fillStyle(0xd9413f, 0.22);
      this.#telegraph.slice(this.x, this.y, reach, angle - 0.55, angle + 0.55, false);
      this.#telegraph.fillPath();
      this.#telegraph.lineStyle(2, 0xff6a6a, 0.6);
      this.#telegraph.strokeCircle(this.x, this.y, this.snap.radius + 4);
    } else if (this.#flash > 0) {
      this.#flash -= dt;
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.sprite.setScale(this.#baseScale * 1.06, this.#baseScale * 0.96);
    } else {
      this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.snap.statusEffects.includes('slow')) this.sprite.setTint(0x9fe3ff);
      if (this.snap.statusEffects.includes('burn')) this.sprite.setTint(0xffa060);
      this.sprite.setScale(this.#baseScale);
    }

    // Health bar: shown when damaged, always for elites and bosses. Placed off
    // the drawn body rather than the frame box, which is padded by the trails.
    this.#bar.clear();
    const frac = Math.max(0, this.snap.health / this.snap.maxHealth);
    if (frac < 0.999 || this.snap.elite || this.snap.boss) {
      const w = this.snap.boss ? 70 : this.snap.elite ? 44 : 34;
      const h = this.snap.boss ? 6 : 4;
      const top = this.y - this.#bodyHeight - 8;
      this.#bar.fillStyle(0x14111a, 0.75);
      this.#bar.fillRoundedRect(this.x - w / 2 - 1, top - 1, w + 2, h + 2, 2);
      this.#bar.fillStyle(this.snap.boss ? PALETTE.magenta : PALETTE.healthRed, 1);
      this.#bar.fillRoundedRect(this.x - w / 2, top, w * frac, h, 2);
      if (this.snap.elite && !this.snap.boss) {
        this.#bar.lineStyle(1, PALETTE.gold, 0.8);
        this.#bar.strokeRoundedRect(this.x - w / 2 - 1, top - 1, w + 2, h + 2, 2);
      }
    }
  }

  /** Death animation, then destroy. Returns the burst position for VFX. */
  die(): Vec2 {
    if (this.#dying) return { x: this.x, y: this.y };
    this.#dying = true;
    this.#bar.clear();
    this.#telegraph.clear();
    this.#ring?.destroy();
    this.#aura?.destroy();
    this.#markTween?.stop();
    this.#mark?.destroy();
    this.#mark = null;
    this.shadow?.destroy();
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.tweens.add({
      targets: this.sprite, scaleX: this.#baseScale * 1.3, scaleY: this.#baseScale * 0.2, alpha: 0, y: this.y + 6,
      duration: 260, ease: 'Quad.easeIn', onComplete: () => this.destroy(),
    });
    return { x: this.x, y: this.y - 14 };
  }

  override destroy(): void {
    super.destroy();
    this.sprite.destroy();
    this.#bar.destroy();
    this.#telegraph.destroy();
    this.#ring?.destroy();
    this.#aura?.destroy();
    this.#markTween?.stop();
    this.#mark?.destroy();
  }
}
