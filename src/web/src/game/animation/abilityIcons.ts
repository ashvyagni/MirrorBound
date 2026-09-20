import { drawnIcon, icon, type IconArt, type IconName } from './icons';

/**
 * The server's ability ids, in the icon set's spelling.
 *
 * Two vocabularies meet here. The server names abilities for what they do --
 * `arcane_bolt`, `flame_burst`, `aegis` -- and the first icon sheet names its
 * eight frames after the sandbox's spells, which were drawn before the server
 * had abilities at all. Neither is wrong and neither is going to change, so the
 * translation lives in one table rather than in the rail and the hotbar
 * separately.
 *
 * Sheet 85 changed what this table is for. Nothing is borrowed any more: the
 * dash, the ward and the heal have their own marks, and `arcane_bolt` has one
 * drawn as a bolt of light rather than the ice beam it was standing in for.
 * The frames on that sheet are the ability ids verbatim, which is why its half
 * of this table looks redundant -- it is the translation being the identity,
 * and it is worth keeping visible that these four resolve somewhere else.
 */
const ICONS: Readonly<Record<string, IconArt>> = {
  // The staves' six, each on the sheet drawn for exactly that spell.
  ember_bolt: icon('fireBall'),
  flame_burst: icon('fireWave'),
  flame_pillar: icon('firePillar'),
  frost_bolt: icon('iceShards'),
  binding_nova: icon('iceNova'),
  arrow_volley: icon('arrow'),
  // Sheet 85's four, on their own marks at last.
  arcane_bolt: drawnIcon('arcane_bolt'),
  shadow_dash: drawnIcon('shadow_dash'),
  mending_light: drawnIcon('mending_light'),
  aegis: drawnIcon('aegis'),
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
export function weaponIcon(id: string): IconArt {
  return icon(WEAPON_ICONS[id] ?? 'sword');
}

/**
 * Ability ids still drawing someone else's icon.
 *
 * Empty, and kept rather than deleted: it is what the settings screen reads to
 * warn that a mark is a stand-in, and the next ability added will want it.
 */
export const BORROWED_ICONS: readonly string[] = [];

/**
 * An icon for an ability id.
 *
 * Falls back to the sword rather than throwing: a server that adds a seventh
 * ability should put a plain mark on the rail, not empty the rail.
 */
export function abilityIcon(id: string): IconArt {
  return ICONS[id] ?? icon('sword');
}
