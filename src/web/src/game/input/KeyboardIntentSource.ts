import Phaser from 'phaser';

import type { Intent, IntentSource } from '../types';

/**
 * Translates the keyboard and mouse into an `Intent`.
 *
 * The rest of the game never sees a key code. Swapping this for a gamepad, a
 * replay, or an agent feed from the backend is a one-line change at the call
 * site, because everything downstream only consumes `Intent`.
 */
export class KeyboardIntentSource implements IntentSource {
  readonly #keys: Record<
    'left' | 'right' | 'up' | 'down' | 'run' | 'attack' | 'ability1' | 'ability2' | 'ability3' | 'ability4',
    Phaser.Input.Keyboard.Key
  >;
  #scene: Phaser.Scene | null = null;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    const { KeyCodes } = Phaser.Input.Keyboard;
    this.#keys = {
      left: keyboard.addKey(KeyCodes.A),
      right: keyboard.addKey(KeyCodes.D),
      up: keyboard.addKey(KeyCodes.W),
      down: keyboard.addKey(KeyCodes.S),
      run: keyboard.addKey(KeyCodes.SHIFT),
      attack: keyboard.addKey(KeyCodes.J),
      ability1: keyboard.addKey(KeyCodes.ONE),
      ability2: keyboard.addKey(KeyCodes.TWO),
      ability3: keyboard.addKey(KeyCodes.THREE),
      ability4: keyboard.addKey(KeyCodes.FOUR),
    };

    keyboard.addCapture([
      KeyCodes.W, KeyCodes.A, KeyCodes.S, KeyCodes.D,
      KeyCodes.UP, KeyCodes.DOWN, KeyCodes.LEFT, KeyCodes.RIGHT,
      KeyCodes.SPACE,
    ]);
  }

  setScene(scene: Phaser.Scene): void {
    this.#scene = scene;
  }

  sample(): Intent {
    const k = this.#keys;
    const left = k.left.isDown;
    const right = k.right.isDown;
    const up = k.up.isDown;
    const down = k.down.isDown;

    // Calculate aim angle from mouse position if scene is available
    let aimAngle = 0;
    if (this.#scene) {
      const pointer = this.#scene.input.activePointer;
      const worldPoint = this.#scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      // Access player through scene - will be set after create()
      const player = (this.#scene as any).player;
      if (player) {
        aimAngle = Math.atan2(worldPoint.y - player.y, worldPoint.x - player.x);
      }
    }

    let ability: number | null = null;
    if (Phaser.Input.Keyboard.JustDown(k.ability1)) ability = 1;
    else if (Phaser.Input.Keyboard.JustDown(k.ability2)) ability = 2;
    else if (Phaser.Input.Keyboard.JustDown(k.ability3)) ability = 3;
    else if (Phaser.Input.Keyboard.JustDown(k.ability4)) ability = 4;

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      attack: Phaser.Input.Keyboard.JustDown(k.attack),
      run: k.run.isDown,
      aimAngle,
      ability,
    };
  }

  destroy(): void {
    for (const key of Object.values(this.#keys)) key.destroy();
  }
}
