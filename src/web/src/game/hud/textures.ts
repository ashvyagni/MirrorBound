import { BARSPLATES_TEXTURE_KEY } from '../animation/barsPlatesAtlas.generated';
import { BOSSBAR_TEXTURE_KEY } from '../animation/bossBarAtlas.generated';
import { DIALOGUE_TEXTURE_KEY } from '../animation/dialogueAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { ABILITYICONS_TEXTURE_KEY } from '../animation/abilityIconsAtlas.generated';
import { ICONS_TEXTURE_KEY } from '../animation/iconsAtlas.generated';
import { VITALS_TEXTURE_KEY } from '../animation/vitalsAtlas.generated';
import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { SKILLNODES_TEXTURE_KEY } from '../animation/skillNodesAtlas.generated';
import { SPEAKERS_TEXTURE_KEY } from '../animation/speakersAtlas.generated';
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
  // The six faces that talk to you. Drawn as sheet 87 and never loaded, so
  // the dialogue plate's portrait window had never had a face in it.
  SPEAKERS_TEXTURE_KEY,
  // The ability/weapon marks the hotbar and the cooldown rail draw. This list
  // exists so a piece of chrome cannot quietly miss its texture, and this is
  // the one that was missing: every icon on both was an unresolved key.
  ICONS_TEXTURE_KEY,
  // Sheet 85's four: the dash, the ward, the heal and the arcane bolt, which
  // until now wore an arrow, a sword and an ice beam between them.
  ABILITYICONS_TEXTURE_KEY,
  // Sheet 92: the level bar and the twin's pair. This list exists so a piece
  // of chrome cannot quietly miss its texture -- which it did, and the portrait
  // corner drew Phaser's green missing-texture box over the health bars.
  VITALS_TEXTURE_KEY,
];
