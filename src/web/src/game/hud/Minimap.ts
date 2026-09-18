import type Phaser from 'phaser';

import { MINIMAPRING_TEXTURE_KEY } from '../animation/minimapRingAtlas.generated';
import { HUD_ART, PALETTE } from '../constants';
import { fitWidth } from './fit';
import type { Vec2 } from '../types';

/** What the map is told each frame. Positions are world units. */
export interface MapView {
  room: { width: number; height: number };
  player: Vec2;
  marks: readonly Vec2[];
}

/**
 * The map inside its ring.
 *
 * Drawn as a graphics layer masked to a circle, rather than as a second camera
 * rendering the world small. A second camera would have to re-render every
 * sprite in the room to show four dots, and it would show the *art* -- at map
 * scale a goat is three pixels of fur and reads as nothing at all.
 */
export class Minimap {
  #dots!: Phaser.GameObjects.Graphics;
  #mask!: Phaser.GameObjects.Graphics;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #view: MapView | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  build(): void {
    const { minimap } = HUD_ART;
    const inner = minimap.size / 2;

    const floor = this.scene.add.circle(minimap.x, minimap.y, inner * 0.94, PALETTE.night, 0.66);
    this.#dots = this.scene.add.graphics();

    // The dots are clipped to the ring's opening so a mark near the edge of the
    // room cannot spill out over the frame.
    this.#mask = this.scene.make.graphics({}, false);
    this.#mask.fillStyle(0xffffff).fillCircle(minimap.x, minimap.y, inner * 0.94);
    this.#dots.setMask(this.#mask.createGeometryMask());

    const ring = this.scene.add
      .image(minimap.x, minimap.y, MINIMAPRING_TEXTURE_KEY, 'ring');
    fitWidth(ring, minimap.size);

    this.#objects.push(floor, this.#dots, ring);
  }

  set(view: MapView): void {
    this.#view = view;
  }

  /**
   * Repaint the dots.
   *
   * The room is fitted to the circle on its longer side, so a wide room stays
   * the shape it is rather than being stretched to fill a round frame -- which
   * would put a mark in the wrong place relative to everything else.
   */
  draw(): void {
    const view = this.#view;
    if (!view) return;

    const { minimap } = HUD_ART;
    const inner = minimap.size / 2 * 0.94;
    const scale = (inner * 2) / Math.max(view.room.width, view.room.height);
    const toMap = (p: Vec2) => ({
      x: minimap.x + (p.x - view.room.width / 2) * scale,
      y: minimap.y + (p.y - view.room.height / 2) * scale,
    });

    this.#dots.clear();

    // The room's own outline, so an empty corner still reads as floor rather
    // than as the edge of the world.
    this.#dots.lineStyle(2, PALETTE.dusk, 0.9);
    this.#dots.strokeRect(
      minimap.x - (view.room.width * scale) / 2,
      minimap.y - (view.room.height * scale) / 2,
      view.room.width * scale,
      view.room.height * scale,
    );

    this.#dots.fillStyle(PALETTE.taupe, 0.9);
    for (const mark of view.marks) {
      const p = toMap(mark);
      this.#dots.fillRect(p.x - 3, p.y - 3, 6, 6);
    }

    // The player last and brightest: on a map this size the only question
    // being asked is "where am I", and it has to be answerable instantly.
    const self = toMap(view.player);
    this.#dots.fillStyle(PALETTE.pink, 1);
    this.#dots.fillRect(self.x - 4, self.y - 4, 8, 8);
  }

  destroy(): void {
    this.#dots?.clearMask(true);
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
  }
}
