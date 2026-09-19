import type { WeaponId } from '../animation/weaponClips';

/** One flask on the dial. */
export interface PotionDef {
  /** The server's own consumable id, so a stack indexes its own icon. */
  id: string;
  name: string;
}

/**
 * What the dial can point at, in the order it turns through them.
 *
 * These ids are `inventory.consumables[].id` verbatim -- matching the server's
 * spelling means a count arrives already keyed to the slot that shows it.
 */
export const POTIONS: readonly PotionDef[] = [
  { id: 'health_potion', name: 'Health' },
  { id: 'mana_potion', name: 'Mana' },
];

/** Which hand is drawn. */
export type WeaponSlot = 0 | 1;

/**
 * What the hotbar draws.
 *
 * As with `VitalsSnapshot`, a type rather than the class that used to own it.
 * Two carried weapons and a potion dial is the interface's way of showing the
 * server's `inventory.equippedWeapon` / `offhandWeapon` pair and its
 * consumable stacks -- the shape is the HUD's, the numbers are the server's.
 */
export interface LoadoutSnapshot {
  /** What is in each of the two slots. Null is an empty hand. */
  weapons: readonly (WeaponId | null)[];
  /** Which slot is in hand. */
  active: WeaponSlot;
  /** What the dial is pointing at. */
  potion: string;
  potionIndex: number;
  /** How many of each potion is carried, by id. */
  counts: Readonly<Record<string, number>>;
}
