import type Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { keybinds, keyName } from '../state/Keybinds';
import { fitWidth } from './fit';

/**
 * "Space — health potion", floating over whatever you are standing next to.
 *
 * It lives in the HUD scene, not the play scene, so it is drawn at interface
 * scale rather than world scale: a label that shrank when you zoomed out would
 * be a label you could not read at exactly the moment you had zoomed out to
 * see more of the room.
 *
 * That means the world position has to be converted, which is what
 * `#toScreen` does. The play camera is zoomed by `RENDER_SCALE` times the
 * player's own zoom, and scrolls; the HUD camera does neither.
 *
 * The key shown is read from the binding table, so rebinding Interact changes
 * the prompt with it. A prompt that says a key the game no longer listens to
 * is worse than no prompt.
 */
export class InteractPrompt {
  #plate!: Phaser.GameObjects.Image;
  #cap!: Phaser.GameObjects.Text;
  #label!: Phaser.GameObjects.Text;
  #group!: Phaser.GameObjects.Container;
  #texts: Phaser.GameObjects.Text[] = [];
  #target: { label: string; x: number; y: number } | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    this.#group = this.scene.add.container(0, 0).setVisible(false);

    this.#plate = this.scene.add.image(0, 0, CONTROLS_TEXTURE_KEY, 'button');
    this.#group.add(this.#plate);

    this.#cap = this.#text(0, 0, '', HUD.hintSize - 1, HUD.activeInk);
    this.#label = this.#text(0, 0, '', HUD.hintSize - 1, HUD.ink);
    this.#group.add(this.#cap);
    this.#group.add(this.#label);
  }

  #text(x: number, y: number, value: string, size: number, colour: string) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(0, 0.5);
    this.#texts.push(t);
    return t;
  }

  set(target: { label: string; x: number; y: number } | null): void {
    this.#target = target;
    if (!target) {
      this.#group.setVisible(false);
      return;
    }

    const key = keyName(keybinds.get('interact').primary);
    this.#cap.setText(key.toUpperCase());
    this.#label.setText(target.label.toUpperCase());

    // Laid out from the two texts' measured widths, so a short key and a long
    // item name both come out centred in a plate that fits them.
    const gap = 14;
    const pad = 26;
    const inner = this.#cap.width + gap + this.#label.width;
    fitWidth(this.#plate, inner + pad * 2);
    this.#cap.setX(-inner / 2);
    this.#label.setX(-inner / 2 + this.#cap.width + gap);

    this.#group.setVisible(true);
  }

  /** Follow the target. Called every frame the prompt is up. */
  step(): void {
    if (!this.#target) return;
    const p = this.#toScreen(this.#target.x, this.#target.y);
    this.#group.setPosition(p.x, p.y);
    // Hidden rather than clamped when it leaves the view: a prompt pinned to
    // the edge points at something you cannot see.
    this.#group.setVisible(
      p.x > 0 && p.x < VIEW.width * RENDER_SCALE && p.y > 0 && p.y < VIEW.height * RENDER_SCALE,
    );
  }

  /** World point to HUD point, through the play camera. */
  #toScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.scene.scene.get('play')?.cameras?.main;
    if (!cam) return { x, y };
    return {
      x: (x - cam.scrollX) * cam.zoom,
      y: (y - cam.scrollY) * cam.zoom,
    };
  }

  destroy(): void {
    this.#group?.destroy();
    this.#texts = [];
  }
}
