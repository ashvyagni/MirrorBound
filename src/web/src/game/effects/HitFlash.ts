/**
 * Hit flash effect.
 */

import Phaser from 'phaser';

export class HitFlash {
  private scene: Phaser.Scene;
  private flashDuration: number = 0.1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  flash(target: Phaser.GameObjects.Shape | Phaser.GameObjects.Sprite, color: number = 0xffffff): void {
    if (!target || !target.active) return;

    // Store original tint
    const originalTint = target instanceof Phaser.GameObjects.Sprite ? target.tint : 0xffffff;

    // Apply flash
    if (target instanceof Phaser.GameObjects.Sprite) {
      target.setTint(color);
    }

    // Reset after duration
    this.scene.time.delayedCall(this.flashDuration * 1000, () => {
      if (target instanceof Phaser.GameObjects.Sprite && target.active) {
        target.setTint(originalTint);
      }
    });
  }
}
