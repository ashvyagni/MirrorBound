import { BARSPLATES_TEXTURE_KEY } from '../animation/barsPlatesAtlas.generated';
import { BOSSBAR_TEXTURE_KEY } from '../animation/bossBarAtlas.generated';
import { DIALOGUE_TEXTURE_KEY } from '../animation/dialogueAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { SKILLNODES_TEXTURE_KEY } from '../animation/skillNodesAtlas.generated';
import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { COOLDOWNRAIL_TEXTURE_KEY } from '../animation/cooldownRailAtlas.generated';
import { FLOURISHES_TEXTURE_KEY } from '../animation/flourishesAtlas.generated';
import { MAPTOKENS_TEXTURE_KEY } from '../animation/mapTokensAtlas.generated';
import { SCREENFRAME_TEXTURE_KEY } from '../animation/screenFrameAtlas.generated';
import { HOTBAR_TEXTURE_KEY } from '../animation/hotbarAtlas.generated';
import { MINIMAPRING_TEXTURE_KEY } from '../animation/minimapRingAtlas.generated';
import { PORTRAITRING_TEXTURE_KEY } from '../animation/portraitRingAtlas.generated';
import { POTIONDIAL_TEXTURE_KEY } from '../animation/potionDialAtlas.generated';
import { SETTINGSBUTTON_TEXTURE_KEY } from '../animation/settingsButtonAtlas.generated';
import { STATUSBARS_TEXTURE_KEY } from '../animation/statusBarsAtlas.generated';

/**
 * Every sheet the interface draws from.
 *
 * Listed in one place so the preloader cannot be given a new piece of chrome
 * and quietly miss its texture -- a missing HUD texture is a green box in the
 * corner of the screen, which is a slower thing to notice than a crash.
 */
export const HUD_TEXTURES: readonly string[] = [
  PORTRAITRING_TEXTURE_KEY,
  STATUSBARS_TEXTURE_KEY,
  MINIMAPRING_TEXTURE_KEY,
  SETTINGSBUTTON_TEXTURE_KEY,
  HOTBAR_TEXTURE_KEY,
  POTIONDIAL_TEXTURE_KEY,
  COOLDOWNRAIL_TEXTURE_KEY,
  // The screens: a frame to build them out of, the controls that go in it, the
  // full map's tokens, the boss bar and the three flourishes.
  SCREENFRAME_TEXTURE_KEY,
  CONTROLS_TEXTURE_KEY,
  MAPTOKENS_TEXTURE_KEY,
  BOSSBAR_TEXTURE_KEY,
  FLOURISHES_TEXTURE_KEY,
  // Items the player finds, the skill tree's nodes, and the small pieces every
  // remaining screen is assembled from.
  ITEMS_TEXTURE_KEY,
  SKILLNODES_TEXTURE_KEY,
  BARSPLATES_TEXTURE_KEY,
  // The eight shared glyphs, and the bubbles and plates that carry words.
  GLYPHS_TEXTURE_KEY,
  DIALOGUE_TEXTURE_KEY,
];
