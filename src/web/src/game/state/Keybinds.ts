import Phaser from 'phaser';

/**
 * What every key does, and which key does it.
 *
 * `DeviceIntentSource` was the only thing in the game that knew a key code, and
 * that is exactly what made this cheap: the rest of the game consumes `Intent`
 * and has never heard of a keyboard. Rebinding is therefore a change to one
 * table and a rebuild of one object, not a hunt through the codebase.
 *
 * `main` has a `KEYBINDS` list, but it is a read-only one for display -- the
 * keys there are hardcoded too. This is new on both sides.
 */

export type Action =
  | 'moveLeft' | 'moveRight' | 'moveUp' | 'moveDown'
  | 'run' | 'attack' | 'companion'
  | 'ability1' | 'ability2' | 'ability3'
  | 'hand1' | 'hand2'
  | 'potionCycle' | 'potionUse'
  | 'map' | 'pause' | 'console' | 'interact';

/** A binding is two keys, because movement has always had arrows and WASD. */
export interface Binding {
  primary: number;
  secondary?: number;
}

export interface ActionInfo {
  action: Action;
  label: string;
  /** Rows are grouped under these in the settings screen. */
  group: 'Movement' | 'Combat' | 'Loadout' | 'Interface';
}

const K = Phaser.Input.Keyboard.KeyCodes;

/** Every action, in the order the settings screen lists them. */
export const ACTIONS: readonly ActionInfo[] = [
  { action: 'moveUp', label: 'Move up', group: 'Movement' },
  { action: 'moveDown', label: 'Move down', group: 'Movement' },
  { action: 'moveLeft', label: 'Move left', group: 'Movement' },
  { action: 'moveRight', label: 'Move right', group: 'Movement' },
  { action: 'run', label: 'Run', group: 'Movement' },

  { action: 'attack', label: 'Attack', group: 'Combat' },
  { action: 'ability1', label: 'Ability 1', group: 'Combat' },
  { action: 'ability2', label: 'Ability 2', group: 'Combat' },
  { action: 'ability3', label: 'Ability 3', group: 'Combat' },
  { action: 'companion', label: 'Companion attack', group: 'Combat' },

  { action: 'hand1', label: 'Draw first hand', group: 'Loadout' },
  { action: 'hand2', label: 'Draw second hand', group: 'Loadout' },
  { action: 'potionCycle', label: 'Turn the potion dial', group: 'Loadout' },
  { action: 'potionUse', label: 'Drink', group: 'Loadout' },

  { action: 'map', label: 'Map', group: 'Interface' },
  { action: 'pause', label: 'Pause', group: 'Interface' },
  { action: 'interact', label: 'Interact', group: 'Interface' },
  { action: 'console', label: 'Console', group: 'Interface' },
];

export const DEFAULT_BINDINGS: Readonly<Record<Action, Binding>> = {
  moveUp: { primary: K.UP, secondary: K.W },
  moveDown: { primary: K.DOWN, secondary: K.S },
  moveLeft: { primary: K.LEFT, secondary: K.A },
  moveRight: { primary: K.RIGHT, secondary: K.D },
  run: { primary: K.SHIFT },
  attack: { primary: K.J },
  companion: { primary: K.K },
  ability1: { primary: K.ONE },
  ability2: { primary: K.TWO },
  ability3: { primary: K.THREE },
  hand1: { primary: K.Q },
  hand2: { primary: K.E },
  potionCycle: { primary: K.R },
  potionUse: { primary: K.F },
  map: { primary: K.M },
  pause: { primary: K.P },
  // Space, not E: E already draws the second hand, and the defaults are not
  // run through the conflict checker -- a duplicate here fires both actions.
  interact: { primary: K.SPACE },
  console: { primary: K.BACK_SLASH },
};

/**
 * Keys the game refuses to bind.
 *
 * Not a style preference. Escape closes the screen you would be rebinding from,
 * and F5 and F12 belong to the browser -- binding either means the only way out
 * of the mistake is clearing storage by hand.
 */
const RESERVED = new Set<number>([K.ESC, K.F5, K.F12, K.TAB]);

const STORAGE_KEY = 'mirrorbound.keybinds.v1';

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
    [K.BACK_SLASH]: '\\', [K.BACKSPACE]: 'Bksp', [K.ENTER]: 'Enter', [K.COMMA]: ',', [K.PERIOD]: '.',
  };
})();

export function keyName(code: number | undefined): string {
  if (code === undefined) return '—';
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
 * rebind made from the settings screen has to survive the play scene
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
   * want attack on `K`, and refusing it leaves them to work out that the
   * companion has it first. The row that lost its key shows a dash, which is a
   * problem you can see rather than one you have to deduce.
   */
  set(action: Action, slot: 'primary' | 'secondary', code: number): Conflict | null {
    if (Keybinds.reserved(code)) return null;

    const taken = this.conflict(code, action);
    if (taken) {
      const other = this.#bindings[taken.action];
      if (other.primary === code) {
        // Promote the spare so the action is not left unbound when it has one.
        if (other.secondary !== undefined) {
          this.#bindings[taken.action] = { primary: other.secondary };
        } else {
          this.#bindings[taken.action] = { primary: -1 };
        }
      } else {
        this.#bindings[taken.action] = { primary: other.primary };
      }
    }

    const current = this.#bindings[action];
    this.#bindings[action] = slot === 'primary'
      ? { primary: code, ...(current.secondary !== undefined ? { secondary: current.secondary } : {}) }
      : { primary: current.primary, secondary: code };

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
