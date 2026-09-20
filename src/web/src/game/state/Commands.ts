import { ITEM_NAMES } from '../animation/items';
import type { CommandMessage } from '../contracts';

/**
 * What the console can do.
 *
 * A table rather than a switch, because the same table has to answer two
 * questions -- "run this" and "what might they be typing" -- and two lists that
 * have to agree are one list that eventually does not.
 *
 * Every verb here is a `CommandMessage` the server already accepts. The
 * sandbox's console spawned creatures into the room directly; nothing does
 * that any more, because the room belongs to the server and a client that
 * invented a skeleton would be corrected by the next snapshot. What replaces
 * it is more useful anyway: travel, equip, unlock and respec are the things
 * worth reaching for without a menu.
 */

export interface Suggestion {
  value: string;
  hint: string;
}

/** Areas the campaign defines, in map order. */
export const AREAS: readonly { id: string; name: string }[] = [
  { id: 'hollow_reach', name: 'village · grove' },
  { id: 'wakewood_crypt', name: 'dungeon · grove' },
  { id: 'emberfall', name: 'village · ruins' },
  { id: 'ashen_deep', name: 'dungeon · ruins · the Warden' },
  { id: 'mirror_sanctum', name: 'dungeon · crypt · the Mirror' },
  { id: 'the_proving', name: 'sandbox · empty, and nothing here counts' },
];

/** The four weapons the server ships with. */
export const WEAPON_IDS: readonly { id: string; name: string }[] = [
  { id: 'iron_sword', name: 'sword' },
  { id: 'hunter_bow', name: 'bow' },
  { id: 'ember_staff', name: 'fire staff' },
  { id: 'frost_staff', name: 'ice staff' },
];

/**
 * What `give` offers, which is the four plus the testing tool.
 *
 * Kept apart from `WEAPON_IDS` so the admin stick cannot be completed anywhere
 * that stands for something a player earns -- `equip` only lists what you can
 * actually own, and the stick is not loot.
 */
export const GIVEABLE: readonly { id: string; name: string }[] = [
  ...WEAPON_IDS,
  { id: 'admin_stick', name: 'admin stick · deletes what it touches' },
];

interface Verb {
  /** What you type. */
  token: string;
  /** What it does, shown dim to the right. */
  hint: string;
  /** Completions for the argument, if it takes one. */
  options?: readonly { id: string; name: string }[];
  /** The message to send. `arg` is the resolved option id. */
  build(arg: string): Omit<CommandMessage, 'type'> | string;
}

/**
 * Everything `spawn` accepts, in the order it completes them.
 *
 * These are `ARCHETYPES` on the server verbatim. What comes back is a real
 * enemy with a real `EnemyDef`, a real controller and a real loot table --
 * the Mirror summoned here is the Mirror, and it will come for you.
 */
export const SPAWNABLE: readonly { id: string; name: string }[] = [
  { id: 'mirror', name: 'the final boss' },
  { id: 'warden', name: 'the Ashen Warden · guardian' },
  { id: 'skeleton', name: 'Bone Knight' },
  { id: 'archer', name: 'Hollow Archer' },
  { id: 'hound', name: 'Gloom Hound' },
  { id: 'slime', name: 'Mire Slime' },
  { id: 'acolyte', name: 'Ash Acolyte' },
  { id: 'brute', name: 'Crypt Brute' },
  { id: 'scarab', name: 'Husk Scarab' },
];

