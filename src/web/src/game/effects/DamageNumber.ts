/**
 * Floating damage number effect.
 */

import Phaser from 'phaser';

export class DamageNumber {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(x: number, y: number, amount: number, isCrit: boolean = false): void {
    const text = this.scene.add.text(x, y, `-${Math.round(amount)}`, {
      fontSize: isCrit ? '24px' : '18px',
      fontFamily: 'Arial',
      color: isCrit ? '#ff4444' : '#ffaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    });

    text.setOrigin(0.5);
    text.setDepth(200);

    // Float up and fade out
    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        text.destroy();
      },
    });
  }

  showHeal(x: number, y: number, amount: number): void {
    const text = this.scene.add.text(x, y, `+${Math.round(amount)}`, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#44ff44',
      stroke: '#000000',
      strokeThickness: 2,
    });

    text.setOrigin(0.5);
    text.setDepth(200);

    // Float up and fade out
    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        text.destroy();
      },
    });
  }
}
