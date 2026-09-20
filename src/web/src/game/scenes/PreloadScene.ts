import Phaser from 'phaser';

import { registerEffectAnimations, EFFECT_TEXTURES } from '../animation/abilityClips';
import { BRO_TEXTURE, registerBroAnimations } from '../animation/broClips';
import { registerAlertMarkAnimation, SHARED_ENEMY_TEXTURES } from '../animation/enemyClips';
import { registerFxAnimations } from '../animation/fx';
import { HATCH_TEXTURES, registerHatchAnimations } from '../entities/Hatch';
import { GOAT_TEXTURES, registerGoatAnimations } from '../animation/goatClips';
import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { SKILLNODES_TEXTURE_KEY } from '../animation/skillNodesAtlas.generated';
import { registerShieldAnimations, SHIELD_TEXTURES } from '../animation/shieldClips';
import { registerWeaponAnimations, WEAPON_TEXTURES } from '../animation/weaponClips';
import { PALETTE } from '../constants';
import { HUD_TEXTURES } from '../hud/textures';
import { registerChestAnimation, WORLD_TEXTURES } from '../world/propArt';
import { eventBus } from '../EventBus';
import { TextureFactory } from '../world/TextureFactory';

/**
 * Sheets the React screens draw from.
 *
 * They are not Phaser's to render -- `Portrait` and `AtlasIcon` read the same
 * JSON and PNG straight from the DOM -- but loading them here fetches those
 * exact URLs, so the HUD's potion count and the skill tree's emblems come out
 * of the HTTP cache instead of costing a round trip the first time a screen
 * opens. Both together are a quarter of a megabyte.
 */
// The interface draws from its own sheets, and every one is listed in
// `hud/textures.ts` so the preloader cannot be given a new piece of chrome and
// quietly miss its texture -- a missing HUD texture is a green box in the
// corner of the screen, which is slower to notice than a crash.
const UI_TEXTURES: readonly string[] = [
  ITEMS_TEXTURE_KEY, SKILLNODES_TEXTURE_KEY, ...HUD_TEXTURES, ...WORLD_TEXTURES,
];

/**
 * Loads the character atlases, paints the procedural world textures, registers
 * animations, then hands off to play. Animations are registered here because
 * Phaser's animation manager is global: a scene restart must not redefine them.
 *
 * What is here is what the first frame cannot be drawn without: the player's
 * three sheets, the twin, the weapons and their cast motions, the spell
 * effects, and the shared alert mark. The twelve enemy families are *not* --
 * they are 51 MB of the 70 this would otherwise fetch, and a room draws a few
 * of them, so `EnemyAtlasLoader` pulls them per room from the sprite list the
 * room snapshot carries. The timings printed at the end of `create` are what
 * to watch if that trade ever needs revisiting.
 */
export class PreloadScene extends Phaser.Scene {
  static readonly KEY = 'preload';

  #startedAt = 0;

  constructor() {
    super(PreloadScene.KEY);
  }

  preload(): void {
    this.#startedAt = performance.now();
    const { width, height } = this.cameras.main;
    const barWidth = Math.round(width * 0.3);
    this.cameras.main.setBackgroundColor(PALETTE.night);

    this.add.text(width / 2, height / 2 - 40, 'MIRRORBOUND', {
      fontFamily: '"Instrument Serif", Georgia, serif', fontSize: '44px', color: '#f2e8df',
    }).setOrigin(0.5);
    const track = this.add.rectangle(width / 2, height / 2 + 10, barWidth, 4, PALETTE.taupe, 0.25).setOrigin(0.5);
    const fill = this.add.rectangle(track.x - barWidth / 2, height / 2 + 10, 0, 4, PALETTE.magenta).setOrigin(0, 0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      fill.width = barWidth * progress * 0.8;
      eventBus.emit('game:loading', { progress: progress * 0.8 });
    });

    // De-duplicated: the weapon list and the effect list overlap on nothing
    // today, but both are built from tables that can grow.
    const textures = [...new Set([
      ...GOAT_TEXTURES, BRO_TEXTURE, ...WEAPON_TEXTURES, ...SHIELD_TEXTURES, ...EFFECT_TEXTURES,
      ...SHARED_ENEMY_TEXTURES, ...UI_TEXTURES, ...HATCH_TEXTURES,
    ])];
    for (const texture of textures) {
      this.load.setPath(`game/${texture}`);
      this.load.atlas(texture, `${texture}.png`, `${texture}.json`);
    }
    this.load.setPath();
    console.info(`[mirrorbound] queueing ${textures.length} atlases; enemy sheets load per room`);
  }

  create(): void {
    const loaded = performance.now();
    registerGoatAnimations(this.anims);
    registerBroAnimations(this.anims);
    registerWeaponAnimations(this.anims);
    registerShieldAnimations(this.anims);
    // Only the shared mark: each enemy family's clips are registered by
    // `EnemyAtlasLoader` once its own sheets have arrived, because a clip whose
    // frames name an unloaded texture is a clip that draws nothing.
    registerAlertMarkAnimation(this.anims);
    registerEffectAnimations(this.anims);
    registerHatchAnimations(this.anims);
    registerChestAnimation(this.anims);
    registerFxAnimations(this.anims);
    const registered = performance.now();
    // Paint the world once, up front, so the first room appears without a hitch.
    const factory = new TextureFactory(this);
    factory.ensureCommon();
    factory.ensureBiome('grove');
    console.info(
      `[mirrorbound] atlases loaded in ${Math.round(loaded - this.#startedAt)}ms; `
      + `animations registered in ${Math.round(registered - loaded)}ms; `
      + `textures painted in ${Math.round(performance.now() - registered)}ms`,
    );
    eventBus.emit('game:loading', { progress: 1 });
    this.scene.start('play');
  }
}
