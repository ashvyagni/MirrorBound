import Phaser from 'phaser';

import { PALETTE, PHYSICS, RENDER_SCALE, VIEW } from './constants';
import { PlayScene } from './scenes/PlayScene';
import { PreloadScene } from './scenes/PreloadScene';

/**
 * Build the Phaser game.
 *
 * Imported lazily by the React mount so Phaser -- which needs `window` at
 * module scope -- is never pulled into a non-browser context, and so the
 * ~1.4 MB engine chunk is fetched only when the game is actually shown.
 */
export function createGame(parent: HTMLElement, fullscreenTarget?: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW.width * RENDER_SCALE,
    height: VIEW.height * RENDER_SCALE,
    backgroundColor: PALETTE.night,
    // The art is painted, not pixel art, so let it filter smoothly.
    pixelArt: false,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      // Fullscreen the whole stage rather than the canvas alone, so the exit
      // button -- a sibling of the canvas -- stays on screen.
      ...(fullscreenTarget ? { fullscreenTarget } : {}),
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: PHYSICS.gravity },
        debug: false,
      },
    },
    scene: [PreloadScene, PlayScene],
  });

  // Dev-only handle, for poking at scenes and input from the console.
  if (import.meta.env.DEV) {
    (window as unknown as { game?: Phaser.Game }).game = game;
  }

  return game;
}
