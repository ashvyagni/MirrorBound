import { ITEM_NAMES, type ItemName } from '../animation/items';
import { MOBS, MOB_IDS, type MobId } from '../entities/Mob';

/**
 * What the console can do.
 *
 * A table rather than a switch, because the same table has to answer two
 * questions -- "run this" and "what might they be typing" -- and two lists that
 * have to agree is one list that eventually does not.
 */

export interface Suggestion {
  value: string;
  hint: string;
}

/** What the console needs from the world in order to change it. */
export interface CommandHost {
  spawnMob(id: MobId): string;
  spawnItem(item: ItemName): string;
  spawnBoss(): string;
  clearSpawned(): string;
}

interface Target {
  /** What you type. */
  token: string;
  /** What it is, shown dim to the right. */
  hint: string;
  run(host: CommandHost): string;
}

/** Everything `spawn` accepts, in the order it completes them. */
export const SPAWNABLE: readonly Target[] = [
  { token: 'mirror', hint: 'the boss', run: (h) => h.spawnBoss() },
  ...MOB_IDS.map((id) => ({
    token: id,
    hint: MOBS[id].name,
    run: (h: CommandHost) => h.spawnMob(id),
  })),
  ...ITEM_NAMES.map((item) => ({
    token: item,
    hint: item.endsWith('_potion') ? 'potion' : 'item',
    run: (h: CommandHost) => h.spawnItem(item),
  })),
];

const VERBS = ['spawn', 'clear', 'help'] as const;

/**
 * Best completion for a partial line.
 *
 * Prefix matches first and in table order, so the same half-typed word always
 * completes to the same thing -- a suggestion that changes between keystrokes
 * is a suggestion nobody trusts enough to press Tab on.
 */
export function complete(line: string): Suggestion | null {
  const lower = line.toLowerCase();
  const space = lower.indexOf(' ');

  if (space === -1) {
    const verb = VERBS.find((v) => v.startsWith(lower));
    if (!verb) return null;
    return {
      value: verb === 'spawn' ? 'spawn ' : verb,
      hint: verb === 'spawn' ? 'spawn <thing>'
        : verb === 'clear' ? 'remove everything spawned'
        : 'list the commands',
    };
  }

  const verb = lower.slice(0, space);
  if (verb !== 'spawn') return null;

  const rest = lower.slice(space + 1);
  const target = SPAWNABLE.find((t) => t.token.toLowerCase().startsWith(rest));
  if (!target) return null;
  return { value: `spawn ${target.token}`, hint: target.hint };
}

/** Run a line. Always returns something to show, including on failure. */
export function run(line: string, host: CommandHost): string {
  const [verb, ...rest] = line.trim().split(/\s+/);
  const lower = (verb ?? '').toLowerCase();

  if (lower === 'help') {
    return 'spawn <thing> · clear · help   —   Tab completes, ↑ recalls';
  }
  if (lower === 'clear') return host.clearSpawned();

  if (lower === 'spawn') {
    const token = (rest[0] ?? '').toLowerCase();
    if (!token) return 'spawn what? Tab lists what there is.';
    const target = SPAWNABLE.find((t) => t.token.toLowerCase() === token);
    // An exact miss falls back to a prefix, so a half-typed name still works
    // when you hit Enter instead of Tab.
    const guess = target ?? SPAWNABLE.find((t) => t.token.toLowerCase().startsWith(token));
    if (!guess) return `No such thing: ${token}`;
    return guess.run(host);
  }

  return `Unknown command: ${verb}`;
}
