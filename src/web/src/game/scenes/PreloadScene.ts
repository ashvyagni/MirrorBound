import Phaser from 'phaser';

import { BRO_TEXTURE, registerBroAnimations } from '../animation/broClips';
import { registerFxAnimations } from '../animation/fx';
import { GOAT_TEXTURE, registerGoatAnimations } from '../animation/goatClips';
import { registerWeaponAnimations, WEAPON_TEXTURES } from '../animation/weaponClips';
import { PALETTE } from '../constants';
import { eventBus } from '../EventBus';
import { TextureFactory } from '../world/TextureFactory';

/**
 * Loads the character atlases, paints the procedural world textures, registers
 * animations, then hands off to play. Animations are registered here because
 * Phaser's animation manager is global: a scene restart must not redefine them.
 */
export class PreloadScene extends Phaser.Scene {
  static readonly KEY = 'preload';

  constructor() {
    super(PreloadScene.KEY);
  }

  preload(): void {
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

    for (const texture of [GOAT_TEXTURE, BRO_TEXTURE, ...WEAPON_TEXTURES]) {
      this.load.setPath(`game/${texture}`);
      this.load.atlas(texture, `${texture}.png`, `${texture}.json`);
    }
  }

  create(): void {
    const t0 = performance.now();
    registerGoatAnimations(this.anims);
    registerBroAnimations(this.anims);
    registerWeaponAnimations(this.anims);
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
