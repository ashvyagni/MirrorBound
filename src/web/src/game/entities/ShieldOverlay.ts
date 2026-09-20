/**
 * The Aegis ward, drawn over the player: Logesh's two shield sheets.
 *
 * Both sheets were generated and then never referenced, so the ability that
 * cuts incoming damage by 40% for five seconds had no picture at all -- the
 * only way to know it was up was to notice the damage numbers were smaller.
 *
 * The server owns the ward: `statusEffects` carries `shield` for exactly as
 * long as the status lasts, so the block pose is driven off the snapshot
 * rather than off a local five-second timer that would drift out of step with
 * it. The parry is the one hit-reactive piece, played when DAMAGE_TAKEN says
 * the shield is what made a hit small.
 */

import Phaser from 'phaser';

import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import {
  SHIELD_BLOCK, SHIELD_PARRY, shieldBlockKey, shieldParryKey, type ShieldDef,
} from '../animation/shieldClips';
import { DEPTH, PLAYER_DISPLAY_HEIGHT } from '../constants';
import type { Vec2 } from '../contracts';

const RATIO = PLAYER_DISPLAY_HEIGHT / 190;

export class ShieldOverlay extends Phaser.GameObjects.Sprite {
  #up = false;
  #parrying = false;
  #active: ShieldDef = SHIELD_BLOCK;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, SHIELD_BLOCK.texture, SHIELD_BLOCK.frames[0]);
    scene.add.existing(this);
    // Over the weapon: the ward is in front of the body, and a shield drawn
    // under the sword it is protecting reads as being behind the player.
    this.setVisible(false).setActive(false).setDepth(DEPTH.fxLow + 1);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.#parrying) return;
      this.#parrying = false;
      // Back to holding the ward, unless it expired while the parry played.
      if (this.#up) this.#play(SHIELD_BLOCK, shieldBlockKey());
      else this.#hide();
    });
  }

  get up(): boolean {
    return this.#up;
  }

  /**
   * Raise or drop the ward, from the snapshot's status list.
   *
   * Idempotent, because this runs off every snapshot: restarting the block
   * loop twenty times a second would freeze it on its first frame.
   */
  setUp(up: boolean): void {
    if (up === this.#up) return;
    this.#up = up;
    if (up) this.#play(SHIELD_BLOCK, shieldBlockKey());
    else if (!this.#parrying) this.#hide();
  }

  /** A hit the ward turned aside. Interrupts the hold, then returns to it. */
  parry(): void {
    if (!this.#up) return;
    this.#parrying = true;
    this.#play(SHIELD_PARRY, shieldParryKey());
  }

  #hide(): void {
    this.setVisible(false).setActive(false);
  }

  #play(def: ShieldDef, key: string): void {
    this.#active = def;
    this.setTexture(def.texture, def.frames[0]);
    this.setOrigin(def.anchor.x, def.anchor.y);
    const body = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    // Solved against the sheet's own body ratio rather than its frame height,
    // for the same reason the weapons are: the two sheets are padded by
    // different amounts and matching frame heights would size them apart.
    this.setScale((body * def.lengthRatio) / (def.frameSize.height * def.bodyRatio));
    this.setVisible(true).setActive(true);
    this.play(key, true);
  }

  /** Follow the host while the ward is on screen. */
  place(host: Vec2, facing: Vec2): void {
    if (!this.visible) return;
    const def = this.#active;
    const sign = facing.x >= 0 ? 1 : -1;
    this.setPosition(host.x + def.offset.x * RATIO * sign, host.y + def.offset.y * RATIO);
    this.setFlipX(sign === -1);
  }
}
