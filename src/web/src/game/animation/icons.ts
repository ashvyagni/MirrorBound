import { ICONS_FRAMES } from './iconsAtlas.generated';

/**
 * The ability icon set.
 *
 * Every ability's `id` is also its icon's name, so a spell needs no separate
 * artwork field -- adding one would just be a second place for the two to
 * disagree. The sword is the one extra: it stands for plain melee, which has
 * no ability to be named after.
 */
export const ICON_NAMES = [...ICONS_FRAMES.icon, ...ICONS_FRAMES.icon_b] as const;

export type IconName = (typeof ICON_NAMES)[number];
