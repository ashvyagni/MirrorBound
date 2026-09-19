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

/**
 * Whether an id from the server is one the item sheet has art for.
 *
 * A type guard rather than a lookup, so a caller that passes the check can
 * index the atlas without a cast. The server's item table is larger than the
 * sheet -- weapons and relics it has never drawn -- and this is what lets a
 * view fall back to a generic mark instead of asking for a frame that is not
 * there, which Phaser answers with a green box.
 */
const NAMES: ReadonlySet<string> = new Set(ITEM_NAMES);

export function isItemName(id: string): id is ItemName {
  return NAMES.has(id);
}
