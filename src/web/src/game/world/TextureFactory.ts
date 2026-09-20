/**
 * Procedural painted textures for the world.
 *
 * The team's character art is soft, outlined and painted. Rather than mixing
 * in a pixel-art tile pack, every environment texture is painted at runtime in
 * the same idiom: shaded blobs, dark outlines, speckled fills. Swapping any of
 * these for a drawn asset is a one-line texture-key change in the renderer.
 */

import type Phaser from 'phaser';

import { BIOMES, RENDER_SCALE, TILE, VIEW, type BiomeName } from '../constants';
import {
  TILES_FRAMES, TILES_SIZE, TILES_TEXTURE_KEY,
} from '../animation/tilesAtlas.generated';
import { blob, glow, paint, poly, rgba, shade, speckle, type Ctx } from './paint';
import { paintCritters, paintEnemies, paintProps } from './PropPainter';

export const T = { GRASS: 0, WALL: 1, PATH: 2, STONE: 3, DIRT: 4, WATER: 5 } as const;

export class TextureFactory {
  readonly #built = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Textures that don't depend on biome: props, enemies, fx, pickups, projectiles. */
  ensureCommon(): void {
    if (this.#built.has('common')) return;
    this.#built.add('common');
    paintProps(this.scene);
    paintEnemies(this.scene);
    paintCritters(this.scene);
    this.#paintFx();
    this.#paintPickups();
    this.#paintProjectiles();
    this.#paintDoors();
  }

  ensureBiome(biome: BiomeName): void {
    if (this.#built.has(`biome:${biome}`)) return;
    this.#built.add(`biome:${biome}`);
    // Drawn tiles if the sheet for this biome arrived, painted ones if not.
    // Both produce the same texture keys, so nothing downstream -- the floor
    // composer, the edge fringing, the water ripples -- can tell which it got.
    if (!this.#sliceTiles(biome)) this.#paintTiles(biome);
  }

  /**
   * Cut a biome's drawn tile sheet into the textures the floor asks for.
   *
   * The sheet is twelve tiles already at world scale, so this is a straight
   * copy per tile rather than a resample: `build_tiles.py` did the resampling
   * once, with a good kernel, instead of every client doing it on every load.
   *
   * Returns false when the sheet is not loaded, which is the whole fallback --
   * a biome whose art has not been drawn keeps the painted floor it has always
   * had rather than rendering nothing.
   */
  #sliceTiles(biome: BiomeName): boolean {
    // Indexed defensively: `BiomeName` includes `sandbox`, the violet test
    // room, which has no drawn floor of its own and is meant to fall through.
    const texture = (TILES_TEXTURE_KEY as Partial<Record<BiomeName, string>>)[biome];
    if (!texture || !this.scene.textures.exists(texture)) return false;

    // All twelve or none. Falling back half way would leave some tiles drawn
    // and the painted pass unable to make the rest -- their keys would already
    // be taken -- so a floor that failed at tile seven would render seven
    // drawn tiles and five missing ones rather than twelve painted ones.
    const made: string[] = [];
    for (const frame of TILES_FRAMES) {
      const key = `tile:${biome}:${frame.replace(/(\d)$/, ':$1')}`;
      if (this.scene.textures.exists(key)) continue;
      const canvas = this.scene.textures.createCanvas(key, TILES_SIZE, TILES_SIZE);
      if (!canvas) {
        for (const done of made) this.scene.textures.remove(done);
        return false;
      }
      made.push(key);
      canvas.getContext().imageSmoothingEnabled = false;
      canvas.drawFrame(texture, frame, 0, 0);
      canvas.refresh();
    }
    return true;
  }

  static tileKey(biome: BiomeName, tile: number, variant: number): string {
    switch (tile) {
      case T.WALL: return `tile:${biome}:wall`;
      case T.PATH: return `tile:${biome}:path:${variant % 2}`;
      case T.STONE: return `tile:${biome}:stone:${variant % 3}`;
      case T.DIRT: return `tile:${biome}:dirt:${variant % 2}`;
      case T.WATER: return `tile:${biome}:water`;
      default: return `tile:${biome}:grass:${variant % 3}`;
    }
  }

  // --- tiles -----------------------------------------------------------------

  #paintTiles(biome: BiomeName): void {
    const b = BIOMES[biome];
    const s = TILE;
    for (let v = 0; v < 3; v++) {
      paint(this.scene, `tile:${biome}:grass:${v}`, s, s, (ctx, rng) => {
        ctx.fillStyle = b.grass[v] ?? b.grass[0];
        ctx.fillRect(0, 0, s, s);
        speckle(ctx, rng, s, s, 26, [b.grassDark, b.grassLight, b.grass[(v + 1) % 3] ?? b.grass[0]], 0.8, 2.2, 0.45);
        // a few blades
        ctx.strokeStyle = rgba(b.grassLight, 0.5);
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const x = rng() * s, y = rng() * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rng() - 0.5) * 3, y - 3 - rng() * 3);
          ctx.stroke();
        }
      });
    }
    for (let v = 0; v < 2; v++) {
      paint(this.scene, `tile:${biome}:dirt:${v}`, s, s, (ctx, rng) => {
        // Worn earth: the grass base showing through a soft patch of dirt, so
        // the blotch edges never read as hard tile boundaries.
        ctx.fillStyle = b.grass[0] ?? '#4b7944';
        ctx.fillRect(0, 0, s, s);
        const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s * 0.85);
        g.addColorStop(0, rgba(b.dirt, 0.95));
        g.addColorStop(1, rgba(b.dirt, 0.35));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        speckle(ctx, rng, s, s, 26, [b.dirtLight, shade(b.dirt, 0.8), b.grassDark], 0.7, 2.4, 0.4);
      });
      paint(this.scene, `tile:${biome}:path:${v}`, s, s, (ctx, rng) => {
        ctx.fillStyle = b.path;
        ctx.fillRect(0, 0, s, s);
        speckle(ctx, rng, s, s, 18, [shade(b.path, 1.18), shade(b.path, 0.82)], 0.8, 2.4, 0.5);
        // a couple of flat stepping stones
        for (let i = 0; i < 2; i++) {
          blob(ctx, 6 + rng() * 20, 6 + rng() * 20, 5 + rng() * 4, 3 + rng() * 2, shade(b.path, 1.12),
               { outline: 'rgba(20,14,10,0.25)', highlight: 0.15, shadow: 0.2 });
        }
      });
    }
    for (let v = 0; v < 3; v++) {
      paint(this.scene, `tile:${biome}:stone:${v}`, s, s, (ctx, rng) => {
        ctx.fillStyle = b.stone;
        ctx.fillRect(0, 0, s, s);
        // flagstone grid with irregular grout
        ctx.strokeStyle = shade(b.stone, 0.62);
        ctx.lineWidth = 1.2;
        const split = 10 + Math.floor(rng() * 12);
        ctx.beginPath();
        ctx.moveTo(0, split + (rng() - 0.5) * 2);
        ctx.lineTo(s, split + (rng() - 0.5) * 2);
        ctx.moveTo(split, 0);
        ctx.lineTo(split + (rng() - 0.5) * 2, split);
        ctx.moveTo(s - split, split);
        ctx.lineTo(s - split + (rng() - 0.5) * 2, s);
        ctx.stroke();
        speckle(ctx, rng, s, s, 16, [b.stoneLight, shade(b.stone, 0.85)], 0.6, 1.8, 0.4);
        if (v === 2) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = b.grassDark;  // moss
          ctx.beginPath();
          ctx.ellipse(rng() * s, rng() * s, 5, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });
    }
    paint(this.scene, `tile:${biome}:water`, s, s, (ctx, rng) => {
      ctx.fillStyle = b.water;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = rgba(b.waterLight, 0.55);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) {
        const y = rng() * s;
        ctx.beginPath();
        ctx.moveTo(rng() * 8, y);
        ctx.quadraticCurveTo(s / 2, y - 3 + rng() * 6, s - rng() * 8, y);
        ctx.stroke();
      }
    });
    paint(this.scene, `tile:${biome}:wall`, s, s, (ctx, rng) => {
      ctx.fillStyle = b.wall;
      ctx.fillRect(0, 0, s, s);
      // bricks / hedge texture
      ctx.strokeStyle = shade(b.wall, 0.6);
      ctx.lineWidth = 1.5;
      for (let row = 0; row < 3; row++) {
        const y = row * 11 + 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y);
        ctx.stroke();
        const off = row % 2 ? 8 : 0;
        for (let x = off; x < s; x += 16) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 11);
          ctx.stroke();
        }
      }
      speckle(ctx, rng, s, s, 14, [shade(b.wall, 1.35), shade(b.wall, 0.7)], 0.6, 1.6, 0.4);
      ctx.fillStyle = shade(b.wallTop, 1.0);
      ctx.fillRect(0, 0, s, 5);
      ctx.fillStyle = rgba('#000000', 0.35);
      ctx.fillRect(0, s - 4, s, 4);
    });
  }

  // --- fx ---------------------------------------------------------------------

  #paintFx(): void {
    paint(this.scene, 'fx:soft', 32, 32, (ctx) => glow(ctx, 16, 16, 16));
    paint(this.scene, 'fx:spark', 10, 10, (ctx) => {
      glow(ctx, 5, 5, 5, '#ffffff', 1);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(5, 5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
    paint(this.scene, 'fx:glow', 128, 128, (ctx) => glow(ctx, 64, 64, 64, '#ffd9a0', 0.9));
    paint(this.scene, 'fx:shadow', 64, 32, (ctx) => {
      const g = ctx.createRadialGradient(32, 16, 2, 32, 16, 30);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(32, 16, 31, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    // Two shadows, because one ellipse cannot be both.
    //
    // A real shadow has two parts and they behave differently. Right where a
    // thing meets the ground there is a small, dark, hard-edged contact patch
    // -- that is the bit that makes an object look like it is *standing* on
    // the floor rather than floating an inch above it. Away from that, the
    // cast shadow is longer, much fainter, and soft at the edges.
    //
    // Drawing one mid-grey ellipse for both is what made the trees look stuck
    // on: too dark to read as a cast shadow, too big and too symmetric to read
    // as contact.
    paint(this.scene, 'fx:contact', 64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.34)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    paint(this.scene, 'fx:cast', 128, 64, (ctx) => {
      // Soft the whole way out, and faint: a cast shadow on grass in daylight
      // is a tint, not a hole. The falloff starts immediately so there is no
      // flat core to give away that this is one stretched ellipse.
      const g = ctx.createRadialGradient(64, 32, 2, 64, 32, 62);
      g.addColorStop(0, 'rgba(0,0,0,0.30)');
      g.addColorStop(0.45, 'rgba(0,0,0,0.17)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(64, 32, 63, 31, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    paint(this.scene, 'fx:ring', 96, 96, (ctx) => {
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(48, 48, 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();
    });
    paint(this.scene, 'fx:leaf', 12, 8, (ctx) => {
      poly(ctx, [[1, 4], [5, 0], [11, 3], [7, 8], [3, 7]], '#a8c46a', 'rgba(40,60,20,0.6)');
    });
    paint(this.scene, 'fx:flame', 20, 30, (ctx) => {
      glow(ctx, 10, 18, 10, '#ff9a3c', 0.9);
      poly(ctx, [[10, 2], [15, 12], [16, 21], [10, 28], [4, 21], [5, 12]], '#ffb13d');
      poly(ctx, [[10, 9], [13, 15], [13, 22], [10, 26], [7, 22], [7, 15]], '#fff1a8');
    });
    paint(this.scene, 'fx:slash', 120, 60, (ctx) => {
      ctx.lineCap = 'round';
      for (const [w, a] of [[16, 0.18], [9, 0.45], [4, 0.95]] as const) {
        ctx.lineWidth = w;
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(60, 70, 58, Math.PI * 1.18, Math.PI * 1.82);
        ctx.stroke();
      }
    });
    paint(this.scene, 'fx:vignette', VIEW.width * RENDER_SCALE / 2, VIEW.height * RENDER_SCALE / 2, (ctx) => {
      const w = VIEW.width * RENDER_SCALE / 2, h = VIEW.height * RENDER_SCALE / 2;
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(10,6,16,0)');
      g.addColorStop(1, 'rgba(10,6,16,0.62)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    paint(this.scene, 'fx:firefly', 8, 8, (ctx) => glow(ctx, 4, 4, 4, '#d8ff9a', 1));
    paint(this.scene, 'fx:ember', 8, 8, (ctx) => glow(ctx, 4, 4, 4, '#ff8a4a', 1));
    paint(this.scene, 'fx:afterimage', 8, 8, (ctx) => glow(ctx, 4, 4, 4, '#7c6add', 1));
  }

  // --- pickups ---------------------------------------------------------------------

  #paintPickups(): void {
    paint(this.scene, 'pickup:essence', 22, 22, (ctx) => {
      glow(ctx, 11, 11, 11, '#d66cff', 0.8);
      blob(ctx, 11, 11, 5.5, 5.5, '#c05bff', { outline: 'rgba(60,20,90,0.7)', highlight: 0.6 });
    });
    paint(this.scene, 'pickup:shards', 20, 24, (ctx) => {
      glow(ctx, 10, 12, 10, '#9fe3ff', 0.6);
      poly(ctx, [[10, 1], [16, 9], [13, 22], [7, 22], [4, 9]], '#bfeeff', 'rgba(30,60,90,0.8)');
      poly(ctx, [[10, 1], [13, 22], [10, 20], [8, 9]], 'rgba(255,255,255,0.55)');
    });
    for (const [key, colour] of [['health_potion', '#e04a5a'], ['mana_potion', '#4f8fe6']] as const) {
      paint(this.scene, `pickup:${key}`, 18, 24, (ctx) => {
        // flask
        poly(ctx, [[7, 3], [11, 3], [11, 8], [16, 15], [15, 22], [3, 22], [2, 15], [7, 8]], shade(colour, 0.9), 'rgba(20,10,20,0.75)');
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(5, 12, 2, 7);
        ctx.fillStyle = '#c9a27a';
        ctx.fillRect(6, 1, 6, 3);
        glow(ctx, 9, 16, 6, colour, 0.35);
      });
    }
    paint(this.scene, 'pickup:weapon', 28, 28, (ctx) => {
      glow(ctx, 14, 14, 14, '#f0c060', 0.7);
      ctx.save();
      ctx.translate(14, 14);
      ctx.rotate(-Math.PI / 4);
      poly(ctx, [[-2, -12], [2, -12], [1.5, 6], [-1.5, 6]], '#e9e2d8', 'rgba(30,20,20,0.7)');
      ctx.fillStyle = '#b08040';
      ctx.fillRect(-6, 5, 12, 3);
      ctx.fillRect(-1.5, 8, 3, 6);
      ctx.restore();
    });
    paint(this.scene, 'pickup:relic', 24, 24, (ctx) => {
      glow(ctx, 12, 12, 12, '#ffd27a', 0.7);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f0c060';
      ctx.beginPath();
      ctx.arc(12, 12, 7, 0, Math.PI * 2);
      ctx.stroke();
      blob(ctx, 12, 12, 3, 3, '#d62e6c', { highlight: 0.6 });
    });
  }

  // --- projectiles ---------------------------------------------------------------------

  #paintProjectiles(): void {
    const arrow = (key: string, shaft: string, head: string) =>
      paint(this.scene, key, 30, 8, (ctx) => {
        ctx.fillStyle = shaft;
        ctx.fillRect(2, 3, 20, 2);
        poly(ctx, [[22, 0.5], [30, 4], [22, 7.5]], head, 'rgba(20,15,15,0.6)');
        poly(ctx, [[0, 1], [6, 4], [0, 7], [2, 4]], '#d0c8b8');
      });
    arrow('proj:arrow', '#c9a27a', '#e8e4dc');
    arrow('proj:bone_arrow', '#d8d2c2', '#9a8a7a');
    const bolt = (key: string, colour: string, core: string, r = 12) =>
      paint(this.scene, key, r * 2 + 4, r * 2 + 4, (ctx) => {
        glow(ctx, r + 2, r + 2, r + 2, colour, 0.95);
        blob(ctx, r + 2, r + 2, r * 0.45, r * 0.45, core, { outline: 'rgba(255,255,255,0.4)', highlight: 0.8 });
      });
    bolt('proj:fire_bolt', '#ff7a3d', '#fff0b0', 13);
    bolt('proj:ice_bolt', '#9fe3ff', '#ffffff', 10);
    bolt('proj:arcane_bolt', '#b48cff', '#ffffff', 11);
    bolt('proj:mirror_bolt', '#d62e6c', '#ffe6f0', 11);
  }

  // --- doors ----------------------------------------------------------------------------

  #paintDoors(): void {
    const w = TILE * 3, h = TILE * 1.4;
    paint(this.scene, 'door:gate_closed', w, h, (ctx) => {
      ctx.fillStyle = '#2a2230';
      ctx.fillRect(0, 0, w, h);
      // iron bars
      for (let x = 8; x < w; x += 12) {
        ctx.fillStyle = '#7a7180';
        ctx.fillRect(x, 4, 4, h - 8);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x, 4, 1, h - 8);
      }
      ctx.fillStyle = '#5a5060';
      ctx.fillRect(0, h * 0.35, w, 4);
      ctx.fillRect(0, h * 0.7, w, 4);
      // posts
      blob(ctx, 5, h / 2, 6, h / 2, '#6f6a76', { rotation: 0 });
      blob(ctx, w - 5, h / 2, 6, h / 2, '#6f6a76');
    });
    paint(this.scene, 'door:gate_open', w, h, (ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,0)';
      // open: just the two posts and a faint glow between them
      glow(ctx, w / 2, h / 2, w / 2, '#f0c060', 0.35);
      blob(ctx, 5, h / 2, 6, h / 2, '#6f6a76');
      blob(ctx, w - 5, h / 2, 6, h / 2, '#6f6a76');
      // gate swung open, drawn flat against the posts
      ctx.fillStyle = '#7a7180';
      ctx.fillRect(9, 2, 4, h * 0.45);
      ctx.fillRect(w - 13, 2, 4, h * 0.45);
    });
    paint(this.scene, 'door:arch', w, h, (ctx) => {
      glow(ctx, w / 2, h / 2, w / 2, '#a0cae4', 0.22);
      blob(ctx, 5, h / 2, 6, h / 2, '#6f6a76');
      blob(ctx, w - 5, h / 2, 6, h / 2, '#6f6a76');
    });
    paint(this.scene, 'door:sealed', w, h, (ctx) => {
      ctx.fillStyle = '#231c2b';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, seededFromKey('door:sealed'), w, h, 20, ['#3a3044', '#171220'], 1, 3, 0.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(214,46,108,0.7)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

function seededFromKey(key: string): () => number {
  let a = 0;
  for (const c of key) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type { Ctx };
