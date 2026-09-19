import Phaser from 'phaser';

import { eventBus } from '../EventBus';
import { keybinds, type Action } from '../state/Keybinds';
import type { Intent, IntentSource } from '../types';

/**
 * Translates this machine's input devices into an `Intent`.
 *
 * The rest of the game never sees a key code or a mouse button. Swapping this
 * for a gamepad, a replay, or an agent feed from the backend is a one-line
 * change at the call site, because everything downstream only consumes
 * `Intent`.
 *
 * That isolation is also what made rebinding cheap. This file is the only place
 * that ever knew a key code, so binding them from a table meant changing the
 * table -- nothing downstream of `Intent` noticed, and nothing had to.
 */
export class DeviceIntentSource implements IntentSource {
  #keys = new Map<Action, Phaser.Input.Keyboard.Key[]>();

  /** Left mouse button, latched until the next sample so a click between
   *  frames is never dropped. */
  #clicked = false;
  /** A click the in-game bar has already used. Without this, equipping a
   *  weapon from the bar would also swing it on the way past. */
  #consumed = false;
  /** Set while the settings screen is listening for a key to bind. Without it,
   *  pressing `W` to rebind "move up" also walks the goat into a tree. */
  #suspended = false;
  readonly #release: Array<() => void> = [];

  constructor(
    private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    pointer?: Phaser.Input.InputPlugin,
  ) {
    this.#bind();

    // Rebuilt rather than patched when a binding changes: the set of keys is
    // small, and a rebuild cannot leave a stale key behind still firing.
    this.#release.push(keybinds.onChange(() => this.#bind()));

    const { KeyCodes } = Phaser.Input.Keyboard;
    // Stop the browser scrolling the page when the player walks.
    keyboard.addCapture([
      KeyCodes.LEFT, KeyCodes.RIGHT, KeyCodes.UP, KeyCodes.DOWN, KeyCodes.SPACE,
    ]);

    if (pointer) {
      const onDown = (p: Phaser.Input.Pointer) => {
        if (p.leftButtonDown()) this.#clicked = true;
      };
      pointer.on(Phaser.Input.Events.POINTER_DOWN, onDown);
      this.#release.push(() => pointer.off(Phaser.Input.Events.POINTER_DOWN, onDown));
    }

    // The bar runs in its own scene, whose input is processed before this one
    // is sampled, so a flag set there is always seen on the right frame.
    this.#release.push(
      eventBus.on('hud:pointer-used', () => { this.#consumed = true; }),
      eventBus.on('input:suspend', ({ suspended }) => { this.#suspended = suspended; }),
    );
  }

  /** Build one Phaser key per bound code, from the current table. */
  #bind(): void {
    for (const keys of this.#keys.values()) {
      for (const key of keys) key.destroy();
    }
    this.#keys.clear();

    for (const [action, binding] of Object.entries(keybinds.all())) {
      const codes = [binding.primary, binding.secondary]
        // -1 marks an action left unbound when its key was taken by another.
        .filter((code): code is number => typeof code === 'number' && code >= 0);
      this.#keys.set(
        action as Action,
        codes.map((code) => this.keyboard.addKey(code)),
      );
    }
  }

  /** Whether any key bound to this action is currently held. */
  #down(action: Action): boolean {
    const keys = this.#keys.get(action);
    return keys ? keys.some((k) => k.isDown) : false;
  }

  /**
   * Whether this action was pressed on this frame.
   *
   * Every key is polled rather than short-circuited, because `JustDown`
   * *consumes* the press -- skipping the second key of a pair would leave it
   * latched to fire on some later frame instead.
   */
  #pressed(action: Action): boolean {
    const keys = this.#keys.get(action);
    if (!keys) return false;
    let hit = false;
    for (const key of keys) {
      if (Phaser.Input.Keyboard.JustDown(key)) hit = true;
    }
    return hit;
  }

  sample(): Intent {
    // Taken before anything below could short-circuit past it: a click that
    // lands on the same frame as a key press still has to be consumed, or it
    // sits latched and fires a phantom swing on some later frame.
    const clicked = this.#takeClick();

    // While a key is being bound, every press belongs to the binding dialog.
    // The presses are still polled above so nothing stays latched.
    if (this.#suspended) {
      for (const action of this.#keys.keys()) this.#pressed(action);
      return { ...NEUTRAL };
    }

    const right = this.#down('moveRight');
    const left = this.#down('moveLeft');
    const down = this.#down('moveDown');
    const up = this.#down('moveUp');

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      attack: this.#pressed('attack') || clicked,
      ability: this.#pressed('ability1') ? 0
        : this.#pressed('ability2') ? 1
        : this.#pressed('ability3') ? 2
        : null,
      run: this.#down('run'),
      companionAttack: this.#pressed('companion'),
      weaponSlot: this.#pressed('hand1') ? 0
        : this.#pressed('hand2') ? 1
        : null,
      potionCycle: this.#pressed('potionCycle') ? 1 : 0,
      potionUse: this.#pressed('potionUse'),
      mapToggle: this.#pressed('map'),
      pauseToggle: this.#pressed('pause'),
      consoleToggle: this.#pressed('console'),
      interact: this.#pressed('interact'),
    };
  }

  /** Consume a pending click, unless the in-game bar got to it first. */
  #takeClick(): boolean {
    const clicked = this.#clicked && !this.#consumed;
    this.#clicked = false;
    this.#consumed = false;
    return clicked;
  }

  destroy(): void {
    for (const off of this.#release) off();
    for (const keys of this.#keys.values()) {
      for (const key of keys) key.destroy();
    }
    this.#keys.clear();
  }
}

/** What a suspended frame reports: nothing happening. */
const NEUTRAL: Intent = {
  moveX: 0, moveY: 0, attack: false, run: false, ability: null,
  companionAttack: false, weaponSlot: null, potionCycle: 0,
  potionUse: false, mapToggle: false, pauseToggle: false,
  consoleToggle: false, interact: false,
};
