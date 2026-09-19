import Phaser from 'phaser';

import { eventBus } from '../EventBus';
import { NEUTRAL_INTENT, type Intent, type IntentSource } from '../types';

type KeyName =
  | 'left' | 'right' | 'up' | 'down' | 'altLeft' | 'altRight' | 'altUp' | 'altDown'
  | 'run' | 'attack' | 'altAttack' | 'slot1' | 'slot2' | 'slot3' | 'slot4'
  | 'companionAttack' | 'hand1' | 'hand2' | 'potionCycle' | 'potionUse' | 'map';

/** The keys that report a press rather than a state. */
const EDGE_KEYS = [
  'attack', 'altAttack', 'slot1', 'slot2', 'slot3', 'slot4',
  'companionAttack', 'hand1', 'hand2', 'potionCycle', 'potionUse', 'map',
] as const satisfies readonly KeyName[];

type EdgeKey = (typeof EDGE_KEYS)[number];

/**
 * Translates this machine's input devices into an `Intent`.
 *
 * The rest of the game never sees a key code or a mouse button. Swapping this
 * for a gamepad, a replay, or an agent feed from the backend is a one-line
 * change at the call site, because everything downstream only consumes
 * `Intent`.
 */
export class DeviceIntentSource implements IntentSource {
  readonly #keys: Record<KeyName, Phaser.Input.Keyboard.Key>;

  /**
   * Presses seen since the last sample.
   *
   * Deliberately not `Phaser.Input.Keyboard.JustDown`. That reads a flag which
   * keydown sets and keyup *clears*, so a tap beginning and ending between two
   * frames is dropped entirely -- and it only reports the press if you ask,
   * which meant the `slot1 ? 1 : slot2 ? 2 : ...` chain below left the
   * unasked-for slots still flagged, to fire an ability a frame or two later
   * that nobody pressed. Latching on the key's own `down` event makes an edge
   * survive however long the frame took, and draining every latch each sample
   * makes a press fire exactly once, on the frame after it happened.
   */
  readonly #edges = new Set<EdgeKey>();

  /** Left mouse button, latched until the next sample so a click between
   *  frames is never dropped. */
  #clicked = false;
  /** A click the in-game bar has already used. Without this, equipping a
   *  weapon from the bar would also swing it on the way past. */
  #consumed = false;
  readonly #release: Array<() => void> = [];
  /** Set while a React menu is open. Edges are still consumed so a key
   *  pressed behind a menu never fires when it closes. */
  muted = false;

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
      // Space is the other attack key. It was already in addCapture below --
      // so the page did not scroll -- but nothing was ever bound to it, which
      // made Space the one key that looked deliberately handled and did
      // nothing at all.
      altAttack: keyboard.addKey(KeyCodes.SPACE),
      // Abilities sit on the number row, one per slot the weapon offers.
      slot1: keyboard.addKey(KeyCodes.ONE),
      slot2: keyboard.addKey(KeyCodes.TWO),
      slot3: keyboard.addKey(KeyCodes.THREE),
      slot4: keyboard.addKey(KeyCodes.FOUR),
      // C, not K: K opens the skill tree in the React shell, and both
      // layers see the same keyboard.
      companionAttack: keyboard.addKey(KeyCodes.C),
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
      // H, not F: F toggles fullscreen in the React shell.
      potionUse: keyboard.addKey(KeyCodes.H),
      map: keyboard.addKey(KeyCodes.M),
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

    for (const name of EDGE_KEYS) {
      const key = this.#keys[name];
      const onDown = () => { this.#edges.add(name); };
      key.on(Phaser.Input.Keyboard.Events.DOWN, onDown);
      this.#release.push(() => key.off(Phaser.Input.Keyboard.Events.DOWN, onDown));
    }

    // The bar runs in its own scene, whose input is processed before this one
    // is sampled, so a flag set there is always seen on the right frame.
    this.#release.push(
      eventBus.on('hud:pointer-used', () => { this.#consumed = true; }),
    );
  }

  /** Was this key pressed since the last sample? Consumes the press. */
  #took(name: EdgeKey): boolean {
    return this.#edges.delete(name);
  }

  sample(): Intent {
    const k = this.#keys;
    if (this.muted) {
      // Drop every pending press so nothing fires when the menu closes.
      this.#edges.clear();
      this.#takeClick();
      return { ...NEUTRAL_INTENT };
    }
    const left = k.left.isDown || k.altLeft.isDown;
    const right = k.right.isDown || k.altRight.isDown;
    const up = k.up.isDown || k.altUp.isDown;
    const down = k.down.isDown || k.altDown.isDown;

    // Every edge is taken before any of them is used: `a ? 1 : b ? 2 : null`
    // would stop asking after the first hit and leave the rest latched for a
    // later frame. Same reason the click is taken before the `||` below it.
    const clicked = this.#takeClick();
    const hitAttack = this.#took('attack');
    const hitAltAttack = this.#took('altAttack');
    const slot1 = this.#took('slot1');
    const slot2 = this.#took('slot2');
    const slot3 = this.#took('slot3');
    const slot4 = this.#took('slot4');
    const hand1 = this.#took('hand1');
    const hand2 = this.#took('hand2');

    return {
      moveX: (right ? 1 : 0) - (left ? 1 : 0),
      moveY: (down ? 1 : 0) - (up ? 1 : 0),
      attack: hitAttack || hitAltAttack || clicked,
      // 1-indexed: this is the server's `InputMessage.ability` slot, not an
      // array index. The sandbox counted from 0 because it had no server.
      ability: slot1 ? 1 : slot2 ? 2 : slot3 ? 3 : slot4 ? 4 : null,
      run: k.run.isDown,
      companionAttack: this.#took('companionAttack'),
      weaponSlot: hand1 ? 0 : hand2 ? 1 : null,
      potionCycle: this.#took('potionCycle') ? 1 : 0,
      potionUse: this.#took('potionUse'),
      mapToggle: this.#took('map'),
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
