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
  /**
   * The composed floor texture for this room, if it has been built yet.
   *
   * The world renderer already flattens every tile into one image per room, so
   * the map draws that scaled down instead of inventing its own terrain. It is
   * what turns the ring from a dark hole with dots in it into something you
   * can recognise the room by -- the path, the dirt, the water are all there.
   */
  floorKey?: string | null;
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
  #floor!: Phaser.GameObjects.Image;
  #floorKey: string | null = null;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #view: MapView | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  build(): void {
    const { minimap } = HUD_ART;
    const inner = minimap.size / 2;

    // Nearly opaque. At 0.66 the lit grass underneath came through strongly
    // enough that a few small marks on top of it read as noise in the texture
    // rather than as a map.
    const disc = this.scene.add.circle(minimap.x, minimap.y, inner * 0.94, PALETTE.night, 0.92);

    // The room's own floor, slotted between the disc and the marks. Starts on
    // a placeholder frame: it is given a real texture the first time one
    // arrives, which is after the play scene has built the room.
    this.#floor = this.scene.add.image(minimap.x, minimap.y, MINIMAPRING_TEXTURE_KEY, 'ring')
      .setVisible(false);

    this.#dots = this.scene.add.graphics();

    // No geometry mask: `setMask` is accepted and then silently ignored on
    // this Phaser build -- the mask was never applied, which only went
    // unnoticed while nothing drew near the rim. The floor is clipped into a
    // circular texture instead (see #circularFloor) and the marks are clipped
    // by distance in draw(), both of which are cheaper than a mask anyway.

    const ring = this.scene.add
      .image(minimap.x, minimap.y, MINIMAPRING_TEXTURE_KEY, 'ring');
    fitWidth(ring, minimap.size);

    this.#objects.push(disc, this.#floor, this.#dots, ring);
  }

  /**
   * The room's floor, scaled into the ring and clipped to it.
   *
   * Composed once per room into its own texture rather than clipped every
   * frame: the source is already a single flattened image of the whole floor,
   * so this is one scale-and-punch and then a plain sprite.
   */
  #circularFloor(sourceKey: string, roomWidth: number, roomHeight: number, diameter: number): string | null {
    const key = `mm:${sourceKey}`;
    if (this.scene.textures.exists(key)) return key;
    if (!this.scene.textures.exists(sourceKey)) return null;

    const canvas = this.scene.textures.createCanvas(key, diameter, diameter);
    if (!canvas) return null;
    const ctx = canvas.getContext();
    const scale = diameter / Math.max(roomWidth, roomHeight);
    const w = roomWidth * scale;
    const h = roomHeight * scale;
    ctx.clearRect(0, 0, diameter, diameter);
    ctx.drawImage(
      this.scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource,
      (diameter - w) / 2, (diameter - h) / 2, w, h,
    );
    // Punch it to a circle, so the room's corners cannot sit outside the ring.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(diameter / 2, diameter / 2, diameter / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    canvas.refresh();
    return key;
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
    /** Inside the ring's opening? Marks are clipped by distance, since there
     *  is no working mask to clip them with. */
    const shows = (p: { x: number; y: number }) =>
      Math.hypot(p.x - minimap.x, p.y - minimap.y) <= inner - 2;
    // Marks are sized against the ring, not in absolute pixels: the ring is
    // 228 across and an 8px dot on it is a speck. Everything below is a
    // fraction of that so the map stays readable if the ring is ever resized.
    const unit = minimap.size / 28;

    const w = view.room.width * scale;
    const h = view.room.height * scale;

    // Swap in the room's floor when it changes rooms, or when the play scene
    // finishes building one we asked for too early.
    const source = view.floorKey ?? null;
    const composed = source
      ? this.#circularFloor(source, view.room.width, view.room.height, Math.round(inner * 2))
      : null;
    if (composed !== this.#floorKey) {
      // Drop the room we just left. Recomposing on the way back is one
      // drawImage; keeping every room of every restart alive is not, and this
      // texture is 214x214 of RGBA per room.
      if (this.#floorKey && this.scene.textures.exists(this.#floorKey)) {
        this.scene.textures.remove(this.#floorKey);
      }
      this.#floorKey = composed;
      if (composed) this.#floor.setTexture(composed).setVisible(true);
      else this.#floor.setVisible(false);
    }
    if (this.#floor.visible) {
      this.#floor.setPosition(minimap.x, minimap.y).setDisplaySize(inner * 2, inner * 2);
    }

    const g = this.#dots;
    g.clear();

    // The room's own outline, so an empty corner still reads as floor rather
    // than as the edge of the world. Taupe, not dusk: dusk is two shades off
    // the floor disc it is drawn on and was invisible in practice.
    if (!this.#floor.visible) {
      // Only until the room's own floor image exists; once it does, the
      // terrain says where the room is far better than an outline can.
      g.fillStyle(PALETTE.dusk, 0.55);
      g.fillRect(minimap.x - w / 2, minimap.y - h / 2, w, h);
      g.lineStyle(2, PALETTE.taupe, 0.5);
      g.strokeRect(minimap.x - w / 2, minimap.y - h / 2, w, h);
    }

    // Doors: where the room lets you out, and whether it will yet.
    //
    // A locked door is dim stone, not red. Red is what is trying to kill you,
    // and a door you cannot use yet is an absence of an exit rather than a
    // threat -- so gold arrives exactly when the way out becomes real, which
    // is the one moment the door is worth looking at.
    for (const door of view.doors ?? []) {
      const p = toMap(door);
      if (!shows(p)) continue;
      g.fillStyle(door.locked ? PALETTE.taupe : PALETTE.gold, door.locked ? 0.45 : 1);
      g.fillRect(p.x - unit * 0.7, p.y - unit * 0.7, unit * 1.4, unit * 1.4);
    }

    // Enemies.
    g.fillStyle(PALETTE.healthRed, 1);
    for (const mark of view.marks) {
      const p = toMap(mark);
      if (!shows(p)) continue;
      g.fillRect(p.x - unit * 0.6, p.y - unit * 0.6, unit * 1.2, unit * 1.2);
    }

    // The companion, in the cool tone it owns everywhere else in the HUD.
    if (view.twin) {
      const p = toMap(view.twin);
      if (shows(p)) {
      g.fillStyle(PALETTE.frost, 1);
      g.fillRect(p.x - unit * 0.6, p.y - unit * 0.6, unit * 1.2, unit * 1.2);
      }
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
    if (this.#floorKey && this.scene.textures.exists(this.#floorKey)) {
      this.scene.textures.remove(this.#floorKey);
    }
    this.#dots?.clearMask(true);
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
  }
}
