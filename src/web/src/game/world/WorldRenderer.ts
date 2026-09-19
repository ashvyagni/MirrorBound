/**
 * Draws a room: floor tiles, walls, decor with shadows and sway, torches with
 * fire and light, water ripples, doors that reflect their lock state.
 *
 * Everything static is built once per room; only doors and torch lights are
 * touched afterwards.
 */

import Phaser from 'phaser';

import { BIOMES, DEPTH, TILE, type BiomeName } from '../constants';
import type { DecorSnap, DoorSnap, RoomFull } from '../contracts';
import type { Quality } from '../../ui/settings';
import { T, TextureFactory } from './TextureFactory';

/**
 * Key of the composed floor texture for a room.
 *
 * Exported because the minimap draws this same texture rather than painting a
 * second, worse copy of the room -- the whole floor is already one image, so
 * the map is that image scaled into the ring.
 */
export function floorTextureKey(roomId: string, seed: number): string {
  return `floor:${roomId}:${seed}`;
}

const SWAY_KINDS = new Set(['grass_tuft', 'flowers', 'bush', 'mushrooms']);
const TREE_KINDS = new Set(['tree', 'tree_big']);
const VARIANTS: Record<string, number> = {
  tree: 3, tree_big: 2, bush: 3, rock: 3, rock_big: 2, log: 1, flowers: 4, grass_tuft: 3, mushrooms: 2,
  pillar: 2, broken_pillar: 2, crate: 2, chest: 1, statue: 1, rubble: 3, bones: 2, gravestone: 3,
  brazier: 1, candles: 2, torch: 2, well: 1,
};

export interface TorchLight { x: number; y: number }

export class WorldRenderer {
  #objects: Phaser.GameObjects.GameObject[] = [];
  #tweens: Phaser.Tweens.Tween[] = [];
  #doorSprites = new Map<string, Phaser.GameObjects.Image>();
  #doorGlows = new Map<string, Phaser.GameObjects.Image>();
  #emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  room: RoomFull | null = null;
  torches: TorchLight[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly textures: TextureFactory, private quality: Quality) {}

  setQuality(quality: Quality): void {
    this.quality = quality;
  }

  build(room: RoomFull): void {
    this.destroy();
    this.room = room;
    const biome = (room.biome in BIOMES ? room.biome : 'grove') as BiomeName;
    this.textures.ensureCommon();
    this.textures.ensureBiome(biome);
    this.scene.cameras.main.setBackgroundColor(BIOMES[biome].fog);

    this.#buildFloor(room, biome);
    this.#buildDecor(room, biome);
    this.#buildDoors(room);
  }

  // --- floor -------------------------------------------------------------------

  #buildFloor(room: RoomFull, biome: BiomeName): void {
    const rows = room.tiles.length;
    const cols = room.tiles[0]?.length ?? 0;
    const seed = room.seed;
    // The whole floor is composed once into a single canvas texture: one draw
    // call per frame instead of ~1800 tile sprites, and no dependence on the
    // RenderTexture API, which changed between Phaser 3 and 4.
    const floorKey = floorTextureKey(room.id, seed);
    if (this.scene.textures.exists(floorKey)) this.scene.textures.remove(floorKey);
    const canvas = this.scene.textures.createCanvas(floorKey, room.width, room.height);
    if (canvas) {
      for (let y = 0; y < rows; y++) {
        const row = room.tiles[y];
        if (!row) continue;
        for (let x = 0; x < cols; x++) {
          const tile = row[x] ?? T.GRASS;
          const variant = ((x * 7 + y * 13 + seed) >>> 0) % 3;
          canvas.drawFrame(TextureFactory.tileKey(biome, tile, variant), undefined, x * TILE, y * TILE, false);
        }
      }
      canvas.refresh();
      const floor = this.scene.add.image(0, 0, floorKey).setOrigin(0, 0).setDepth(DEPTH.floor);
      this.#objects.push(floor);
    }

    // Soft edge shadow inside the walls: gives the floor depth against the border.
    const edge = this.scene.add.graphics().setDepth(DEPTH.floorDecal);
    edge.fillStyle(0x000000, 0.28);
    edge.fillRect(TILE, TILE, room.width - TILE * 2, 8);
    edge.fillStyle(0x000000, 0.14);
    edge.fillRect(TILE, TILE, 8, room.height - TILE * 2);
    edge.fillRect(room.width - TILE - 8, TILE, 8, room.height - TILE * 2);
    this.#objects.push(edge);

