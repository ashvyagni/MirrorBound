/**
 * What every key does, and which key does it.
 *
 * Logesh's `state/Keybinds.ts`, adapted to `main`'s control set. His design is
 * kept whole -- one table, two keys per action, steal-rather-than-refuse on a
 * conflict, a reserved set that cannot be bound, validation on the way out of
 * storage -- because it is the right shape and it was already written.
 *
 * What changed: `main` has four abilities rather than three, no companion
 * attack key, two potions on their own keys, and five interface screens. The
 * table below is `main`'s controls, not his.
 *
 * One table serves both halves of the input. Phaser reads it for movement and
 * combat (`KeyboardIntentSource`); React reads it for the menu and world keys
 * (`useHotkeys`). Both compare on Phaser's key codes, which are the same
 * numbers `KeyboardEvent.keyCode` reports, so there is one source of truth and
 * no second table to drift.
 */

import Phaser from 'phaser';

export type Action =
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'run'
  | 'attack' | 'dash' | 'ability1' | 'ability2' | 'ability3' | 'ability4'
  | 'ability5' | 'ability6'
  | 'swapWeapon' | 'healthPotion' | 'manaPotion'
  | 'interact' | 'character' | 'inventory' | 'skills' | 'map' | 'pause' | 'debug'
  // The in-canvas HUD's own: the potion dial is one slot you turn and drink
  // from rather than one key per flask, and the console is how anything gets
  // put in the room without a menu for it.
  | 'potionCycle' | 'potionUse' | 'companion' | 'console';

/** A binding is two keys, because movement has always had arrows and WASD. */
export interface Binding {
  primary: number;
  secondary?: number;
}

export interface ActionInfo {
  action: Action;
  label: string;
  /** Rows are grouped under these in the Controls screen. */
  group: 'Movement' | 'Combat' | 'Items' | 'Interface';
}

const K = Phaser.Input.Keyboard.KeyCodes;

/**
 * Mouse buttons live in the same number space as keys, above every key code.
 *
 * One table has to hold both, because an action is bound to "whatever the
 * player presses" and that is as often a mouse button as a key. Phaser's key
 * codes stop well below 256, so anything at or above this base is a mouse
 * button and `button` is its DOM `MouseEvent.button` index.
 */
export const MOUSE_BASE = 1000;
export const MOUSE = {
  left: MOUSE_BASE + 0,
  middle: MOUSE_BASE + 1,
  right: MOUSE_BASE + 2,
  back: MOUSE_BASE + 3,
  forward: MOUSE_BASE + 4,
} as const;

export function isMouseCode(code: number): boolean {
  return code >= MOUSE_BASE;
}

/** The DOM button index a mouse code stands for. */
export function mouseButton(code: number): number {
  return code - MOUSE_BASE;
}

export function mouseCode(button: number): number {
  return MOUSE_BASE + button;
}

/** Every action, in the order the Controls screen lists them. */
export const ACTIONS: readonly ActionInfo[] = [
  { action: 'moveUp', label: 'Move up', group: 'Movement' },
  { action: 'moveDown', label: 'Move down', group: 'Movement' },
  { action: 'moveLeft', label: 'Move left', group: 'Movement' },
  { action: 'moveRight', label: 'Move right', group: 'Movement' },
  { action: 'run', label: 'Run', group: 'Movement' },

  { action: 'attack', label: 'Attack', group: 'Combat' },
  { action: 'dash', label: 'Dash', group: 'Combat' },
  { action: 'ability1', label: 'Ability 1', group: 'Combat' },
  { action: 'ability2', label: 'Ability 2', group: 'Combat' },
  { action: 'ability3', label: 'Ability 3', group: 'Combat' },
  { action: 'ability4', label: 'Ability 4', group: 'Combat' },
  { action: 'ability5', label: 'Ability 5', group: 'Combat' },
  { action: 'ability6', label: 'Ability 6', group: 'Combat' },

  { action: 'swapWeapon', label: 'Swap weapons', group: 'Items' },
  { action: 'healthPotion', label: 'Drink health potion', group: 'Items' },
  { action: 'manaPotion', label: 'Drink mana potion', group: 'Items' },

  { action: 'interact', label: 'Talk / interact', group: 'Interface' },
  { action: 'character', label: 'Character', group: 'Interface' },
  { action: 'inventory', label: 'Inventory', group: 'Interface' },
  { action: 'skills', label: 'Skills', group: 'Interface' },
  { action: 'map', label: 'World map', group: 'Interface' },
  { action: 'pause', label: 'Pause', group: 'Interface' },
  { action: 'debug', label: 'What the AI knows', group: 'Interface' },

  { action: 'potionCycle', label: 'Turn the potion dial', group: 'Items' },
  { action: 'potionUse', label: 'Drink', group: 'Items' },
  { action: 'companion', label: 'Call the twin', group: 'Combat' },
  { action: 'console', label: 'Console', group: 'Interface' },
];

