import Phaser from 'phaser';

import type { Intent, IntentSource } from '../types';

/**
 * Translates the keyboard into an `Intent`.
 *
 * WASD / arrows move (and therefore set facing on the server), J or Space
 * attacks, 1-4 fire abilities, Shift runs. Menu keys (P, Esc, I, K, Tab, F3)
 * are handled by React, not here -- the game only ever sees movement and
 * combat, and it is muted entirely while a menu is open.
 */
export class KeyboardIntentSource implements IntentSource {
  readonly #keys: Record<
    'left' | 'right' | 'up' | 'down' | 'altLeft' | 'altRight' | 'altUp' | 'altDown'
    | 'run' | 'attack' | 'altAttack' | 'ability1' | 'ability2' | 'ability3' | 'ability4',
    Phaser.Input.Keyboard.Key
  >;
  muted = false;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    const { KeyCodes } = Phaser.Input.Keyboard;
    this.#keys = {
      left: keyboard.addKey(KeyCodes.A),
      right: keyboard.addKey(KeyCodes.D),
      up: keyboard.addKey(KeyCodes.W),
      down: keyboard.addKey(KeyCodes.S),
      altLeft: keyboard.addKey(KeyCodes.LEFT),
      altRight: keyboard.addKey(KeyCodes.RIGHT),
      altUp: keyboard.addKey(KeyCodes.UP),
      altDown: keyboard.addKey(KeyCodes.DOWN),
      run: keyboard.addKey(KeyCodes.SHIFT),
      attack: keyboard.addKey(KeyCodes.J),
      altAttack: keyboard.addKey(KeyCodes.SPACE),
      ability1: keyboard.addKey(KeyCodes.ONE),
      ability2: keyboard.addKey(KeyCodes.TWO),
      ability3: keyboard.addKey(KeyCodes.THREE),
      ability4: keyboard.addKey(KeyCodes.FOUR),
    };

    // Stop the browser scrolling the page on movement keys.
    keyboard.addCapture([
      KeyCodes.W, KeyCodes.A, KeyCodes.S, KeyCodes.D,
      KeyCodes.UP, KeyCodes.DOWN, KeyCodes.LEFT, KeyCodes.RIGHT, KeyCodes.SPACE,
    ]);
  }

  sample(): Intent {
    const k = this.#keys;
    if (this.muted) {
      // Consume edges so a key pressed while a menu was open doesn't fire later.
      Phaser.Input.Keyboard.JustDown(k.attack);
      Phaser.Input.Keyboard.JustDown(k.altAttack);
      for (const key of [k.ability1, k.ability2, k.ability3, k.ability4]) Phaser.Input.Keyboard.JustDown(key);
      return { moveX: 0, moveY: 0, attack: false, run: false, ability: null };
    }
    const left = k.left.isDown || k.altLeft.isDown;
    const right = k.right.isDown || k.altRight.isDown;
    const up = k.up.isDown || k.altUp.isDown;
    const down = k.down.isDown || k.altDown.isDown;

    let ability: number | null = null;
    if (Phaser.Input.Keyboard.JustDown(k.ability1)) ability = 1;
    else if (Phaser.Input.Keyboard.JustDown(k.ability2)) ability = 2;
    else if (Phaser.Input.Keyboard.JustDown(k.ability3)) ability = 3;
    else if (Phaser.Input.Keyboard.JustDown(k.ability4)) ability = 4;

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      // JustDown consumes the press, so an edge is reported exactly once.
      attack: Phaser.Input.Keyboard.JustDown(k.attack) || Phaser.Input.Keyboard.JustDown(k.altAttack),
      run: k.run.isDown,
      ability,
    };
  }

  destroy(): void {
    for (const key of Object.values(this.#keys)) key.destroy();
  }
}
