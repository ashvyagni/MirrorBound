import type Phaser from 'phaser';

import { FLOURISHES_TEXTURE_KEY } from '../animation/flourishesAtlas.generated';
import { HUD, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { fitWidth } from './fit';

/**
 * The three marks the game needs for the moments it currently passes over.
 *
 * Health could already reach zero with nothing to show for it; this is what
 * shows for it. Each mark is a still, animated by transform rather than by
 * frames -- a turn, a rise, a fade the game times to the moment that raised
 * it, which two drawn frames could never match.
 */
export type FlourishName = 'death' | 'victory' | 'levelUp';

interface Shown {
  mark: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  scrim: Phaser.GameObjects.Rectangle;
}

const COPY: Record<FlourishName, { text: string; colour: string; size: number }> = {
  death:   { text: 'THE MIRROR KEEPS YOU', colour: HUD.dimInk, size: 340 },
  victory: { text: 'CLEARED', colour: HUD.ink, size: 320 },
  levelUp: { text: 'LEVEL UP', colour: HUD.activeInk, size: 210 },
};

export class Flourish {
  #shown: Shown | null = null;
  #tweens: Phaser.Tweens.Tween[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Show a mark. Death holds until something clears it; the other two pass.
   *
   * Returns nothing to wait on: a flourish is feedback, and code that has to
   * await its animation is code the animation can stall.
   */
  show(name: FlourishName): void {
    this.clear();

    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;
    const { text, colour, size } = COPY[name];
    const holds = name === 'death';

    const scrim = this.scene.add
      .rectangle(cx, cy, VIEW.width * RENDER_SCALE, VIEW.height * RENDER_SCALE,
        PALETTE.night, holds ? 0.78 : 0.34)
      .setAlpha(0);

    const mark = this.scene.add.image(cx, cy - 40, FLOURISHES_TEXTURE_KEY, name);
    fitWidth(mark, size);
    mark.setAlpha(0).setScale(mark.scaleX * 0.7, mark.scaleY * 0.7);

    const label = this.scene.add
      .text(cx, cy + size * 0.52, text, {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.labelSize + 4}px`,
        color: colour,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);

    this.#shown = { mark, label, scrim };

    const full = { x: mark.scaleX / 0.7, y: mark.scaleY / 0.7 };
    this.#tweens.push(
      this.scene.tweens.add({ targets: scrim, alpha: 1, duration: 260 }),
      this.scene.tweens.add({
        targets: mark, alpha: 1, scaleX: full.x, scaleY: full.y,
        duration: 420, ease: 'Back.easeOut',
      }),
      this.scene.tweens.add({ targets: label, alpha: 1, duration: 320, delay: 180 }),
      // The death ring keeps turning, very slowly, so a held screen is not a
      // frozen one. The other two do not: they are gone before it would read.
      ...(name === 'death'
        ? [this.scene.tweens.add({
          targets: mark, angle: 12, duration: 9000, ease: 'Sine.easeInOut',
          yoyo: true, repeat: -1,
        })]
        : []),
    );

    if (!holds) {
      this.#tweens.push(this.scene.tweens.add({
        targets: [mark, label, scrim], alpha: 0,
        duration: 420, delay: 1500,
        onComplete: () => this.clear(),
      }));
    }
  }

  get showing(): boolean {
    return this.#shown !== null;
  }

  clear(): void {
    for (const t of this.#tweens) t.remove();
    this.#tweens = [];
    if (!this.#shown) return;
    this.#shown.mark.destroy();
    this.#shown.label.destroy();
    this.#shown.scrim.destroy();
    this.#shown = null;
  }

  destroy(): void {
    this.clear();
  }
}
