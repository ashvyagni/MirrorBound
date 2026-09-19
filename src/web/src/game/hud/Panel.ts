import type Phaser from 'phaser';

import { SCREENFRAME_TEXTURE_KEY } from '../animation/screenFrameAtlas.generated';
import { HUD, PALETTE, PIXEL_FONT } from '../constants';

/**
 * A framed panel at any size.
 *
 * The frame art is one 506px square drawn so its corners stay fixed, its edges
 * tile and its middle is thrown away -- which is what a nine-slice is, and what
 * `Phaser.GameObjects.NineSlice` does natively. Every screen is built out of
 * this rather than drawing its own chrome, for the same reason one alert mark
 * serves eleven creatures: five copies of the same border drift apart.
 *
 * The prompt asked for a 120px border on a 1024px square. The atlas trimmed it
 * to 506, so the inset is that border at the same ratio -- solved rather than
 * typed, because the next time the frame is redrawn the ratio survives and a
 * hardcoded 60 does not.
 */
const SOURCE_SIZE = 1024;
const SOURCE_BORDER = 120;

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
    const frame = scene.textures.get(SCREENFRAME_TEXTURE_KEY).get('frame');
    this.inset = Math.round((frame.width / SOURCE_SIZE) * SOURCE_BORDER);

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
      0, 0, SCREENFRAME_TEXTURE_KEY, 'frame',
      opts.width, opts.height,
      this.inset, this.inset, this.inset, this.inset,
    );
    this.container.add(nine);

    if (opts.title) {
      const title = scene.add
        .text(0, -opts.height / 2 + this.inset * 0.5, opts.title.toUpperCase(), {
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
