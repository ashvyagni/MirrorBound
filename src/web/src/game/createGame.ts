import Phaser from 'phaser';

import { PALETTE, RENDER_SCALE, VIEW } from './constants';
import { PlayScene } from './scenes/PlayScene';
import { HudScene } from './scenes/HudScene';
import { PreloadScene } from './scenes/PreloadScene';

/**
 * Build the Phaser game.
 *
 * Imported lazily by the React mount so Phaser -- which needs `window` at
 * module scope -- is never pulled into a non-browser context, and so the
 * engine chunk is fetched only when the game is actually shown.
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
      ...(fullscreenTarget ? { fullscreenTarget } : {}),
    },
    // No client-side physics: the server owns movement and collisions.
    // HudScene is listed but inactive; PlayScene launches it once the world
    // exists, so the interface never draws over an empty room.
    scene: [PreloadScene, PlayScene, HudScene],
    // In development the loop runs on timers instead of requestAnimationFrame so
    // the game keeps stepping while the window is occluded (automated QA drives
    // it from a hidden browser pane). Production keeps vsync-locked RAF.
    fps: { target: 60, forceSetTimeOut: import.meta.env.DEV },
  });

  if (import.meta.env.DEV) {
    (window as unknown as { game?: Phaser.Game }).game = game;
  }
  return game;
}
