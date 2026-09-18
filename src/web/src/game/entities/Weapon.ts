import Phaser from 'phaser';

import {
  swingKey, WEAPONS, type SwingDef, type WeaponDef, type WeaponId,
} from '../animation/weaponClips';
import type { AbilityId } from '../animation/abilityClips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { COMBAT, GOAT_DISPLAY_HEIGHT } from '../constants';
import { flippedFor, mirroredOriginX } from '../facing';
import type { Facing } from '../types';

/**
 * The equipped weapon, drawn over the goat.
 *
 * It is a plain sprite with no body of its own: it has no physics, and giving
 * it one would only add a second place where its position is decided. It shows
 * itself for the length of a swing and hides again.
 */
export class Weapon extends Phaser.GameObjects.Sprite {
  #weapon: WeaponDef | null = null;
  #swingIndex = 0;
  /** Time left to land the next hit of a combo before it resets. */
  #chainWindow = 0;
  /** The one-shot clip on screen right now -- a swing or a cast -- or null
   *  while the weapon is simply being carried. Held directly rather than
   *  recomputed from the combo index, because a cast has no index. */
  #active: SwingDef | null = null;
  /** What to run when the current cast reaches the frame that throws it. */
  #release: (() => void) | null = null;
  #releaseFrame = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, WEAPONS.sword.swings[0]!.texture, WEAPONS.sword.swings[0]!.frames[0]);
    scene.add.existing(this);
    this.setVisible(false).setActive(false);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onSwingEnd, this);
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.#onFrame, this);
  }

  get equipped(): WeaponId | null {
    return this.#weapon?.id ?? null;
  }

  get swinging(): boolean {
    return this.#active !== null;
  }

  /** Which hit of the combo lands next, 1-based. 0 when nothing is equipped. */
  get comboStep(): number {
    return this.#weapon ? this.#swingIndex + 1 : 0;
  }

  get comboLength(): number {
    return this.#weapon?.swings.length ?? 0;
  }

  equip(id: WeaponId | null): void {
    this.#weapon = id ? WEAPONS[id] : null;
    this.#release = null;
    this.#swingIndex = 0;
    this.#chainWindow = 0;
    this.#active = null;

    if (!this.#weapon) {
      this.setVisible(false).setActive(false);
      return;
    }
    this.#rest();
  }

  /** Settle onto the held pose. The weapon stays on screen between swings --
   *  it is being carried, not conjured for each hit. */
  #rest(): void {
    const weapon = this.#weapon;
    if (!weapon) return;
    this.#active = null;
    this.#dress(weapon.idle);
    this.setVisible(true).setActive(true);
    this.play(swingKey(weapon.idle.texture), true);
  }

  /**
   * Swing, advancing the combo.
   *
   * Consecutive hits inside the chain window step through the weapon's swings;
   * letting the window lapse drops back to the first. Weapons with a single
   * swing simply replay it.
   */
  strike(): void {
    const weapon = this.#weapon;
    if (!weapon) return;

    if (this.#chainWindow <= 0) this.#swingIndex = 0;
    const def = weapon.swings[this.#swingIndex] ?? weapon.swings[0]!;

    this.#swingIndex = (this.#swingIndex + 1) % weapon.swings.length;
    this.#chainWindow = COMBAT.comboWindow;
    this.#playOnce(def);
  }

  /**
   * Play the weapon's own motion for an ability.
   *
   * Returns whether there was one. A weapon with no cast sheet for that
   * ability simply carries on idling, which is what the whole set did before
   * the cast sheets existed -- so this stays optional rather than a hole.
   */
  cast(ability: AbilityId, onRelease?: () => void): boolean {
    const def = this.#weapon?.casts?.[ability];
    if (!def) return false;
    this.#playOnce(def);   // clears any release still pending from before

    if (!onRelease) return true;
    const at = def.releaseFrame ?? 0;
    // Frame 0 means the spell leaves as the clip starts, which is what every
    // cast did before any of them said otherwise.
    if (at <= 0) onRelease();
    else {
      this.#release = onRelease;
      this.#releaseFrame = at;
    }
    return true;
  }

  /** Show a one-shot clip and remember it, so `step` can keep placing it. */
  #playOnce(def: SwingDef): void {
    // Whatever was waiting to be thrown is not going to be: a new clip has
    // interrupted the one that would have thrown it.
    this.#release = null;
    this.#active = def;
    this.#dress(def);
    this.setVisible(true).setActive(true);
    this.play(swingKey(def.texture), true);
  }

  /**
   * Point the sprite at the right sheet and size it against the goat.
   *
   * Solved from each sheet's own body ratio rather than a fixed frame height:
   * the boxes are padded by trails, and padded by different amounts, so equal
   * frame heights would draw the weapons at visibly different sizes.
   */
  #dress(def: SwingDef): void {
    this.setTexture(def.texture, def.frames[0]);
    // Origin x is left to `step`, which knows which way the goat is facing.
    this.setOrigin(def.anchor.x, def.anchor.y);

    const goatBody = GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    const ratio = def.lengthRatio ?? this.#weapon?.lengthRatio ?? 0.9;
    this.setScale((goatBody * ratio) / (def.frameSize.height * def.bodyRatio));
  }

  /** Throw the spell once the clip reaches the frame that throws it. */
  #onFrame(_animation: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    // Phaser numbers frames from 1, the sheets from 0.
    if (this.#release && frame.index - 1 >= this.#releaseFrame) this.#throw();
  }

  #throw(): void {
    const release = this.#release;
    this.#release = null;
    release?.();
  }

  #onSwingEnd(): void {
    if (!this.#active) return;
    // A release frame past the end of the clip would otherwise swallow the
    // spell entirely, so anything still pending goes now.
    this.#throw();
    this.#rest();
  }

  /** Follow the goat. Called every frame, whether or not a swing is playing. */
  step(deltaSeconds: number, host: { x: number; y: number; facing: Facing }): void {
    if (this.#chainWindow > 0) this.#chainWindow -= deltaSeconds;
    if (!this.#weapon) return;

    const def = this.#active ?? this.#weapon.idle;
    const { x, y } = def?.offset ?? this.#weapon.offset;
    this.setPosition(host.x + x * host.facing, host.y + y);

    // Mirror with the goat so a swing always reads as coming from its front.
    // `mirror` inverts that for a sheet the generator drew facing the other
    // way -- the ice staff sweeps its frost backwards otherwise.
    //
    // The origin follows the flip. These anchors are grip centroids, not
    // centres -- the bow's sits at 0.65 -- so leaving it put slides the weapon
    // a third of its own width out of the goat's hand every time it turns.
    const flipped = def?.mirror ? !flippedFor(host.facing) : flippedFor(host.facing);
    const anchor = def?.anchor ?? this.#weapon.idle.anchor;
    this.setFlipX(flipped);
    this.setOrigin(mirroredOriginX(anchor.x, flipped), anchor.y);
  }

  override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onSwingEnd, this);
    this.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.#onFrame, this);
    super.destroy(fromScene);
  }
}