export const DEFAULT_BINDINGS: Readonly<Record<Action, Binding>> = {
  moveUp: { primary: K.W, secondary: K.UP },
  moveDown: { primary: K.S, secondary: K.DOWN },
  moveLeft: { primary: K.A, secondary: K.LEFT },
  moveRight: { primary: K.D, secondary: K.RIGHT },
  run: { primary: K.SHIFT },
  // The mouse already aims, so the button under the aiming hand swings. J is
  // kept as the second binding for anyone playing on the keyboard alone.
  attack: { primary: MOUSE.left, secondary: K.J },
  // Dash is on Space whatever weapon grants it, rather than on whichever
  // ability slot that weapon happens to put it in -- the one movement button
  // should not move when you change swords.
  dash: { primary: K.SPACE },
  ability1: { primary: K.ONE },
  ability2: { primary: K.TWO },
  ability3: { primary: K.THREE },
  ability4: { primary: K.FOUR },
  ability5: { primary: K.FIVE },
  ability6: { primary: K.SIX },
  swapWeapon: { primary: K.Q },
  healthPotion: { primary: K.F },
  manaPotion: { primary: K.G },
  interact: { primary: K.E },
  character: { primary: K.C },
  inventory: { primary: K.I },
  skills: { primary: K.K },
  map: { primary: K.M },
  pause: { primary: K.P },
  debug: { primary: K.F3 },
  // The dial turns with R and pours with H. `healthPotion` and `manaPotion`
  // keep their own keys as well: the dial is the faster way once you know it
  // is there, and a direct key is the faster way before you do.
  potionCycle: { primary: K.R },
  potionUse: { primary: K.H },
  companion: { primary: K.T },
  console: { primary: K.BACK_SLASH },
};

/**
 * Keys the game refuses to bind.
 *
 * Not a style preference. Escape closes the screen you would be rebinding from
 * and always pauses, and F5 and F12 belong to the browser -- binding any of
 * them means the only way out of the mistake is clearing storage by hand.
 */
const RESERVED = new Set<number>([K.ESC, K.F5, K.F12, K.TAB]);

// v3 added two more ability keys, because a staff grants three abilities and
// two hands no longer fit in four. v2 added `dash` as its own action and moved
// attack onto the mouse. An older table is dropped rather than migrated row by
// row: it has no rows for the actions that were added, and the defaults are
// what those actions are meant to be on.
const STORAGE_KEY = 'mirrorbound.keybinds.v3';

/** Code to a readable name, built by inverting Phaser's own table. */
const NAMES: Record<number, string> = (() => {
  const out: Record<number, string> = {};
  for (const [name, code] of Object.entries(K)) {
    if (typeof code === 'number' && out[code] === undefined) out[code] = name;
  }
  // The inverted table is shouty and a few entries read badly on a key cap.
  return {
    ...out,
    [K.UP]: '↑', [K.DOWN]: '↓', [K.LEFT]: '←', [K.RIGHT]: '→',
    [K.SPACE]: 'Space', [K.SHIFT]: 'Shift', [K.CTRL]: 'Ctrl', [K.ALT]: 'Alt',
    [K.ONE]: '1', [K.TWO]: '2', [K.THREE]: '3', [K.FOUR]: '4',
    [K.FIVE]: '5', [K.SIX]: '6', [K.SEVEN]: '7', [K.EIGHT]: '8',
    [K.NINE]: '9', [K.ZERO]: '0',
    [K.BACKSPACE]: 'Bksp', [K.ENTER]: 'Enter', [K.COMMA]: ',', [K.PERIOD]: '.',
  };
})();

/** Mouse buttons read as M1..M5 -- shorter than "Left Click" on a key cap. */
const MOUSE_NAMES: Record<number, string> = {
  [MOUSE.left]: 'M1', [MOUSE.middle]: 'M3', [MOUSE.right]: 'M2',
  [MOUSE.back]: 'M4', [MOUSE.forward]: 'M5',
};

export function keyName(code: number | undefined): string {
  if (code === undefined || code < 0) return '—';
  if (isMouseCode(code)) return MOUSE_NAMES[code] ?? `M${mouseButton(code) + 1}`;
  return NAMES[code] ?? `#${code}`;
}

export interface Conflict {
  action: Action;
  label: string;
}

/**
 * The live binding table.
 *
 * Held here rather than in the scene because it outlives any one scene: a
 * rebind made from the Controls screen has to survive the play scene
 * restarting, and reading it back from storage on every restart is how the two
 * quietly diverge.
 */
export class Keybinds {
  #bindings: Record<Action, Binding>;
  readonly #listeners = new Set<() => void>();

  constructor() {
    this.#bindings = Keybinds.#load();
  }

