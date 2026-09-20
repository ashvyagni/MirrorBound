import type Phaser from 'phaser';

import { BARSPLATES_TEXTURE_KEY } from '../animation/barsPlatesAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { fitWidth } from './fit';
import { Panel } from './Panel';

/**
 * Paused, on `P`.
 *
 * The blur is applied to the *play* camera rather than drawn here: this scene
 * is where the panel lives, and blurring the panel along with the world would
 * make the thing you are meant to read the hardest thing on screen. Phaser's
 * camera FX pipeline does it in one call and costs nothing while it is off.
 */
const WIDTH = 720;
const HEIGHT = 560;

export interface PauseStats {
  /** Seconds of play, not of wall clock -- a paused game does not age. */
  elapsed: number;
  room: string;
  biome: string;
  health: number;
  maxHealth: number;
  kills: number;
  casts: number;
  rooms: number;
}

export class PauseScreen {
  #panel!: Panel;
  #rows: Phaser.GameObjects.Text[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  #stats: PauseStats | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;

    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'Paused', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    const left = -WIDTH / 2 + this.#panel.inset + 34;
    const right = WIDTH / 2 - this.#panel.inset - 34;
    let y = -HEIGHT / 2 + this.#panel.inset + 90;

    // Eight rows, built once and refilled, because the labels never change and
    // only the values do.
    for (let i = 0; i < 8; i += 1) {
      const label = this.#text(left, y, '', HUD.hintSize - 1, HUD.dimInk, 0);
      const value = this.#text(right, y, '', HUD.hintSize - 1, HUD.ink, 1);
      this.#rows.push(label, value);

      if (i < 7) {
        const rule = this.scene.add
          .image(left, y + 24, BARSPLATES_TEXTURE_KEY, 'divider')
          .setOrigin(0, 0.5)
          .setAlpha(0.28);
        fitWidth(rule, right - left);
        this.#panel.body.add(rule);
      }
      y += 48;
    }

    this.#text(0, HEIGHT / 2 - this.#panel.inset - 30,
      'P TO RESUME', HUD.hintSize - 2, HUD.dimInk, 0.5);

    this.#panel.setVisible(false);
  }

  #text(x: number, y: number, value: string, size: number, colour: string, originX: number) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#panel.body.add(t);
    this.#texts.push(t);
    return t;
  }

  /** `3:07`, never `187s`. */
  static clock(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(whole / 60);
    return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
  }

  set(stats: PauseStats): void {
    this.#stats = stats;
    const lines: Array<[string, string]> = [
      ['TIME', PauseScreen.clock(stats.elapsed)],
      ['ROOM', stats.room.toUpperCase()],
      ['BIOME', stats.biome.toUpperCase()],
      ['HEALTH', `${Math.round(stats.health)} / ${stats.maxHealth}`],
      ['ENEMIES DEFEATED', String(stats.kills)],
      ['SPELLS CAST', String(stats.casts)],
      ['ROOMS CLEARED', String(stats.rooms)],
      ['', ''],
    ];
    lines.forEach(([label, value], i) => {
      this.#rows[i * 2]?.setText(label);
      this.#rows[i * 2 + 1]?.setText(value);
    });
  }

  get open(): boolean {
    return this.#panel.visible;
  }

  setVisible(visible: boolean): void {
    this.#panel.setVisible(visible);
    if (visible && this.#stats) this.set(this.#stats);
  }

  destroy(): void {
    this.#panel?.destroy();
    this.#rows = [];
    this.#texts = [];
  }
}
