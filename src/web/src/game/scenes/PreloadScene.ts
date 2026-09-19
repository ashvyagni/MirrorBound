import Phaser from 'phaser';

import { registerEffectAnimations, EFFECT_TEXTURES } from '../animation/abilityClips';
import { BRO_TEXTURE, registerBroAnimations } from '../animation/broClips';
import { ENEMY_TEXTURES, registerEnemyAnimations } from '../animation/enemyClips';
import { registerFxAnimations } from '../animation/fx';
import { GOAT_TEXTURES, registerGoatAnimations } from '../animation/goatClips';
import { registerWeaponAnimations, WEAPON_TEXTURES } from '../animation/weaponClips';
import { PALETTE } from '../constants';
import { eventBus } from '../EventBus';
import { TextureFactory } from '../world/TextureFactory';

/**
 * Loads the character atlases, paints the procedural world textures, registers
 * animations, then hands off to play. Animations are registered here because
 * Phaser's animation manager is global: a scene restart must not redefine them.
 *
 * The enemy sheets are forty-five of the atlases loaded here, which is most of
 * the boot cost. They are loaded up front rather than per room because a room
 * can hold any of them and a fight that starts while its sheet is still coming
 * down the wire is worse than a longer load screen. The timings printed at the
 * end of `create` are what to watch if that trade ever needs revisiting.
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
      ...GOAT_TEXTURES, BRO_TEXTURE, ...WEAPON_TEXTURES, ...EFFECT_TEXTURES, ...ENEMY_TEXTURES,
    ])];
    for (const texture of textures) {
      this.load.setPath(`game/${texture}`);
      this.load.atlas(texture, `${texture}.png`, `${texture}.json`);
    }
    console.info(`[mirrorbound] queueing ${textures.length} atlases (${ENEMY_TEXTURES.length} of them enemies)`);
  }

  create(): void {
    const loaded = performance.now();
    registerGoatAnimations(this.anims);
    registerBroAnimations(this.anims);
    registerWeaponAnimations(this.anims);
    registerEnemyAnimations(this.anims);
    registerEffectAnimations(this.anims);
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
