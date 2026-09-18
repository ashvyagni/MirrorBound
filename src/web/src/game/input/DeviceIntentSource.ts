import Phaser from 'phaser';

import { eventBus } from '../EventBus';
import type { Intent, IntentSource } from '../types';

/**
 * Translates this machine's input devices into an `Intent`.
 *
 * The rest of the game never sees a key code or a mouse button. Swapping this
 * for a gamepad, a replay, or an agent feed from the backend is a one-line
 * change at the call site, because everything downstream only consumes
 * `Intent`.
 */
export class DeviceIntentSource implements IntentSource {
  readonly #keys: Record<'left' | 'right' | 'up' | 'down' | 'altLeft' | 'altRight' | 'altUp' | 'altDown' | 'run' | 'attack' | 'slot1' | 'slot2' | 'slot3' | 'companionAttack' | 'hand1' | 'hand2' | 'potionCycle' | 'potionUse', Phaser.Input.Keyboard.Key>;

  /** Left mouse button, latched until the next sample so a click between
   *  frames is never dropped. */
  #clicked = false;
  /** A click the in-game bar has already used. Without this, equipping a
   *  weapon from the bar would also swing it on the way past. */
  #consumed = false;
  readonly #release: Array<() => void> = [];

  constructor(
    keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
    pointer?: Phaser.Input.InputPlugin,
  ) {
    const { KeyCodes } = Phaser.Input.Keyboard;
    this.#keys = {
      left: keyboard.addKey(KeyCodes.LEFT),
      right: keyboard.addKey(KeyCodes.RIGHT),
      up: keyboard.addKey(KeyCodes.UP),
      down: keyboard.addKey(KeyCodes.DOWN),
      altLeft: keyboard.addKey(KeyCodes.A),
      altRight: keyboard.addKey(KeyCodes.D),
      altUp: keyboard.addKey(KeyCodes.W),
      altDown: keyboard.addKey(KeyCodes.S),
      run: keyboard.addKey(KeyCodes.SHIFT),
      attack: keyboard.addKey(KeyCodes.J),
      // Abilities sit on the number row, one per slot the weapon offers.
      slot1: keyboard.addKey(KeyCodes.ONE),
      slot2: keyboard.addKey(KeyCodes.TWO),
      slot3: keyboard.addKey(KeyCodes.THREE),
      companionAttack: keyboard.addKey(KeyCodes.K),
      // Weapons cycle rather than sitting on their own number keys: the number
      // row is already the ability bar, and a carousel needs no more keys as
      // weapons are added.
      // One key per hand, not a cycle: Q is always the left slot and E is
      // always the right one, so the weapon a key reaches never depends on
      // what is already in hand.
      hand1: keyboard.addKey(KeyCodes.Q),
      hand2: keyboard.addKey(KeyCodes.E),
      // The dial and the drink get their own keys, because rotating what you
      // are about to drink and drinking it are different mistakes to make.
      potionCycle: keyboard.addKey(KeyCodes.R),
      potionUse: keyboard.addKey(KeyCodes.F),
    };

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
    );
  }

  sample(): Intent {
    const k = this.#keys;
    const left = k.left.isDown || k.altLeft.isDown;
    const right = k.right.isDown || k.altRight.isDown;
    const up = k.up.isDown || k.altUp.isDown;
    const down = k.down.isDown || k.altDown.isDown;
    // Taken before the `||` below could short-circuit past it: a click that
    // lands on the same frame as a key press still has to be consumed, or it
    // sits latched and fires a phantom swing on some later frame.
    const clicked = this.#takeClick();

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      // JustDown consumes the press, so an edge is reported exactly once.
      attack: Phaser.Input.Keyboard.JustDown(k.attack) || clicked,
      ability: Phaser.Input.Keyboard.JustDown(k.slot1) ? 0
        : Phaser.Input.Keyboard.JustDown(k.slot2) ? 1
        : Phaser.Input.Keyboard.JustDown(k.slot3) ? 2
        : null,
      run: k.run.isDown,
      companionAttack: Phaser.Input.Keyboard.JustDown(k.companionAttack),
      weaponSlot: Phaser.Input.Keyboard.JustDown(k.hand1) ? 0
        : Phaser.Input.Keyboard.JustDown(k.hand2) ? 1
        : null,
      potionCycle: Phaser.Input.Keyboard.JustDown(k.potionCycle) ? 1 : 0,
      potionUse: Phaser.Input.Keyboard.JustDown(k.potionUse),
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
    for (const key of Object.values(this.#keys)) key.destroy();
  }
}
