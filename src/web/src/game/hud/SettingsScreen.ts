import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import {
  ACTIONS, keybinds, keyName, Keybinds, mouseCode, type Action, type ActionInfo,
} from '../state/Keybinds';
import { saves, savedAgo } from '../state/Saves';
import type { CommandMessage, SaveSlot } from '../contracts';
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
  bindRow: 36,
  /** Height a section heading and its rule take before its first row. */
  bindHead: 36,
  /** Space between one group and the next heading. */
  bindGap: 16,
  contentTop: -244,
  footer: 354,
} as const;

/** Rows the Saves tab has vertical room for before the footer buttons. */
const SAVE_ROWS = 5;
/** Matches the server's own cap on `saveName`. */
const SAVE_NAME_MAX = 48;

type Tab = 'Display' | 'Controls' | 'Saves';
const TABS: readonly Tab[] = ['Display', 'Controls', 'Saves'];

export class SettingsScreen {
  #panel!: Panel;
  #tab: Tab = 'Display';
  #tabButtons: Array<{ image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; tab: Tab }> = [];
  /** Everything belonging to the tab on screen, cleared on every switch. */
  #rows: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  /** The action waiting for a key, while a rebind is armed. */
  #listening: Action | null = null;
  #onMouse: ((event: MouseEvent) => void) | null = null;
  /** The name being typed for a new save, while one is being named. */
  #saveName = '';
  /** True between the first and second press of RESET ALL DATA. */
  #resetArmed = false;
  #notice!: Phaser.GameObjects.Text;
  #onKey: ((event: KeyboardEvent) => void) | null = null;
  #escape: ((event: KeyboardEvent) => void) | null = null;
  #dragZoom: ((pointer: Phaser.Input.Pointer) => void) | null = null;
  #offSettings: (() => void) | null = null;
  #offSaves: (() => void) | null = null;
  /** `saves.revision` the Saves tab was last drawn from. */
  #savesDrawn = -1;

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
    // The list is the server's, so it redraws when the server's answer lands
    // rather than when the button was pressed -- a delete that failed must not
    // leave the row gone on screen.
    this.#offSaves = eventBus.on('game:snapshot', () => {
      if (!this.open || this.#tab !== 'Saves' || saves.revision === this.#savesDrawn) return;
      this.#savesDrawn = saves.revision;
      this.#render();
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
          this.#resetArmed = false;
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
    else if (this.#tab === 'Saves') this.#renderSaves();
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
    this.#label(140, 'Show hitboxes and heat map');
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
    this.#label(308, 'The Proving');
    this.#button(308, 'OPEN THE SANDBOX', 320, () => {
      eventBus.emit('settings:toggle', {});
      eventBus.emit('sandbox:toggle', {});
    });
    this.#button(L.footer, 'RESET ZOOM', 250, () => {
      updateSettings({ zoom: 1 });
      this.#render();
    }, this.#right - 125);
    this.#add(this.#text(this.#left, L.footer,
      'The Proving is on the map too — travel there like anywhere else.', 22, HUD.dimInk, 0));
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

  // --- saves ------------------------------------------------------------------

  /**
   * The save list.
   *
   * The server owns the slots; this only shows what the last detail snapshot
   * said and sends commands. Nothing here decides that a save exists -- it
   * asks, and the next snapshot answers, which is why every button re-renders
   * off `saves.revision` rather than editing the list it just drew.
   */
  #renderSaves(): void {
    this.#section(L.contentTop, 'Saves');
    const slots = saves.slots;
    let y = -188;

    if (slots.length === 0) {
      this.#add(this.#text(this.#left, y, 'No saves yet. Reaching a village writes one.', 24, HUD.dimInk, 0));
    }
    for (const slot of slots.slice(0, SAVE_ROWS)) {
      this.#saveRow(y, slot);
      y += L.row;
    }

    // Three different things, and the labels now say which is which. The
    // middle one used to read NEW SAVE while sending SAVE_AS, so the only
    // button that looked like "start again" copied the run you were in --
    // level, gear, campaign progress and everything the twin had learned.
    this.#button(L.footer - 74, 'SAVE HERE', 236, () => this.#command({ action: 'SAVE' }, 'Saved.'),
                 this.#left + 118);
    this.#button(L.footer - 74, 'COPY TO NEW SLOT', 300, () => this.#nameSave('SAVE_AS'),
                 this.#left + 392);
    this.#button(L.footer - 74, 'START A NEW RUN', 300, () => this.#nameSave('NEW_SAVE'),
                 this.#left + 706);
    this.#button(L.footer, 'RESET ALL DATA', 320, () => this.#confirmReset(), this.#right - 160);
    this.#add(this.#text(this.#left, L.footer, this.#resetArmed
      ? 'This erases every save. Press again to confirm.'
      : 'Villages save on their own. A new run starts from nothing, in a slot of its own.',
      22, this.#resetArmed ? HUD.activeInk : HUD.dimInk, 0));
  }

  #saveRow(y: number, slot: SaveSlot): void {
    const playing = slot.id === saves.active;
    this.#add(this.#text(this.#left, y - 12, slot.name, 26,
      playing ? HUD.activeInk : HUD.ink, 0));
    const where = [slot.area.replace(/_/g, ' '), `level ${slot.level}`, savedAgo(slot.savedAt)];
    if (playing) where.push('playing');
    this.#add(this.#text(this.#left, y + 16, where.join('  ·  '), 20, HUD.dimInk, 0));

    this.#button(y, 'CONTINUE', 200, () => this.#command(
      { action: 'LOAD_SAVE', saveId: slot.id }, `Loading ${slot.name}...`), this.#right - 330);
    // The autosave is the village checkpoint itself; deleting it would be
    // deleting the run rather than a save of it. Reset is how that is done.
    if (!slot.auto) {
      this.#button(y, 'DELETE', 180, () => this.#command(
        { action: 'DELETE_SAVE', saveId: slot.id }, `Deleted ${slot.name}.`), this.#right - 100);
    }
  }

  #command(message: Omit<CommandMessage, 'type'>, notice: string): void {
    eventBus.emit('ui:command', { type: 'COMMAND', ...message });
    this.#notice.setText(notice);
    this.#resetArmed = false;
    // The list redraws when the server's next snapshot says what happened.
  }

  /**
   * Type a name for a new save.
   *
   * Captured off the window rather than through Phaser, for the same reason
   * rebinding is: this has to accept keys the game has never asked for. Enter
   * commits, Escape cancels, and an empty name still saves -- the server names
   * the slot rather than refusing it.
   */
  #nameSave(action: 'SAVE_AS' | 'NEW_SAVE'): void {
    this.#cancelListening();
    this.#saveName = '';
    this.#resetArmed = false;
    const what = action === 'NEW_SAVE' ? 'Name your new run' : 'Name this save';
    const paint = () => this.#notice.setText(
      `${what}: ${this.#saveName}_    (Enter to confirm, Escape to cancel)`);
    paint();

    this.#onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        this.#notice.setText('');
        this.#cancelListening();
        return;
      }
      if (event.key === 'Enter') {
        const name = this.#saveName.trim();
        this.#cancelListening();
        this.#command({ action, saveName: name }, action === 'NEW_SAVE'
          ? `Starting a new run${name ? ` as ${name}` : ''}...`
          : name ? `Saved as ${name}.` : 'Saved.');
        return;
      }
      if (event.key === 'Backspace') {
        this.#saveName = this.#saveName.slice(0, -1);
        paint();
        return;
      }
      // One printable character. `key` is already the composed character, so
      // this takes accented letters without a dead-key table of its own.
      if (event.key.length === 1 && this.#saveName.length < SAVE_NAME_MAX) {
        this.#saveName += event.key;
        paint();
      }
    };
    window.addEventListener('keydown', this.#onKey, { capture: true });
  }

  /**
   * Erase everything, on a second press.
   *
   * Two presses rather than a modal: this is the one button on the screen that
   * cannot be undone, and it sits next to buttons that can. The armed state is
   * dropped whenever anything else is touched, so it cannot be left primed.
   */
  #confirmReset(): void {
    if (!this.#resetArmed) {
      this.#resetArmed = true;
      this.#render();
      return;
    }
    this.#resetArmed = false;
    eventBus.emit('ui:command', { type: 'COMMAND', action: 'RESET_DATA' });
    this.#notice.setText('Everything erased. Starting over.');
    this.#render();
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
        y += L.bindHead;
        for (const info of ACTIONS.filter((action) => action.group === group)) {
          this.#bindRow(x, y, colWidth, info);
          y += L.bindRow;
        }
        y += L.bindGap;
      }
    });
    this.#button(L.footer, 'RESET TO DEFAULTS', 320, () => {
      this.#cancelListening();
      keybinds.reset();
      this.#notice.setText('Bindings reset to defaults.');
      this.#render();
    }, this.#right - 160);
    this.#add(this.#text(this.#left, L.footer,
      'Select a row, then press a key or a mouse button. Escape cancels.', 22, HUD.dimInk, 0));
  }

  #bindRow(x: number, y: number, colWidth: number, info: ActionInfo): void {
    const binding = keybinds.get(info.action);
    const armed = this.#listening === info.action;

    this.#add(this.#text(x, y, info.label, 21, HUD.ink, 0));

    const capWidth = 200;
    const capX = x + colWidth - capWidth / 2;
    const cap = this.#plate(capX, y, armed ? 'buttonPress' : 'button', capWidth, 32);
    cap.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.#listen(info.action);
      });
    this.#add(cap);

    const caption = armed ? 'PRESS ANY'
      : binding.primary < 0 ? '—'
      : keyName(binding.primary)
        + (binding.secondary !== undefined ? ` / ${keyName(binding.secondary)}` : '');
    this.#add(this.#text(capX, y, caption, 20,
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
    this.#render();

    const bind = (code: number) => {
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

    this.#onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.keyCode === Phaser.Input.Keyboard.KeyCodes.ESC) {
        this.#notice.setText('');
        this.#cancelListening();
        this.#render();
        return;
      }
      bind(event.keyCode);
    };
    // A mouse button binds like a key. Listened for on the window at capture
    // depth, because the click that arms a row is still travelling through
    // Phaser's own handlers and would otherwise press the button underneath.
    this.#onMouse = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      bind(mouseCode(event.button));
    };
    window.addEventListener('keydown', this.#onKey, { capture: true });
    // Armed on the next frame, so the click that armed this row is not the
    // click that binds it.
    this.scene.time.delayedCall(0, () => {
      if (this.#onMouse) window.addEventListener('mousedown', this.#onMouse, { capture: true });
    });
  }

  #cancelListening(): void {
    if (this.#onKey) {
      window.removeEventListener('keydown', this.#onKey, { capture: true });
      this.#onKey = null;
    }
    if (this.#onMouse) {
      window.removeEventListener('mousedown', this.#onMouse, { capture: true });
      this.#onMouse = null;
    }
    this.#saveName = '';
    if (this.#listening !== null) {
      this.#listening = null;
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
      this.#resetArmed = false;
      this.#render();
    } else {
      this.#cancelListening();
      this.#unwatchEscape();
      this.#dragZoom = null;
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

  #unwatchEscape(): void {
    if (!this.#escape) return;
    window.removeEventListener('keydown', this.#escape);
    this.#escape = null;
  }

  get open(): boolean {
    return this.#panel.visible;
  }

  close(notify = true): void {
    this.#cancelListening();
    this.#resetArmed = false;
    this.#unwatchEscape();
    const wasOpen = this.open;
    this.#panel.setVisible(false);
    this.#dragZoom = null;
    if (wasOpen && notify) eventBus.emit('ui:screen-close', { screen: 'settings' });
  }

  destroy(): void {
    this.#offSettings?.();
    this.#offSaves?.();
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
