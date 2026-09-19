import Phaser from 'phaser';

import { DEPTH, ROOM, TILE } from '../constants';
import { FLOOR_VARIANTS, floorKey, WALL_KEY } from './textures';

/**
 * The arena: a floor of tiles inside a ring of walls.
 *
 * The floor is composed once into a single canvas texture and added as one
 * image, rather than as a thousand tile sprites. It never changes, so paying
 * for it per frame would buy nothing.
 */
export class Room {
  readonly width = ROOM.cols * TILE;
  readonly height = ROOM.rows * TILE;
  #objects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Where the walls stop, in world units. Movement is clamped to this. */
  get bounds(): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      TILE, TILE, this.width - TILE * 2, this.height - TILE * 2,
    );
  }

  build(): void {
    this.destroy();
    const key = 'room:floor';
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    const canvas = this.scene.textures.createCanvas(key, this.width, this.height);
    if (!canvas) return;

    for (let row = 0; row < ROOM.rows; row += 1) {
      for (let col = 0; col < ROOM.cols; col += 1) {
        const wall = row === 0 || col === 0 || row === ROOM.rows - 1 || col === ROOM.cols - 1;
        // Hashed rather than random, so the same cell always gets the same tile.
        const variant = ((col * 7 + row * 13) >>> 0) % FLOOR_VARIANTS;
        canvas.drawFrame(wall ? WALL_KEY : floorKey(variant), undefined, col * TILE, row * TILE, false);
      }
    }
    canvas.refresh();

    this.#objects.push(
      this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.floor),
    );

    // A soft inner shadow along the wall line, which is what stops the floor
    // reading as a flat sheet the walls are merely printed on.
    const edge = this.scene.add.graphics().setDepth(DEPTH.floorDecal);
    edge.fillStyle(0x000000, 0.3);
    edge.fillRect(TILE, TILE, this.width - TILE * 2, 10);
    edge.fillStyle(0x000000, 0.16);
    edge.fillRect(TILE, TILE, 8, this.height - TILE * 2);
    edge.fillRect(this.width - TILE - 8, TILE, 8, this.height - TILE * 2);
    edge.fillRect(TILE, this.height - TILE - 6, this.width - TILE * 2, 6);
    this.#objects.push(edge);
  }

  destroy(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
  }
}
