import { ABILITYICONS_TEXTURE_KEY } from './abilityIconsAtlas.generated';
import { ICONS_FRAMES, ICONS_TEXTURE_KEY } from './iconsAtlas.generated';

/**
 * The ability icon set, which is now two sheets.
 *
 * The first holds the staves' six spells and the sword, and every frame on it
 * is the mark its ability should have. It has no dash, no ward and no heal --
 * those three borrowed whatever was closest, so the dash wore an arrow and the
 * ward wore a sword. Sheet 85 draws them, and it arrived chroma-keyed where
 * the first sheet has clean alpha, which is why it is a second atlas and not
 * four more bands on the first.
 *
 * Two sheets means an icon is no longer just a frame name, so everything that
 * draws one asks for both halves together and neither caller has to know which
 * sheet a given mark came from.
 */
export interface IconArt {
  texture: string;
  frame: string;
}

export const ICON_NAMES = [...ICONS_FRAMES.icon, ...ICONS_FRAMES.icon_b] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** A mark from the original sheet. */
export function icon(name: IconName): IconArt {
  return { texture: ICONS_TEXTURE_KEY, frame: name };
}

/** A mark from sheet 85. Its frames are the server's ability ids verbatim. */
export function drawnIcon(name: string): IconArt {
  return { texture: ABILITYICONS_TEXTURE_KEY, frame: name };
}
