import type Phaser from 'phaser';

import { HUD, PALETTE, PIXEL_FONT } from '../constants';
import { ensurePanelFrame, PANEL_FRAME_INSET, PANEL_FRAME_KEY } from './panelFrame';

/**
 * A framed panel at any size.
 *
 * The frame is a nine-slice: corners stay fixed, edges tile, the middle is
 * thrown away. Every screen is built out of this rather than drawing its own
 * chrome, for the same reason one alert mark serves eleven creatures: five
 * copies of the same border drift apart.
 *
 * The texture it slices is composed in `panelFrame.ts`, because the drawn art
 * is only a top-left corner and slicing that directly leaves a panel with no
 * right or bottom edge.
 */

export interface PanelOptions {
  width: number;
  height: number;
  title?: string;
  /** Darken everything behind it. Screens want this; a tooltip does not. */
  scrim?: boolean;
}

export class Panel {
  readonly container: Phaser.GameObjects.Container;
  readonly body: Phaser.GameObjects.Container;
  readonly inset: number;
  #texts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, opts: PanelOptions) {
    ensurePanelFrame(scene);
    this.inset = PANEL_FRAME_INSET;

    this.container = scene.add.container(x, y);

    if (opts.scrim) {
      // Sized off the camera rather than the panel: it has to cover the screen,
      // and the panel is centred on it.
      const cam = scene.cameras.main;
      const scrim = scene.add
        .rectangle(0, 0, cam.width * 2, cam.height * 2, PALETTE.night, 0.72)
        .setOrigin(0.5);
      this.container.add(scrim);
    }

    const fill = scene.add
      .rectangle(0, 0, opts.width - this.inset, opts.height - this.inset, PALETTE.night, 0.97)
      .setOrigin(0.5);
    this.container.add(fill);

    const nine = scene.add.nineslice(
      0, 0, PANEL_FRAME_KEY, undefined,
      opts.width, opts.height,
      this.inset, this.inset, this.inset, this.inset,
    );
    this.container.add(nine);

    if (opts.title) {
      // Just inside the border, not centred on it. Centring put the text on
      // the bar, where the frame's own inner line cut through the letters.
      const title = scene.add
        .text(0, -opts.height / 2 + this.inset + HUD.labelSize * 0.9, opts.title.toUpperCase(), {
          fontFamily: PIXEL_FONT.stack,
          fontSize: `${HUD.labelSize + 6}px`,
          color: HUD.ink,
        })
        .setOrigin(0.5, 0.5);
      this.container.add(title);
      this.#texts.push(title);
    }

    // Everything a screen puts inside goes here, so a caller never has to know
    // how thick the border is.
    this.body = scene.add.container(0, 0);
    this.container.add(this.body);
  }

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  /** Usable space inside the border. */
  contentSize(width: number, height: number): { width: number; height: number } {
    return { width: width - this.inset * 2, height: height - this.inset * 2 };
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  get visible(): boolean {
    return this.container.visible;
  }

  destroy(): void {
    this.container.destroy();
    this.#texts = [];
  }
}
