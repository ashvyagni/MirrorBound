import Phaser from 'phaser';

import { ABILITY_TEXTURES, registerAbilityAnimations } from '../animation/abilityClips';
import { BRO_TEXTURE, registerBroAnimations } from '../animation/broClips';
import { DUMMY_TEXTURE_KEY } from '../animation/dummyAtlas.generated';
import { ENEMY_TEXTURES, registerEnemyAnimations } from '../animation/enemyClips';
import { registerFxAnimations } from '../animation/fx';
import {
  GOAT_TEXTURES, registerFacingAnimations, registerGoatAnimations,
} from '../animation/goatClips';
import { ICONS_TEXTURE_KEY } from '../animation/iconsAtlas.generated';
import { SHIELDBLOCK_TEXTURE_KEY } from '../animation/shieldBlockAtlas.generated';
import { SHIELDPARRY_TEXTURE_KEY } from '../animation/shieldParryAtlas.generated';
import { registerWeaponAnimations, WEAPON_TEXTURES } from '../animation/weaponClips';
import { PALETTE } from '../constants';
import { eventBus } from '../EventBus';
import { HUD_TEXTURES } from '../hud/textures';
import { Shield } from '../entities/Shield';
import { TextureFactory } from '../world/TextureFactory';

/**
 * Loads the character, ability, enemy and HUD atlases, paints the procedural
 * world textures, registers animations, then hands off to play.
 *
 * Animations are registered here because Phaser's animation manager is global:
 * a scene restart must not redefine them.
 */
export class PreloadScene extends Phaser.Scene {
  static readonly KEY = 'preload';

  constructor() {
    super(PreloadScene.KEY);
  }

  preload(): void {
    // The loading screen has no camera zoom, so it is laid out against the
    // canvas itself rather than world units.
    const { width, height } = this.cameras.main;
    const barWidth = Math.round(width * 0.36);
    this.cameras.main.setBackgroundColor(PALETTE.night);

    this.add.text(width / 2, height / 2 - 40, 'MIRRORBOUND', {
      fontFamily: '"Instrument Serif", Georgia, serif', fontSize: '44px', color: '#f2e8df',
    }).setOrigin(0.5);
    const track = this.add
      .rectangle(width / 2, height / 2 + 10, barWidth, 4, PALETTE.taupe, 0.25)
      .setOrigin(0.5);
    const fill = this.add
      .rectangle(track.x - barWidth / 2, height / 2 + 10, 0, 4, PALETTE.magenta)
      .setOrigin(0, 0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      fill.width = barWidth * progress * 0.8;
      eventBus.emit('game:loading', { progress: progress * 0.8 });
    });

    // The icon sheet is loaded here too: the in-game bar draws from it, so it
    // has to be a Phaser texture and not only a CSS background.
    for (const texture of [
      ...GOAT_TEXTURES, BRO_TEXTURE, ...WEAPON_TEXTURES, ...ABILITY_TEXTURES,
      ...ENEMY_TEXTURES,
      DUMMY_TEXTURE_KEY, ICONS_TEXTURE_KEY,
      SHIELDBLOCK_TEXTURE_KEY, SHIELDPARRY_TEXTURE_KEY,
      ...HUD_TEXTURES,
    ]) {
      this.load.setPath(`game/${texture}`);
      this.load.atlas(texture, `${texture}.png`, `${texture}.json`);
    }
  }

  create(): void {
    const t0 = performance.now();
    registerGoatAnimations(this.anims);
    registerFacingAnimations(this.anims);
    registerBroAnimations(this.anims);
    registerWeaponAnimations(this.anims);
    registerAbilityAnimations(this.anims);
    registerEnemyAnimations(this.anims);
    Shield.register(this.anims);
    registerFxAnimations(this.anims);
    // Paint the world once, up front, so the first room appears without a hitch.
    const factory = new TextureFactory(this);
    factory.ensureCommon();
    factory.ensureBiome('grove');
    console.info(`[mirrorbound] atlases loaded at ${Math.round(t0)}ms; textures painted in ${Math.round(performance.now() - t0)}ms`);
    eventBus.emit('game:loading', { progress: 1 });
    this.scene.start('play');
  }
}
