import Phaser from 'phaser';

import { registerAnimations } from '../animation/clips';
import { TEXTURE_KEY } from '../animation/goatAtlas.generated';
import { PALETTE, VIEW } from '../constants';
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
    const { width, height } = VIEW;
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

    this.load.setPath('game/goat');
    this.load.atlas(TEXTURE_KEY, `${TEXTURE_KEY}.png`, `${TEXTURE_KEY}.json`);
  }

  create(): void {
    registerAnimations(this.anims);
    this.scene.start('play');
  }
}
