import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import {
  ACTIONS, keybinds, keyName, Keybinds, type Action,
} from '../state/Keybinds';
import {
  getSettings, QUALITIES, SETTINGS_AVAILABLE, SETTINGS_KEYS, updateSettings,
  type Quality,
} from '../../ui/settings';
import { fitWidth } from './fit';
import { Panel } from './Panel';

/**
 * The settings screen.
 *
 * In the canvas rather than in React, for the same reason the rest of the HUD
 * is: it has to survive fullscreen, where no DOM panel beside the game exists
 * any more. The React rail is for things you read while developing; this is a
 * thing you open while playing.
 *
 * Two tabs, because the screen answers two unrelated questions -- how the game
 * looks and what the keys do -- and a single scrolling list of both is a list
 * nobody finds anything in.
 */
const WIDTH = 1180;
const HEIGHT = 760;
const ROW = 58;

type Tab = 'Display' | 'Controls';
const TABS: readonly Tab[] = ['Display', 'Controls'];

export class SettingsScreen {
  #panel!: Panel;
  #tab: Tab = 'Display';
  #tabButtons: Array<{ image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; tab: Tab }> = [];
  /** Everything belonging to the tab currently shown, cleared on every switch. */
  #rows: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  /** The action waiting for a key, while a rebind is armed. */
  #listening: Action | null = null;
  #notice!: Phaser.GameObjects.Text;
  #onKey: ((event: KeyboardEvent) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;

    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'Settings', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    this.#buildTabs();

    this.#notice = this.#text(0, HEIGHT / 2 - this.#panel.inset * 1.25, '', HUD.hintSize, HUD.dimInk);
    this.#panel.body.add(this.#notice);

