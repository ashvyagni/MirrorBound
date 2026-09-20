/**
 * Projectiles: Logesh's effect sheets where the server's `kind` has one, and
 * the painted lozenge where it does not.
 *
 * Position, velocity and lifetime all come from the snapshot -- this only
 * decides how the thing looks and which way it points.
 */

import Phaser from 'phaser';

import {
  darkEffect, EFFECTS, effectKey, PROJECTILE_ART, PROJECTILE_TINT, type EffectDef,
} from '../animation/abilityClips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { DEPTH, PLAYER_DISPLAY_HEIGHT } from '../constants';
import type { ProjectileSnap } from '../contracts';
import { EntityView } from './EntityView';

const TRAIL_TINT: Record<string, number> = {
  fire_bolt: 0xff7a3d, ice_bolt: 0x9fe3ff, arcane_bolt: 0xb48cff, mirror_bolt: 0xd62e6c,
  spore_pod: 0x9fbf5a, shell_shard: 0xe0733a,
};

const PLAYER_BODY = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;

/** Kinds the server sent that no sheet covers. Logged once each. */
const reportedMissing = new Set<string>();

function artFor(scene: Phaser.Scene, kind: string, dark: boolean): EffectDef | null {
  const id = PROJECTILE_ART[kind];
  if (!id) {
    if (!reportedMissing.has(kind)) {
      reportedMissing.add(kind);
      console.info(`[mirrorbound] no projectile atlas for kind "${kind}"; using the painted texture`);
    }
    return null;
  }
  const def = dark ? darkEffect(EFFECTS[id]) : EFFECTS[id];
  // Falls back to the light sheet rather than to nothing: the dark bundle is
  // fetched lazily, and the first bolt can outrun it.
  if (scene.textures.exists(def.texture)) return def;
  const light = EFFECTS[id];
  return scene.textures.exists(light.texture) ? light : null;
}

export class ProjectileView extends EntityView {
  readonly sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  #trail: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  #glow: Phaser.GameObjects.Image | null = null;
  readonly #turns: boolean;
  kind: string;

  /**
   * `dark` draws the blackened sheet: this was thrown by something fighting
   * with one of the player's own weapons, so it should match what is in its
   * hands. Ordinary enemies keep their own colours.
   */
  constructor(scene: Phaser.Scene, snap: ProjectileSnap, particles: boolean, dark = false) {
    super(scene, snap.id, snap.position, 0);
    this.kind = snap.kind;
    const art = artFor(scene, snap.kind, dark);
    // Anything thrown turns to point along its travel. A `ground` effect never
    // does: a flame pillar tipped forty degrees is a pillar falling over.
    this.#turns = art === null || !art.ground;

    if (art) {
      const sprite = scene.add.sprite(snap.position.x, snap.position.y, art.texture, art.frames[0]);
      // Uniform scale from the artwork's own body ratio, never `setDisplaySize`
      // -- that measures the untrimmed source box, which on these sheets is
      // padded by the trail by a different amount on every one of them.
      sprite.setScale((PLAYER_BODY * art.sizeRatio) / (art.frameSize.height * art.bodyRatio));
      sprite.setOrigin(art.anchorX ?? art.anchor.x, art.anchor.y);
      sprite.play(effectKey(art));
      const extra = PROJECTILE_TINT[snap.kind];
      if (extra !== undefined) sprite.setTint(extra).setTintMode(Phaser.TintModes.MULTIPLY);
      this.sprite = sprite;
    } else {
      const key = scene.textures.exists(`proj:${snap.kind}`) ? `proj:${snap.kind}` : 'proj:arrow';
      this.sprite = scene.add.image(snap.position.x, snap.position.y, key);
    }
    this.sprite.setDepth(DEPTH.entityTop);
    this.velocity = { ...snap.velocity };
    this.#aim(snap.velocity);

    const tint = TRAIL_TINT[snap.kind];
    if (tint !== undefined) {
      // The painted bolts are flat shapes that need additive glow to read; the
      // drawn ones already have their own light in them.
      if (!art) this.sprite.setBlendMode(Phaser.BlendModes.ADD);
      this.#glow = scene.add.image(snap.position.x, snap.position.y, 'fx:glow').setTint(tint).setScale(0.45).setAlpha(art ? 0.22 : 0.35)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floorDecal + 2);
      if (particles) {
        this.#trail = scene.add.particles(snap.position.x, snap.position.y, 'fx:soft', {
          lifespan: { min: 180, max: 340 }, speed: { min: 5, max: 20 }, scale: { start: 0.35, end: 0 },
          alpha: { start: 0.7, end: 0 }, tint, frequency: 22, quantity: 1, blendMode: 'ADD',
        }).setDepth(DEPTH.entityTop - 1);
      }
    }
  }

  /**
   * Point along travel.
   *
   * Mirrored first and then turned by the mirrored angle, rather than rotated
   * by the raw angle: rotating alone sends a left-going shot round to 180
   * degrees, which points it correctly and stands it on its head.
   */
  #aim(velocity: { x: number; y: number }): void {
    if (!this.#turns) return;
    if (velocity.x === 0 && velocity.y === 0) return;
    const flipped = velocity.x < 0;
    this.sprite.setFlipX(flipped);
    this.sprite.setRotation(flipped ? Math.atan2(-velocity.y, -velocity.x) : Math.atan2(velocity.y, velocity.x));
  }

  applySnapshot(snap: ProjectileSnap): void {
    this.syncTarget(snap.position, snap.velocity);
    this.#aim(snap.velocity);
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
