/**
 * Draws a room: floor tiles, walls, decor with shadows and sway, torches with
 * fire and light, water ripples, doors that reflect their lock state.
 *
 * Everything static is built once per room; only doors and torch lights are
 * touched afterwards.
 */

import Phaser from 'phaser';

import { DIALOGUE_TEXTURE_KEY } from '../animation/dialogueAtlas.generated';
import { DOORS_TEXTURE_KEY } from '../animation/doorsAtlas.generated';
import { BIOMES, DEPTH, HUD, LIGHT_ANGLE, PIXEL_FONT, TILE, type BiomeName } from '../constants';
import { CHEST_TEXTURE_KEY } from '../animation/chestAtlas.generated';
import { featherEdges, mottle, tileVariant } from './floor';
import { CHEST_OPEN_KEY, isPerson, propArt, propArtSide } from './propArt';
import type { DecorSnap, DoorSnap, RoomFull } from '../contracts';
import type { Quality } from '../../ui/settings';
import { T, TextureFactory } from './TextureFactory';

const SWAY_KINDS = new Set(['grass_tuft', 'flowers', 'bush', 'mushrooms']);
const TREE_KINDS = new Set(['tree', 'tree_big']);

/** Lying on the floor already; a flat thing casts nothing worth drawing. */
const FLAT_KINDS: ReadonlySet<string> = new Set([
  'flowers', 'grass_tuft', 'rubble', 'bones', 'pond', 'torch', 'candles',
]);

/** How close the player has to be before anyone turns to look, in world units. */
const FACE_RANGE = 260;
/** Directly in front counts as face-on, so nobody flickers as you walk past. */
const FACE_DEADZONE = 26;
const VARIANTS: Record<string, number> = {
  tree: 3, tree_big: 2, bush: 3, rock: 3, rock_big: 2, log: 1, flowers: 4, grass_tuft: 3, mushrooms: 2,
  pillar: 2, broken_pillar: 2, crate: 2, chest: 1, statue: 1, rubble: 3, bones: 2, gravestone: 3,
  brazier: 1, candles: 2, torch: 2, well: 1,
  // Villages: people and the buildings they live in.
  npc_elder: 1, npc_smith: 1, npc_apothecary: 1, hearth: 1,
  hut: 3, hut_big: 1, forge: 1, stall: 1, banner: 1,
};

export interface TorchLight { x: number; y: number }

/** Somebody standing in a village, and which way they are drawn. */
interface Person {
  image: Phaser.GameObjects.Image;
  x: number;
  kind: string;
  variant: number;
  /** The server's per-instance size jitter, reapplied on every turn. */
  scale: number;
  /** -1 left, 0 toward the viewer, 1 right. Redrawn only when it changes. */
  facing: -1 | 0 | 1;
}

