import type Phaser from 'phaser';

import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';

/**
 * Letterbox bars and the line being spoken, for a scene the server is running.
 *
 * The bars are the whole reason this is a separate thing from `Toast`: they say
 * "your hands are off the controls" before any text appears, which is the part
 * a player needs to know immediately. They slide rather than cut, because a
 * hard cut to letterbox reads as the game breaking.
 *
 * Nothing here decides when a line changes or when the scene ends. The server
 * owns the beats; this shows whatever it was last told.
 */
const BAR_FRACTION = 0.11;
const SLIDE_MS = 420;

export class Cinematic {
  #top!: Phaser.GameObjects.Rectangle;
  #bottom!: Phaser.GameObjects.Rectangle;
  #line!: Phaser.GameObjects.Text;
  #texts: Phaser.GameObjects.Text[] = [];
  #tweens: Phaser.Tweens.Tween[] = [];
  #active = false;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const width = VIEW.width * RENDER_SCALE;
    const height = VIEW.height * RENDER_SCALE;
    const bar = Math.round(height * BAR_FRACTION);

    // Parked fully off-screen, so the first frame of a scene is the slide in
    // rather than a bar already sitting there.
    this.#top = this.scene.add.rectangle(width / 2, -bar / 2, width, bar, 0x000000)
      .setDepth(HUD_DEPTH).setScrollFactor(0);
    this.#bottom = this.scene.add.rectangle(width / 2, height + bar / 2, width, bar, 0x000000)
      .setDepth(HUD_DEPTH).setScrollFactor(0);

    this.#line = this.scene.add
      .text(width / 2, height - bar / 2, '', {
        fontFamily: PIXEL_FONT.stack,
        fontSize: '30px',
        color: HUD.ink,
        align: 'center',
        wordWrap: { width: width * 0.7 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(HUD_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0);
    this.#texts.push(this.#line);
  }

  /** Bring the bars in. Idempotent, because it runs off every snapshot. */
  begin(): void {
    if (this.#active) return;
    this.#active = true;
    this.#slide(true);
  }

  /** Take the bars away and clear the line. */
  end(): void {
    if (!this.#active) return;
    this.#active = false;
    this.#line.setText('').setAlpha(0);
    this.#slide(false);
  }

  /**
   * Show a spoken line.
   *
   * It stays until the next one or until the scene ends, rather than fading on
   * a timer of its own: the server's beat decides how long a line is on screen,
   * and a subtitle that vanished early would leave the Mirror talking silently.
   */
  say(text: string): void {
    if (!this.#active) return;
    this.#line.setText(text).setAlpha(0);
    this.#tweens.push(this.scene.tweens.add({
      targets: this.#line, alpha: 1, duration: 260, ease: 'Sine.easeOut',
    }));
  }

  #slide(inward: boolean): void {
    const height = VIEW.height * RENDER_SCALE;
    const bar = Math.round(height * BAR_FRACTION);
    this.#clearTweens();
    this.#tweens.push(this.scene.tweens.add({
      targets: this.#top, y: inward ? bar / 2 : -bar / 2,
      duration: SLIDE_MS, ease: 'Cubic.easeInOut',
    }));
    this.#tweens.push(this.scene.tweens.add({
      targets: this.#bottom, y: inward ? height - bar / 2 : height + bar / 2,
      duration: SLIDE_MS, ease: 'Cubic.easeInOut',
    }));
  }

  #clearTweens(): void {
    for (const tween of this.#tweens) tween.stop();
    this.#tweens = [];
  }

  destroy(): void {
    this.#clearTweens();
    this.#top?.destroy();
    this.#bottom?.destroy();
    this.#line?.destroy();
    this.#texts = [];
  }
}

/** Over the world and the rest of the HUD, under nothing. */
const HUD_DEPTH = 4000;
