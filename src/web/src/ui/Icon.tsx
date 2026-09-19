import type { ItemName } from '@/game/animation/items';
import type { IconName } from '@/game/animation/icons';

import { frameStyle, useAtlas } from './atlas';

export type { IconName, ItemName };

/**
 * One frame from a generated sheet, drawn as a window onto the atlas.
 *
 * A window rather than eight separate files: it is one request for the whole
 * set, the browser has already fetched the sheet for the game, and the names
 * come from the generated manifest -- so a frame that leaves the sheet is a
 * compile error rather than a blank square.
 *
 * Two sheets, two components, one implementation. Keeping the names in separate
 * types is the point: an ability icon and an item icon are not interchangeable,
 * and a single `name: string` would let either be passed where the other
 * belongs and fail silently at runtime.
 */
function Sprite({ sheet, name, size }: { sheet: string; name: string; size: number }) {
  const atlas = useAtlas(`/game/${sheet}/${sheet}.json`);
  const style = frameStyle(atlas, `/game/${sheet}/${sheet}.png`, name, size);

  // The wrapper holds the space whether or not the sheet has arrived, so
  // nothing reflows around it when it does.
  return (
    <span className="icon" style={{ width: size, height: size }} aria-hidden="true">
      {style && <i className="icon__art" style={style} />}
    </span>
  );
}

/** An ability icon, from `assets/ui/icons.png`. */
export function Icon({ name, size = 30 }: { name: IconName; size?: number }) {
  return <Sprite sheet="icons" name={name} size={size} />;
}

/** A potion, relic or resource, from `assets/ui/items.png`. */
export function ItemIcon({ name, size = 30 }: { name: ItemName; size?: number }) {
  return <Sprite sheet="items" name={name} size={size} />;
}
