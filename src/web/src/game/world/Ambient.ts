/**
 * Environmental life: drifting motes, fireflies or embers by biome, falling
 * leaves, the occasional bird crossing the room, and a few ground critters
 * running a tiny IDLE -> WANDER -> PAUSE -> WANDER state machine that flees
 * from the player. None of it touches gameplay; all of it is cheap.
 */

import Phaser from 'phaser';

import { BIOMES, DEPTH, TILE, type BiomeName } from '../constants';
import type { RoomFull, Vec2 } from '../contracts';
import type { Quality } from '../../ui/settings';

type CritterState = 'idle' | 'wander' | 'pause' | 'flee';

interface Critter {
  sprite: Phaser.GameObjects.Image;
  kind: 'squirrel' | 'rabbit' | 'frog';
  state: CritterState;
  timer: number;
  target: Vec2;
  speed: number;
  frame: number;
  frameTimer: number;
}

interface Bird {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  frameTimer: number;
  frame: number;
  life: number;
}

export class Ambient {
  #emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  #critters: Critter[] = [];
  #birds: Bird[] = [];
  #objects: Phaser.GameObjects.GameObject[] = [];
  #room: RoomFull | null = null;
  #birdTimer = 6;
  #rng = Math.random;

  constructor(private readonly scene: Phaser.Scene, private quality: Quality) {}

