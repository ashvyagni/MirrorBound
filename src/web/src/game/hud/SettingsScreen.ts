import Phaser from 'phaser';

import { BARSPLATES_TEXTURE_KEY } from '../animation/barsPlatesAtlas.generated';
import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import {
  ACTIONS, keybinds, keyName, Keybinds, type Action, type ActionInfo,
} from '../state/Keybinds';
import {
  getSettings, QUALITIES, SETTINGS_AVAILABLE, SETTINGS_KEYS, updateSettings,
  type Quality, type Settings,
} from '../../ui/settings';
import { fitWidth } from './fit';
import { Panel } from './Panel';

/**
 * The settings screen.
 *
 * In the canvas rather than in React, for the same reason the rest of the HUD
 * is: it has to survive fullscreen, where no DOM panel beside the game exists
 * any more.
 *
 * Two tabs, because the screen answers two unrelated questions -- how the game
 * looks and what the keys do -- and one scrolling list of both is a list nobody
 * finds anything in.
 *
 * Everything sits on the grid below rather than where it fitted. The first
 * version placed each control by eye, which stranded labels at one edge with
 * their controls at the other and a hand's width of nothing between them.
 */
const WIDTH = 1240;
const HEIGHT = 820;

/** The layout grid. Every position on this screen comes from here. */
const L = {
  /** Space between the frame's inner edge and the content. */
  pad: 46,
  /** Width of the right-hand column every control is placed in. */
  controlW: 420,
  /** Height of one setting row. */
  row: 66,
  /** Height of one keybind row, which is denser. */
  bindRow: 52,
  /** Space above a section heading, and below its rule. */
  sectionTop: 38,
  sectionGap: 26,
  /** Top of the content, below the tabs. */
  contentTop: 176,
} as const;

type Tab = 'Display' | 'Controls';
const TABS: readonly Tab[] = ['Display', 'Controls'];

/** Readable names for the settings this branch cannot honour yet. */
const SETTING_LABELS: Partial<Record<keyof Settings, string>> = {
  masterVolume: 'Master volume',
  musicVolume: 'Music',
  sfxVolume: 'Effects',
  screenShake: 'Screen shake',
  damageNumbers: 'Damage numbers',
  showTwinThoughts: 'Twin thoughts',
};

export class SettingsScreen {
  #panel!: Panel;
  #tab: Tab = 'Display';
  #tabButtons: Array<{ image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; tab: Tab }> = [];
  /** Everything belonging to the tab on screen, cleared on every switch. */
  #rows: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  /** The action waiting for a key, while a rebind is armed. */
  #listening: Action | null = null;
  #notice!: Phaser.GameObjects.Text;
  #onKey: ((event: KeyboardEvent) => void) | null = null;
  #escape: ((event: KeyboardEvent) => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  /** Content edges, inside the frame's border and the padding. */
  get #left(): number { return -WIDTH / 2 + this.#panel.inset + L.pad; }
  get #right(): number { return WIDTH / 2 - this.#panel.inset - L.pad; }
  /** Left edge of the control column, so every control begins at one x. */
  get #controlX(): number { return this.#right - L.controlW; }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;

    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'Settings', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    this.#buildTabs();
    this.#buildClose();

    this.#notice = this.#text(0, HEIGHT / 2 - this.#panel.inset - 26, '', HUD.hintSize, HUD.dimInk);
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
    // Below the title, which sits on the frame's top bar.
    const top = -HEIGHT / 2 + this.#panel.inset + 62;
    const width = 300;
    TABS.forEach((tab, i) => {
      const x = this.#left + width / 2 + i * (width + 20);
      const image = this.scene.add.image(x, top, CONTROLS_TEXTURE_KEY, 'tab');
      fitWidth(image, width);
      const label = this.#text(x, top - 4, tab.toUpperCase(), HUD.labelSize, HUD.ink);

      image.setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          this.#tab = tab;
          this.#render();
        });

