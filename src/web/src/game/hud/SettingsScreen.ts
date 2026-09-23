import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import {
  ACTIONS, keybinds, keyName, Keybinds, type Action, type ActionInfo,
} from '../state/Keybinds';
import {
  getSettings, QUALITIES, updateSettings,
  type Quality,
} from '../../ui/settings';
import { fitInside, fitWidth } from './fit';
import { controlArt } from './controlArt';
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
const WIDTH = 1640;
const HEIGHT = 960;
const L = {
  pad: 40,
  controlW: 580,
  row: 84,
  bindRow: 46,
  contentTop: -244,
  footer: 354,
} as const;

type Tab = 'Display' | 'Controls';
const TABS: readonly Tab[] = ['Display', 'Controls'];

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
  #dragZoom: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  #offSettings: (() => void) | null = null;

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

    // A modal owns every click, including blank space outside the frame.
    const blocker = this.scene.add.zone(0, 0, VIEW.width * RENDER_SCALE, VIEW.height * RENDER_SCALE)
      .setInteractive().on('pointerdown', () => eventBus.emit('hud:pointer-used', {}));
    this.#panel.container.addAt(blocker, 0);
    this.#buildTabs();
    this.#buildClose();

    this.#notice = this.#text(0, 392, '', 20, HUD.dimInk);
    this.#panel.body.add(this.#notice);

    this.#panel.setVisible(false);
    this.#render();
    this.#offSettings = eventBus.on('game:fullscreen', () => {
      if (this.open && this.#tab === 'Display') this.#render();
    });
    this.scene.input.on('pointermove', this.#moveSlider, this);
    this.scene.input.on('pointerup', this.#releaseSlider, this);
    this.scene.input.on('gameout', this.#releaseSlider, this);
  }

  #plate(x: number, y: number, frame: string, width: number, height: number) {
    return this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, frame, width, height));
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
    const top = -334;
    const width = 270;
    TABS.forEach((tab, i) => {
      const x = this.#left + width / 2 + i * (width + 20);
      const image = this.#plate(x, top, 'tab', width, 68);
      const label = this.#text(x, top, tab.toUpperCase(), 28, HUD.ink);

      image.setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          this.#cancelListening();
          this.#notice.setText('');
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
   * The cross is the drawn `close` glyph now, not a text "x" -- a font
   * character next to hand-drawn chrome is the one thing on a screen of art
   * that looks like a placeholder, because it is one.
   *
   * The whole button takes the pointer, not the glyph: a hit area the size of
   * the cross is a hit area you have to aim at. Escape closes the screen too,
   * and always will -- a screen you can only leave by finding a small button is
   * a screen that traps anyone whose mouse has wandered off the canvas.
   */
  #buildClose(): void {
    const x = this.#right - 34;
    const y = -334;
    const button = this.#plate(x, y, 'button', 68, 68);
    button.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        eventBus.emit('settings:toggle', {});
      });
    this.#panel.body.add(button);

    const cross = this.scene.add.image(x, y, GLYPHS_TEXTURE_KEY, 'close');
    fitInside(cross, 32);
    this.#panel.body.add(cross);
  }

  #render(): void {
    this.#dragZoom = null;
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((text) => text.scene);

    for (const { image, label, tab } of this.#tabButtons) {
      const on = tab === this.#tab;
      image.setTexture(controlArt(this.scene, CONTROLS_TEXTURE_KEY, on ? 'tabActive' : 'tab', 270, 68));
      label.setColor(on ? HUD.activeInk : HUD.dimInk);
    }

    if (this.#tab === 'Display') this.#renderDisplay();
    else this.#renderControls();
  }

  // --- shared row furniture ---------------------------------------------------

  /** A heading with a rule under it, so the screen reads as sections. */
  #section(y: number, title: string, x = this.#left, width = this.#right - this.#left): void {
    this.#add(this.#text(x, y, title.toUpperCase(), 22, HUD.activeInk, 0));
    this.#add(this.scene.add.rectangle(x, y + 24, width, 2, 0x53456a).setOrigin(0, 0.5));
  }

  #label(y: number, text: string): void {
    this.#add(this.#text(this.#left, y, text, 28, HUD.ink, 0));
  }

  #renderDisplay(): void {
    const settings = getSettings();
    this.#section(L.contentTop, 'Display');
    let y = -180;
    this.#label(y, 'Camera zoom');
    this.#slider(y, settings.zoom);
    y += L.row;
    this.#label(y, 'Quality');
    this.#chips(y, QUALITIES, settings.quality, (q) => {
      updateSettings({ quality: q as Quality });
      this.#render();
    });
    y += L.row;
    this.#label(y, 'Fullscreen');
    this.#toggle(y, this.scene.scale.isFullscreen, () => eventBus.emit('game:toggle-fullscreen', {}));

    this.#section(76, 'Sandbox');
    this.#label(140, 'Show hitboxes');
    this.#toggle(140, settings.debugOverlay, (on) => {
      updateSettings({ debugOverlay: on });
      eventBus.emit('debug:toggle-bodies', { enabled: on });
      this.#render();
    });
    this.#label(224, 'The Mirror');
    this.#button(224, 'SUMMON / DISMISS', 320, () => {
      eventBus.emit('debug:spawn-boss', {});
      eventBus.emit('settings:toggle', {});
    });
    this.#button(L.footer, 'RESET ZOOM', 250, () => {
      updateSettings({ zoom: 1 });
      this.#render();
    }, this.#right - 125);
    this.#add(this.#text(this.#left, L.footer, 'Audio and extra effects are coming later.', 22, HUD.dimInk, 0));
  }

  #slider(y: number, value: number): void {
    const min = 0.7;
    const max = 1.6;
    const x = this.#controlX + 60;
    const width = L.controlW - 260;
    const track = this.#plate(x + width / 2, y, 'sliderTrack', width, 32);
    this.#add(track);
    const knob = this.scene.add.image(x, y, CONTROLS_TEXTURE_KEY, 'sliderKnob');
    fitWidth(knob, 24);
    this.#add(knob);
    const caption = this.#text(this.#right, y, '', 26, HUD.activeInk, 1);
    this.#add(caption);
    let current = value;
    const paint = () => {
      knob.setX(x + Phaser.Math.Clamp((current - min) / (max - min), 0, 1) * width);
      caption.setText(`${current.toFixed(2)}x`);
    };
    const change = (next: number) => {
      current = Math.round(Phaser.Math.Clamp(next, min, max) * 20) / 20;
      updateSettings({ zoom: current });
      paint();
    };
    const atPointer = (pointer: Phaser.Input.Pointer) => {
      // Pointer is in HUD camera space; the track lives inside two containers.
      const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
      const local = this.#panel.body.getWorldTransformMatrix().applyInverse(world.x, world.y);
      change(min + Phaser.Math.Clamp((local.x - x) / width, 0, 1) * (max - min));
    };
    const hit = this.scene.add.zone(x + width / 2, y, width + 24, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        eventBus.emit('hud:pointer-used', {});
        this.#dragZoom = atPointer;
        atPointer(pointer);
      });
    this.#add(hit);
    this.#button(y, '-', 48, () => change(current - 0.05), x - 36);
    this.#button(y, '+', 48, () => change(current + 0.05), x + width + 40);
    paint();
  }

  #moveSlider(pointer: Phaser.Input.Pointer): void {
    if (pointer.isDown) this.#dragZoom?.(pointer);
    else this.#dragZoom = null;
  }

  #releaseSlider(): void { this.#dragZoom = null; }

  #chips(y: number, options: readonly string[], current: string,
         onPick: (value: string) => void): void {
    const gap = 10;
    const width = (L.controlW - gap * (options.length - 1)) / options.length;
    options.forEach((option, i) => {
      const x = this.#controlX + width / 2 + i * (width + gap);
      const on = option === current;
      const chip = this.#plate(x, y, on ? 'buttonPress' : 'button', width, 56);
      chip.setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          onPick(option);
        });
      this.#add(chip);
      this.#add(this.#text(x, y, option.toUpperCase(), 24,
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
    const image = this.#plate(x, y, 'button', width, 54);
    image.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        onPress();
      });
    this.#add(image);
    this.#add(this.#text(x, y, caption, 23, HUD.ink));
  }

  // --- controls ---------------------------------------------------------------

  #renderControls(): void {
    const gap = 48;
    const colWidth = (this.#right - this.#left - gap) / 2;
    const groups: readonly (readonly ActionInfo['group'][])[] = [
      ['Movement', 'Combat'], ['Items', 'Interface'],
    ];
    groups.forEach((column, index) => {
      const x = this.#left + index * (colWidth + gap);
      let y = L.contentTop;
      for (const group of column) {
        this.#section(y, group, x, colWidth);
        y += 44;
        for (const info of ACTIONS.filter((action) => action.group === group)) {
          this.#bindRow(x, y, colWidth, info);
          y += L.bindRow;
        }
        y += 22;
      }
    });
    this.#button(L.footer, 'RESET TO DEFAULTS', 320, () => {
      this.#cancelListening();
      keybinds.reset();
      this.#notice.setText('Bindings reset to defaults.');
      this.#render();
    }, this.#right - 160);
    this.#add(this.#text(this.#left, L.footer, 'Select a key to rebind. Escape cancels.', 22, HUD.dimInk, 0));
  }

  #bindRow(x: number, y: number, colWidth: number, info: ActionInfo): void {
    const binding = keybinds.get(info.action);
    const armed = this.#listening === info.action;

    this.#add(this.#text(x, y, info.label, 23, HUD.ink, 0));

    const capWidth = 210;
    const capX = x + colWidth - capWidth / 2;
    const cap = this.#plate(capX, y, armed ? 'buttonPress' : 'button', capWidth, 40);
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
    this.#add(this.#text(capX, y, caption, 22,
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
      eventBus.emit('input:suspend', { suspended: this.open });
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
      eventBus.emit('input:suspend', { suspended: true });
    } else {
      this.#cancelListening();
      this.#unwatchEscape();
      this.#dragZoom = null;
      eventBus.emit('input:suspend', { suspended: false });
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
    const wasOpen = this.open;
    this.#panel.setVisible(false);
    this.#dragZoom = null;
    if (wasOpen) eventBus.emit('input:suspend', { suspended: false });
  }

  destroy(): void {
    this.#offSettings?.();
    this.scene.input.off('pointermove', this.#moveSlider, this);
    this.scene.input.off('pointerup', this.#releaseSlider, this);
    this.scene.input.off('gameout', this.#releaseSlider, this);
    this.close();
    this.#cancelListening();
    this.#unwatchEscape();
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#panel?.destroy();
    this.#texts = [];
    this.#tabButtons = [];
  }
}
