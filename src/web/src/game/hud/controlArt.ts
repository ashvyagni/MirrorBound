import type Phaser from 'phaser';

/**
 * How to slice a frame that has something drawn into its left end.
 *
 * `dialogue.plate` carries a portrait window cut clean through it, and a hole
 * in the stretched middle column gets smeared across the whole result. Skipping
 * the middle past it fixes that -- but skipping the *left column* too throws
 * away the plate's own border, which is how the bubble ended up open along its
 * left edge. So the two are separate: the left column still comes from the real
 * left edge, and only the part that stretches is sampled from further in.
 *
 * Measured off `dialogue.plate`: its border occupies x 0-12, the window frame
 * starts at 13, and the art is clean again from x 54.
 */
export interface LeftWindow {
  /** Width of the left column, in source pixels. Must stop before the hole. */
  column: number;
  /** Source x the stretched middle is sampled from. Must start after the hole. */
  stretchFrom: number;
}

/**
 * Resize chrome from its trimmed art, preserving the corners and hit bounds.
 *
 * Nine-sliced: the four corners are kept, the four edges tile, the middle
 * stretches. `window` handles the one frame that is not uniform along its left
 * edge; everything else leaves it out.
 */
export function controlArt(
  scene: Phaser.Scene, atlas: string, frame: string, width: number, height: number,
  edge = 14, window?: LeftWindow,
): string {
  const leftW = window?.column ?? edge;
  const midFrom = window?.stretchFrom ?? leftW;
  const key = `${atlas}:${frame}:${width}x${height}:${edge}:${leftW}:${midFrom}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.getFrame(atlas, frame);
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not build ${key}`);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;

  // Source columns as (start, end) pairs rather than one array of edges: the
  // middle column does not begin where the left column ends.
  const sxStart = [0, midFrom, source.width - edge];
  const sxEnd = [leftW, source.width - edge, source.width];
  const sy = [0, edge, source.height - edge, source.height];
  const dx = [0, leftW, width - edge, width];
  const dy = [0, edge, height - edge, height];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const sw = sxEnd[col]! - sxStart[col]!;
      const sh = sy[row + 1]! - sy[row]!;
      const dw = dx[col + 1]! - dx[col]!;
      const dh = dy[row + 1]! - dy[row]!;
      if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) continue;
      ctx.drawImage(source.source.image as CanvasImageSource,
        source.cutX + sxStart[col]!, source.cutY + sy[row]!, sw, sh,
        dx[col]!, dy[row]!, dw, dh);
    }
  }
  texture.refresh();
  return key;
}
