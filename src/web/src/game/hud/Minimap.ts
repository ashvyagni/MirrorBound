import type Phaser from 'phaser';

import { MINIMAPRING_TEXTURE_KEY } from '../animation/minimapRingAtlas.generated';
import { BIOMES, HUD_ART, PALETTE, type BiomeName } from '../constants';
import type { Vec2 } from '../contracts';
import { T } from '../world/TextureFactory';
import { fitWidth } from './fit';

/**
 * What the map is told. Positions are world units.
 *
 * The tiles come with it rather than being read from somewhere shared, because
 * the minimap has no business reaching into the scene -- and when the room
 * arrives from a socket instead of a generator, this shape does not change.
 */
export interface MapView {
  room: { width: number; height: number };
  /** Row-major, `[row][col]`, as `RoomFull` carries it. */
  tiles: readonly (readonly number[])[];
  biome: BiomeName;
  /** Changes when the room does. The floor is only repainted when it moves. */
  roomId: string;
  roomSeed?: number;
  player: Vec2;
  marks: readonly Vec2[];
}

/**
 * The map inside its ring.
 *
 * The floor is the room's own tile grid, painted once into a canvas texture and
 * then left alone -- not a second camera rendering the world small. A camera
 * would re-render every sprite in the room to show four dots, and it would show
 * the *art*: at map scale a tree is four pixels of green and a goat is three
 * pixels of fur, neither of which reads as anything.
 *
 * Tile colours come from `BIOMES`, the same table `WorldRenderer` paints the
 * real floor from, so the map is the room in miniature rather than a diagram
 * of it -- and a new biome needs no work here at all.
 */
