import type { IconName } from '@/game/animation/icons';

import { frameStyle, useAtlas } from './atlas';

export type { IconName };

const ATLAS_URL = '/game/icons/icons.json';
const IMAGE_URL = '/game/icons/icons.png';

/**
 * One icon from the shared sheet.
 *
 * Drawn as a background window onto the atlas rather than as eight separate
 * files: it is one request for the whole set, and the names come from the
 * generated manifest, so an icon that leaves the sheet is a compile error
 * rather than a blank square.
 */
export function Icon({ name, size = 30 }: { name: IconName; size?: number }) {
  const atlas = useAtlas(ATLAS_URL);
  const style = frameStyle(atlas, IMAGE_URL, name, size);

  // The wrapper holds the space whether or not the sheet has arrived, so
  // nothing reflows around it when it does.
  return (
    <span className="icon" style={{ width: size, height: size }} aria-hidden="true">
      {style && <i className="icon__art" style={style} />}
    </span>
  );
}
