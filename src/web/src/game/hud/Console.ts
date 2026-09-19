import Phaser from 'phaser';

import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import { Panel } from './Panel';

/**
 * The command line, on `\`.
 *
 * A thin frame across the middle of the screen with one line in it. It exists
 * to put things in the room without a menu for each -- spawning eleven
 * creatures, a boss and seven items from a settings screen would be twenty
 * buttons nobody wants to maintain.
 *
 * Completion is a ghost: the rest of the best match is drawn behind the cursor
 * at low opacity, and Tab or the right arrow takes it. Nothing is ever typed
 * for you -- the suggestion is behind what you wrote, so a wrong guess costs
 * you nothing and you can always see exactly what you have actually entered.
 *
 * The keyboard is read from the window rather than through Phaser, because
 * Phaser only reports keys it has been asked for and a text field has to take
 * every one of them.
 */
const WIDTH = 1180;
const HEIGHT = 108;

export interface Suggestion {
  /** The full command this completes to. */
  value: string;
  /** Shown to the right, dim: what it does. */
  hint: string;
}

export class Console {
  #panel!: Panel;
  #typed!: Phaser.GameObjects.Text;
  #ghost!: Phaser.GameObjects.Text;
  #caret!: Phaser.GameObjects.Rectangle;
  #hint!: Phaser.GameObjects.Text;
  #result!: Phaser.GameObjects.Text;
  #texts: Phaser.GameObjects.Text[] = [];

  #line = '';
  #onKey: ((event: KeyboardEvent) => void) | null = null;
  #caretBlink = 0;
  /** Everything the console can complete to, newest first in the history. */
  #history: string[] = [];
  #historyAt = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Supplies completions. Owned by the scene, which knows what exists. */
    private readonly complete: (line: string) => Suggestion | null,
    /** Runs a command and reports what happened. */
    private readonly run: (line: string) => string,
  ) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) * 0.32;

    this.#panel = new Panel(this.scene, cx, cy, { width: WIDTH, height: HEIGHT });

    const left = -WIDTH / 2 + this.#panel.inset + 20;

    // Placed and then left alone; nothing ever changes it.
    this.#text(left, 0, '>', HUD.labelSize, HUD.activeInk);
    this.#typed = this.#text(left + 30, 0, '', HUD.labelSize, HUD.ink);
    // Drawn at the same size and from the same left edge as the typed text, so
    // the two line up character for character however long either gets.
    this.#ghost = this.#text(left + 30, 0, '', HUD.labelSize, HUD.dimInk);
    this.#ghost.setAlpha(0.45);

    this.#caret = this.scene.add.rectangle(left + 30, 0, 3, HUD.labelSize + 6, 0xf5a4c0);
    this.#panel.body.add(this.#caret);

    this.#hint = this.#text(WIDTH / 2 - this.#panel.inset - 20, 0, '', HUD.hintSize - 2, HUD.dimInk, 1);
    this.#result = this.#text(left, HEIGHT / 2 + 18, '', HUD.hintSize - 2, HUD.dimInk);

    // The ghost goes under the typed text, so a descender never sits on top of
    // a real character.
    this.#panel.body.sendToBack(this.#ghost);
    this.#panel.setVisible(false);
  }

  #text(x: number, y: number, value: string, size: number, colour: string, originX = 0) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#panel.body.add(t);
    this.#texts.push(t);
    return t;
  }

  get open(): boolean {
    return this.#panel.visible;
  }

  toggle(): boolean {
    return this.open ? (this.close(), false) : (this.#open(), true);
  }

  #open(): void {
    this.#line = '';
    this.#historyAt = -1;
    this.#result.setText('');
    this.#panel.setVisible(true);
    this.#redraw();

    // The game stops reading the keyboard while this is up, or typing "spawn"
    // also swings a sword and drinks a potion.
    eventBus.emit('input:suspend', { suspended: true });

    this.#onKey = (event: KeyboardEvent) => this.#key(event);
    window.addEventListener('keydown', this.#onKey, { capture: true });
  }

  close(): void {
    if (this.#onKey) {
      window.removeEventListener('keydown', this.#onKey, { capture: true });
      this.#onKey = null;
    }
    this.#panel.setVisible(false);
    eventBus.emit('input:suspend', { suspended: false });
  }

  #key(event: KeyboardEvent): void {
    const { key } = event;

    // Everything below is handled here, so nothing reaches the game underneath.
    event.preventDefault();
    event.stopPropagation();

    if (key === 'Escape' || key === '\\') {
      this.close();
      return;
    }
    if (key === 'Enter') {
      const line = this.#line.trim();
      if (line) {
        this.#history.unshift(line);
        this.#result.setText(this.run(line));
      }
      this.#line = '';
      this.#historyAt = -1;
      this.#redraw();
      return;
    }
    if (key === 'Backspace') {
      this.#line = this.#line.slice(0, -1);
      this.#redraw();
      return;
    }
    if (key === 'Tab' || key === 'ArrowRight') {
      const suggestion = this.complete(this.#line);
      if (suggestion) this.#line = suggestion.value;
      this.#redraw();
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      // Walk the history. Down past the newest clears the line, which is the
      // only way back to an empty prompt without holding backspace.
      const step = key === 'ArrowUp' ? 1 : -1;
      this.#historyAt = Phaser.Math.Clamp(this.#historyAt + step, -1, this.#history.length - 1);
      this.#line = this.#historyAt < 0 ? '' : this.#history[this.#historyAt]!;
      this.#redraw();
      return;
    }
    // One printable character. `key.length === 1` is what separates those from
    // every named key without listing them.
    if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
      this.#line += key;
      this.#redraw();
    }
  }

  #redraw(): void {
    this.#typed.setText(this.#line);

    const suggestion = this.complete(this.#line);
    // The ghost holds the whole completion, not just its tail, so it sits
    // exactly under the typed text and the visible part is the difference.
    this.#ghost.setText(suggestion && suggestion.value !== this.#line ? suggestion.value : '');
    this.#hint.setText(suggestion?.hint ?? '');

    this.#caret.setX(this.#typed.x + this.#typed.width + 2);
  }

  /** Blink the caret. Called from the scene's update. */
  step(deltaSeconds: number): void {
    if (!this.open) return;
    this.#caretBlink += deltaSeconds;
    this.#caret.setVisible(this.#caretBlink % 1 < 0.6);
  }

  destroy(): void {
    this.close();
    this.#panel?.destroy();
    this.#texts = [];
  }
}
