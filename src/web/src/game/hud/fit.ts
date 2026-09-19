import type Phaser from 'phaser';

type Art = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

/**
 * Size a HUD piece by the artwork actually drawn in its frame.
 *
 * These set `scale` and nothing else -- never `displaySize`, and never the
 * origin. Both of those have bitten:
 *
 * **`setDisplaySize` measures the source box, not the art.** Phaser solves it
 * against `realWidth`/`realHeight`, the frame's *untrimmed* size, while the
 * aspect you want is the trimmed artwork's. On a sheet whose frames are all
 * the same shape those agree. On the cooldown sheet, which holds a 132x736
 * rail and a 172x173 socket sharing a 172x737 source box, they disagree by
 * 4.26x: asking for a 48px socket drew one 48 wide and 11 tall, a flat band
 * lying across the rail.
 *
 * **The origin belongs to the caller.** A bar grows rightward from its left
 * edge and sets `origin(0, 0.5)` to say so; a ring is placed by its middle.
 * Having a sizing helper quietly re-centre everything moved every bar half its
 * own width to the left.
 */

/** Draw the artwork `width` pixels across, keeping its own proportions. */
export function fitWidth(image: Art, width: number): void {
  image.setScale(width / image.frame.width);
}

/** Draw the artwork `height` pixels tall, keeping its own proportions. */
export function fitHeight(image: Art, height: number): void {
  image.setScale(height / image.frame.height);
}

/** Fit the artwork inside a square box: its longer side lands on the box. */
export function fitInside(image: Art, box: number): void {
  const { width, height } = image.frame;
  image.setScale(box / Math.max(width, height));
}

/**
 * The artwork's drawn size.
 *
 * Not `displayWidth`, which measures the whole source box -- most of which may
 * be empty on a trimmed frame. The rail's box is 172 wide around 132 of art, so
 * the two differ by a third, and placing anything by the wrong one puts it a
 * third of the rail's width off.
 */
export function artWidth(image: Art): number {
  return image.frame.width * image.scaleX;
}

export function artHeight(image: Art): number {
  return image.frame.height * image.scaleY;
}
