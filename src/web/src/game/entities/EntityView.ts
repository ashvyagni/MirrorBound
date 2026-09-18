/**
 * Base for anything the server owns and the client only draws.
 *
 * Snapshots arrive at 20 Hz; the view dead-reckons from the last velocity and
 * eases toward each new authoritative position so motion stays smooth at 60.
 */

import Phaser from 'phaser';

import { DEPTH, NET } from '../constants';
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
  alive = true;

  constructor(protected readonly scene: Phaser.Scene, id: string, pos: Vec2, shadowScale = 0) {
    this.id = id;
    this.x = pos.x;
    this.y = pos.y;
    this.target = { ...pos };
    this.shadow = shadowScale > 0
      ? scene.add.image(pos.x, pos.y, 'fx:shadow').setDepth(DEPTH.shadow).setScale(shadowScale, shadowScale * 0.9).setAlpha(0.75)
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
  }

  abstract update(dt: number): void;

  destroy(): void {
    this.alive = false;
    this.shadow?.destroy();
  }
}
