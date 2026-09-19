import type Phaser from 'phaser';

import { MINIMAPRING_TEXTURE_KEY } from '../animation/minimapRingAtlas.generated';
import { HUD_ART, PALETTE } from '../constants';
import { fitWidth } from './fit';
import type { Vec2 } from '../types';

/** What the map is told each frame. Positions are world units. */
export interface MapView {
  room: { width: number; height: number };
  player: Vec2;
  /** Live enemies. */
  marks: readonly Vec2[];
  /** The companion, kept apart from the enemies so the two never read alike. */
  twin?: Vec2 | null;
  /** Doors, so the ring answers "which way out" and not only "where am I". */
  doors?: readonly { x: number; y: number; locked: boolean }[];
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

    // Nearly opaque. At 0.66 the lit grass underneath came through strongly
    // enough that a few small marks on top of it read as noise in the texture
    // rather than as a map.
    const floor = this.scene.add.circle(minimap.x, minimap.y, inner * 0.94, PALETTE.night, 0.92);
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
    // Marks are sized against the ring, not in absolute pixels: the ring is
    // 228 across and an 8px dot on it is a speck. Everything below is a
    // fraction of that so the map stays readable if the ring is ever resized.
    const unit = minimap.size / 28;

    const g = this.#dots;
    g.clear();

    // The room's own outline, so an empty corner still reads as floor rather
    // than as the edge of the world. Taupe, not dusk: dusk is two shades off
    // the floor disc it is drawn on and was invisible in practice.
    const w = view.room.width * scale;
    const h = view.room.height * scale;
    g.fillStyle(PALETTE.dusk, 0.55);
    g.fillRect(minimap.x - w / 2, minimap.y - h / 2, w, h);
    g.lineStyle(2, PALETTE.taupe, 0.5);
    g.strokeRect(minimap.x - w / 2, minimap.y - h / 2, w, h);

    // Doors: where the room lets you out, and whether it will yet.
    //
    // A locked door is dim stone, not red. Red is what is trying to kill you,
    // and a door you cannot use yet is an absence of an exit rather than a
    // threat -- so gold arrives exactly when the way out becomes real, which
    // is the one moment the door is worth looking at.
    for (const door of view.doors ?? []) {
      const p = toMap(door);
      g.fillStyle(door.locked ? PALETTE.taupe : PALETTE.gold, door.locked ? 0.45 : 1);
      g.fillRect(p.x - unit * 0.7, p.y - unit * 0.7, unit * 1.4, unit * 1.4);
    }

    // Enemies.
    g.fillStyle(PALETTE.healthRed, 1);
    for (const mark of view.marks) {
      const p = toMap(mark);
      g.fillRect(p.x - unit * 0.6, p.y - unit * 0.6, unit * 1.2, unit * 1.2);
    }

    // The companion, in the cool tone it owns everywhere else in the HUD.
    if (view.twin) {
      const p = toMap(view.twin);
      g.fillStyle(PALETTE.frost, 1);
      g.fillRect(p.x - unit * 0.6, p.y - unit * 0.6, unit * 1.2, unit * 1.2);
    }

    // The player last and brightest: on a map this size the only question
    // being asked is "where am I", and it has to be answerable instantly. The
    // dark collar keeps it legible when it crosses a door or an enemy.
    const self = toMap(view.player);
    g.fillStyle(PALETTE.night, 0.9);
    g.fillRect(self.x - unit, self.y - unit, unit * 2, unit * 2);
    g.fillStyle(PALETTE.pink, 1);
    g.fillRect(self.x - unit * 0.7, self.y - unit * 0.7, unit * 1.4, unit * 1.4);
  }

  destroy(): void {
    this.#dots?.clearMask(true);
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
  }
}
