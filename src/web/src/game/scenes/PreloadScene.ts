import Phaser from 'phaser';

import { BRO_TEXTURE, registerBroAnimations } from '../animation/broClips';
import { registerFxAnimations } from '../animation/fx';
import { GOAT_TEXTURE, registerGoatAnimations } from '../animation/goatClips';
import { ABILITY_TEXTURES, registerAbilityAnimations } from '../animation/abilityClips';
import { registerWeaponAnimations, WEAPON_TEXTURES } from '../animation/weaponClips';
import { DUMMY_TEXTURE_KEY } from '../animation/dummyAtlas.generated';
import { ICONS_TEXTURE_KEY } from '../animation/iconsAtlas.generated';
import { SHIELDBLOCK_TEXTURE_KEY } from '../animation/shieldBlockAtlas.generated';
import { SHIELDPARRY_TEXTURE_KEY } from '../animation/shieldParryAtlas.generated';
import { Dummy } from '../entities/Dummy';
import { Shield } from '../entities/Shield';
import { PALETTE } from '../constants';
import { eventBus } from '../EventBus';

/**
 * Loads the atlas, then hands off to play.
 *
 * Animations are registered here rather than in the play scene because Phaser's
 * animation manager is global: doing it once, after the texture exists, means a
 * scene restart never redefines them.
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

    const track = this.add
      .rectangle(width / 2, height / 2, barWidth, 4, PALETTE.taupe, 0.25)
      .setOrigin(0.5);
    const fill = this.add
      .rectangle(track.x - barWidth / 2, height / 2, 0, 4, PALETTE.magenta)
      .setOrigin(0, 0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (progress: number) => {
      fill.width = barWidth * progress;
      eventBus.emit('game:loading', { progress });
    });

    // The icon sheet is loaded here too: the in-game bar draws from it, so it
    // has to be a Phaser texture and not only a CSS background.
    for (const texture of [
      GOAT_TEXTURE, BRO_TEXTURE, ...WEAPON_TEXTURES, ...ABILITY_TEXTURES,
      DUMMY_TEXTURE_KEY, ICONS_TEXTURE_KEY,
      SHIELDBLOCK_TEXTURE_KEY, SHIELDPARRY_TEXTURE_KEY,
    ]) {
      this.load.setPath(`game/${texture}`);
      this.load.atlas(texture, `${texture}.png`, `${texture}.json`);
    }
  }

  create(): void {
    registerGoatAnimations(this.anims);
    registerBroAnimations(this.anims);
    registerWeaponAnimations(this.anims);
    registerAbilityAnimations(this.anims);
    Dummy.register(this.anims);
    Shield.register(this.anims);
    registerFxAnimations(this.anims);
    this.scene.start('play');
  }
}
