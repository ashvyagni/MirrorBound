import Phaser from 'phaser';

import { eventBus } from '../EventBus';
import { isMouseCode, keybinds, mouseButton, type Action } from '../state/Keybinds';
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
 *
 * Mouse buttons are ordinary bindings, not a special case: the table holds key
 * codes and mouse codes in one number space, so "attack is M1" is stored,
 * shown and rebound exactly the way "attack is J" is. Attack defaults to the
 * left button because the pointer already aims and the hand is already there.
 */

/** The actions this source samples. The rest of the table belongs to React. */
const SAMPLED = [
  'moveUp', 'moveDown', 'moveLeft', 'moveRight', 'run',
  'attack', 'dash', 'ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'ability6',
] as const satisfies readonly Action[];

type Sampled = (typeof SAMPLED)[number];

/** The ability keys in slot order, so slot N is always `ABILITY_KEYS[N - 1]`. */
const ABILITY_KEYS = [
  'ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'ability6',
] as const satisfies readonly Sampled[];

export class KeyboardIntentSource implements IntentSource {
  readonly #keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  /** Every Phaser key per action: primary and secondary, in that order. */
  #keys!: Record<Sampled, Phaser.Input.Keyboard.Key[]>;
  readonly #unsubscribe: () => void;
  readonly #teardown: Array<() => void> = [];
  /** Mouse buttons bound to an action, by DOM button index. */
  #mouseCodes!: Record<Sampled, number[]>;
  /** Buttons currently held. */
  #mouseHeld = new Set<number>();
  /** Buttons pressed since the last sample, consumed like a key edge. */
  #mouseEdges = new Set<number>();
  /** Set when a HUD element took this click, so the world never also sees it. */
  #pointerClaimed = false;
  /** Key codes currently held by Phaser's capture list. */
  #captured: number[] = [];
  /**
   * The ability slot holding the dash, or null when nothing equipped grants
   * one. Set by the scene from each snapshot.
   */
  dashSlot: number | null = null;
  #muted = false;
  get muted(): boolean { return this.#muted; }
  /**
   * Mute the game's own input while a menu or a text field owns the keyboard.
   *
   * Releasing the *capture* matters as much as resetting the keys. Phaser
   * captures movement and combat keys so the browser does not scroll the page
   * on them, and a captured key is `preventDefault`ed before anything else
   * sees it -- which meant W, A, S and D could not be typed into the naming
   * prompt at all. Muting has to hand the keyboard back, not just stop reading
   * it.
   */
  set muted(value: boolean) {
    if (value !== this.#muted) {
      for (const keys of Object.values(this.#keys)) for (const key of keys) key.reset();
      this.#mouseHeld.clear();
      this.#mouseEdges.clear();
      if (value) this.#keyboard.removeCapture(this.#captured);
      else this.#keyboard.addCapture(this.#captured);
    }
    this.#muted = value;
  }

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin, input?: Phaser.Input.InputPlugin) {
    this.#keyboard = keyboard;
    this.#build();
    // A rebind from the Controls screen takes effect on the next frame rather
    // than on the next scene restart, which is the difference between the
    // setting working and the setting appearing to work.
    this.#unsubscribe = keybinds.onChange(() => this.#build());
    if (input) this.#watchPointer(input);
  }

  /**
   * Track mouse buttons on the world.
   *
   * Presses are latched rather than read live, because a click can land and
   * end between two `sample()` calls and an attack that depends on the frame
   * rate is an attack that goes missing. `hud:pointer-used` arrives from
   * whichever HUD control took the click; a click on a button is not also a
   * swing.
   */
  #watchPointer(input: Phaser.Input.InputPlugin): void {
    const claimed = () => { this.#pointerClaimed = true; };
    const down = (pointer: Phaser.Input.Pointer) => {
      if (this.#muted) return;
      const button = pointer.button;
      this.#pointerClaimed = false;
      // The HUD lives in another scene and takes the same pointer event, so
      // its claim can arrive after this one. Settle it at the end of the tick.
      queueMicrotask(() => {
        if (this.#pointerClaimed) return;
        this.#mouseHeld.add(button);
        this.#mouseEdges.add(button);
      });
    };
    const up = (pointer: Phaser.Input.Pointer) => this.#mouseHeld.delete(pointer.button);
    // Without this, binding attack to M2 opens the browser menu on every swing.
    const canvas = input.manager.canvas;
    const menu = (event: Event) => event.preventDefault();
    canvas?.addEventListener('contextmenu', menu);

    input.on(Phaser.Input.Events.POINTER_DOWN, down);
    input.on(Phaser.Input.Events.POINTER_UP, up);
    // A button released off-canvas never reports an up, and would stay held.
    const blur = () => this.#mouseHeld.clear();
    window.addEventListener('blur', blur);

    const off = eventBus.on('hud:pointer-used', claimed);
    this.#teardown.push(() => {
      input.off(Phaser.Input.Events.POINTER_DOWN, down);
      input.off(Phaser.Input.Events.POINTER_UP, up);
      canvas?.removeEventListener('contextmenu', menu);
      window.removeEventListener('blur', blur);
      off();
    });
  }

  #build(): void {
    // Release the old objects first: Phaser keys a key per code and leaving
    // them behind means a rebound key keeps reporting under its old action.
    if (this.#keys) for (const keys of Object.values(this.#keys)) for (const k of keys) this.#keyboard.removeKey(k, true, true);

    const built = {} as Record<Sampled, Phaser.Input.Keyboard.Key[]>;
    const mice = {} as Record<Sampled, number[]>;
    const capture: number[] = [];
    for (const action of SAMPLED) {
      const all = keybinds.codes(action);
      // One table holds both, so each binding is sorted to the half that can
      // read it. A mouse code handed to `addKey` would bind a stray keyboard
      // key, because 1000 is a number like any other to Phaser.
      const keys = all.filter((code) => !isMouseCode(code));
      mice[action] = all.filter(isMouseCode).map(mouseButton);
      built[action] = keys.map((code) => this.#keyboard.addKey(code));
      // Stop the browser scrolling the page on whatever movement and attack
      // are bound to, which is why this is derived rather than a fixed list.
      if (action !== 'run') capture.push(...keys);
    }
    this.#mouseCodes = mice;
    this.#keys = built;
    // A rebind while muted must not quietly re-capture the keyboard a text
    // field is using: the list is remembered and applied when unmuting.
    if (this.#captured.length) this.#keyboard.removeCapture(this.#captured);
    this.#captured = capture;
    if (!this.#muted) this.#keyboard.addCapture(capture);
  }

  /** True on the frame the action was pressed, consuming the edge. */
  #justDown(action: Sampled): boolean {
    let fired = false;
    // Every key, not the first match: `JustDown` consumes, so short-circuiting
    // would leave the other key's edge to fire again on a later frame.
    for (const key of this.#keys[action]) {
      if (Phaser.Input.Keyboard.JustDown(key)) fired = true;
    }
    for (const button of this.#mouseCodes[action]) {
      if (this.#mouseEdges.delete(button)) fired = true;
    }
    return fired;
  }

  #isDown(action: Sampled): boolean {
    return this.#keys[action].some((key) => key.isDown)
      || this.#mouseCodes[action].some((button) => this.#mouseHeld.has(button));
  }

  sample(): Intent {
    if (this.muted) {
      // Consume edges so a key pressed while a menu was open doesn't fire later.
      this.#justDown('attack');
      this.#justDown('dash');
      for (const a of ABILITY_KEYS) this.#justDown(a);
      this.#mouseEdges.clear();
      return { moveX: 0, moveY: 0, attack: false, run: false, ability: null, aimX: 0, aimY: 0 };
    }

    // Dash is read first and wins: it is the one ability with a key of its
    // own, and the slot it resolves to is whichever slot the equipped weapon
    // put `shadow_dash` in. The scene keeps `dashSlot` in step with the
    // snapshot, because only the snapshot knows what is equipped.
    let ability: number | null = null;
    const dashed = this.#justDown('dash');
    if (dashed && this.dashSlot !== null) ability = this.dashSlot;
    // First key down wins, and every one is read so none keeps its edge.
    for (let i = 0; i < ABILITY_KEYS.length; i += 1) {
      if (this.#justDown(ABILITY_KEYS[i]!) && ability === null) ability = i + 1;
    }

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
      // The scene fills these: aiming needs the pointer, the camera and the
      // player's position, and none of the three belong to a key table.
      aimX: 0,
      aimY: 0,
    };
  }

  destroy(): void {
    this.#unsubscribe();
    for (const off of this.#teardown) off();
    for (const keys of Object.values(this.#keys)) for (const key of keys) this.#keyboard.removeKey(key, true, true);
  }
}
