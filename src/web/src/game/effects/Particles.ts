/**
 * Particle effects for combat and atmosphere.
 */

import Phaser from 'phaser';

export class ParticleEffects {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create hit particles at a position.
   */
  hitParticles(x: number, y: number, color: number = 0xffffff): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 50 + Math.random() * 50;

      const particle = this.scene.add.circle(x, y, 2, color, 1);
      particle.setDepth(150);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 300 + Math.random() * 200,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  /**
   * Create death explosion effect.
   */
  deathExplosion(x: number, y: number, color: number = 0xff4444): void {
    // Central flash
    const flash = this.scene.add.circle(x, y, 20, color, 0.8);
    flash.setDepth(150);

    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        flash.destroy();
      },
    });

    // Particles
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = 80 + Math.random() * 80;

      const particle = this.scene.add.circle(x, y, 3, color, 1);
      particle.setDepth(150);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 400 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  /**
   * Create ambient dust particles.
   */
  ambientDust(bounds: Phaser.Geom.Rectangle): void {
    // Create a few dust particles
    for (let i = 0; i < 5; i++) {
      const x = bounds.x + Math.random() * bounds.width;
      const y = bounds.y + Math.random() * bounds.height;

      const dust = this.scene.add.circle(x, y, 1, 0xffffff, 0.2);
      dust.setDepth(50);

      // Float slowly
      this.scene.tweens.add({
        targets: dust,
        y: y - 20 - Math.random() * 30,
        alpha: 0,
        duration: 2000 + Math.random() * 2000,
        ease: 'Linear',
        onComplete: () => {
          dust.destroy();
        },
      });
    }
  }
}
