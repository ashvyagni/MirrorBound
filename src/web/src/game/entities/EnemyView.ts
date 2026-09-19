/**
 * Enemies: Logesh's drawn sheets where one exists for the archetype, the older
 * procedural painted sprite where one does not, with readable combat states --
 * a bob while moving, a red pulse and telegraph arc while winding up, a white
 * flash on hit, and a squash-and-burst on death.
 *
 * The drawn sheets are four separate textures per enemy (idle / walk / alert /
 * attack) rather than four clips inside one, so changing animation means
 * changing texture as well as animation key.
 */

import Phaser from 'phaser';

import {
  ENEMY_SHEETS, enemyAnimationKey, isEnemyKind,
  type EnemyClipName, type EnemyKind,
} from '../animation/enemyClips';
import { DEPTH, PALETTE } from '../constants';
import type { EnemySnap, Vec2 } from '../contracts';
import { EntityView } from './EntityView';

/** Relative size per archetype, against ENEMY_DISPLAY_HEIGHT. */
const SIZE: Record<string, number> = {
  skeleton: 1.0, archer: 0.96, hound: 0.8, slime: 0.9, mirror: 1.15,
  acolyte: 0.98, brute: 1.2, scarab: 0.72, shardling: 0.78, spitter: 0.92,
  sprout: 0.85, warden: 1.15,
};

/** Drawn height of a 1.0-size enemy, in world units. Matches the player's 76
 *  so the cast is in proportion; each sheet's own body ratio is divided out so
 *  a tall padded frame does not read as a tall monster. */
const ENEMY_DISPLAY_HEIGHT = 78;

/** Server enemy state -> which of the four drawn sheets to show. */
function clipFor(snap: EnemySnap): EnemyClipName {
  if (snap.windingUp) return 'alert';
  if (snap.state === 'attack') return 'attack';
  if (snap.state === 'idle' || snap.state === 'dead') return 'idle';
  return 'walk';
}

export class EnemyView extends EntityView {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Null when no drawn sheet exists for this archetype (the boss today),
   *  in which case the painted texture is used and never animated. */
  readonly #kind: EnemyKind | null;
  #clip: EnemyClipName = 'idle';
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
    const size = (SIZE[snap.sprite] ?? 1) * (snap.elite ? 1.22 : 1) * (snap.boss ? 1.25 : 1);
    this.#kind = isEnemyKind(snap.sprite) && scene.textures.exists(ENEMY_SHEETS[snap.sprite].idle.texture)
      ? snap.sprite
      : null;

    if (this.#kind) {
      const sheet = ENEMY_SHEETS[this.#kind].idle;
      // Divide out the sheet's padding so every enemy is scaled by how big its
      // *body* is, not how big its frame box happens to be.
      this.#baseScale = (ENEMY_DISPLAY_HEIGHT * size) / (sheet.frameSize.height * sheet.bodyRatio);
      this.sprite = scene.add.sprite(snap.position.x, snap.position.y, sheet.texture)
        .setOrigin(sheet.anchor.x, sheet.anchor.y)
        .setScale(this.#baseScale);
      this.#playClip('idle');
    } else {
      const key = scene.textures.exists(`enemy:${snap.sprite}`) ? `enemy:${snap.sprite}` : 'enemy:skeleton';
      this.#baseScale = size;
      this.sprite = scene.add.sprite(snap.position.x, snap.position.y, key)
        .setOrigin(0.5, 0.92)
        .setScale(this.#baseScale);
    }
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
    this.#playClip(clipFor(snap));
  }

  /** Swap to one of the four drawn sheets. No-op for a painted fallback, and
   *  for a clip that is already playing. */
  #playClip(clip: EnemyClipName): void {
    if (!this.#kind || clip === this.#clip) return;
    this.#clip = clip;
    const sheet = ENEMY_SHEETS[this.#kind][clip];
    this.sprite.setTexture(sheet.texture);
    this.sprite.setOrigin(sheet.anchor.x, sheet.anchor.y);
    this.sprite.play(enemyAnimationKey(this.#kind, clip), true);
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