export class WorldRenderer {
  #objects: Phaser.GameObjects.GameObject[] = [];
  #tweens: Phaser.Tweens.Tween[] = [];
  #doorSprites = new Map<string, Phaser.GameObjects.Image>();
  #doorGlows = new Map<string, Phaser.GameObjects.Image>();
  #emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  room: RoomFull | null = null;
  torches: TorchLight[] = [];
  /** Villagers and shopkeepers, so they can turn toward the player. */
  people: Person[] = [];
  /** Chests in this room, so the server can tell one to open. */
  #chests: Phaser.GameObjects.Sprite[] = [];

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
    this.#buildPortals(room);
  }

  // --- floor -------------------------------------------------------------------

  #buildFloor(room: RoomFull, biome: BiomeName): void {
    const rows = room.tiles.length;
    const cols = room.tiles[0]?.length ?? 0;
    const seed = room.seed;
    // The whole floor is composed once into a single canvas texture: one draw
    // call per frame instead of ~1800 tile sprites, and no dependence on the
    // RenderTexture API, which changed between Phaser 3 and 4.
    const floorKey = `floor:${room.id}:${seed}`;
    if (this.scene.textures.exists(floorKey)) this.scene.textures.remove(floorKey);
    const canvas = this.scene.textures.createCanvas(floorKey, room.width, room.height);
    if (canvas) {
      // Three passes, and the order is the whole point: the tiles are laid
      // down, the seams between different materials are broken up, and only
      // then is the light varied over the lot -- so the mottling falls across
      // a boundary rather than stopping at one.
      for (let y = 0; y < rows; y++) {
        const row = room.tiles[y];
        if (!row) continue;
        for (let x = 0; x < cols; x++) {
          const tile = row[x] ?? T.GRASS;
          canvas.drawFrame(TextureFactory.tileKey(biome, tile, tileVariant(x, y, seed)),
                           undefined, x * TILE, y * TILE, false);
        }
      }
      const ctx = canvas.context;
      featherEdges(ctx, room.tiles, biome, seed);
      mottle(ctx, room.width, room.height, biome, seed);
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

  /**
   * The drawn sheet for a prop, or the painted stand-in, or nothing.
   *
   * Drawn art first: `propArt` covers every decor kind the server places, the
   * village buildings and the people included -- and those two had no texture
   * at all before, so `VARIANTS` returned undefined and the whole village was
   * skipped silently. The painted fallback still catches anything the sheets
   * have never seen, which is what keeps a new decor kind on the server
   * rendering as *something*.
   */
  #artFor(d: DecorSnap): { texture: string; frame?: string; height?: number } | null {
    const drawn = propArt(d.kind, d.variant);
    if (drawn && this.scene.textures.exists(drawn.texture)) return drawn;

    const variants = VARIANTS[d.kind];
    if (variants === undefined) return null;
    const key = `prop:${d.kind}:${d.variant % variants}`;
    // The painted textures were drawn at their world size already, so they
    // need no height: the canvas IS the size.
    return this.scene.textures.exists(key) ? { texture: key } : null;
  }

  /**
   * Scale a prop to the size it is meant to be in the world.
   *
   * Measured off the frame in hand rather than the sheet's shared box. These
   * are single static frames, so there is no animation to breathe, and the
   * trimmed height is exactly the drawn art -- whereas the shared box is the
   * union of a tree and a bush on the same sheet and would size both wrong.
   */
  static #fit(img: Phaser.GameObjects.Image, height: number | undefined, scale: number): void {
    if (height === undefined) {
      img.setScale(scale);
      return;
    }
    const drawn = img.frame.height || 1;
    img.setScale((height / drawn) * scale);
  }

  /**
   * Open the chest nearest a point, once.
   *
   * Matched by position rather than by id because decor has no id -- the
   * server sends a chest as a kind and a coordinate. A generous radius, since
   * the event carries the treasure's anchor and the prop is placed on it.
   *
   * Idempotent per chest: a chest already playing or already open is left
   * alone, so a replayed event cannot snap a lid shut and lift it again.
   */
  openChest(at: { x: number; y: number }): void {
    let best: Phaser.GameObjects.Sprite | null = null;
    let bestDist = 64;
    for (const chest of this.#chests) {
      const dist = Math.hypot(chest.x - at.x, chest.y - at.y);
      if (dist < bestDist) { best = chest; bestDist = dist; }
    }
    if (!best || best.getData('open') === true) return;
    best.setData('open', true);
    best.play(CHEST_OPEN_KEY);
  }

  #buildDecor(room: RoomFull, biome: BiomeName): void {
    this.torches = [];
    this.#chests = [];
    const ambient = BIOMES[biome];
    for (const d of room.decor) {
      if (d.kind === 'pond') continue; // water is drawn by tiles
      if (d.kind === 'torch') {
        this.#buildTorch(d);
        continue;
      }
      const art = this.#artFor(d);
      if (!art) continue;
      // A chest is the one prop that moves, so it is the one prop that is a
      // Sprite: its sheet is eight frames of the lid coming up and `chest0` is
      // that sequence closed. Everything else stays an Image, which cannot
      // hold an animation and does not need to.
      const chest = d.kind === 'chest' && this.scene.textures.exists(CHEST_TEXTURE_KEY);
      const img = (chest
        ? this.scene.add.sprite(d.x, d.y, art.texture, art.frame)
        : this.scene.add.image(d.x, d.y, art.texture, art.frame))
        .setOrigin(0.5, 1).setFlipX(d.flip);
      if (chest) this.#chests.push(img as Phaser.GameObjects.Sprite);
      WorldRenderer.#fit(img, art.height, d.scale);
      img.setDepth(DEPTH.entityBase + d.y * 0.01);
      this.#objects.push(img);

      // People watch you. Kept as a list the scene steps rather than a tween,
      // because which way they face depends on where you are standing and
      // nothing else in here does.
      if (isPerson(d.kind)) this.people.push({ image: img, x: d.x, kind: d.kind, variant: d.variant, scale: d.scale, facing: 0 });

      if (this.quality !== 'low') {
        if (SWAY_KINDS.has(d.kind)) {
          const seed = (d.x * 3 + d.y * 7) % 1000;
          img.setOrigin(0.5, 1);
          this.#tweens.push(this.scene.tweens.add({
            targets: img, angle: { from: -3.5, to: 3.5 }, duration: 1600 + seed, delay: seed, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut',
          }));
        } else if (TREE_KINDS.has(d.kind)) {
          // Breathe around the size it was fitted to, not around 1.
          //
          // This used to set `scaleX` straight from `d.scale`, which was right
          // when props were canvas textures painted at their world size -- the
          // scale was only the server's little per-instance jitter. The sheets
          // are ~190px a frame and `#fit` is what brings them down to a 104
          // unit tree, so assigning `d.scale` here threw that away and drew
          // every tree at twice the size, with a shadow measured off it.
          const base = img.scaleY;
          const flip = d.flip ? -1 : 1;
          const seed = (d.x * 5 + d.y * 3) % 1400;
          img.setFlipX(false);
          img.setScale(base * flip, base);
          this.#tweens.push(this.scene.tweens.add({
            targets: img,
            scaleX: { from: base * flip * 0.985, to: base * flip * 1.015 },
            angle: { from: -0.8, to: 0.8 },
            duration: 2600 + seed, delay: seed, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          }));
        }
      }

      // Cast last, so it is measured against the size the prop ended up at --
      // the tree branch above resets the scale, and a shadow taken before it
      // would be sized for a tree that is no longer there.
      //
      // Everything standing up casts one, blocking or not: a bush has no
      // collision and still sits on the floor. Only the flat things are
      // skipped.
      if (!FLAT_KINDS.has(d.kind)) this.#shadow(img, d.x, d.y);

      if (this.quality === 'low') continue;
      if (d.kind === 'brazier' || d.kind === 'candles') {
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

  // --- portals ----------------------------------------------------------------------

  /**
   * The ways out of an area.
   *
   * Nothing drew these. Portals were in the snapshot, the server routed travel
   * through them and the interact prompt named them, but no object was ever
   * added for one -- so a village's roads out and the exit that opens in a
   * cleared dungeon were invisible circles on the floor. You could only leave
   * an area by walking over a spot with nothing on it.
   *
   * Drawn as a ring lying on the ground with its destination written above it,
   * because a portal is a place rather than a thing: a standing gate would
   * have to face a direction, and these sit in the open.
   *
   * A locked one is drawn broken and dim, with the reason under it, so a way
   * out you cannot use yet still tells you it is there.
   */
  #buildPortals(room: RoomFull): void {
    for (const portal of room.portals) {
      const open = !portal.locked;

      const ring = this.scene.add
        .image(portal.x, portal.y, DIALOGUE_TEXTURE_KEY, open ? 'ringSolid' : 'ringBroken')
        .setDepth(DEPTH.floorDecal + 1)
        .setAlpha(open ? 0.9 : 0.45);
      // Flattened: it lies on the floor, so the circle reads as an ellipse.
      ring.setDisplaySize(portal.radius * 2.2, portal.radius * 1.3);
      this.#objects.push(ring);

      if (open) {
        const glowImg = this.scene.add.image(portal.x, portal.y, 'fx:glow')
          .setScale(portal.radius / 42, portal.radius / 70)
          .setAlpha(0.3).setDepth(DEPTH.floorDecal)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(portal.kind === 'descent' ? 0xb48cff : 0xf0c060);
        this.#objects.push(glowImg);
        this.#tweens.push(this.scene.tweens.add({
          targets: [ring, glowImg], alpha: { from: 0.28, to: 0.75 },
          duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        }));
      }

      const label = this.scene.add
        .text(portal.x, portal.y - portal.radius * 0.9, portal.label.toUpperCase(), {
          fontFamily: PIXEL_FONT.stack,
          fontSize: '13px',
          color: open ? HUD.ink : HUD.dimInk,
        })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.entityBase + portal.y * 0.01 + 2);
      this.#objects.push(label);

      if (portal.lockReason) {
        const why = this.scene.add
          .text(portal.x, portal.y + portal.radius * 0.7, portal.lockReason.toUpperCase(), {
            fontFamily: PIXEL_FONT.stack, fontSize: '11px', color: HUD.dimInk,
          })
          .setOrigin(0.5, 0)
          .setDepth(DEPTH.entityBase + portal.y * 0.01 + 2);
        this.#objects.push(why);
      }
    }
  }

  // --- doors ------------------------------------------------------------------------

  #buildDoors(room: RoomFull): void {
    this.#doorSprites.clear();
    this.#doorGlows.clear();
    for (const door of room.doors) {
      const img = this.scene.add
        .image(door.x, door.y + (door.side === 'north' ? 6 : -4),
          DOORS_TEXTURE_KEY, this.#doorFrame(door))
        .setDepth(door.side === 'north' ? DEPTH.floorDecal + 2 : DEPTH.entityBase + door.y * 0.01);
      // Three tiles wide, which is the opening the generator cuts for it.
      img.setDisplaySize(TILE * 3, TILE * 3 * (img.frame.height / img.frame.width));
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

  /**
   * Which of the four drawn gateways this door is.
   *
   * One sheet, four states of the same gateway, so the posts are identical
   * across all of them and only what is between them changes -- which is what
   * makes a door opening read as *that* door opening rather than as one image
   * being swapped for a different one.
   *
   * A door with no room on the other side is sealed. That is the one you came
   * in through, and drawing it as a closed gate would have you waiting for it
   * to open.
   */
  #doorFrame(door: DoorSnap): string {
    if (door.targetIndex === null) return 'sealed';
    if (door.kind === 'arch') return 'arch';
    return door.locked ? 'gateClosed' : 'gateOpen';
  }

  updateDoors(doors: DoorSnap[]): void {
    for (const door of doors) {
      const img = this.#doorSprites.get(door.side);
      const glowImg = this.#doorGlows.get(door.side);
      if (!img || !glowImg) continue;
      const frame = this.#doorFrame(door);
      if (img.frame.name !== frame) {
        img.setFrame(frame);
        img.setDisplaySize(TILE * 3, TILE * 3 * (img.frame.height / img.frame.width));
        if (frame === 'gateOpen') {
          this.scene.tweens.add({ targets: glowImg, alpha: { from: 0, to: 0.5 }, duration: 900, ease: 'Sine.easeOut' });
          this.scene.tweens.add({ targets: glowImg, scaleX: { from: 1.6, to: 1.9 }, duration: 1400, yoyo: true, repeat: -1 });
        }
      }
      const open = door.targetIndex !== null && !door.locked;
      if (open && glowImg.alpha === 0 && !this.scene.tweens.isTweening(glowImg)) glowImg.setAlpha(0.35);
      if (!open) glowImg.setAlpha(0);
    }
  }

  /**
   * Turn the villagers toward the player.
   *
   * They are drawn face-on until you are beside them, and then they turn --
   * which is the whole difference between a village of cardboard cut-outs and
   * a village of people who have noticed you. The profile sheet is a second
   * set of the same eight figures, so turning is a frame swap and a flip.
   *
   * `FACE_RANGE` is generous on purpose: somebody who only turns once you are
   * on top of them reads as broken rather than as shy.
   */
  facePeople(player: { x: number; y: number }): void {
    for (const person of this.people) {
      const dx = player.x - person.x;
      const next: -1 | 0 | 1 = Math.abs(dx) < FACE_DEADZONE || Math.abs(dx) > FACE_RANGE
        ? 0
        : (dx < 0 ? -1 : 1);
      if (next === person.facing) continue;
      person.facing = next;

      const art = next === 0
        ? propArt(person.kind, person.variant)
        : propArtSide(person.kind, person.variant);
      if (!art) continue;
      person.image.setTexture(art.texture, art.frame);
      // Re-fitted, not just re-framed: the profile sheet trims to a different
      // height than the face-on one, so keeping the old scale would make
      // everybody grow or shrink the moment they turned.
      WorldRenderer.#fit(person.image, art.height, person.scale);
      person.image.setFlipX(next === -1);
    }
  }

  /**
   * Put a prop on the ground.
   *
   * Two pieces, because one ellipse cannot do both jobs. The **contact** patch
   * is small, dark and sits directly under the object: it is what makes a tree
   * look like it is standing on the grass instead of pasted over it. The
   * **cast** shadow is long, faint and thrown away from the light, and its
   * length comes from how tall the thing is -- which is the part the old
   * version had no way of knowing, because it sized both from the collision
   * radius. A rock's radius is 18 and a pillar's is 16, so a 30-unit rock and
   * a 118-unit pillar were casting the same shadow.
   *
   * Measured off `img`, after it has been fitted, so this reads the drawn size
   * rather than anything declared about it.
   */
  #shadow(img: Phaser.GameObjects.Image, x: number, y: number): void {
    // The *drawn* size, not `displayWidth`.
    //
    // Every frame on these sheets shares one padded source box -- 195x213 --
    // and `displayWidth` measures that box, so a bush whose art is 112x72
    // inside it reports 99x109. Sizing a shadow off that gave the bush one
    // three times too big, which is most of why they read as wrong.
    // `frame.width/height` is the trimmed cut: the art and nothing else.
    // `abs`, because a flipped tree carries a negative scaleX.
    const width = img.frame.width * Math.abs(img.scaleX);
    const height = img.frame.height * Math.abs(img.scaleY);

    // Thrown further by tall things and wider by broad ones. The height term
    // decides how far it reaches; the width term keeps a low broad thing from
    // casting a spike.
    const reach = width * 0.34 + height * 0.30;

    const cast = this.scene.add.image(x, y, 'fx:cast')
      .setDepth(DEPTH.shadow)
      // A third of it sits *under* the object and two thirds extend away.
      //
      // Anchored at its very end it detached: the whole ellipse lay beside the
      // trunk and read as a separate grey blob dropped on the grass rather
      // than as something the tree was casting. A shadow has to touch the
      // thing making it, and on a canopy that means the pool under the leaves
      // is part of the same shape.
      .setOrigin(0.34, 0.5)
      .setRotation(LIGHT_ANGLE)
      .setDisplaySize(reach, width * 0.66)
      .setAlpha(0.6);
    this.#objects.push(cast);

    // Tight and dark, where the thing actually meets the floor. Narrower than
    // the cast pool on purpose -- a trunk touches the ground over a much
    // smaller footprint than its canopy shades.
    const contact = this.scene.add.image(x, y, 'fx:contact')
      .setDepth(DEPTH.shadow)
      .setDisplaySize(width * 0.34, width * 0.34 * 0.44)
      .setAlpha(0.75);
    this.#objects.push(contact);
  }

  destroy(): void {
    for (const t of this.#tweens) t.stop();
    this.#tweens = [];
    for (const e of this.#emitters) e.destroy();
    this.#emitters = [];
    for (const o of this.#objects) o.destroy();
    this.#objects = [];
    this.people = [];
    this.#doorSprites.clear();
    this.#doorGlows.clear();
    this.room = null;
    this.torches = [];
  }
}