    this.#panel.setVisible(false);
    this.#render();
  }

  #text(x: number, y: number, value: string, size: number, colour: string, originX = 0.5) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#texts.push(t);
    return t;
  }

  #buildTabs(): void {
    // Clear of the title, which sits on the top bar of the frame.
    const top = -HEIGHT / 2 + this.#panel.inset + 66;
    TABS.forEach((tab, i) => {
      const x = -190 + i * 380;
      const image = this.scene.add.image(x, top, CONTROLS_TEXTURE_KEY, 'tab');
      fitWidth(image, 330);
      const label = this.#text(x, top - 4, tab.toUpperCase(), HUD.labelSize, HUD.ink);

      image.setInteractive(
        new Phaser.Geom.Rectangle(-165, -45, 330, 90), Phaser.Geom.Rectangle.Contains,
      ).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.#tab = tab;
        this.#render();
      });

      this.#panel.body.add(image);
      this.#panel.body.add(label);
      this.#tabButtons.push({ image, label, tab });
    });
  }

  #render(): void {
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#cancelListening();

    for (const { image, label, tab } of this.#tabButtons) {
      const on = tab === this.#tab;
      image.setFrame(on ? 'tabActive' : 'tab');
      label.setColor(on ? HUD.activeInk : HUD.dimInk);
    }

    if (this.#tab === 'Display') this.#renderDisplay();
    else this.#renderControls();
  }

  // --- display ---------------------------------------------------------------

  #renderDisplay(): void {
    const settings = getSettings();
    const left = -WIDTH / 2 + this.#panel.inset + 40;
    const right = WIDTH / 2 - this.#panel.inset - 40;
    let y = -HEIGHT / 2 + this.#panel.inset + 172;

    this.#add(this.#text(left, y, 'CAMERA ZOOM', HUD.hintSize, HUD.ink, 0));
    this.#slider(right - 300, y, settings.zoom, 0.7, 1.6, (v) => {
      updateSettings({ zoom: Math.round(v * 20) / 20 });
      this.#render();
    });
    this.#add(this.#text(right, y, `${settings.zoom.toFixed(2)}x`, HUD.hintSize, HUD.dimInk, 1));
    y += ROW;

    this.#add(this.#text(left, y, 'QUALITY', HUD.hintSize, HUD.ink, 0));
    QUALITIES.forEach((q, i) => {
      const x = right - 300 + i * 100;
      const on = settings.quality === q;
      const chip = this.scene.add.image(x, y, CONTROLS_TEXTURE_KEY, on ? 'buttonPress' : 'button');
      fitWidth(chip, 94);
      chip.setInteractive(
        new Phaser.Geom.Rectangle(-47, -20, 94, 40), Phaser.Geom.Rectangle.Contains,
      ).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        updateSettings({ quality: q as Quality });
        this.#render();
      });
      this.#add(chip);
      this.#add(this.#text(x, y, q.toUpperCase(), HUD.hintSize - 2, on ? HUD.activeInk : HUD.dimInk));
    });
    y += ROW;

    this.#toggle(left, right, y, 'FULLSCREEN', this.scene.scale.isFullscreen, () => {
      eventBus.emit('game:toggle-fullscreen', {});
    });
    y += ROW;

    this.#toggle(left, right, y, 'HITBOXES', settings.debugOverlay, (on) => {
      updateSettings({ debugOverlay: on });
      eventBus.emit('debug:toggle-bodies', { enabled: on });
      this.#render();
    });
    y += ROW * 1.4;

    // `main` defines nine settings and this branch can honour three. The rest
    // are named rather than hidden, so they read as coming rather than missing
    // -- and so nobody wires a slider to nothing to fill the space.
    const waiting = [...SETTINGS_KEYS].filter((k) => !SETTINGS_AVAILABLE.has(k));
    this.#add(this.#text(left, y, 'NOT YET WIRED', HUD.hintSize - 2, HUD.dimInk, 0));
    y += 30;
    this.#add(this.#text(
      left, y, waiting.join('   ·   '), HUD.hintSize - 3, HUD.dimInk, 0,
    ));
  }

  #slider(x: number, y: number, value: number, min: number, max: number,
          onChange: (value: number) => void): void {
    const width = 260;
    const track = this.scene.add.image(x + width / 2, y, CONTROLS_TEXTURE_KEY, 'sliderTrack');
    fitWidth(track, width);
    this.#add(track);

    const frac = Phaser.Math.Clamp((value - min) / (max - min), 0, 1);
    const knob = this.scene.add.image(x + frac * width, y, CONTROLS_TEXTURE_KEY, 'sliderKnob');
    fitWidth(knob, 26);
    this.#add(knob);

    // The track takes the click, not the knob: dragging a 26-pixel knob is
    // fiddly, and jumping to where you clicked is what every slider does.
    track.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -26, width, 52), Phaser.Geom.Rectangle.Contains,
    ).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      eventBus.emit('hud:pointer-used', {});
      const local = Phaser.Math.Clamp((p.worldX - (track.x - width / 2)) / width, 0, 1);
      onChange(min + local * (max - min));
    });
  }

  #toggle(left: number, right: number, y: number, label: string, on: boolean,
          onFlip: (next: boolean) => void): void {
    this.#add(this.#text(left, y, label, HUD.hintSize, HUD.ink, 0));
    const image = this.scene.add.image(right - 60, y, CONTROLS_TEXTURE_KEY, on ? 'toggleOn' : 'toggleOff');
    fitWidth(image, 110);
    image.setInteractive(
      new Phaser.Geom.Rectangle(-55, -25, 110, 50), Phaser.Geom.Rectangle.Contains,
    ).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      eventBus.emit('hud:pointer-used', {});
      onFlip(!on);
    });
    this.#add(image);
  }

  // --- controls --------------------------------------------------------------

  #renderControls(): void {
    const left = -WIDTH / 2 + this.#panel.inset + 40;
    const right = WIDTH / 2 - this.#panel.inset - 40;
    const startY = -HEIGHT / 2 + this.#panel.inset + 160;

    // Two columns, because fifteen rows down one side of a 760-tall panel
    // leaves the other side empty and still does not fit.
    const half = Math.ceil(ACTIONS.length / 2);
    ACTIONS.forEach((info, i) => {
      const col = i < half ? 0 : 1;
      const row = i % half;
      const x = col === 0 ? left : left + (right - left) / 2 + 30;
      const y = startY + row * 44;
      const binding = keybinds.get(info.action);

      this.#add(this.#text(x, y, info.label.toUpperCase(), HUD.hintSize - 3, HUD.ink, 0));

      const keyX = x + (right - left) / 2 - 120;
      const armed = this.#listening === info.action;
      const caption = armed ? 'PRESS A KEY'
        : binding.primary < 0 ? '—'
        : keyName(binding.primary) + (binding.secondary !== undefined ? ` / ${keyName(binding.secondary)}` : '');

      const cap = this.scene.add.image(keyX, y, CONTROLS_TEXTURE_KEY, armed ? 'buttonPress' : 'button');
      fitWidth(cap, 150);
      cap.setInteractive(
        new Phaser.Geom.Rectangle(-75, -22, 150, 44), Phaser.Geom.Rectangle.Contains,
      ).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.#listen(info.action);
      });
      this.#add(cap);
      this.#add(this.#text(keyX, y, caption, HUD.hintSize - 4,
        armed ? HUD.activeInk : binding.primary < 0 ? HUD.dimInk : HUD.ink));
    });

    const resetY = HEIGHT / 2 - this.#panel.inset - 70;
    const reset = this.scene.add.image(0, resetY, CONTROLS_TEXTURE_KEY, 'button');
    fitWidth(reset, 260);
    reset.setInteractive(
      new Phaser.Geom.Rectangle(-130, -28, 260, 56), Phaser.Geom.Rectangle.Contains,
    ).on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      eventBus.emit('hud:pointer-used', {});
      keybinds.reset();
      this.#notice.setText('Bindings reset to defaults.');
      this.#render();
    });
    this.#add(reset);
    this.#add(this.#text(0, resetY, 'RESET TO DEFAULTS', HUD.hintSize - 2, HUD.ink));
  }

  /**
   * Arm a rebind: the next key pressed becomes this action's.
   *
   * Listened for on the window rather than through Phaser, because Phaser only
   * reports keys it has been asked for -- and the whole point is to accept one
   * it has never heard of.
   */
  #listen(action: Action): void {
    this.#cancelListening();
    this.#listening = action;
    this.#notice.setText('Press a key, or Escape to cancel.');
    eventBus.emit('input:suspend', { suspended: true });
    this.#render();

    this.#onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      const code = event.keyCode;
      if (code === Phaser.Input.Keyboard.KeyCodes.ESC) {
        this.#notice.setText('');
        this.#cancelListening();
        this.#render();
        return;
      }
      if (Keybinds.reserved(code)) {
        this.#notice.setText(`${keyName(code)} is reserved and cannot be bound.`);
        return;
      }
      const stolen = keybinds.set(action, 'primary', code);
      this.#notice.setText(
        stolen ? `${keyName(code)} taken from ${stolen.label}.` : `Bound to ${keyName(code)}.`,
      );
      this.#cancelListening();
      this.#render();
    };
    window.addEventListener('keydown', this.#onKey, { capture: true });
  }

  #cancelListening(): void {
    if (this.#onKey) {
      window.removeEventListener('keydown', this.#onKey, { capture: true });
      this.#onKey = null;
    }
    if (this.#listening !== null) {
      this.#listening = null;
      eventBus.emit('input:suspend', { suspended: false });
    }
  }

  #add(object: Phaser.GameObjects.GameObject): void {
    this.#panel.body.add(object);
    this.#rows.push(object);
  }

  toggle(): boolean {
    const next = !this.#panel.visible;
    this.#panel.setVisible(next);
    if (next) {
      this.#notice.setText('');
      this.#render();
    } else {
      this.#cancelListening();
    }
    return next;
  }

  get open(): boolean {
    return this.#panel.visible;
  }

  close(): void {
    this.#cancelListening();
    this.#panel.setVisible(false);
  }

  destroy(): void {
    this.#cancelListening();
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#panel?.destroy();
    this.#texts = [];
    this.#tabButtons = [];
  }
}
