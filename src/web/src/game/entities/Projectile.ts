import Phaser from 'phaser';

import { abilityKey, ABILITIES, type AbilityDef, type AbilityId } from '../animation/abilityClips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { GOAT_DISPLAY_HEIGHT } from '../constants';
import { flippedFor, mirroredOriginX } from '../facing';
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

  /**
   * The stretch of ground this effect currently covers, in world x.
   *
   * A point would do for a fireball, but not for a beam: it is anchored at the
   * staff and reaches several hundred units out, so testing its origin alone
   * would leave it passing straight through everything it visibly hits.
   */
  get span(): { from: number; to: number } {
    // The origin is already mirrored to match the facing, so the box always
    // hangs off it the way it is drawn -- no need to reason about direction.
    const from = this.x - this.originX * this.displayWidth;
    return { from, to: from + this.displayWidth };
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

    // `anchorX` overrides where the effect is held, so a beam can hang off the
    // staff rather than be centred on a point in front of it. The origin has to
    // mirror along with the texture or the effect keeps its reach on the side
    // the art was drawn for -- see `mirroredOriginX`.
    const flipped = flippedFor(facing);
    this.setOrigin(mirroredOriginX(def.anchorX ?? def.anchor.x, flipped), def.anchor.y);

    const goatBody = GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    const scale = (goatBody * def.sizeRatio) / (def.frameSize.height * def.bodyRatio);
    this.setScale(scale * (def.stretchX ?? 1), scale);

    this.setPosition(hostX + def.offset.x * facing, hostY + def.offset.y);
    this.setFlipX(flipped);
    this.setVisible(true).setActive(true);
    this.play(abilityKey(id), true);
    // After `play`, so the first frame is the one being stood up.
    if (def.ground) this.#standOnFloor();
  }

  /**
   * Put the current frame's own base on this sprite's y.
   *
   * Frames are trimmed against one source box shared by the whole sheet, and
   * almost none of them reach its bottom edge -- the flames shrink, the embers
   * lift, the burst opens from a point. `frame.y + frame.height` is where this
   * particular frame's artwork actually ends, so dividing by the box height
   * gives the origin that welds it to the floor. Recomputed every frame, since
   * it changes with every frame.
   */
  #standOnFloor(): void {
    const { y, height, realHeight } = this.frame;
    if (!realHeight) return;
    this.setOrigin(this.originX, (y + height) / realHeight);
  }

  /** Advance; returns false once it is spent and can be reused. */
  step(deltaSeconds: number): boolean {
    const def = this.#def;
    if (!def || !this.active) return false;

    this.#age += deltaSeconds;
    if (def.speed) this.x += def.speed * this.#facing * deltaSeconds;
    if (def.ground) this.#standOnFloor();

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
