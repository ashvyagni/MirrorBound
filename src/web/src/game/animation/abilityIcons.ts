import type { IconName } from './icons';

/**
 * The server's ability ids, in the icon set's spelling.
 *
 * Two vocabularies meet here. The server names abilities for what they do --
 * `arcane_bolt`, `flame_burst`, `aegis` -- and the icon sheet names its eight
 * frames after the sandbox's spells, which were drawn before the server had
 * abilities at all. Neither is wrong and neither is going to change, so the
 * translation lives in one table rather than in the rail and the hotbar
 * separately.
 *
 * Three of the six have no icon of their own yet and borrow the nearest one.
 * They are marked, because a borrowed icon is a thing to fix and not a
 * decision: `docs/art-prompts.md` sheet 85 draws the four that are missing.
 */
const ICONS: Readonly<Record<string, IconName>> = {
  arcane_bolt: 'fireBall',
  flame_burst: 'fireWave',
  binding_nova: 'iceNova',
  // Borrowed until sheet 85 lands.
  shadow_dash: 'arrow',
  mending_light: 'iceBeam',
  aegis: 'sword',
};

/**
 * The icon each carried weapon shows in the hotbar.
 *
 * A caster shows what it casts; the sword, which has no spell to borrow from,
 * has its own mark. `WeaponDef` carried this field in the sandbox and does not
 * any more, so it lives beside the ability table rather than in a second one.
 */
const WEAPON_ICONS: Readonly<Record<string, IconName>> = {
  sword: 'sword',
  bow: 'arrow',
  fireStaff: 'fireBall',
  iceStaff: 'iceNova',
};

/** An icon for a carried weapon. */
export function weaponIcon(id: string): IconName {
  return WEAPON_ICONS[id] ?? 'sword';
}

/** Ability ids still drawing someone else's icon. */
export const BORROWED_ICONS: readonly string[] = ['shadow_dash', 'mending_light', 'aegis'];

/**
 * An icon for an ability id.
 *
 * Falls back to the sword rather than throwing: a server that adds a seventh
 * ability should put a plain mark on the rail, not empty the rail.
 */
export function abilityIcon(id: string): IconName {
  return ICONS[id] ?? 'sword';
}
