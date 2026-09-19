import Phaser from 'phaser';

import { keybinds, type Action } from '../state/Keybinds';
import type { Intent, IntentSource } from '../types';

/**
 * Translates the keyboard into an `Intent`.
 *
 * Which key does what comes from `Keybinds`, not from here: this file knows
 * that there is a "move up" and an "attack", and nothing about W or J. That is
 * what makes rebinding cheap -- the table changes and this rebuilds, and the
 * rest of the game, which only ever sees an `Intent`, never notices.
 *
 * Menu and world keys (pause, screens, potions, interact) are React's, in
 * `useHotkeys`, reading the same table. The game only ever sees movement and
 * combat, and it is muted entirely while a menu is open.
 */

/** The actions this source samples. The rest of the table belongs to React. */
const SAMPLED = [
  'moveUp', 'moveDown', 'moveLeft', 'moveRight', 'run',
  'attack', 'ability1', 'ability2', 'ability3', 'ability4',
] as const satisfies readonly Action[];

type Sampled = (typeof SAMPLED)[number];

export class KeyboardIntentSource implements IntentSource {
  readonly #keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  /** Every Phaser key per action: primary and secondary, in that order. */
  #keys!: Record<Sampled, Phaser.Input.Keyboard.Key[]>;
  readonly #unsubscribe: () => void;
  muted = false;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.#keyboard = keyboard;
    this.#build();
    // A rebind from the Controls screen takes effect on the next frame rather
    // than on the next scene restart, which is the difference between the
    // setting working and the setting appearing to work.
    this.#unsubscribe = keybinds.onChange(() => this.#build());
  }

  #build(): void {
    // Release the old objects first: Phaser keys a key per code and leaving
    // them behind means a rebound key keeps reporting under its old action.
    if (this.#keys) for (const keys of Object.values(this.#keys)) for (const k of keys) k.destroy();

    const built = {} as Record<Sampled, Phaser.Input.Keyboard.Key[]>;
    const capture: number[] = [];
    for (const action of SAMPLED) {
      const codes = keybinds.codes(action);
      built[action] = codes.map((code) => this.#keyboard.addKey(code));
      // Stop the browser scrolling the page on whatever movement and attack
      // are bound to, which is why this is derived rather than a fixed list.
      if (action !== 'run') capture.push(...codes);
    }
    this.#keys = built;
    this.#keyboard.addCapture(capture);
  }

  /** True on the frame the action was pressed, consuming the edge. */
  #justDown(action: Sampled): boolean {
    let fired = false;
    // Every key, not the first match: `JustDown` consumes, so short-circuiting
    // would leave the other key's edge to fire again on a later frame.
    for (const key of this.#keys[action]) {
      if (Phaser.Input.Keyboard.JustDown(key)) fired = true;
    }
    return fired;
  }

  #isDown(action: Sampled): boolean {
    return this.#keys[action].some((key) => key.isDown);
  }

  sample(): Intent {
    if (this.muted) {
      // Consume edges so a key pressed while a menu was open doesn't fire later.
      this.#justDown('attack');
      for (const a of ['ability1', 'ability2', 'ability3', 'ability4'] as const) this.#justDown(a);
      return { moveX: 0, moveY: 0, attack: false, run: false, ability: null };
    }

    let ability: number | null = null;
    if (this.#justDown('ability1')) ability = 1;
    else if (this.#justDown('ability2')) ability = 2;
    else if (this.#justDown('ability3')) ability = 3;
    else if (this.#justDown('ability4')) ability = 4;

    const left = this.#isDown('moveLeft');
    const right = this.#isDown('moveRight');
    const up = this.#isDown('moveUp');
    const down = this.#isDown('moveDown');

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      // JustDown consumes the press, so an edge is reported exactly once.
      attack: this.#justDown('attack'),
      run: this.#isDown('run'),
      ability,
    };
  }

  destroy(): void {
    this.#unsubscribe();
    for (const keys of Object.values(this.#keys)) for (const key of keys) key.destroy();
  }
}
