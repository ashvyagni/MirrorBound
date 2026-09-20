import type Phaser from 'phaser';

import { SCREENFRAME_TEXTURE_KEY } from '../animation/screenFrameAtlas.generated';
import { HUD, PALETTE, PIXEL_FONT } from '../constants';

/**
 * A framed panel at any size.
 *
 * `assets/ui/screen-frame.png` did not come back as a hollow rectangle. It came
 * back as an **L**: a top bar, a left bar, one ornamented corner, and nothing
 * at all on the right or the bottom. A nine-slice of that renders exactly what
 * is there, which is half a frame.
 *
 * So the L is taken apart into the three pieces it actually contains -- the
 * corner, a slice of the horizontal bar, a slice of the vertical bar -- and the
 * rectangle is rebuilt from them: four corners mirrored outward, four edges
 * stretched from one clean slice. That is what a nine-slice does anyway, with
 * the difference that the seams are measured off this art rather than taken
 * from the brief. The brief said a 120px border on a 1024px square, which lands
 * at 59 here; the art's border is 72. Slicing at 59 cut through the border and
 * stretched the cut, which is what mangled the corners.
 *
 * Every screen is built from this rather than drawing its own chrome, for the
 * same reason one alert mark serves eleven creatures: five copies of the same
 * border drift apart.
 *
 * The three numbers below are measured, not chosen. If the frame is ever
 * redrawn as a closed rectangle, re-measure them and this assembly still holds.
 */

/** The ornamented corner occupies this square of the source, from its origin. */
const CORNER = 96;
/** How thick the bar runs once the corner's ornament has finished. */
const BORDER = 72;
/**
 * The column every edge is stretched from.
 *
 * One column rather than a tiled run: the bar is drawn with a deliberate
 * hand-drawn wobble, so no two columns of it are identical and tiling any
 * stretch of it would show a seam every repeat. Stretching a single column is
 * seamless by construction, at the cost of the wobble -- which is invisible on
 * a straight edge and very visible at a seam.
 */
const BAR_SAMPLE = 200;

/**
 * The smallest frame this art can make.
 *
 * Below two corners there is no room for the corners, let alone the edges
 * between them: `spanY` goes negative, both side edges are skipped, and the top
 * and bottom corners are drawn over each other. That renders as a squashed
 * sandwich with no sides, which is what a 108px-tall console panel looked like.
 * Clamping here rather than asserting means a caller that asks for less gets
 * the smallest frame that can actually be built.
 */
export const PANEL_MIN = CORNER * 2;

/**
 * Compose a closed frame at exactly the size asked for.
 *
 * Built once per size into its own canvas texture and drawn as one image:
 * cheaper at render time than eight game objects, and it cannot drift out of
 * alignment the way eight separately positioned pieces can.
 */
function buildFrame(scene: Phaser.Scene, width: number, height: number): string {
  const w = Math.round(width);
  const h = Math.round(height);
  const key = `screenFrame:${w}x${h}`;
  if (scene.textures.exists(key)) return key;

  const src = scene.textures.get(SCREENFRAME_TEXTURE_KEY).get('frame');
  const image = src.source.image as CanvasImageSource;
  const { cutX, cutY } = src;

  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) return SCREENFRAME_TEXTURE_KEY;
  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = false;

  /** Draw a region of the source into a target box, optionally mirrored. */
  const put = (
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
    fx = 1, fy = 1,
  ): void => {
    if (dw <= 0 || dh <= 0) return;
    ctx.save();
    ctx.translate(fx < 0 ? dx + dw : dx, fy < 0 ? dy + dh : dy);
    ctx.scale(fx, fy);
    ctx.drawImage(image, cutX + sx, cutY + sy, sw, sh, 0, 0, dw, dh);
    ctx.restore();
  };

  const spanX = w - CORNER * 2;
  const spanY = h - CORNER * 2;

  // Edges first, so each corner's ornament sits on top of the bars it meets
  // rather than being cut into by them.
  put(BAR_SAMPLE, 0, 1, BORDER, CORNER, 0, spanX, BORDER);                   // top
  put(BAR_SAMPLE, 0, 1, BORDER, CORNER, h - BORDER, spanX, BORDER, 1, -1);   // bottom
  put(0, BAR_SAMPLE, BORDER, 1, 0, CORNER, BORDER, spanY);                   // left
  put(0, BAR_SAMPLE, BORDER, 1, w - BORDER, CORNER, BORDER, spanY, -1, 1);   // right

  // Then the same drawn corner, four times, each turned to face outward.
  put(0, 0, CORNER, CORNER, 0, 0, CORNER, CORNER);
  put(0, 0, CORNER, CORNER, w - CORNER, 0, CORNER, CORNER, -1, 1);
  put(0, 0, CORNER, CORNER, 0, h - CORNER, CORNER, CORNER, 1, -1);
  put(0, 0, CORNER, CORNER, w - CORNER, h - CORNER, CORNER, CORNER, -1, -1);

  canvas.refresh();
  return key;
}

export interface PanelOptions {
  width: number;
  height: number;
  title?: string;
  /** Darken everything behind it. Screens want this; a tooltip does not. */
  scrim?: boolean;
}

export class Panel {
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Container;
  readonly inset: number;
  #texts: Phaser.GameObjects.Text[] = [];
  /** The heading, when the panel was given one. */
  #title: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: PanelOptions) {
    // The border the art actually has, not the one the brief asked for.
    this.inset = BORDER;

    const width = Math.max(opts.width, PANEL_MIN);
    const height = Math.max(opts.height, PANEL_MIN);

    this.container = scene.add.container(x, y);

    if (opts.scrim) {
      // Sized off the camera rather than the panel: it has to cover the screen,
      // and the panel is centred on it.
      const cam = scene.cameras.main;
      const scrim = scene.add
        .rectangle(0, 0, cam.width * 2, cam.height * 2, PALETTE.night, 0.72)
        .setOrigin(0.5);
      this.container.add(scrim);
    }

    // Inset by the full border, so the fill stops under the frame rather than
    // showing a lip of flat colour outside it.
    const fill = scene.add
      .rectangle(0, 0, width - this.inset * 2, height - this.inset * 2,
        PALETTE.night, 0.97)
      .setOrigin(0.5);
    this.container.add(fill);

    const frame = scene.add
      .image(0, 0, buildFrame(scene, width, height))
      .setOrigin(0.5, 0.5);
    this.container.add(frame);

    if (opts.title) {
      const title = scene.add
        .text(0, -height / 2 + this.inset * 0.5, opts.title.toUpperCase(), {
          fontFamily: PIXEL_FONT.stack,
          fontSize: `${HUD.labelSize + 6}px`,
          color: HUD.ink,
        })
        .setOrigin(0.5, 0.5);
      this.container.add(title);
      this.#texts.push(title);
      this.#title = title;
    }

    // Everything a screen puts inside goes here, so a caller never has to know
    // how thick the border is.
    this.body = scene.add.container(0, 0);
    this.container.add(this.body);
  }

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  /** Retitle a panel whose heading depends on what it is showing. */
  setTitle(title: string): void {
    this.#title?.setText(title.toUpperCase());
  }

  /** Usable space inside the border. */
  contentSize(width: number, height: number): { width: number; height: number } {
    return { width: width - this.inset * 2, height: height - this.inset * 2 };
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    this.container.destroy();
    this.#texts = [];
  }
}
