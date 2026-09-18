/**
 * Enemies: procedural painted sprites with readable combat states -- a bob
 * while moving, a red pulse and telegraph arc while winding up, a white flash
 * on hit, and a squash-and-burst on death.
 */

import Phaser from 'phaser';

import { DEPTH, PALETTE } from '../constants';
import type { EnemySnap, Vec2 } from '../contracts';
import { EntityView } from './EntityView';

const SIZE: Record<string, number> = { skeleton: 1.0, archer: 1.0, hound: 0.95, slime: 1.0, mirror: 1.15 };

export class EnemyView extends EntityView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly #bar: Phaser.GameObjects.Graphics;
  readonly #telegraph: Phaser.GameObjects.Graphics;
  #ring: Phaser.GameObjects.Image | null = null;
  #aura: Phaser.GameObjects.Image | null = null;
  snap: EnemySnap;
  #bob = Math.random() * 6;
  #flash = 0;
  #windPulse = 0;
  #baseScale: number;
  #lastHealth: number;
  #dying = false;

  constructor(scene: Phaser.Scene, snap: EnemySnap) {
    super(scene, snap.id, snap.position, snap.boss ? 1.4 : snap.elite ? 1.1 : 0.85);
    this.snap = snap;
    this.#lastHealth = snap.health;
    const key = scene.textures.exists(`enemy:${snap.sprite}`) ? `enemy:${snap.sprite}` : 'enemy:skeleton';
    this.#baseScale = (SIZE[snap.sprite] ?? 1) * (snap.elite ? 1.22 : 1) * (snap.boss ? 1.25 : 1);
    this.sprite = scene.add.image(snap.position.x, snap.position.y, key).setOrigin(0.5, 0.92).setScale(this.#baseScale);
    this.#bar = scene.add.graphics().setDepth(DEPTH.fxHigh);
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

  applySnapshot(snap: EnemySnap): void {
    if (snap.health < this.#lastHealth) this.#flash = 0.12;
    this.#lastHealth = snap.health;
    this.snap = snap;
    this.syncTarget(snap.position, snap.velocity);
    if (Math.abs(snap.facing.x) > 0.2) this.sprite.setFlipX(snap.facing.x < 0);
  }

  hit(): void {
    this.#flash = 0.12;
  }

  update(dt: number): void {
    if (this.#dying) return;
    this.follow(dt);
    const moving = Math.hypot(this.velocity.x, this.velocity.y) > 12;
    this.#bob += dt * (moving ? 14 : 3);
    const bobY = moving ? Math.abs(Math.sin(this.#bob)) * 3 : Math.sin(this.#bob) * 1.2;
    this.sprite.setPosition(this.x, this.y - bobY);
    this.sprite.setDepth(this.depthFor(this.y));
    this.placeShadow(this.x, this.y);
    this.#ring?.setPosition(this.x, this.y);
    this.#aura?.setPosition(this.x, this.y - 30);

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

    // Health bar: shown when damaged, always for elites and bosses.
    this.#bar.clear();
    const frac = Math.max(0, this.snap.health / this.snap.maxHealth);
    if (frac < 0.999 || this.snap.elite || this.snap.boss) {
      const w = this.snap.boss ? 70 : this.snap.elite ? 44 : 34;
      const h = this.snap.boss ? 6 : 4;
      const top = this.y - this.sprite.displayHeight - 8;
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
  }
}
