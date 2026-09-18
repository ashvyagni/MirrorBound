import { COOLDOWNRAIL_TEXTURE_KEY } from '../animation/cooldownRailAtlas.generated';
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
];
