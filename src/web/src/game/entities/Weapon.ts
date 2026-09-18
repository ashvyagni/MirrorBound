import Phaser from 'phaser';

import {
  swingKey, WEAPONS, type SwingDef, type WeaponDef, type WeaponId,
} from '../animation/weaponClips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { COMBAT, GOAT_DISPLAY_HEIGHT } from '../constants';
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
  #swinging = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, WEAPONS.sword.swings[0]!.texture, WEAPONS.sword.swings[0]!.frames[0]);
    scene.add.existing(this);
    this.setVisible(false).setActive(false);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onSwingEnd, this);
  }

  get equipped(): WeaponId | null {
    return this.#weapon?.id ?? null;
  }

  get swinging(): boolean {
    return this.#swinging;
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
    this.#swingIndex = 0;
    this.#chainWindow = 0;
    this.#swinging = false;

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
    this.#swinging = false;
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

    this.#swinging = true;
    this.#swingIndex = (this.#swingIndex + 1) % weapon.swings.length;
    this.#chainWindow = COMBAT.comboWindow;

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
    this.setOrigin(def.anchor.x, def.anchor.y);

    const goatBody = GOAT_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    const ratio = def.lengthRatio ?? this.#weapon?.lengthRatio ?? 0.9;
    this.setScale((goatBody * ratio) / (def.frameSize.height * def.bodyRatio));
  }

  /** The swing currently on screen, or the one that would play next. */
  #activeSwing(): SwingDef | null {
    const weapon = this.#weapon;
    if (!weapon) return null;
    const index = (this.#swingIndex - 1 + weapon.swings.length) % weapon.swings.length;
    return weapon.swings[index] ?? weapon.swings[0] ?? null;
  }

  #onSwingEnd(): void {
    if (!this.#swinging) return;
    this.#rest();
  }

  /** Follow the goat. Called every frame, whether or not a swing is playing. */
  step(deltaSeconds: number, host: { x: number; y: number; facing: Facing }): void {
    if (this.#chainWindow > 0) this.#chainWindow -= deltaSeconds;
    if (!this.#weapon) return;

    const def = this.#swinging ? this.#activeSwing() : this.#weapon.idle;
    const { x, y } = def?.offset ?? this.#weapon.offset;
    this.setPosition(host.x + x * host.facing, host.y + y);

    // Mirror with the goat so a swing always reads as coming from its front.
    // `mirror` inverts that for a sheet the generator drew facing the other
    // way -- the ice staff sweeps its frost backwards otherwise.
    const facingLeft = host.facing === -1;
    this.setFlipX(def?.mirror ? !facingLeft : facingLeft);
  }

  override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onSwingEnd, this);
    super.destroy(fromScene);
  }
}
