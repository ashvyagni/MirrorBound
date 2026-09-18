import Phaser from 'phaser';

import type { Intent, IntentSource } from '../types';

/**
 * Translates the keyboard into an `Intent`.
 *
 * The rest of the game never sees a key code. Swapping this for a gamepad, a
 * replay, or an agent feed from the backend is a one-line change at the call
 * site, because everything downstream only consumes `Intent`.
 */
export class KeyboardIntentSource implements IntentSource {
  readonly #keys: Record<'left' | 'right' | 'altLeft' | 'altRight' | 'jump' | 'altJump' | 'run' | 'attack' | 'slot1' | 'slot2' | 'slot3' | 'companionAttack', Phaser.Input.Keyboard.Key>;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    const { KeyCodes } = Phaser.Input.Keyboard;
    this.#keys = {
      left: keyboard.addKey(KeyCodes.LEFT),
      right: keyboard.addKey(KeyCodes.RIGHT),
      altLeft: keyboard.addKey(KeyCodes.A),
      altRight: keyboard.addKey(KeyCodes.D),
      jump: keyboard.addKey(KeyCodes.SPACE),
      altJump: keyboard.addKey(KeyCodes.W),
      run: keyboard.addKey(KeyCodes.SHIFT),
      attack: keyboard.addKey(KeyCodes.J),
      // Abilities sit on the number row, one per slot the weapon offers.
      slot1: keyboard.addKey(KeyCodes.ONE),
      slot2: keyboard.addKey(KeyCodes.TWO),
      slot3: keyboard.addKey(KeyCodes.THREE),
      companionAttack: keyboard.addKey(KeyCodes.K),
    };

    // Stop the browser scrolling the page when the player jumps or walks.
    keyboard.addCapture([
      KeyCodes.LEFT, KeyCodes.RIGHT, KeyCodes.UP, KeyCodes.DOWN, KeyCodes.SPACE,
    ]);
  }

  sample(): Intent {
    const k = this.#keys;
    const left = k.left.isDown || k.altLeft.isDown;
    const right = k.right.isDown || k.altRight.isDown;

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      // JustDown consumes the press, so an edge is reported exactly once.
      jump: Phaser.Input.Keyboard.JustDown(k.jump) || Phaser.Input.Keyboard.JustDown(k.altJump),
      jumpHeld: k.jump.isDown || k.altJump.isDown,
      attack: Phaser.Input.Keyboard.JustDown(k.attack),
      ability: Phaser.Input.Keyboard.JustDown(k.slot1) ? 0
        : Phaser.Input.Keyboard.JustDown(k.slot2) ? 1
        : Phaser.Input.Keyboard.JustDown(k.slot3) ? 2
        : null,
      run: k.run.isDown,
      companionAttack: Phaser.Input.Keyboard.JustDown(k.companionAttack),
    };
  }

  destroy(): void {
    for (const key of Object.values(this.#keys)) key.destroy();
  }
}
