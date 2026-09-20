import Phaser from 'phaser';

import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import { Panel } from './Panel';

/**
 * The command line, on `\`.
 *
 * One framed line across the upper third of the screen. It exists to put
 * things in the room without a menu for each -- spawning eleven creatures, a
 * boss and seven items from a settings screen would be twenty buttons nobody
 * wants to maintain.
 *
 * Completion is a ghost: the *rest* of the best match is drawn dim immediately
 * after the cursor, and Tab or the right arrow takes it. It is the tail and not
 * the whole suggestion laid under the typed text, which is what the first
 * version did -- that only lines up while the two agree character for
 * character, and typing `SPAWN` against a suggestion of `spawn ` put two
 * different-width strings on the same origin and drew the line twice, offset.
 * A tail cannot misalign, because there is nothing behind it.
 *
 * Running a command closes the frame. What it did is said by the toast instead:
 * the useful thing after `spawn brute` is the brute, and a panel still sitting
 * over the middle of the screen is in the way of looking at it.
 *
 * The keyboard is read from the window rather than through Phaser, because
 * Phaser only reports keys it has been asked for and a text field has to take
 * every one of them.
 */
const WIDTH = 1180;
/**
 * Tall enough for the frame to exist.
 *
 * `Panel` builds its rectangle from a 96px drawn corner, so anything under
 * 192px has no room between its own corners: the side edges are skipped and the
 * top and bottom corners are drawn over one another. This was 108, and rendered
 * as a crushed sandwich with no sides. `PANEL_MIN` now clamps it as well, but
 * asking for a legal size is better than being clamped to one.
 */
const HEIGHT = 236;

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
  #texts: Phaser.GameObjects.Text[] = [];

  #line = '';
  #onKey: ((event: KeyboardEvent) => void) | null = null;
  #caretBlink = 0;
  /** Lines already run, newest first. */
  #history: string[] = [];
  #historyAt = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Supplies completions. Owned by the scene, which knows what exists. */
    private readonly complete: (line: string) => Suggestion | null,
    /** Runs a command. Reporting what happened is the caller's business. */
    private readonly run: (line: string) => void,
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
    this.#text(left, -14, '>', HUD.labelSize, HUD.activeInk);
    this.#typed = this.#text(left + 30, -14, '', HUD.labelSize, HUD.ink);
    this.#ghost = this.#text(left + 30, -14, '', HUD.labelSize, HUD.dimInk);
    this.#ghost.setAlpha(0.45);

    this.#caret = this.scene.add.rectangle(left + 30, -14, 3, HUD.labelSize + 6, 0xf5a4c0);
    this.#panel.body.add(this.#caret);

    // Inside the frame rather than under it: what the line means belongs with
    // the line, and text floating outside a panel reads as a bug.
    this.#hint = this.#text(left, 30, '', HUD.hintSize - 1, HUD.dimInk);
    this.#text(WIDTH / 2 - this.#panel.inset - 20, 30,
      'TAB COMPLETES  ·  ENTER RUNS  ·  ESC CLOSES', HUD.hintSize - 2, HUD.dimInk, 1);

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
    this.#panel.setVisible(true);
    this.#redraw();

    // The game stops reading the keyboard while this is up, or typing "spawn"
    // also swings a sword and drinks a potion.

    this.#onKey = (event: KeyboardEvent) => this.#key(event);
    window.addEventListener('keydown', this.#onKey, { capture: true });
  }

  close(notify = true): void {
    const wasOpen = this.open;
    if (this.#onKey) {
      window.removeEventListener('keydown', this.#onKey, { capture: true });
      this.#onKey = null;
    }
    this.#panel.setVisible(false);
    if (wasOpen && notify) eventBus.emit('ui:screen-close', { screen: 'console' });
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
      this.#line = '';
      this.#historyAt = -1;
      // Closed before running, so that anything the command puts on screen --
      // a toast, a boss hatching -- is not drawn behind a panel that is on its
      // way out.
      this.close();
      if (line) {
        this.#history.unshift(line);
        this.run(line);
      }
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
    // The tail only, and only when the suggestion really does extend what was
    // typed. `complete` matches case-insensitively, so a suggestion that does
    // not share the typed prefix verbatim would splice two spellings of the
    // same word together on screen.
    const extends_ = suggestion
      && suggestion.value.length > this.#line.length
      && suggestion.value.toLowerCase().startsWith(this.#line.toLowerCase());
    this.#ghost.setText(extends_ ? suggestion.value.slice(this.#line.length) : '');
    this.#hint.setText(suggestion?.hint.toUpperCase() ?? '');

    // Measured, not assumed: the caret sits at the end of what you wrote and
    // the ghost picks up just past it.
    const end = this.#typed.x + this.#typed.width;
    this.#caret.setX(end + 2);
    this.#ghost.setX(end + 8);
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
