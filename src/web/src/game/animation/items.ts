import { ITEMS_FRAMES } from './itemsAtlas.generated';

/**
 * Everything the player can find and carry.
 *
 * The names are `main`'s ids verbatim -- `health_potion`, `ember_heart`,
 * `shards` -- so a consumable or relic arriving from the server indexes its own
 * icon with no lookup table in between, and an id with no art is a compile
 * error rather than a blank square in an inventory.
 */
export const ITEM_NAMES = [...ITEMS_FRAMES.item, ...ITEMS_FRAMES.item_b] as const;

export type ItemName = (typeof ITEM_NAMES)[number];

const NAMES: ReadonlySet<string> = new Set<string>(ITEM_NAMES);

/** Whether an id arriving from the server has drawn art. */
export function isItemName(id: string): id is ItemName {
  return NAMES.has(id);
}
