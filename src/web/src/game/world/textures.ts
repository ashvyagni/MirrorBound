import type Phaser from 'phaser';

import { PALETTE, RENDER_SCALE, TILE, VIEW } from '../constants';

/** Draw into an offscreen canvas and register it as a texture. */
function paint(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, rng: () => number) => void,
): void {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return;
  const ctx = canvas.getContext();
  // Seeded from the key so a texture looks the same every run -- a floor that
  // reshuffles its speckles on reload reads as flicker, not variety.
  let seed = 0;
  for (let i = 0; i < key.length; i += 1) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  draw(ctx, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  });
  canvas.refresh();
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Mix toward white (`t > 0`) or black (`t < 0`). */
function shade(color: number, t: number): string {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return `rgb(${Math.round(r + (to - r) * k)},${Math.round(g + (to - g) * k)},${Math.round(b + (to - b) * k)})`;
}

export const FLOOR_VARIANTS = 4;

export const FX = {
  shadow: 'fx:shadow',
  vignette: 'fx:vignette',
} as const;

export function floorKey(variant: number): string {
  return `tile:floor:${variant}`;
}

export const WALL_KEY = 'tile:wall';

/**
 * Everything the world is drawn from, painted once at boot.
 *
 * Generated rather than authored because none of it is art: a floor tile, a
 * wall cap, an ellipse of shadow and a vignette. Painting them keeps the
 * repository free of assets nobody would ever open.
 */
export function buildWorldTextures(scene: Phaser.Scene): void {
  for (let v = 0; v < FLOOR_VARIANTS; v += 1) {
    paint(scene, floorKey(v), TILE, TILE, (ctx, rng) => {
      ctx.fillStyle = hex(PALETTE.dusk);
      ctx.fillRect(0, 0, TILE, TILE);
      // A few darker flecks per tile, so a large floor does not band.
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = shade(PALETTE.dusk, rng() > 0.5 ? 0.06 : -0.12);
        ctx.fillRect(rng() * TILE, rng() * TILE, 1 + rng() * 3, 1 + rng() * 2);
      }
      // Grout along two edges only: drawing all four would double every seam.
      ctx.fillStyle = shade(PALETTE.night, 0.05);
      ctx.fillRect(0, 0, TILE, 1);
      ctx.fillRect(0, 0, 1, TILE);
    });
  }

  paint(scene, WALL_KEY, TILE, TILE, (ctx, rng) => {
    ctx.fillStyle = hex(PALETTE.night);
    ctx.fillRect(0, 0, TILE, TILE);
    ctx.fillStyle = shade(PALETTE.night, 0.16);
    ctx.fillRect(0, 0, TILE, 6);
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = shade(PALETTE.night, 0.08 + rng() * 0.05);
      ctx.fillRect(rng() * TILE, 6 + rng() * (TILE - 8), 3 + rng() * 6, 2);
    }
  });

  // The ellipse every entity stands on. Wider than it is tall, because the
  // camera looks down the scene at a slight angle rather than straight down.
  paint(scene, FX.shadow, 64, 32, (ctx) => {
    const g = ctx.createRadialGradient(32, 16, 2, 32, 16, 30);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(32, 16, 31, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Painted at half the canvas and stretched over it: a vignette is nothing
  // but a smooth gradient, and it costs a quarter of the pixels this way.
  const vw = (VIEW.width * RENDER_SCALE) / 2;
  const vh = (VIEW.height * RENDER_SCALE) / 2;
  paint(scene, FX.vignette, vw, vh, (ctx) => {
    const g = ctx.createRadialGradient(
      vw / 2, vh / 2, Math.min(vw, vh) * 0.35,
      vw / 2, vh / 2, Math.max(vw, vh) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(8,5,12,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
  });
}