    // Water ripples over pond tiles.
    if (this.quality !== 'low') {
      for (let y = 0; y < rows; y++) {
        const row = room.tiles[y];
        if (!row) continue;
        for (let x = 0; x < cols; x++) {
          if (row[x] === T.WATER && ((x + y) % 3 === 0)) {
            const ring = this.scene.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, 'fx:ring')
              .setDepth(DEPTH.water).setScale(0.1).setAlpha(0).setTint(0xbfe6ff);
            this.#objects.push(ring);
            this.#tweens.push(this.scene.tweens.add({
              targets: ring, scale: 0.42, alpha: { from: 0.35, to: 0 }, duration: 2600 + ((x * 31 + y * 17) % 900),
              delay: (x * 53 + y * 29) % 2000, repeat: -1, ease: 'Sine.easeOut',
            }));
          }
        }
      }
    }
  }

  // --- decor ---------------------------------------------------------------------

  #textureFor(d: DecorSnap): string | null {
    const variants = VARIANTS[d.kind];
    if (variants === undefined) return null;
    const key = `prop:${d.kind}:${d.variant % variants}`;
    return this.scene.textures.exists(key) ? key : null;
  }

  #buildDecor(room: RoomFull, biome: BiomeName): void {
    this.torches = [];
    const ambient = BIOMES[biome];
    for (const d of room.decor) {
      if (d.kind === 'pond') continue; // water is drawn by tiles
      if (d.kind === 'torch') {
        this.#buildTorch(d);
        continue;
      }
      const key = this.#textureFor(d);
      if (!key) continue;
      const img = this.scene.add.image(d.x, d.y, key).setOrigin(0.5, 1).setScale(d.scale).setFlipX(d.flip);
      img.setDepth(DEPTH.entityBase + d.y * 0.01);
      this.#objects.push(img);

      if (d.blocking && d.radius > 0) {
        const shadow = this.scene.add.image(d.x, d.y - 2, 'fx:shadow').setDepth(DEPTH.shadow)
          .setScale((d.radius * 2.6) / 64, (d.radius * 1.5) / 32).setAlpha(0.8);
        this.#objects.push(shadow);
      }
      if (this.quality === 'low') continue;
      if (SWAY_KINDS.has(d.kind)) {
        const seed = (d.x * 3 + d.y * 7) % 1000;
        img.setOrigin(0.5, 1);
        this.#tweens.push(this.scene.tweens.add({
          targets: img, angle: { from: -3.5, to: 3.5 }, duration: 1600 + seed, delay: seed, yoyo: true, repeat: -1,
          ease: 'Sine.easeInOut',
        }));
      } else if (TREE_KINDS.has(d.kind)) {
        const seed = (d.x * 5 + d.y * 3) % 1400;
        this.#tweens.push(this.scene.tweens.add({
          targets: img, scaleX: { from: d.scale * (d.flip ? -0.985 : 0.985), to: d.scale * (d.flip ? -1.015 : 1.015) },
          angle: { from: -0.8, to: 0.8 }, duration: 2600 + seed, delay: seed, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        }));
        img.setFlipX(false);
        img.setScale(d.scale * (d.flip ? -1 : 1), d.scale);
      } else if (d.kind === 'brazier' || d.kind === 'candles') {
        this.torches.push({ x: d.x, y: d.y - (d.kind === 'brazier' ? 40 : 10) });
        this.#fire(d.x, d.y - (d.kind === 'brazier' ? 40 : 8), d.kind === 'brazier' ? 1 : 0.45, ambient.fog);
      }
    }
  }

  #buildTorch(d: DecorSnap): void {
    const key = `prop:torch:${d.variant % 2}`;
    const img = this.scene.add.image(d.x, d.y, key).setOrigin(0.5, 1).setDepth(DEPTH.entityBase + d.y * 0.01);
    this.#objects.push(img);
    this.torches.push({ x: d.x, y: d.y - 34 });
    this.#fire(d.x, d.y - 34, 0.9, 0);
  }

  #fire(x: number, y: number, scale: number, _fog: number): void {
    const flame = this.scene.add.image(x, y, 'fx:flame').setOrigin(0.5, 0.85).setScale(scale).setDepth(DEPTH.fxLow)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.#objects.push(flame);
    this.#tweens.push(this.scene.tweens.add({
      targets: flame, scaleX: { from: scale * 0.85, to: scale * 1.1 }, scaleY: { from: scale * 0.9, to: scale * 1.18 },
      alpha: { from: 0.75, to: 1 }, duration: 160 + ((x + y) % 90), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    const light = this.scene.add.image(x, y + 10, 'fx:glow').setScale(1.4 * scale, 1.0 * scale).setAlpha(0.32)
      .setDepth(DEPTH.floorDecal + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.#objects.push(light);
    this.#tweens.push(this.scene.tweens.add({
      targets: light, alpha: { from: 0.24, to: 0.4 }, scale: { from: 1.25 * scale, to: 1.5 * scale },
      duration: 900 + ((x * 3 + y) % 500), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    }));
    if (this.quality === 'high') {
      const emitter = this.scene.add.particles(x, y - 6, 'fx:spark', {
        lifespan: { min: 500, max: 1100 }, speedY: { min: -40, max: -18 }, speedX: { min: -8, max: 8 },
        scale: { start: 0.35 * scale, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xffb13d, 0xff7a3d],
        frequency: 220, quantity: 1, blendMode: 'ADD',
      }).setDepth(DEPTH.fxLow + 1);
      this.#emitters.push(emitter);
    }
  }

  // --- doors ------------------------------------------------------------------------

  #buildDoors(room: RoomFull): void {
    this.#doorSprites.clear();
    this.#doorGlows.clear();
    for (const door of room.doors) {
      const key = this.#doorTexture(door);
      const img = this.scene.add.image(door.x, door.y + (door.side === 'north' ? 6 : -4), key)
        .setDepth(door.side === 'north' ? DEPTH.floorDecal + 2 : DEPTH.entityBase + door.y * 0.01);
      if (door.side === 'south') img.setFlipY(true);
      this.#objects.push(img);
      this.#doorSprites.set(door.side, img);
      const glowImg = this.scene.add.image(door.x, door.y + (door.side === 'north' ? 18 : -18), 'fx:glow')
        .setScale(1.6, 0.9).setAlpha(0).setDepth(DEPTH.floorDecal + 1).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(door.kind === 'arch' ? 0xa0cae4 : 0xf0c060);
      this.#objects.push(glowImg);
      this.#doorGlows.set(door.side, glowImg);
    }
    this.updateDoors(room.doors);
  }

  #doorTexture(door: DoorSnap): string {
    if (door.targetIndex === null) return 'door:sealed';
    if (door.kind === 'arch') return 'door:arch';
    return door.locked ? 'door:gate_closed' : 'door:gate_open';
  }

  updateDoors(doors: DoorSnap[]): void {
    for (const door of doors) {
      const img = this.#doorSprites.get(door.side);
      const glowImg = this.#doorGlows.get(door.side);
      if (!img || !glowImg) continue;
      const key = this.#doorTexture(door);
      if (img.texture.key !== key) {
        img.setTexture(key);
        if (key === 'door:gate_open') {
          this.scene.tweens.add({ targets: glowImg, alpha: { from: 0, to: 0.5 }, duration: 900, ease: 'Sine.easeOut' });
          this.scene.tweens.add({ targets: glowImg, scaleX: { from: 1.6, to: 1.9 }, duration: 1400, yoyo: true, repeat: -1 });
        }
      }
      const open = door.targetIndex !== null && !door.locked;
      if (open && glowImg.alpha === 0 && !this.scene.tweens.isTweening(glowImg)) glowImg.setAlpha(0.35);
      if (!open) glowImg.setAlpha(0);
    }
  }

  destroy(): void {
    for (const t of this.#tweens) t.stop();
    this.#tweens = [];
    for (const e of this.#emitters) e.destroy();
    this.#emitters = [];
    for (const o of this.#objects) o.destroy();
    this.#objects = [];
    this.#doorSprites.clear();
    this.#doorGlows.clear();
    this.room = null;
    this.torches = [];
  }
}
