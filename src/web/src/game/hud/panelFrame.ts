import type Phaser from 'phaser';

import { SCREENFRAME_TEXTURE_KEY } from '../animation/screenFrameAtlas.generated';

/**
 * Builds the complete panel border out of the one corner that was drawn.
 *
 * `screenFrame` is a single top-left corner: an L of bar with a stud at the
 * elbow, and nothing on its right or bottom halves. Nine-slicing it directly
 * -- which is what `Panel` did -- takes the top-right, bottom-left and
 * bottom-right corner slices out of empty pixels, so a panel came out with a
 * top and a left edge and no other two sides.
 *
 * The art is plainly meant to be mirrored, so that is what this does: the
 * corner is stamped four times into one square texture, flipped into each
 * quadrant, giving a real four-sided frame that nine-slices correctly.
 *
 * Measured off the source rather than guessed: the bar is 72px thick and the
 * stud's ornament ends 94px in, so the slice has to be at least 94 or a corner
 * gets stretched through its own detail. The old inset of 59 was under even
 * the bar thickness.
 */
const SOURCE_BAR = 72;
const SOURCE_CORNER = 94;

/**
 * How thick the finished border is on screen, in canvas pixels.
 *
 * A nine-slice never scales its corners, so this is set by how big the corner
 * is baked into the texture rather than by the panel's size. At the source's
 * own 72px the frame overwhelmed a 620px-tall panel.
 */
const BORDER = 26;

export const PANEL_FRAME_KEY = 'ui:panelFrame';

/** Corner size for `Panel`'s nine-slice, in the composed texture's pixels. */
export const PANEL_FRAME_INSET = Math.round(SOURCE_CORNER * (BORDER / SOURCE_BAR));

/** Compose the texture once. Safe to call from any scene; textures are global. */
export function ensurePanelFrame(scene: Phaser.Scene): void {
  if (scene.textures.exists(PANEL_FRAME_KEY)) return;

  const source = scene.textures.get(SCREENFRAME_TEXTURE_KEY);
  const frame = source.get('frame');
  const image = source.getSourceImage() as CanvasImageSource;

  // One quadrant, scaled so the bar lands on BORDER.
  const q = Math.round(frame.width * (BORDER / SOURCE_BAR));
  const canvas = scene.textures.createCanvas(PANEL_FRAME_KEY, q * 2, q * 2);
  if (!canvas) return;

  const ctx = canvas.getContext();
  ctx.imageSmoothingEnabled = true;
  const stamp = (x: number, y: number, flipX: number, flipY: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flipX, flipY);
    ctx.drawImage(image, frame.cutX, frame.cutY, frame.width, frame.height, 0, 0, q, q);
    ctx.restore();
  };
  stamp(0, 0, 1, 1);          // top-left, as drawn
  stamp(q * 2, 0, -1, 1);     // top-right
  stamp(0, q * 2, 1, -1);     // bottom-left
  stamp(q * 2, q * 2, -1, -1); // bottom-right
  canvas.refresh();
}
