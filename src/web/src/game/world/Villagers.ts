import Phaser from 'phaser';

import { DEPTH } from '../constants';
import type { VillagerSnap } from '../contracts';
import { propArt, propArtSide } from './propArt';

/**
 * The people walking around a village.
 *
 * Separate from `WorldRenderer`'s `people`, and the split matches the server's:
 * a vendor is placed once as decor and stands at their post, because a smith who
 * wanders off mid-conversation is worse than one who does not. These have no
 * dialogue and no collision — they are scenery that moves, and the whole job here
 * is to make the middle distance look inhabited.
 *
 * Drawn from the same four villager frames the world sheet already has. There is
 * no walk cycle for them: what sells the motion is that they *go somewhere*,
 * stop, and set off again, so the sprite only ever changes which way it faces.
 */

/** Walking toward the viewer, or away, rather than across. */
const FACING_DEADZONE = 0.55;

interface Figure {
  image: Phaser.GameObjects.Image;
  /** -1 left, 0 toward the viewer, 1 right. Redrawn only when it changes. */
  facing: -1 | 0 | 1;
  /** Where the server last said they were, and where they are being drawn. */
  target: { x: number; y: number };
}

export class Villagers {
  #figures = new Map<string, Figure>();

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Bring the drawn crowd in line with the snapshot.
   *
   * Positions are eased rather than set, for the same reason every other entity
   * is: snapshots arrive at 20 Hz and the screen redraws at 60, so a figure
   * moved only when a packet lands walks in visible steps.
   */
  sync(villagers: readonly VillagerSnap[]): void {
    const seen = new Set<string>();
    for (const villager of villagers) {
      seen.add(villager.id);
      let figure = this.#figures.get(villager.id);
      if (!figure) {
        const spawned = this.#spawn(villager);
        // Null only when the villager sheet has no frame for that index, which
        // would mean the server and the art disagree; skip rather than crash.
        if (!spawned) continue;
        figure = spawned;
        this.#figures.set(villager.id, figure);
      }
      figure.target = villager.position;
      this.#face(figure, villager);
    }
    // Anyone the server stopped sending — a room change, mostly.
    for (const [id, figure] of this.#figures) {
      if (!seen.has(id)) {
        figure.image.destroy();
        this.#figures.delete(id);
      }
    }
  }

  /** Ease every figure toward where the server put them. Called each frame. */
  step(delta: number): void {
    const lerp = Math.min(1, delta / 120);
    for (const { image, target } of this.#figures.values()) {
      image.x += (target.x - image.x) * lerp;
      image.y += (target.y - image.y) * lerp;
      // Depth is y, like every other thing that stands on the ground, so a
      // villager walking behind a hut is drawn behind it.
      image.setDepth(DEPTH.entityBase + image.y * 0.01);
    }
  }

  #spawn(villager: VillagerSnap): Figure | null {
    const art = propArt('villager', villager.sprite);
    if (!art) return null;
    const image = this.scene.add.image(villager.position.x, villager.position.y, art.texture, art.frame);
    image.setOrigin(0.5, 1);
    this.#fit(image, art.height);
    image.setDepth(DEPTH.entityBase + villager.position.y * 0.01);
    return { image, facing: 0, target: villager.position };
  }

  /**
   * Turn them the way they are walking.
   *
   * Read off the server's facing rather than from frame-to-frame movement: the
   * eased position barely changes between two frames, so differencing it gives a
   * direction that flickers. Someone standing still keeps the way they last
   * faced, which is what a person does.
   */
  #face(figure: Figure, villager: VillagerSnap): void {
    if (!villager.moving) return;
    const want: -1 | 0 | 1 = villager.facing.x < -FACING_DEADZONE ? -1
      : villager.facing.x > FACING_DEADZONE ? 1 : 0;
    if (want === figure.facing) return;
    figure.facing = want;
    const art = want === 0 ? propArt('villager', villager.sprite)
      : propArtSide('villager', villager.sprite);
    if (!art) return;
    figure.image.setTexture(art.texture, art.frame);
    figure.image.setFlipX(want === -1);
    this.#fit(figure.image, art.height);
  }

  /** Scale the frame to the height the art table states, in world units. */
  #fit(image: Phaser.GameObjects.Image, height: number): void {
    const frame = image.frame;
    image.setDisplaySize(height * (frame.width / frame.height), height);
  }

  destroy(): void {
    for (const { image } of this.#figures.values()) image.destroy();
    this.#figures.clear();
  }
}
