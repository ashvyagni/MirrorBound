/**
 * The equipped weapon, drawn over the player: Logesh's swing sheets.
 *
 * The server decides when a swing happens (PLAYER_ATTACKED carries the combo
 * step); this only plays the matching sheet at the player's position, facing
 * the way the player faces. Vertical facings tilt the side-view swing so it
 * still reads as aimed up or down.
 */

import Phaser from 'phaser';

import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import {
  ABILITY_CASTS, darkSwing, idleKey, swingKey, WEAPONS,
  type SwingDef, type WeaponDef, type WeaponId,
} from '../animation/weaponClips';
import { DEPTH, PLAYER_DISPLAY_HEIGHT } from '../constants';
import type { Vec2 } from '../contracts';

const RATIO = PLAYER_DISPLAY_HEIGHT / 190; // Logesh tuned offsets for a 190-unit goat.

export class WeaponOverlay extends Phaser.GameObjects.Sprite {
  #weapon: WeaponDef | null = null;
  #active: SwingDef | null = null;
  /** True while the weapon is looping its rest clip rather than a one-shot. */
  #resting = false;
  /**
   * Draw from the blackened sheets instead of the light ones.
   *
   * Set once, at construction, by whoever owns the overlay -- the player's is
   * light and the Mirror's is dark, and neither ever changes its mind. The
   * geometry is identical either way, so this only chooses a texture: every
   * offset, length ratio and frame order below is shared with the player's.
   */
  readonly #dark: boolean;

  constructor(scene: Phaser.Scene, dark = false) {
    super(scene, 0, 0, WEAPONS.sword.swings[0]!.texture, WEAPONS.sword.swings[0]!.frames[0]);
    this.#dark = dark;
    scene.add.existing(this);
    this.setVisible(false).setActive(false).setDepth(DEPTH.fxLow);
    // A finished swing falls back to the weapon at rest rather than to nothing:
    // the hand does not empty between clicks.
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.#rest());
  }

  get equipped(): WeaponId | null {
    return this.#weapon?.id ?? null;
  }

  /**
   * Put a weapon in the hand, by sheet name -- `null` or an unknown name is an
   * empty hand.
   *
   * A no-op when the same weapon is already held. Callers run this off every
   * snapshot, and hiding the overlay on the way past would cut every swing
   * short: a swing lasts about eight frames and snapshots arrive at 20Hz.
   */
  equip(id: string | null): void {
    const known = id && id in WEAPONS ? (id as WeaponId) : null;
    const weapon = known ? WEAPONS[known] : null;
    if (weapon === this.#weapon) return;
    this.#weapon = weapon;
    this.#rest();
  }

  /**
   * Hold the weapon at rest, or show nothing if it has no drawn rest pose.
   *
   * This is where the overlay sits whenever it is not mid-swing, which is most
   * of the time -- so it is also what makes an equipped weapon visible at all
   * while the player is just standing there.
   */
  #rest(): void {
    const idle = this.#weapon?.idle;
    if (!idle) {
      this.#active = null;
      this.#resting = false;
      this.setVisible(false).setActive(false);
      return;
    }
    this.#resting = true;
    this.#show(idle);
    // Off `#active` rather than off `idle`: `#show` is what resolves which
    // sheet this overlay actually draws, and the clip has to name the same one.
    this.play(idleKey(this.#active!.texture), true);
  }

  /**
   * Play the attack motion for `comboStep` (1-based) at the host.
   *
   * A weapon that throws something plays its cast sheet instead of its bash:
   * the bow's melee swing next to an arrow leaving it reads as the arrow having
   * come from somewhere else.
   */
  strike(comboStep: number, host: Vec2, facing: Vec2, thrown = false): void {
    const weapon = this.#weapon;
    if (!weapon) return;
    if (thrown && weapon.cast) {
      this.#playSheet(weapon.cast, host, facing);
      return;
    }
    const index = Math.max(0, (comboStep - 1) % weapon.swings.length);
    this.#playSheet(weapon.swings[index] ?? weapon.swings[0]!, host, facing);
  }

  /**
   * Play the motion for a named ability, if one was drawn for it.
   *
   * Returns false when nothing is drawn, so the caller can leave the weapon
   * idling rather than borrowing a sheet that says the wrong element.
   */
  castAbility(abilityId: string, host: Vec2, facing: Vec2): boolean {
    if (!this.#weapon) return false;
    const def = ABILITY_CASTS[abilityId];
    if (!def) return false;
    this.#playSheet(def, host, facing);
    return true;
  }

  /** The sheet as this overlay draws it: light for the player, dark for the Mirror. */
  #sheet(def: SwingDef): SwingDef {
    return this.#dark ? darkSwing(def) : def;
  }

  /** Point the sprite at a sheet and size it. Shared by rest and one-shots. */
  #show(raw: SwingDef): void {
    const weapon = this.#weapon;
    if (!weapon) return;
    const def = this.#sheet(raw);
    this.#active = def;
    this.setTexture(def.texture, def.frames[0]);
    this.setOrigin(def.anchor.x, def.anchor.y);
    const body = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    const ratio = def.lengthRatio ?? weapon.lengthRatio;
    // Solved against the sheet's own body ratio, never `setDisplaySize`: that
    // measures the untrimmed source box, and these sheets are padded by their
    // trails by wildly different amounts.
    this.setScale((body * ratio) / (def.frameSize.height * def.bodyRatio));
    this.setVisible(true).setActive(true);
  }

  #playSheet(def: SwingDef, host: Vec2, facing: Vec2): void {
    if (!this.#weapon) return;
    this.#resting = false;
    this.#show(def);
    this.place(host, facing);
    this.play(swingKey(this.#active!.texture), true);
  }

  /** Follow the host, whether swinging or at rest. */
  place(host: Vec2, facing: Vec2): void {
    const weapon = this.#weapon;
    if (!weapon || !this.visible) return;
    const def = this.#active;
    const offset = def?.offset ?? weapon.offset;
    const right = facing.x >= 0;
    const sign = right ? 1 : -1;
    const vertical = Math.abs(facing.y) > Math.abs(facing.x) + 0.2;
    this.setPosition(host.x + offset.x * RATIO * sign * (vertical ? 0.35 : 1), host.y + offset.y * RATIO);
    const facingLeft = !right;
    this.setFlipX(def?.mirror ? !facingLeft : facingLeft);
    // Tilt toward the vertical facing so an upward strike doesn't sweep
    // sideways. A weapon at rest is never tilted: a sheathed sword swinging to
    // seventy degrees because the player faced north reads as a glitch, not as
    // aim.
    this.setAngle(!this.#resting && vertical ? (facing.y < 0 ? -70 : 70) * sign : 0);
  }
}
