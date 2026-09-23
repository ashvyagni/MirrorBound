import Phaser from 'phaser';

import { DEPTH } from '../constants';
import type { PickupSnap } from '../contracts';
import { EntityView } from './EntityView';

const GLOW: Record<string, number> = {
  essence: 0xc05bff, shards: 0x9fe3ff, health_potion: 0xe04a5a, mana_potion: 0x4f8fe6, weapon: 0xf0c060, relic: 0xffd27a,
};

export class PickupView extends EntityView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly #glow: Phaser.GameObjects.Image;
  #phase = Math.random() * Math.PI * 2;
  kind: string;

  constructor(scene: Phaser.Scene, snap: PickupSnap) {
    super(scene, snap.id, snap.position, 0.35);
    this.kind = snap.kind;
    const key = scene.textures.exists(`pickup:${snap.kind}`) ? `pickup:${snap.kind}` : 'pickup:essence';
    this.sprite = scene.add.image(snap.position.x, snap.position.y, key).setScale(1.05);
    this.#glow = scene.add.image(snap.position.x, snap.position.y, 'fx:glow').setTint(GLOW[snap.kind] ?? 0xffffff)
      .setScale(0.5).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floorDecal + 2);
    if (snap.kind === 'weapon' || snap.kind === 'relic') {
      this.#glow.setScale(0.75).setAlpha(0.45);
      scene.tweens.add({ targets: this.#glow, alpha: { from: 0.3, to: 0.6 }, scale: { from: 0.7, to: 0.9 }, duration: 900, yoyo: true, repeat: -1 });
    }
    // Drop-in pop.
    this.sprite.setScale(0.2);
    scene.tweens.add({ targets: this.sprite, scale: 1.05, duration: 240, ease: 'Back.easeOut' });
  }

  applySnapshot(snap: PickupSnap): void {
    this.syncTarget(snap.position, { x: 0, y: 0 });
  }

  update(dt: number): void {
    this.follow(dt, 18);
    this.#phase += dt * 3;
    const bob = Math.sin(this.#phase) * 3;
    this.sprite.setPosition(this.x, this.y - 10 + bob);
    this.sprite.setDepth(this.depthFor(this.y));
    this.#glow.setPosition(this.x, this.y - 6);
    this.placeShadow(this.x, this.y + 2);
  }

  /** Collected: fly up and vanish. */
  collect(): void {
    this.shadow?.destroy();
    this.#glow.destroy();
    this.scene.tweens.add({
      targets: this.sprite, y: this.sprite.y - 26, alpha: 0, scale: 1.4, duration: 220, ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  override destroy(): void {
    super.destroy();
    this.sprite.destroy();
    this.#glow.destroy();
  }
}