  static #load(): Record<Action, Binding> {
    const base = structuredClone(DEFAULT_BINDINGS) as Record<Action, Binding>;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw) as Partial<Record<Action, Binding>>;
      for (const { action } of ACTIONS) {
        const b = saved[action];
        // Validate rather than trust: storage is edited by hand, survives a
        // rename, and a bad code here is a key that silently never fires.
        if (b && typeof b.primary === 'number') {
          base[action] = {
            primary: b.primary,
            ...(typeof b.secondary === 'number' ? { secondary: b.secondary } : {}),
          };
        }
      }
      // Migrate the old duplicate F/H dial binding and discard other duplicates.
      if (base.potionUse.primary === K.F && base.potionUse.secondary === K.H)
        base.potionUse = { primary: K.H };
      const used = new Set<number>();
      for (const { action } of ACTIONS) {
        const codes = [base[action].primary, base[action].secondary].filter(
          (code): code is number => typeof code === 'number' && Number.isInteger(code)
            && code > 0 && (code < 256 || (isMouseCode(code) && mouseButton(code) < 8))
            && !RESERVED.has(code) && !used.has(code),
        );
        const unique = [...new Set(codes)];
        unique.forEach((code) => used.add(code));
        base[action] = { primary: unique[0] ?? -1, ...(unique[1] ? { secondary: unique[1] } : {}) };
      }
      return base;
    } catch {
      return base;
    }
  }

  #save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#bindings));
    } catch {
      /* private mode: bindings simply do not persist */
    }
    for (const listener of [...this.#listeners]) listener();
  }

  /** Called whenever any binding changes, so the input source can rebuild. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get(action: Action): Binding {
    return this.#bindings[action];
  }

  all(): Readonly<Record<Action, Binding>> {
    return this.#bindings;
  }

  /** The keys bound to an action, primary first, unbound ones dropped. */
  codes(action: Action): number[] {
    const b = this.#bindings[action];
    return [b.primary, b.secondary].filter((c): c is number => typeof c === 'number' && c >= 0);
  }

  /**
   * Which action this key code fires, if any.
   *
   * What React's hotkey handler asks, once per keydown, so it never needs a
   * key-name table of its own.
   */
  actionFor(code: number): Action | null {
    for (const { action } of ACTIONS) {
      const b = this.#bindings[action];
      if (b.primary === code || b.secondary === code) return action;
    }
    return null;
  }

  /** Whether a key may be bound at all. */
  static reserved(code: number): boolean {
    return RESERVED.has(code);
  }

  /** Which other action already uses this key, if any. */
  conflict(code: number, exclude: Action): Conflict | null {
    for (const { action, label } of ACTIONS) {
      if (action === exclude) continue;
      const b = this.#bindings[action];
      if (b.primary === code || b.secondary === code) return { action, label };
    }
    return null;
  }

  /**
   * Bind a key, taking it off whatever held it.
   *
   * Stealing rather than refusing: a player rebinding attack to `K` means they
   * want attack on `K`, and refusing it leaves them to work out that the skill
   * screen has it first. The row that lost its key shows a dash, which is a
   * problem you can see rather than one you have to deduce.
   */
  set(action: Action, slot: 'primary' | 'secondary', code: number): Conflict | null {
    if (Keybinds.reserved(code)) return null;

    const taken = this.conflict(code, action);
    if (taken) {
      const other = this.#bindings[taken.action];
      if (other.primary === code) {
        // Promote the spare so the action is not left unbound when it has one.
        this.#bindings[taken.action] = other.secondary !== undefined
          ? { primary: other.secondary }
          : { primary: -1 };
      } else {
        this.#bindings[taken.action] = { primary: other.primary };
      }
    }

    const current = this.#bindings[action];
    this.#bindings[action] = slot === 'primary'
      ? { primary: code, ...(current.secondary !== undefined && current.secondary !== code ? { secondary: current.secondary } : {}) }
      : current.primary === code ? { primary: code } : { primary: current.primary, secondary: code };

    this.#save();
    return taken;
  }

  /** Drop a binding's second key. The primary is never cleared this way --
   *  an action with no key at all is a control the player cannot get back. */
  clearSecondary(action: Action): void {
    const { primary } = this.#bindings[action];
    this.#bindings[action] = { primary };
    this.#save();
  }

  reset(): void {
    this.#bindings = structuredClone(DEFAULT_BINDINGS) as Record<Action, Binding>;
    this.#save();
  }
}

/** One table for the whole session. */
export const keybinds = new Keybinds();

/**
 * The key code for a DOM keyboard event, in Phaser's numbering.
 *
 * `keyCode` is deprecated but every browser still reports it, and for the keys
 * this game binds -- letters, digits, arrows, space, shift, function keys --
 * it is exactly Phaser's `KeyCodes`. `code` is the modern field but names keys
 * by physical position (`KeyA`), which would need its own translation table;
 * one table is the whole point of this file.
 */
export function eventKeyCode(e: KeyboardEvent): number {
  return e.keyCode || e.which || 0;
}
