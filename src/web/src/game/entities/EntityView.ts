/**
 * Base for anything the server owns and the client only draws.
 *
 * Snapshots arrive at 20 Hz; the view dead-reckons from the last velocity and
 * eases toward each new authoritative position so motion stays smooth at 60.
 */

import type Phaser from 'phaser';

import { DEPTH, LIGHT_ANGLE, NET } from '../constants';
import type { Vec2 } from '../contracts';

export abstract class EntityView {
  readonly id: string;
  /** Rendered position. */
  x: number;
  y: number;
  /** Last authoritative position + velocity, extrapolated between snapshots. */
  protected target: Vec2;
  protected velocity: Vec2 = { x: 0, y: 0 };
  protected sinceSnapshot = 0;
  protected readonly shadow: Phaser.GameObjects.Image | null;
  /** The long faint half, thrown away from the light. See the constructor. */
  protected readonly castShadow: Phaser.GameObjects.Image | null;
  alive = true;

  constructor(protected readonly scene: Phaser.Scene, id: string, pos: Vec2, shadowScale = 0) {
    this.id = id;
    this.x = pos.x;
    this.y = pos.y;
    this.target = { ...pos };
    // A creature's shadow is the same two pieces the props get: a tight dark
    // contact patch under the feet, and a long faint one thrown down-right,
    // away from the light every sheet is drawn to. One mid-grey ellipse
    // underneath was dark enough to read as a hole in the ground and
    // symmetric enough to belong to no light source at all.
    //
    // `shadowScale` is in units of the 64px source, which is what every caller
    // already passes, so the two are sized off it rather than off a new number
    // each of them would have to be taught.
    const width = shadowScale * 64;
    this.shadow = shadowScale > 0
      ? scene.add.image(pos.x, pos.y, 'fx:contact')
        .setDepth(DEPTH.shadow)
        .setDisplaySize(width * 0.78, width * 0.78 * 0.44)
        .setAlpha(0.68)
      : null;
    this.castShadow = shadowScale > 0
      ? scene.add.image(pos.x, pos.y, 'fx:cast')
        .setDepth(DEPTH.shadow)
        .setOrigin(0.16, 0.5)
        .setRotation(LIGHT_ANGLE)
        .setDisplaySize(width * 0.95, width * 0.62)
        .setAlpha(0.5)
      : null;
  }

  /** Called with each server snapshot. */
  syncTarget(pos: Vec2, velocity: Vec2): void {
    this.target = { ...pos };
    this.velocity = { ...velocity };
    this.sinceSnapshot = 0;
  }

  /** Move the rendered position toward the (extrapolated) target. */
  protected follow(dt: number, rate: number = NET.followRate): void {
    const horizon = 1 / NET.snapshotHz;
    if (this.sinceSnapshot < horizon) {
      this.target.x += this.velocity.x * dt;
      this.target.y += this.velocity.y * dt;
    }
    this.sinceSnapshot += dt;
    const k = 1 - Math.exp(-rate * dt);
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    if (Math.hypot(dx, dy) > 260) {
      this.x = this.target.x;
      this.y = this.target.y;
    } else {
      this.x += dx * k;
      this.y += dy * k;
    }
  }

  protected depthFor(y: number): number {
    return DEPTH.entityBase + y * 0.01;
  }

  protected placeShadow(x: number, y: number): void {
    this.shadow?.setPosition(x, y);
    this.castShadow?.setPosition(x, y);
  }

  abstract update(dt: number): void;

  destroy(): void {
    this.alive = false;
    this.shadow?.destroy();
    this.castShadow?.destroy();
  }
}