  setQuality(quality: Quality): void {
    this.quality = quality;
    if (this.#room) this.build(this.#room);
  }

  build(room: RoomFull): void {
    this.destroy();
    this.#room = room;
    const biome = (room.biome in BIOMES ? room.biome : 'grove') as BiomeName;
    const b = BIOMES[biome];
    const area = new Phaser.Geom.Rectangle(TILE, TILE, room.width - TILE * 2, room.height - TILE * 2);
    const density = this.quality === 'high' ? 1 : this.quality === 'medium' ? 0.5 : 0;
    if (density === 0) return;

    // Rectangle implements getRandomPoint; Phaser 4's typing of the callback is
    // narrower than the runtime contract, hence the cast.
    const zone = (source: Phaser.Geom.Rectangle): Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig =>
      ({ type: 'random', source: source as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource });

    // Dust motes everywhere.
    this.#emitters.push(this.scene.add.particles(0, 0, 'fx:soft', {
      emitZone: zone(area),
      lifespan: { min: 5000, max: 9000 }, speedX: { min: -6, max: 6 }, speedY: { min: -10, max: -3 },
      scale: { start: 0.08, end: 0.16 }, alpha: { start: 0.22, end: 0 },
      frequency: 260 / density, quantity: 1, blendMode: 'ADD', tint: 0xfff3dd,
    }).setDepth(DEPTH.weather));

    if (b.ambient === 'fireflies') {
      this.#emitters.push(this.scene.add.particles(0, 0, 'fx:firefly', {
        emitZone: zone(area),
        lifespan: { min: 3000, max: 6000 }, speedX: { min: -14, max: 14 }, speedY: { min: -12, max: 8 },
        scale: { start: 0.5, end: 0.2 }, alpha: { start: 0.9, end: 0 },
        frequency: 420 / density, quantity: 1, blendMode: 'ADD',
      }).setDepth(DEPTH.weather));
      // Leaves from the canopy.
      this.#emitters.push(this.scene.add.particles(0, 0, 'fx:leaf', {
        emitZone: zone(new Phaser.Geom.Rectangle(TILE, TILE, room.width - TILE * 2, 40)),
        lifespan: { min: 6000, max: 9000 }, speedX: { min: -20, max: 25 }, speedY: { min: 18, max: 34 },
        rotate: { start: 0, end: 360 }, scale: { start: 0.9, end: 0.7 }, alpha: { start: 0.9, end: 0 },
        frequency: 1400 / density, quantity: 1, tint: [0xa8c46a, 0xc9a25a, 0x7fa85a],
      }).setDepth(DEPTH.weather));
    } else if (b.ambient === 'embers') {
      this.#emitters.push(this.scene.add.particles(0, 0, 'fx:ember', {
        emitZone: zone(area),
        lifespan: { min: 2500, max: 5000 }, speedX: { min: -10, max: 10 }, speedY: { min: -28, max: -10 },
        scale: { start: 0.45, end: 0 }, alpha: { start: 0.9, end: 0 },
        frequency: 380 / density, quantity: 1, blendMode: 'ADD',
      }).setDepth(DEPTH.weather));
    }

    // Ground critters: grove gets squirrels and rabbits, ruins rabbits, crypt nothing but a frog.
    const kinds: Critter['kind'][] = biome === 'grove' ? ['squirrel', 'rabbit', 'squirrel', 'frog']
      : biome === 'ruins' ? ['rabbit', 'squirrel'] : ['frog'];
    const count = Math.round(kinds.length * density);
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length] ?? 'rabbit';
      const pos = this.#freeSpot();
      const sprite = this.scene.add.image(pos.x, pos.y, `critter:${kind}:0`).setOrigin(0.5, 1)
        .setDepth(DEPTH.entityBase + pos.y * 0.01);
      this.#objects.push(sprite);
      this.#critters.push({
        sprite, kind, state: 'idle', timer: 1 + this.#rng() * 3, target: pos,
        speed: kind === 'frog' ? 40 : kind === 'rabbit' ? 95 : 120, frame: 0, frameTimer: 0,
      });
    }
    this.#birdTimer = 4 + this.#rng() * 8;
  }

  #freeSpot(): Vec2 {
    const room = this.#room;
    if (!room) return { x: 0, y: 0 };
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = TILE * 1.5 + this.#rng() * (room.width - TILE * 3);
      const y = TILE * 1.5 + this.#rng() * (room.height - TILE * 3);
      const blocked = room.decor.some((d) => d.blocking && Math.hypot(d.x - x, d.y - y) < d.radius + 10);
      if (!blocked) return { x, y };
    }
    return { x: room.width / 2, y: room.height / 2 };
  }

  update(dt: number, player: Vec2 | null): void {
    const room = this.#room;
    if (!room) return;
    for (const c of this.#critters) this.#updateCritter(dt, c, player);

    if (this.quality !== 'low') {
      this.#birdTimer -= dt;
      if (this.#birdTimer <= 0) {
        this.#birdTimer = 10 + this.#rng() * 16;
        this.#spawnBird(room);
      }
    }
    for (const bird of this.#birds) {
      bird.life -= dt;
      bird.sprite.x += bird.vx * dt;
      bird.sprite.y += bird.vy * dt + Math.sin(bird.life * 6) * 0.4;
      bird.frameTimer += dt;
      if (bird.frameTimer > 0.12) {
        bird.frameTimer = 0;
        bird.frame = 1 - bird.frame;
        bird.sprite.setTexture(`critter:bird:${bird.frame}`);
      }
    }
    this.#birds = this.#birds.filter((b) => {
      if (b.life <= 0) {
        b.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  #spawnBird(room: RoomFull): void {
    const fromLeft = this.#rng() < 0.5;
    const y = TILE * 2 + this.#rng() * (room.height * 0.5);
    const sprite = this.scene.add.image(fromLeft ? -20 : room.width + 20, y, 'critter:bird:0')
      .setDepth(DEPTH.fxHigh).setFlipX(!fromLeft).setScale(0.9).setAlpha(0.9);
    this.#objects.push(sprite);
    const speed = 110 + this.#rng() * 60;
    this.#birds.push({
      sprite, vx: fromLeft ? speed : -speed, vy: -6 + this.#rng() * 12, frameTimer: 0, frame: 0,
      life: (room.width + 60) / speed,
    });
  }

  #updateCritter(dt: number, c: Critter, player: Vec2 | null): void {
    const room = this.#room;
    if (!room) return;
    c.timer -= dt;
    // Flee when the player comes close.
    if (player && c.state !== 'flee') {
      const d = Math.hypot(player.x - c.sprite.x, player.y - c.sprite.y);
      if (d < 85) {
        const away = Math.atan2(c.sprite.y - player.y, c.sprite.x - player.x) + (this.#rng() - 0.5) * 0.8;
        c.target = this.#clamp({ x: c.sprite.x + Math.cos(away) * 160, y: c.sprite.y + Math.sin(away) * 160 });
        c.state = 'flee';
        c.timer = 1.6;
      }
    }
    switch (c.state) {
      case 'idle':
        if (c.timer <= 0) {
          c.target = this.#clamp({ x: c.sprite.x + (this.#rng() - 0.5) * 180, y: c.sprite.y + (this.#rng() - 0.5) * 120 });
          c.state = 'wander';
          c.timer = 4;
        }
        break;
      case 'wander':
      case 'flee': {
        const dx = c.target.x - c.sprite.x;
        const dy = c.target.y - c.sprite.y;
        const dist = Math.hypot(dx, dy);
        const speed = c.state === 'flee' ? c.speed * 1.8 : c.speed;
        if (dist < 4 || c.timer <= 0) {
          c.state = 'pause';
          c.timer = 0.6 + this.#rng() * 2.4;
          c.sprite.setTexture(`critter:${c.kind}:0`);
        } else {
          const step = Math.min(dist, speed * dt);
          c.sprite.x += (dx / dist) * step;
          c.sprite.y += (dy / dist) * step;
          c.sprite.setFlipX(dx < 0);
          c.sprite.setDepth(DEPTH.entityBase + c.sprite.y * 0.01);
          c.frameTimer += dt;
          if (c.frameTimer > (c.kind === 'frog' ? 0.25 : 0.11)) {
            c.frameTimer = 0;
            c.frame = 1 - c.frame;
            c.sprite.setTexture(`critter:${c.kind}:${c.kind === 'frog' ? 0 : c.frame}`);
            if (c.kind === 'frog') c.sprite.y -= 3; // hop
          }
        }
        break;
      }
      case 'pause':
        if (c.timer <= 0) {
          c.state = 'idle';
          c.timer = 0.5 + this.#rng() * 2.5;
        }
        break;
    }
  }

  #clamp(p: Vec2): Vec2 {
    const room = this.#room;
    if (!room) return p;
    return {
      x: Math.max(TILE * 1.5, Math.min(room.width - TILE * 1.5, p.x)),
      y: Math.max(TILE * 1.5, Math.min(room.height - TILE * 1.5, p.y)),
    };
  }

  destroy(): void {
    for (const e of this.#emitters) e.destroy();
    this.#emitters = [];
    for (const o of this.#objects) o.destroy();
    this.#objects = [];
    this.#critters = [];
    this.#birds = [];
    this.#room = null;
  }
}
