import type Phaser from 'phaser';

/** Resize chrome from its trimmed art, preserving the corners and hit bounds. */
export function controlArt(
  scene: Phaser.Scene, atlas: string, frame: string, width: number, height: number,
  edge = 14,
): string {
  const key = `${atlas}:${frame}:${width}x${height}:${edge}`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.getFrame(atlas, frame);
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) throw new Error(`Could not build ${key}`);
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  const sx = [0, edge, source.width - edge, source.width];
  const sy = [0, edge, source.height - edge, source.height];
  const dx = [0, edge, width - edge, width];
  const dy = [0, edge, height - edge, height];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      ctx.drawImage(source.source.image as CanvasImageSource,
        source.cutX + sx[col]!, source.cutY + sy[row]!,
        sx[col + 1]! - sx[col]!, sy[row + 1]! - sy[row]!,
        dx[col]!, dy[row]!, dx[col + 1]! - dx[col]!, dy[row + 1]! - dy[row]!);
    }
  }
  texture.refresh();
  return key;
}
