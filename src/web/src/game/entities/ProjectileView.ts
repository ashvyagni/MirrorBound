import Phaser from 'phaser';

import { DEPTH } from '../constants';
import type { ProjectileSnap } from '../contracts';
import { EntityView } from './EntityView';

const TRAIL_TINT: Record<string, number> = {
  fire_bolt: 0xff7a3d, ice_bolt: 0x9fe3ff, arcane_bolt: 0xb48cff, mirror_bolt: 0xd62e6c,
};

export class ProjectileView extends EntityView {
  readonly sprite: Phaser.GameObjects.Image;
  #trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  #glow: Phaser.GameObjects.Image | null = null;
  kind: string;

  constructor(scene: Phaser.Scene, snap: ProjectileSnap, particles: boolean) {
    super(scene, snap.id, snap.position, 0);
    this.kind = snap.kind;
    const key = scene.textures.exists(`proj:${snap.kind}`) ? `proj:${snap.kind}` : 'proj:arrow';
    this.sprite = scene.add.image(snap.position.x, snap.position.y, key).setDepth(DEPTH.entityTop);
    this.velocity = { ...snap.velocity };
    this.sprite.setRotation(Math.atan2(snap.velocity.y, snap.velocity.x));
    const tint = TRAIL_TINT[snap.kind];
    if (tint !== undefined) {
      this.sprite.setBlendMode(Phaser.BlendModes.ADD);
      this.#glow = scene.add.image(snap.position.x, snap.position.y, 'fx:glow').setTint(tint).setScale(0.45).setAlpha(0.35)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floorDecal + 2);
      if (particles) {
        this.#trail = scene.add.particles(snap.position.x, snap.position.y, 'fx:soft', {
          lifespan: { min: 180, max: 340 }, speed: { min: 5, max: 20 }, scale: { start: 0.35, end: 0 },
          alpha: { start: 0.7, end: 0 }, tint, frequency: 22, quantity: 1, blendMode: 'ADD',
        }).setDepth(DEPTH.entityTop - 1);
      }
    }
  }

  applySnapshot(snap: ProjectileSnap): void {
    this.syncTarget(snap.position, snap.velocity);
    this.sprite.setRotation(Math.atan2(snap.velocity.y, snap.velocity.x));
  }

  update(dt: number): void {
    this.follow(dt, 22);
    this.sprite.setPosition(this.x, this.y);
    this.#glow?.setPosition(this.x, this.y);
    this.#trail?.setPosition(this.x, this.y);
  }

  override destroy(): void {
    super.destroy();
    this.sprite.destroy();
    this.#glow?.destroy();
    if (this.#trail) {
      const trail = this.#trail;
      trail.stop();
      this.scene.time.delayedCall(400, () => trail.destroy());
    }
  }
}
