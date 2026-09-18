import { WEAPONS, WEAPON_ORDER, type WeaponId } from '../animation/weaponClips';

/**
 * Two weapons carried, one potion selected.
 *
 * The carousel this replaces stepped through every weapon in the game, which
 * made "what am I carrying" and "what exists" the same question. Carrying two
 * makes them different questions, and that difference is the whole of the
 * inventory: the panel decides what is in the two hands, and the hotbar key
 * only swaps between them.
 *
 * `main` does not have this. Its `Inventory` has a weapons list and a single
 * `equipped_weapon`, so bringing the two-slot rule over is a server change,
 * not a translation -- see the note in the README.
 */
export type WeaponSlot = 0 | 1;

/** A potion in the middle slot. Ids match main's `CONSUMABLES` keys. */
export interface PotionDef {
  id: string;
  name: string;
  /** Health restored, if any. */
  heal?: number;
  /** Mana restored, if any. */
  mana?: number;
}

export const POTIONS: readonly PotionDef[] = [
  { id: 'health_potion', name: 'Health', heal: 45 },
  { id: 'mana_potion', name: 'Mana', mana: 40 },
];

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

export class Loadout {
  /** Starts with a sword in the first hand and the second empty, so the swap
   *  key has something to demonstrate on the first press. */
  #weapons: (WeaponId | null)[] = ['sword', 'fireStaff'];
  #active: WeaponSlot = 0;
  #potion = 0;
  #counts: Record<string, number> = { health_potion: 3, mana_potion: 2 };

  get equipped(): WeaponId | null {
    return this.#weapons[this.#active] ?? null;
  }

  get active(): WeaponSlot {
    return this.#active;
  }

  get potion(): PotionDef {
    return POTIONS[this.#potion]!;
  }

  /** How many of the selected potion are left. */
  get potionCount(): number {
    return this.#counts[this.potion.id] ?? 0;
  }

  snapshot(): LoadoutSnapshot {
    return {
      weapons: [...this.#weapons],
      active: this.#active,
      potion: this.potion.id,
      potionIndex: this.#potion,
      counts: { ...this.#counts },
    };
  }

  /** Draw from a specific hand. Returns what is now equipped. */
  select(slot: WeaponSlot): WeaponId | null {
    this.#active = slot;
    return this.equipped;
  }

  /** Swap hands. What clicking the plate does, where there is no second key. */
  swap(): WeaponId | null {
    return this.select(this.#active === 0 ? 1 : 0);
  }

  /**
   * Put a weapon in a slot.
   *
   * Equipping a weapon already in the other hand swaps the two rather than
   * carrying it twice, which is the only sensible reading of dragging it
   * across and costs one branch.
   */
  setSlot(slot: WeaponSlot, id: WeaponId | null): void {
    const other: WeaponSlot = slot === 0 ? 1 : 0;
    if (id !== null && this.#weapons[other] === id) {
      this.#weapons[other] = this.#weapons[slot] ?? null;
    }
    this.#weapons[slot] = id;
  }

  /** Equip into the hand currently in use. */
  equip(id: WeaponId | null): void {
    this.setSlot(this.#active, id);
  }

  /** Step the potion dial. Returns how far it has turned, in steps. */
  cyclePotion(step: number): number {
    this.#potion = (this.#potion + step + POTIONS.length) % POTIONS.length;
    return this.#potion;
  }

  /** Drink the selected potion, if there is one. Returns it, or null. */
  usePotion(): PotionDef | null {
    const potion = this.potion;
    const left = this.#counts[potion.id] ?? 0;
    if (left <= 0) return null;
    this.#counts[potion.id] = left - 1;
    return potion;
  }

  /** Whether a weapon is in either hand. Drives the panel's pressed state. */
  slotOf(id: WeaponId): WeaponSlot | null {
    const index = this.#weapons.indexOf(id);
    return index === -1 ? null : (index as WeaponSlot);
  }

  /** Every weapon that exists, for the panel to offer. */
  static get catalogue(): readonly WeaponId[] {
    return WEAPON_ORDER;
  }

  /** The display name for a slot, for a label that has to fit under one. */
  static nameOf(id: WeaponId | null): string {
    return id === null ? 'Empty' : WEAPONS[id].name;
  }
}
