/**
 * Combat and world feedback: slashes, sparks, damage numbers, death bursts,
 * spell effects, telegraphs, callouts, camera shake.
 *
 * Everything is fire-and-forget: create, tween, destroy. Quality lowers
 * particle counts; damage numbers and shake can be turned off in settings.
 */

import Phaser from 'phaser';

import { CAMERA, DEPTH, PALETTE } from '../constants';
import type { Vec2 } from '../contracts';
import type { Settings } from '../../ui/settings';

export class Vfx {
  #settings: Settings;

  constructor(private readonly scene: Phaser.Scene, settings: Settings) {
    this.#settings = settings;
  }

  setSettings(settings: Settings): void {
    this.#settings = settings;
  }

  get #density(): number {
    return this.#settings.quality === 'high' ? 1 : this.#settings.quality === 'medium' ? 0.55 : 0.25;
  }

  #burst(x: number, y: number, texture: string, count: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): void {
    const n = Math.max(1, Math.round(count * this.#density));
    const emitter = this.scene.add.particles(x, y, texture, { ...cfg, emitting: false }).setDepth(DEPTH.fxHigh);
    emitter.explode(n, 0, 0);
    this.scene.time.delayedCall(((cfg.lifespan as { max?: number })?.max ?? (cfg.lifespan as number) ?? 600) + 50, () => emitter.destroy());
  }

  // --- combat -------------------------------------------------------------------

  slash(pos: Vec2, facing: Vec2, colour = 0xffffff, scale = 1): void {
    const angle = Math.atan2(facing.y, facing.x);
    const arc = this.scene.add.image(pos.x + facing.x * 26, pos.y - 18 + facing.y * 18, 'fx:slash')
      .setRotation(angle + Math.PI / 2).setScale(0.7 * scale, 0.9 * scale).setTint(colour).setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
    this.scene.tweens.add({
      targets: arc, alpha: 0, scaleX: 1.1 * scale, scaleY: 1.2 * scale, duration: 180, ease: 'Quad.easeOut',
      onComplete: () => arc.destroy(),
    });
  }

  hitSparks(pos: Vec2, colour = 0xffffff, count = 8): void {
    this.#burst(pos.x, pos.y - 10, 'fx:spark', count, {
      lifespan: { min: 180, max: 380 }, speed: { min: 70, max: 190 }, scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 }, tint: colour, blendMode: 'ADD', gravityY: 260,
    });
  }

  damageNumber(pos: Vec2, amount: number, crit = false, colour = '#fff1c9'): void {
    if (!this.#settings.damageNumbers || amount <= 0) return;
    const text = this.scene.add.text(pos.x + (Math.random() - 0.5) * 16, pos.y - 30, `${Math.round(amount)}`, {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: crit ? '22px' : '16px', fontStyle: crit ? 'bold' : 'normal',
      color: crit ? '#ffd27a' : colour, stroke: '#14111a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.fxHigh + 1);
    if (crit) text.setScale(1.3);
    this.scene.tweens.add({
      targets: text, y: text.y - 34, alpha: { from: 1, to: 0 }, scale: crit ? 1 : 0.9, duration: 720, ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  deathBurst(pos: Vec2, colour = 0xaaaaaa, big = false): void {
    this.#burst(pos.x, pos.y, 'fx:soft', big ? 40 : 18, {
      lifespan: { min: 350, max: 800 }, speed: { min: 40, max: big ? 220 : 140 }, scale: { start: big ? 0.9 : 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: [colour, 0xffffff], blendMode: 'ADD', gravityY: 120,
    });
    const flash = this.scene.add.image(pos.x, pos.y, 'fx:glow').setTint(colour).setScale(big ? 1.2 : 0.5).setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh);
    this.scene.tweens.add({ targets: flash, scale: big ? 2.6 : 1.3, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    if (big) this.shake(CAMERA.shake.heavy, 260);
  }

  impact(pos: Vec2, kind: string): void {
    const colour = kind.includes('fire') ? PALETTE.ember : kind.includes('ice') ? PALETTE.ice
      : kind.includes('arcane') ? PALETTE.arcane : kind.includes('mirror') ? PALETTE.magenta : 0xe8e4dc;
    this.hitSparks(pos, colour, kind.includes('fire') ? 16 : 7);
    if (kind.includes('fire')) {
      const ring = this.scene.add.image(pos.x, pos.y, 'fx:ring').setTint(PALETTE.ember).setScale(0.2).setAlpha(0.8)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
      this.scene.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    }
  }

  // --- abilities -------------------------------------------------------------------

  flameCone(pos: Vec2, facing: Vec2): void {
    const angle = Phaser.Math.RadToDeg(Math.atan2(facing.y, facing.x));
    this.#burst(pos.x + facing.x * 20, pos.y - 12 + facing.y * 14, 'fx:soft', 46, {
      lifespan: { min: 300, max: 620 }, speed: { min: 220, max: 420 }, angle: { min: angle - 38, max: angle + 38 },
      scale: { start: 0.9, end: 0.1 }, alpha: { start: 0.95, end: 0 }, tint: [0xfff1a8, 0xffb13d, 0xff7a3d, 0xd62e6c],
      blendMode: 'ADD',
    });
    this.shake(CAMERA.shake.hit, 150);
  }

  nova(pos: Vec2, radius: number): void {
    const ring = this.scene.add.image(pos.x, pos.y - 8, 'fx:ring').setTint(PALETTE.arcane).setScale(0.1).setAlpha(1)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
    this.scene.tweens.add({ targets: ring, scale: (radius * 2) / 84, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const ring2 = this.scene.add.image(pos.x, pos.y - 8, 'fx:ring').setTint(0xffffff).setScale(0.1).setAlpha(0.7)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
    this.scene.tweens.add({ targets: ring2, scale: (radius * 2) / 84, alpha: 0, duration: 560, delay: 60, ease: 'Quad.easeOut', onComplete: () => ring2.destroy() });
    this.#burst(pos.x, pos.y - 8, 'fx:spark', 36, {
      lifespan: { min: 400, max: 800 }, speed: { min: radius * 0.8, max: radius * 1.6 }, scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [PALETTE.arcane, 0xffffff], blendMode: 'ADD',
    });
    this.shake(CAMERA.shake.hit, 180);
  }

  dash(pos: Vec2, direction: Vec2): void {
    const angle = Phaser.Math.RadToDeg(Math.atan2(-direction.y, -direction.x));
    this.#burst(pos.x, pos.y - 14, 'fx:soft', 14, {
      lifespan: { min: 200, max: 420 }, speed: { min: 60, max: 160 }, angle: { min: angle - 25, max: angle + 25 },
      scale: { start: 0.6, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: PALETTE.violet, blendMode: 'ADD',
    });
  }

  arcaneCast(pos: Vec2): void {
    const flash = this.scene.add.image(pos.x, pos.y - 20, 'fx:glow').setTint(PALETTE.arcane).setScale(0.4).setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh);
    this.scene.tweens.add({ targets: flash, scale: 0.9, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
  }

  // --- world --------------------------------------------------------------------------

  pickup(pos: Vec2, colour: number): void {
    this.#burst(pos.x, pos.y - 6, 'fx:spark', 10, {
      lifespan: { min: 240, max: 480 }, speed: { min: 30, max: 110 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [colour, 0xffffff], blendMode: 'ADD', gravityY: -120,
    });
  }

  heal(pos: Vec2, amount: number): void {
    this.#burst(pos.x, pos.y - 10, 'fx:soft', 14, {
      lifespan: { min: 500, max: 900 }, speedY: { min: -90, max: -30 }, speedX: { min: -30, max: 30 },
      scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: PALETTE.healthGreen, blendMode: 'ADD',
    });
    this.damageNumber(pos, amount, false, '#8fe69a');
  }

  levelUp(pos: Vec2): void {
    const beam = this.scene.add.image(pos.x, pos.y - 10, 'fx:glow').setTint(PALETTE.gold).setScale(0.8, 2.2).setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh);
    this.scene.tweens.add({ targets: beam, scaleX: 2.2, scaleY: 3.2, alpha: 0, duration: 700, onComplete: () => beam.destroy() });
    this.#burst(pos.x, pos.y - 10, 'fx:spark', 40, {
      lifespan: { min: 600, max: 1100 }, speed: { min: 60, max: 200 }, scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [PALETTE.gold, 0xffffff, PALETTE.pink], blendMode: 'ADD', gravityY: -60,
    });
    this.callout(pos, 'LEVEL UP', '#ffd27a');
  }

  callout(pos: Vec2, text: string, colour = '#ffffff', size = 14): void {
    const t = this.scene.add.text(pos.x, pos.y - 64, text, {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: colour,
      stroke: '#14111a', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.fxHigh + 2).setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 10, duration: 160 });
    this.scene.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  }

  telegraphRing(pos: Vec2, radius: number, duration: number, colour = PALETTE.magenta): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.floorDecal + 3);
    const start = this.scene.time.now;
    const ev = this.scene.time.addEvent({
      delay: 16, loop: true, callback: () => {
        const t = Math.min(1, (this.scene.time.now - start) / (duration * 1000));
        g.clear();
        g.lineStyle(3, colour, 0.9);
        g.strokeCircle(pos.x, pos.y, radius);
        g.fillStyle(colour, 0.12 + 0.25 * t);
        g.fillCircle(pos.x, pos.y, radius * t);
        if (t >= 1) {
          ev.remove();
          g.destroy();
        }
      },
    });
  }

  /**
   * Room change: the exit event and the new room arrive in the same snapshot,
   * so this is one gesture -- a quick dip to black, then a fade back in over
   * whatever has already been built.
   */
  roomTransition(): void {
    const cam = this.scene.cameras.main;
    cam.resetFX();
    cam.fadeOut(140, 10, 6, 16, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress >= 1) cam.fadeIn(520, 10, 6, 16);
    });
  }

  fadeIn(duration = 500): void {
    const cam = this.scene.cameras.main;
    cam.resetFX();
    cam.fadeIn(duration, 10, 6, 16);
  }

  shake(intensity: number, duration: number = CAMERA.shake.duration): void {
    if (!this.#settings.screenShake) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  hurtFlash(): void {
    this.scene.cameras.main.flash(120, 120, 20, 30, false);
    this.shake(CAMERA.shake.hit, 120);
  }
}
