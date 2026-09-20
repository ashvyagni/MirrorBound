import Phaser from 'phaser';

import { weaponDropArt } from '../animation/weaponClips';
import { DEPTH } from '../constants';
import type { PickupSnap } from '../contracts';
import { EntityView } from './EntityView';

/** How tall a dropped weapon is drawn, in world units. */
const DROP_HEIGHT = 34;

const GLOW: Record<string, number> = {
  essence: 0xc05bff, shards: 0x9fe3ff, health_potion: 0xe04a5a, mana_potion: 0x4f8fe6, weapon: 0xf0c060, relic: 0xffd27a,
};

export class PickupView extends EntityView {
  readonly sprite: Phaser.GameObjects.Image;
  readonly #glow: Phaser.GameObjects.Image;
  #phase = Math.random() * Math.PI * 2;
  /** The scale the sprite settles at; the sheets differ wildly in frame size. */
  #restScale = 1.05;
  kind: string;

  constructor(scene: Phaser.Scene, snap: PickupSnap) {
    super(scene, snap.id, snap.position, 0.35);
    this.kind = snap.kind;
    // A dropped weapon is drawn from its own rest sheet, so a bow on the floor
    // looks like a bow. Everything else keeps the painted mark for its kind --
    // one loot glyph is right for essence and wrong for four weapons.
    const drop = snap.kind === 'weapon' ? weaponDropArt(snap.itemId) : null;
    if (drop && scene.textures.exists(drop.texture)) {
      this.sprite = scene.add.image(snap.position.x, snap.position.y, drop.texture, drop.frame);
      this.#restScale = DROP_HEIGHT / drop.frameSize.height;
    } else {
      const key = scene.textures.exists(`pickup:${snap.kind}`) ? `pickup:${snap.kind}` : 'pickup:essence';
      this.sprite = scene.add.image(snap.position.x, snap.position.y, key);
      this.#restScale = 1.05;
    }
    this.sprite.setScale(this.#restScale);
    this.#glow = scene.add.image(snap.position.x, snap.position.y, 'fx:glow').setTint(GLOW[snap.kind] ?? 0xffffff)
      .setScale(0.5).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD)
      // Above the shadow, not below it. Underneath, the item's own black
      // contact patch was composited over its bright glow and the pair read as
      // an olive smear on the floor rather than as a lit object.
      .setDepth(DEPTH.shadow + 1);
    if (snap.kind === 'weapon' || snap.kind === 'relic') {
      this.#glow.setScale(0.75).setAlpha(0.45);
      scene.tweens.add({ targets: this.#glow, alpha: { from: 0.3, to: 0.6 }, scale: { from: 0.7, to: 0.9 }, duration: 900, yoyo: true, repeat: -1 });
    }
    // Drop-in pop.
    this.sprite.setScale(this.#restScale * 0.2);
    scene.tweens.add({ targets: this.sprite, scale: this.#restScale, duration: 240, ease: 'Back.easeOut' });
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
      targets: this.sprite, y: this.sprite.y - 26, alpha: 0, scale: this.#restScale * 1.35,
      duration: 220, ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  override destroy(): void {
    super.destroy();
    this.sprite.destroy();
    this.#glow.destroy();
  }
}
