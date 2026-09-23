/**
 * Small Canvas2D painting toolkit shared by the texture painters.
 *
 * Everything procedural is seeded, so a texture variant always looks the same
 * across reloads and across players.
 */

import Phaser from 'phaser';

export type Ctx = CanvasRenderingContext2D;

/** mulberry32: tiny, fast, good enough for art noise. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Parse '#rrggbb', 'rgb(r,g,b)' or 'rgba(r,g,b,a)' into channels. */
export function parseColour(css: string): { r: number; g: number; b: number } {
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(css);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  const c = Phaser.Display.Color.HexStringToColor(css);
  return { r: c.red, g: c.green, b: c.blue };
}

/** Shade a CSS colour by a multiplier (1 = same, <1 darker, >1 lighter). Nests safely. */
export function shade(css: string, mult: number): string {
  const c = parseColour(css);
  const r = Math.max(0, Math.min(255, Math.round(c.r * mult)));
  const g = Math.max(0, Math.min(255, Math.round(c.g * mult)));
  const b = Math.max(0, Math.min(255, Math.round(c.b * mult)));
  return `rgb(${r},${g},${b})`;
}

export function rgba(css: string, alpha: number): string {
  const c = parseColour(css);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/** Scatter soft speckles: the cheapest way to make a flat fill read as painted. */
export function speckle(ctx: Ctx, rng: () => number, w: number, h: number, count: number,
                        colours: string[], minR = 0.6, maxR = 1.8, alpha = 0.5): void {
  for (let i = 0; i < count; i++) {
    const colour = colours[Math.floor(rng() * colours.length)] ?? colours[0] ?? '#000';
    ctx.globalAlpha = alpha * (0.5 + rng() * 0.5);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(rng() * w, rng() * h, minR + rng() * (maxR - minR), minR + rng() * (maxR - minR), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A shaded blob: base fill, darker lower half, highlight top-left, soft outline. */
export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, base: string,
                     opts: { outline?: string; highlight?: number; shadow?: number; rotation?: number } = {}): void {
  const { outline = 'rgba(15,10,20,0.55)', highlight = 0.35, shadow = 0.3, rotation = 0 } = opts;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  const grad = ctx.createRadialGradient(-rx * 0.35, -ry * 0.4, Math.min(rx, ry) * 0.1, 0, 0, Math.max(rx, ry) * 1.1);
  grad.addColorStop(0, shade(base, 1 + highlight));
  grad.addColorStop(0.55, base);
  grad.addColorStop(1, shade(base, 1 - shadow));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.restore();
}

/** Soft radial glow (white by default) with alpha fading to zero. */
export function glow(ctx: Ctx, cx: number, cy: number, r: number, colour = '#ffffff', alpha = 1): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, rgba(colour, alpha));
  grad.addColorStop(0.45, rgba(colour, alpha * 0.45));
  grad.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

export function outlinePath(ctx: Ctx, colour = 'rgba(15,10,20,0.6)', width = 1.5): void {
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function poly(ctx: Ctx, points: number[][], fill: string, outline?: string): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x ?? 0, y ?? 0) : ctx.lineTo(x ?? 0, y ?? 0)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) outlinePath(ctx, outline);
}

/**
 * Create (once) a CanvasTexture and paint into it.
 * Returns false if the key already existed (so callers can skip work).
 */
export function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, rng: () => number) => void): boolean {
  if (scene.textures.exists(key)) return false;
  const texture = scene.textures.createCanvas(key, Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  if (!texture) return false;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = true;
  draw(ctx, seeded(hashString(key)));
  texture.refresh();
  return true;
}
