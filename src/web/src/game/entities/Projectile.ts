import Phaser from 'phaser';

import { abilityKey, ABILITIES, type AbilityDef, type AbilityId } from '../animation/abilityClips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { GOAT_DISPLAY_HEIGHT } from '../constants';
import type { Facing } from '../types';

/**
 * One cast effect in flight, or one burst on the ground.
 *
 * Pooled rather than created per cast: these are spawned several times a
 * second while testing, and churning sprites would leave the texture cache
 * rebuilding batches for no reason.
 */
export class Projectile extends Phaser.GameObjects.Sprite {
  #def: AbilityDef | null = null;
  #facing: Facing = 1;
  #age = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ABILITIES.arrow.texture, ABILITIES.arrow.frames[0]);
    scene.add.existing(this);
    this.setVisible(false).setActive(false);
  }

  get busy(): boolean {
    return this.active;
  }

  /** Where this shot is now, for anything that wants to know what it hit. */
  get reach(): number {
    return this.x;
  }

  get kind(): AbilityId | null {
    return (this.#def?.id as AbilityId) ?? null;
  }

  launch(id: AbilityId, hostX: number, hostY: number, facing: Facing): void {
    const def = ABILITIES[id];
    this.#def = def;
    this.#facing = facing;
    this.#age = 0;

    this.setTexture(def.texture, def.frames[0]);
    this.setOrigin(def.anchor.x, def.anchor.y);

    const goatBody = GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    this.setScale((goatBody * def.sizeRatio) / (def.frameSize.height * def.bodyRatio));

    this.setPosition(hostX + def.offset.x * facing, hostY + def.offset.y);
    this.setFlipX(facing === -1);
    this.setVisible(true).setActive(true);
    this.play(abilityKey(id), true);
  }

  /** Advance; returns false once it is spent and can be reused. */
  step(deltaSeconds: number): boolean {
    const def = this.#def;
    if (!def || !this.active) return false;

    this.#age += deltaSeconds;
    if (def.speed) this.x += def.speed * this.#facing * deltaSeconds;

    // A burst ends with its clip; a projectile outlives its looping clip and
    // is cut off by its own lifetime instead.
    const spent = def.kind === 'burst'
      ? !this.anims.isPlaying || this.#age >= def.life
      : this.#age >= def.life;

    if (spent) {
      this.setVisible(false).setActive(false);
      this.#def = null;
      return false;
    }
    return true;
  }
}