export class Minimap {
  #floor!: Phaser.GameObjects.Image;
  #dots!: Phaser.GameObjects.Graphics;
  #mask!: Phaser.GameObjects.Graphics;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #view: MapView | null = null;
  /** The room the floor texture was painted from. */
  #painted: string | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Diameter of the ring's opening, which everything is drawn inside. */
  get #inner(): number {
    return HUD_ART.minimap.size * HUD_ART.minimap.innerRatio;
  }

  build(): void {
    const { minimap } = HUD_ART;

    // Sits under the floor, so a room that does not fill the circle shows dark
    // rather than showing whatever is behind the HUD.
    const back = this.scene.add.circle(minimap.x, minimap.y, this.#inner / 2, PALETTE.night, 0.85);

    this.#floor = this.scene.add.image(minimap.x, minimap.y, MINIMAPRING_TEXTURE_KEY, 'ring');
    this.#floor.setVisible(false);

    this.#dots = this.scene.add.graphics();

    // The marks are clipped to the ring's opening, so one near a corner of the
    // room cannot spill out over the frame. The floor needs no mask: it is
    // painted circular, which is cheaper and cannot be got wrong.
    this.#mask = this.scene.make.graphics({}, false);
    this.#mask.fillStyle(0xffffff).fillCircle(minimap.x, minimap.y, this.#inner / 2);
    this.#dots.setMask(this.#mask.createGeometryMask());

    const ring = this.scene.add
      .image(minimap.x, minimap.y, MINIMAPRING_TEXTURE_KEY, 'ring');
    fitWidth(ring, minimap.size);

    this.#objects.push(back, this.#floor, this.#dots, ring);
  }

  set(view: MapView): void {
    this.#view = view;
    if (`${view.roomId}:${view.roomSeed ?? 0}` !== this.#painted) this.#paintFloor(view);
  }

  /**
   * Paint the room's tiles into a texture, once per room.
   *
   * Once, not per frame: a 40x30 grid is 1,200 fills, which is nothing as a
   * one-off and far too much sixty times a second to show a floor that never
   * changes.
   *
   * Scaled to FILL the circle on the room's longer side rather than to fit
   * inside it on the diagonal. Fitting the diagonal keeps every corner in view
   * but leaves a 1280x960 room occupying two thirds of the ring, with the rest
   * empty -- and the corners of a rectangular room are the least interesting
   * part of it. Filling and clipping shows the middle, where everything is.
   */
  #paintFloor(view: MapView): void {
    const rows = view.tiles.length;
    const cols = view.tiles[0]?.length ?? 0;
    if (!rows || !cols) return;

    const size = Math.round(this.#inner);
    const identity = `${view.roomId}:${view.roomSeed ?? 0}`;
    const key = `minimap:floor:${identity}`;
    if (this.#painted) this.scene.textures.remove(`minimap:floor:${this.#painted}`);
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);

    const canvas = this.scene.textures.createCanvas(key, size, size);
    if (!canvas) return;
    const ctx = canvas.getContext();

    const palette = BIOMES[view.biome] ?? BIOMES.grove;
    const colourFor = (tile: number): string => {
      switch (tile) {
        case T.WALL: return palette.wall;
        case T.PATH: return palette.path;
        case T.STONE: return palette.stone;
        case T.DIRT: return palette.dirt;
        case T.WATER: return palette.water;
        case T.GRASS:
        default: return palette.grass[0]!;
      }
    };

    // One tile is this many map pixels. Ceiled, so neighbouring tiles overlap
    // by a fraction rather than leaving a hairline of background between them.
    const scale = size / Math.max(cols, rows);
    const step = Math.ceil(scale);
    const originX = (size - cols * scale) / 2;
    const originY = (size - rows * scale) / 2;

    for (let row = 0; row < rows; row += 1) {
      const line = view.tiles[row]!;
      for (let col = 0; col < cols; col += 1) {
        ctx.fillStyle = colourFor(line[col] ?? T.GRASS);
        ctx.fillRect(
          Math.floor(originX + col * scale), Math.floor(originY + row * scale),
          step, step,
        );
      }
    }

    // Cut it to the ring's opening. Done here rather than with a Phaser mask
    // because the texture is built once anyway, and a baked circle cannot come
    // apart the way a mask and its target can.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    canvas.refresh();

    this.#floor.setTexture(key);
    this.#floor.setDisplaySize(size, size);
    this.#floor.setVisible(true);
    this.#painted = identity;
  }

  /** Repaint the marks. The floor underneath is already drawn. */
  draw(): void {
    const view = this.#view;
    if (!view) return;

    const { minimap } = HUD_ART;
    const size = this.#inner;
    // The same mapping the floor was painted with, so a mark lands on the tile
    // it is standing on rather than near it.
    const scale = size / Math.max(view.room.width, view.room.height);
    const toMap = (p: Vec2) => ({
      x: minimap.x + (p.x - view.room.width / 2) * scale,
      y: minimap.y + (p.y - view.room.height / 2) * scale,
    });

    this.#dots.clear();

    this.#dots.fillStyle(PALETTE.night, 0.85);
    for (const mark of view.marks) {
      const p = toMap(mark);
      this.#dots.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    this.#dots.fillStyle(PALETTE.taupe, 1);
    for (const mark of view.marks) {
      const p = toMap(mark);
      this.#dots.fillRect(p.x - 3, p.y - 3, 6, 6);
    }

    // The player last and brightest: on a map this size the only question being
    // asked is "where am I", and it has to be answerable instantly. Outlined,
    // because pink on grass and pink on a dirt path are not equally readable.
    const self = toMap(view.player);
    this.#dots.fillStyle(PALETTE.night, 0.9);
    this.#dots.fillRect(self.x - 5, self.y - 5, 10, 10);
    this.#dots.fillStyle(PALETTE.pink, 1);
    this.#dots.fillRect(self.x - 3, self.y - 3, 6, 6);
  }

  /**
   * Show or hide the whole piece.
   *
   * Used by the Sanctum cutscene, which is a scene rather than a moment of
   * play: a hotbar and a minimap over it say "you are playing" while the one
   * thing the game wants is for you to watch. Visibility rather than destroy,
   * because the scene ends and everything has to come back exactly as it was.
   */
  setVisible(on: boolean): void {
    for (const object of this.#objects) {
      // Not every GameObject carries the Visible component -- a Zone used as a
      // hit area does not -- so this asks rather than asserts.
      (object as unknown as Partial<Phaser.GameObjects.Components.Visible>).setVisible?.(on);
    }
  }

  destroy(): void {
    this.#dots?.clearMask(true);
    if (this.#painted) this.scene.textures.remove(`minimap:floor:${this.#painted}`);
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
    this.#painted = null;
  }
}
