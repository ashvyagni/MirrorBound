import Phaser from 'phaser';

import { abilityKey, ABILITIES, type AbilityDef, type AbilityId } from '../animation/abilityClips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { ART_RATIO, depthAt, GOAT_DISPLAY_HEIGHT } from '../constants';
import { flippedFor, mirroredOriginX } from '../facing';
import type { Facing, Vec2 } from '../types';

/**
 * One cast effect in flight, or one burst on the ground.
 *
 * Pooled rather than created per cast: these are spawned several times a
 * second while testing, and churning sprites would leave the texture cache
 * rebuilding batches for no reason.
 */
export class Projectile extends Phaser.GameObjects.Sprite {
  #def: AbilityDef | null = null;
  #aim: Vec2 = { x: 1, y: 0 };
  #age = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ABILITIES.arrow.texture, ABILITIES.arrow.frames[0]);
    scene.add.existing(this);
    this.setVisible(false).setActive(false);
  }

  get busy(): boolean {
    return this.active;
  }

  get kind(): AbilityId | null {
    return (this.#def?.id as AbilityId) ?? null;
  }

  launch(id: AbilityId, hostX: number, hostY: number, aim: Vec2, facing: Facing): void {
    const def = ABILITIES[id];
    this.#def = def;
    this.#aim = aim;
    this.#age = 0;

    this.setTexture(def.texture, def.frames[0]);

    /**
     * Whether this effect turns to face where it is going.
     *
     * Everything thrown does. Everything that stands on the floor does not: a
     * flame pillar tipped forty degrees is a pillar falling over, and a wave
     * that rolls along the ground rolls along it at every angle. `ground` is
     * already the flag that says which is which.
     */
    const turns = !def.ground;

    // Thrown effects take their facing from the direction of travel rather
    // than from the goat's, because they are no longer attached to it -- and
    // for a shot going straight up the goat's facing says nothing useful.
    const flipped = turns ? aim.x < 0 : flippedFor(facing);

    // `anchorX` overrides where the effect is held, so a beam can hang off the
    // staff rather than be centred on a point in front of it. The origin has to
    // mirror along with the texture or the effect keeps its reach on the side
    // the art was drawn for -- see `mirroredOriginX`. It is also what the
    // rotation below turns about, which is why a beam sweeps around its source
    // rather than orbiting its own middle.
    this.setOrigin(mirroredOriginX(def.anchorX ?? def.anchor.x, flipped), def.anchor.y);

    const goatBody = GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    const scale = (goatBody * def.sizeRatio) / (def.frameSize.height * def.bodyRatio);
    this.setScale(scale * (def.stretchX ?? 1), scale);

    // Spawned along the aim rather than at a fixed side-on offset: the weapon
    // offsets were measured on a side view, so their `x` is distance along the
    // way the goat points and their `y` is how far up the sprite it sits.
    const reach = def.offset.x * ART_RATIO;
    this.setPosition(
      hostX + aim.x * reach,
      hostY + aim.y * reach + def.offset.y * ART_RATIO,
    );
    this.setFlipX(flipped);

    /**
     * Point it along the aim.
     *
     * Composed with the flip rather than replacing it. Rotating by the raw aim
     * angle alone would send a left-going shot round to 180 degrees, which
     * points it correctly and also stands it on its head -- fine for an arrow,
     * wrong for anything whose art has a top. Mirroring first and then turning
     * by the mirrored angle keeps each effect's own "up" upward at every angle.
     *
     * The mirrored sprite's forward direction is -x, so solving
     * `(-cos t, -sin t) = aim` gives the angle below.
     */
    this.setRotation(
      turns
        ? (flipped ? Math.atan2(-aim.y, -aim.x) : Math.atan2(aim.y, aim.x))
        : 0,
    );

    this.setVisible(true).setActive(true);
    this.play(abilityKey(id), true);
    this.setDepth(depthAt(this.y));
  }

  /** Advance; returns false once it is spent and can be reused. */
  step(deltaSeconds: number): boolean {
    const def = this.#def;
    if (!def || !this.active) return false;

    this.#age += deltaSeconds;
    if (def.speed) {
      this.x += def.speed * this.#aim.x * deltaSeconds;
      this.y += def.speed * this.#aim.y * deltaSeconds;
      this.setDepth(depthAt(this.y));
    }

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
