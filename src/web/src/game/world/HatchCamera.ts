import type Phaser from 'phaser';

import { CAMERA } from '../constants';
import type { Vec2 } from '../contracts';

/** Briefly frame the hatch, then blend back to the player's current position. */
export class HatchCamera {
  #phase: 'in' | 'hold' | 'out' | null = null;
  #elapsed = 0;
  #from = { x: 0, y: 0 };
  #spawn = { x: 0, y: 0 };

  constructor(
    private readonly camera: Phaser.Cameras.Scene2D.Camera,
    private readonly player: Vec2,
  ) {}

  focus(spawn: Vec2): void {
    this.#from = { ...this.camera.midPoint };
    this.#spawn = { ...spawn };
    this.#elapsed = 0;
    this.#phase = 'in';
    this.camera.stopFollow();
    this.camera.setDeadzone();
    this.camera.roundPixels = false;
  }

  returnToPlayer(): void {
    if (!this.#phase) return;
    this.#from = { ...this.camera.midPoint };
    this.#elapsed = 0;
    this.#phase = 'out';
  }

  step(dt: number): void {
    if (!this.#phase) return;
    if (this.#phase === 'hold') {
      this.camera.centerOn(this.#spawn.x, this.#spawn.y);
      return;
    }
    this.#elapsed += dt;
    const t = Math.min(1, this.#elapsed / (this.#phase === 'in' ? 0.85 : 0.75));
    const eased = t * t * (3 - 2 * t);
    const target = this.#phase === 'in' ? this.#spawn : this.player;
    this.camera.centerOn(
      this.#from.x + (target.x - this.#from.x) * eased,
      this.#from.y + (target.y - this.#from.y) * eased,
    );
    if (t < 1) return;
    if (this.#phase === 'in') this.#phase = 'hold';
    else this.restore();
  }

  restore(): void {
    this.#phase = null;
    this.camera.startFollow(this.player, true, CAMERA.lerp, CAMERA.lerp);
    this.camera.setDeadzone(CAMERA.deadzone.width, CAMERA.deadzone.height);
  }
}