      this.#panel.body.add(image);
      this.#panel.body.add(label);
      this.#tabButtons.push({ image, label, tab });
    });
  }

  /**
   * The close button.
   *
   * A button frame with a cross on it, until `assets/ui/close.png` exists.
   * Escape closes the screen too, and always will -- a screen you can only
   * leave by finding a small button is a screen that traps anyone whose mouse
   * has wandered off the canvas.
   */
  #buildClose(): void {
    const x = this.#right - 34;
    const y = -HEIGHT / 2 + this.#panel.inset + 62;
    const button = this.scene.add.image(x, y, CONTROLS_TEXTURE_KEY, 'button');
    fitWidth(button, 76);
    button.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        eventBus.emit('settings:toggle', {});
      });
    this.#panel.body.add(button);
    this.#panel.body.add(this.#text(x, y - 2, '×', HUD.labelSize + 8, HUD.ink));
  }

  #render(): void {
    for (const o of this.#rows) o.destroy();
    this.#rows = [];

    for (const { image, label, tab } of this.#tabButtons) {
      const on = tab === this.#tab;
      image.setFrame(on ? 'tabActive' : 'tab');
      label.setColor(on ? HUD.activeInk : HUD.dimInk);
    }

    if (this.#tab === 'Display') this.#renderDisplay();
    else this.#renderControls();
  }

  // --- shared row furniture ---------------------------------------------------

  /** A heading with a rule under it, so the screen reads as sections. */
  #section(y: number, title: string): number {
    this.#add(this.#text(this.#left, y, title.toUpperCase(), HUD.hintSize - 2, HUD.activeInk, 0));
    const rule = this.scene.add
      .image(this.#left, y + 20, BARSPLATES_TEXTURE_KEY, 'divider')
      .setOrigin(0, 0.5)
      .setAlpha(0.5);
    fitWidth(rule, this.#right - this.#left);
    this.#add(rule);
    return y + L.sectionGap + 18;
  }

  #label(y: number, text: string): void {
    this.#add(this.#text(this.#left, y, text, HUD.hintSize, HUD.ink, 0));
  }

  // --- display ----------------------------------------------------------------

  #renderDisplay(): void {
    const settings = getSettings();
    let y = -HEIGHT / 2 + this.#panel.inset + L.contentTop;

    y = this.#section(y, 'Display');

    this.#label(y, 'Camera zoom');
    this.#slider(y, settings.zoom, 0.7, 1.6, (v) => {
      updateSettings({ zoom: Math.round(v * 20) / 20 });
      this.#render();
    }, `${settings.zoom.toFixed(2)}x`);
    y += L.row;

    this.#label(y, 'Quality');
    this.#chips(y, QUALITIES, settings.quality, (q) => {
      updateSettings({ quality: q as Quality });
      this.#render();
    });
    y += L.row;

    this.#label(y, 'Fullscreen');
    this.#toggle(y, this.scene.scale.isFullscreen, () => {
      eventBus.emit('game:toggle-fullscreen', {});
      // The scale manager reports the new state a frame later.
      this.scene.time.delayedCall(80, () => this.#render());
    });
    y += L.row + L.sectionTop;

    y = this.#section(y, 'Debug');

    this.#label(y, 'Show hitboxes');
    this.#toggle(y, settings.debugOverlay, (on) => {
      updateSettings({ debugOverlay: on });
      eventBus.emit('debug:toggle-bodies', { enabled: on });
      this.#render();
    });
    y += L.row;

    this.#label(y, 'Spawn the Mirror');
    this.#button(y, 'SUMMON', 200, () => {
      eventBus.emit('debug:spawn-boss', {});
      eventBus.emit('settings:toggle', {});
    });
    y += L.row + L.sectionTop;

    // `main` defines nine settings and this branch can honour three. The rest
    // are named rather than hidden, so they read as coming rather than missing
    // -- and so nobody wires a slider to nothing to fill the space.
    y = this.#section(y, 'Not yet wired');
    const waiting = SETTINGS_KEYS
      .filter((k) => !SETTINGS_AVAILABLE.has(k))
      .map((k) => SETTING_LABELS[k] ?? k);
    this.#add(this.#text(this.#left, y, waiting.join('      '), HUD.hintSize - 2, HUD.dimInk, 0));
    y += 28;
    this.#add(this.#text(
      this.#left, y,
      'volume needs an audio manager; the rest need the systems behind them',
      HUD.hintSize - 3, HUD.dimInk, 0,
    ));
  }

  #slider(y: number, value: number, min: number, max: number,
          onChange: (value: number) => void, caption: string): void {
    const width = L.controlW - 110;
    const x = this.#controlX;
    const track = this.scene.add.image(x + width / 2, y, CONTROLS_TEXTURE_KEY, 'sliderTrack');
    fitWidth(track, width);
    this.#add(track);

    const frac = Phaser.Math.Clamp((value - min) / (max - min), 0, 1);
    const knob = this.scene.add.image(x + frac * width, y, CONTROLS_TEXTURE_KEY, 'sliderKnob');
    fitWidth(knob, 24);
    this.#add(knob);

    // The track takes the click, not the knob: dragging a 24-pixel knob is
    // fiddly, and jumping to where you clicked is what every slider does.
    track.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        eventBus.emit('hud:pointer-used', {});
        const local = Phaser.Math.Clamp((p.worldX - (track.x - width / 2)) / width, 0, 1);
        onChange(min + local * (max - min));
      });

    this.#add(this.#text(this.#right, y, caption, HUD.hintSize, HUD.dimInk, 1));
  }

  #chips(y: number, options: readonly string[], current: string,
         onPick: (value: string) => void): void {
    const gap = 10;
    const width = (L.controlW - gap * (options.length - 1)) / options.length;
    options.forEach((option, i) => {
      const x = this.#controlX + width / 2 + i * (width + gap);
      const on = option === current;
      const chip = this.scene.add.image(x, y, CONTROLS_TEXTURE_KEY, on ? 'buttonPress' : 'button');
      fitWidth(chip, width);
      chip.setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          onPick(option);
        });
      this.#add(chip);
      this.#add(this.#text(x, y, option.toUpperCase(), HUD.hintSize - 2,
        on ? HUD.activeInk : HUD.dimInk));
    });
  }

  #toggle(y: number, on: boolean, onFlip: (next: boolean) => void): void {
    // Right-aligned in the control column, so every toggle lines up with every
    // other whatever the length of its label.
    const image = this.scene.add
      .image(this.#right - 56, y, CONTROLS_TEXTURE_KEY, on ? 'toggleOn' : 'toggleOff');
    fitWidth(image, 112);
    image.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        onFlip(!on);
      });
    this.#add(image);
  }

  #button(y: number, caption: string, width: number, onPress: () => void,
          x = this.#right - width / 2): void {
    const image = this.scene.add.image(x, y, CONTROLS_TEXTURE_KEY, 'button');
    fitWidth(image, width);
    image.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        onPress();
      });
    this.#add(image);
    this.#add(this.#text(x, y, caption, HUD.hintSize - 2, HUD.ink));
  }

  // --- controls ---------------------------------------------------------------

  #renderControls(): void {
    const top = -HEIGHT / 2 + this.#panel.inset + L.contentTop - 40;
    const colWidth = (this.#right - this.#left) / 2;

    // Grouped, and split across two columns at a group boundary rather than
    // mid-group: fifteen rows down one side does not fit, and a split landing
    // inside "Movement" reads as two unrelated lists.
    const groups = new Map<string, ActionInfo[]>();
    for (const info of ACTIONS) {
      const list = groups.get(info.group) ?? [];
      list.push(info);
      groups.set(info.group, list);
    }

    const entries = [...groups.entries()];
    const half = Math.ceil(entries.length / 2);
    entries.forEach(([group, actions], index) => {
      const col = index < half ? 0 : 1;
      const x = this.#left + col * colWidth;
      // Each column restarts at the top; groups stack within a column.
      const before = entries.slice(col === 0 ? 0 : half, index);
      const offset = before.reduce(
        (sum, [, list]) => sum + list.length * L.bindRow + L.sectionGap + 30, 0,
      );
      let y = top + offset;

      this.#add(this.#text(x, y, group.toUpperCase(), HUD.hintSize - 3, HUD.activeInk, 0));
      const rule = this.scene.add
        .image(x, y + 18, BARSPLATES_TEXTURE_KEY, 'divider')
        .setOrigin(0, 0.5)
        .setAlpha(0.45);
      fitWidth(rule, colWidth - 50);
      this.#add(rule);
      y += 38;

      for (const info of actions) {
        this.#bindRow(x, y, colWidth, info);
        y += L.bindRow;
      }
    });

    this.#button(HEIGHT / 2 - this.#panel.inset - 74, 'RESET TO DEFAULTS', 300, () => {
      keybinds.reset();
      this.#notice.setText('Bindings reset to defaults.');
      this.#render();
    }, 0);
  }

  #bindRow(x: number, y: number, colWidth: number, info: ActionInfo): void {
    const binding = keybinds.get(info.action);
    const armed = this.#listening === info.action;

    this.#add(this.#text(x, y, info.label, HUD.hintSize - 3, HUD.ink, 0));

    const capWidth = 150;
    const capX = x + colWidth - 70 - capWidth / 2;
    const cap = this.scene.add
      .image(capX, y, CONTROLS_TEXTURE_KEY, armed ? 'buttonPress' : 'button');
    fitWidth(cap, capWidth);
    cap.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.#listen(info.action);
      });
    this.#add(cap);

    const caption = armed ? 'PRESS KEY'
      : binding.primary < 0 ? '—'
      : keyName(binding.primary)
        + (binding.secondary !== undefined ? ` / ${keyName(binding.secondary)}` : '');
    this.#add(this.#text(capX, y, caption, HUD.hintSize - 4,
      armed ? HUD.activeInk : binding.primary < 0 ? HUD.dimInk : HUD.ink));
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
      event.stopPropagation();
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
      this.#watchEscape();
    } else {
      this.#cancelListening();
      this.#unwatchEscape();
    }
    return next;
  }

  /**
   * Escape closes it.
   *
   * A screen you can only leave by finding a small button is a screen that
   * traps anyone whose mouse has left the canvas -- and this one covers the
   * game, so being trapped in it means being unable to play.
   */
  #watchEscape(): void {
    if (this.#escape) return;
    this.#escape = (event: KeyboardEvent) => {
      // A rebind waiting for a key owns Escape first, to cancel itself.
      if (this.#listening !== null) return;
      if (event.keyCode !== Phaser.Input.Keyboard.KeyCodes.ESC) return;
      event.preventDefault();
      eventBus.emit('settings:toggle', {});
    };
    window.addEventListener('keydown', this.#escape);
  }

  #unwatchEscape(): void {
    if (!this.#escape) return;
    window.removeEventListener('keydown', this.#escape);
    this.#escape = null;
  }

  get open(): boolean {
    return this.#panel.visible;
  }

  close(): void {
    this.#cancelListening();
    this.#unwatchEscape();
    this.#panel.setVisible(false);
  }

  destroy(): void {
    this.#cancelListening();
    this.#unwatchEscape();
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#panel?.destroy();
    this.#texts = [];
    this.#tabButtons = [];
  }
}
