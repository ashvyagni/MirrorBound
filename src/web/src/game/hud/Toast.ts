import type Phaser from 'phaser';

import { BARSPLATES_TEXTURE_KEY } from '../animation/barsPlatesAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { fitWidth } from './fit';

/**
 * A line of text that appears, holds, and fades.
 *
 * It exists because the console closes the moment it runs something, and a
 * command that reports "spawned a Bone Knight" into a panel that is already
 * gone has not reported anything. Anything else that needs to say one sentence
 * without taking the screen can use it too.
 *
 * One toast, not a queue: two commands in two seconds should show the second
 * one, and a stack of them would cover the thing the command just put in the
 * room. The plate is resized to the text rather than the text wrapped to the
 * plate, so a short message is a short plate.
 */
const HOLD = 2.4;
const FADE = 0.45;
const PAD = 40;

export class Toast {
  #group!: Phaser.GameObjects.Container;
  #plate!: Phaser.GameObjects.Image;
  #label!: Phaser.GameObjects.Text;
  #texts: Phaser.GameObjects.Text[] = [];
  #tween: Phaser.Tweens.Tween | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) * 0.2;

    this.#group = this.scene.add.container(cx, cy).setAlpha(0).setVisible(false);

    this.#plate = this.scene.add.image(0, 0, BARSPLATES_TEXTURE_KEY, 'toast');
    this.#label = this.scene.add
      .text(0, 0, '', {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.labelSize}px`,
        color: HUD.ink,
      })
      .setOrigin(0.5, 0.5);

    this.#group.add(this.#plate);
    this.#group.add(this.#label);
    this.#texts.push(this.#label);
  }

  show(message: string): void {
    if (!message) return;

    this.#label.setText(message);
    fitWidth(this.#plate, this.#label.width + PAD * 2);

    // Restarted rather than queued: the newest message is the one worth
    // reading, and it gets the full hold rather than the tail of the last one.
    this.#tween?.remove();
    this.#group.setVisible(true).setAlpha(1);
    this.#tween = this.scene.tweens.add({
      targets: this.#group,
      alpha: 0,
      delay: HOLD * 1000,
      duration: FADE * 1000,
      onComplete: () => this.#group.setVisible(false),
    });
  }

  destroy(): void {
    this.#tween?.remove();
    this.#group?.destroy();
    this.#texts = [];
  }
}
