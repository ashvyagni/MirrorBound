import Phaser from 'phaser';

import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { ITEM_NAMES, type ItemName } from '../animation/items';
import { depthAt, DEPTH, GOAT_DISPLAY_HEIGHT, PICKUP } from '../constants';
import { FX } from '../world/textures';

/**
 * An item lying on the floor, waiting to be walked over or picked up.
 *
 * The names are `main`'s consumable, relic and resource ids, so a pickup
 * indexes its own icon with nothing in between and an id with no art is a
 * compile error rather than a blank square on the grass.
 */
export { ITEM_NAMES, type ItemName };

export class Pickup extends Phaser.GameObjects.Sprite {
  readonly item: ItemName;
  #age = 0;
  /** Where it rests, before the bob is added. */
  readonly #baseY: number;
  #taken = false;
  readonly #shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, item: ItemName, x: number, y: number) {
    super(scene, x, y, ITEMS_TEXTURE_KEY, item);
    this.item = item;
    this.#baseY = y;
    scene.add.existing(this);

    this.setScale((GOAT_DISPLAY_HEIGHT * PICKUP.sizeRatio) / this.frame.height);

    // The shadow stays on the floor while the item bobs above it -- which is
    // the only thing that says the item is off the ground rather than simply
    // drawn higher up.
    this.#shadow = scene.add
      .image(x, y + PICKUP.shadowDrop, FX.shadow)
      .setDepth(DEPTH.shadow)
      .setScale((GOAT_DISPLAY_HEIGHT * PICKUP.sizeRatio * 0.4) / 64)
      .setAlpha(0.5);
  }

  /** How close the goat has to be. Generous: an item you have to stand exactly
   *  on is an item you walk past. */
  get reach(): number {
    return PICKUP.reach;
  }

  get taken(): boolean {
    return this.#taken;
  }

  /** Collect it, with a short rise-and-fade rather than vanishing. */
  take(): void {
    if (this.#taken) return;
    this.#taken = true;
    this.#shadow.destroy();
    this.scene.tweens.add({
      targets: this,
      y: this.#baseY - PICKUP.takeRise,
      alpha: 0,
      scale: this.scale * 1.3,
      duration: PICKUP.takeTime,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  step(deltaSeconds: number): void {
    if (this.#taken) return;
    this.#age += deltaSeconds;
    this.y = this.#baseY + Math.sin(this.#age * PICKUP.bobSpeed) * PICKUP.bobAmount;
    this.setDepth(depthAt(this.#baseY));
  }

  override destroy(fromScene?: boolean): void {
    if (this.#shadow.active) this.#shadow.destroy();
    super.destroy(fromScene);
  }
}