const VERBS: readonly Verb[] = [
  {
    token: 'spawn', hint: 'put an enemy in the room', options: SPAWNABLE,
    build: (enemyType) => (enemyType
      ? { action: 'SPAWN', enemyType }
      : 'spawn what? Tab lists what there is.'),
  },
  {
    token: 'travel', hint: 'go to an area', options: AREAS,
    build: (areaId) => (areaId ? { action: 'TRAVEL', areaId } : 'travel where?'),
  },
  {
    token: 'equip', hint: 'draw a weapon', options: WEAPON_IDS,
    build: (weaponId) => (weaponId ? { action: 'EQUIP_WEAPON', weaponId } : 'equip what?'),
  },
  {
    token: 'use', hint: 'drink or consume',
    options: ITEM_NAMES.map((id) => ({ id, name: id.replace(/_/g, ' ') })),
    build: (itemId) => (itemId ? { action: 'USE_ITEM', itemId } : 'use what?'),
  },
  {
    token: 'give', hint: 'drop a weapon in front of you', options: GIVEABLE,
    build: (weaponId) => (weaponId ? { action: 'GIVE', weaponId } : 'give what?'),
  },
  {
    // `arm mirror <weapon>` would need two arguments and the console takes one,
    // so the weapon is the argument and the Mirror is implied -- it is the only
    // thing there is to arm.
    token: 'arm', hint: 'give the Mirror a weapon', options: GIVEABLE,
    build: (weaponId) => (weaponId ? { action: 'CONFIGURE_BOSS', bossWeapon: weaponId } : 'arm it with what?'),
  },
  {
    token: 'skill', hint: 'how much of you the Mirror already knows',
    options: [
      { id: '0', name: 'none · generic boss until it watches you' },
      { id: '0.5', name: 'half' },
      { id: '1', name: 'everything · counters from the first second' },
    ],
    build: (value) => (value ? { action: 'CONFIGURE_BOSS', bossSkill: Number(value) } : 'skill how much? 0 to 1.'),
  },
  { token: 'swap', hint: 'trade the two carried weapons', build: () => ({ action: 'SWAP_WEAPON' }) },
  { token: 'respec', hint: 'refund every skill point', build: () => ({ action: 'RESPEC' }) },
  { token: 'save', hint: 'write the run to disk', build: () => ({ action: 'SAVE' }) },
  { token: 'restart', hint: 'start the run again', build: () => ({ action: 'RESTART' }) },
  { token: 'pause', hint: 'stop the world', build: () => ({ action: 'PAUSE' }) },
  { token: 'resume', hint: 'start it again', build: () => ({ action: 'RESUME' }) },
  { token: 'help', hint: 'list the commands', build: () => HELP },
];

const HELP = VERBS.map((v) => v.token).join(' · ') + '   —   Tab completes, ↑ recalls';

/** What the console needs from the game in order to change it. */
export interface CommandHost {
  send(message: Omit<CommandMessage, 'type'>): void;
}

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
    const verb = VERBS.find((v) => v.token.startsWith(lower));
    if (!verb) return null;
    return {
      value: verb.options ? `${verb.token} ` : verb.token,
      hint: verb.hint,
    };
  }

  const verb = VERBS.find((v) => v.token === lower.slice(0, space));
  if (!verb?.options) return null;

  const rest = lower.slice(space + 1);
  const option = verb.options.find((o) => o.id.toLowerCase().startsWith(rest));
  if (!option) return null;
  return { value: `${verb.token} ${option.id}`, hint: option.name };
}

/** Run a line. Always returns something to show, including on failure. */
export function run(line: string, host: CommandHost): string {
  const [word, ...rest] = line.trim().split(/\s+/);
  const lower = (word ?? '').toLowerCase();
  const verb = VERBS.find((v) => v.token === lower);
  if (!verb) return `Unknown command: ${word}`;

  let arg = (rest[0] ?? '').toLowerCase();
  if (verb.options && arg) {
    // An exact miss falls back to a prefix, so a half-typed name still works
    // when you hit Enter instead of Tab.
    const option = verb.options.find((o) => o.id.toLowerCase() === arg)
      ?? verb.options.find((o) => o.id.toLowerCase().startsWith(arg));
    if (!option) return `No such thing: ${arg}`;
    arg = option.id;
  }

  const built = verb.build(arg);
  if (typeof built === 'string') return built;
  host.send(built);
  return `${verb.token}${arg ? ` ${arg}` : ''} — sent.`;
}
