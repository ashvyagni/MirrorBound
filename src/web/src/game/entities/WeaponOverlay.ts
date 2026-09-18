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
import { swingKey, WEAPONS, type SwingDef, type WeaponDef, type WeaponId } from '../animation/weaponClips';
import { DEPTH, PLAYER_DISPLAY_HEIGHT } from '../constants';
import type { Vec2 } from '../contracts';

const RATIO = PLAYER_DISPLAY_HEIGHT / 190; // Logesh tuned offsets for a 190-unit goat.

export class WeaponOverlay extends Phaser.GameObjects.Sprite {
  #weapon: WeaponDef | null = null;
  #active: SwingDef | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, WEAPONS.sword.swings[0]!.texture, WEAPONS.sword.swings[0]!.frames[0]);
    scene.add.existing(this);
    this.setVisible(false).setActive(false).setDepth(DEPTH.fxLow);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.setVisible(false).setActive(false));
  }

  get equipped(): WeaponId | null {
    return this.#weapon?.id ?? null;
  }

  equip(id: string | null): void {
    const known = id && id in WEAPONS ? (id as WeaponId) : null;
    this.#weapon = known ? WEAPONS[known] : null;
    this.setVisible(false).setActive(false);
  }

  /** Play the swing for `comboStep` (1-based) at the host. */
  strike(comboStep: number, host: Vec2, facing: Vec2): void {
    const weapon = this.#weapon;
    if (!weapon) return;
    const index = Math.max(0, (comboStep - 1) % weapon.swings.length);
    const def = weapon.swings[index] ?? weapon.swings[0]!;
    this.#active = def;
    this.setTexture(def.texture, def.frames[0]);
    this.setOrigin(def.anchor.x, def.anchor.y);
    const body = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    const ratio = def.lengthRatio ?? weapon.lengthRatio;
    this.setScale((body * ratio) / (def.frameSize.height * def.bodyRatio));
    this.place(host, facing);
    this.setVisible(true).setActive(true);
    this.play(swingKey(def.texture), true);
  }

  /** Follow the host while a swing is on screen. */
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
    // Tilt toward the vertical facing so an upward strike doesn't sweep sideways.
    this.setAngle(vertical ? (facing.y < 0 ? -70 : 70) * sign : 0);
  }
}
