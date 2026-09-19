import Phaser from 'phaser';

import { SETTINGSBUTTON_TEXTURE_KEY } from '../animation/settingsButtonAtlas.generated';
import { HUD, HUD_ART, PALETTE, PIXEL_FONT } from '../constants';
import { fitWidth } from './fit';
import { eventBus } from '../EventBus';

/** One switch on the panel. */
interface Toggle {
  label: Phaser.GameObjects.Text;
  pip: Phaser.GameObjects.Rectangle;
  on: boolean;
}

/**
 * The gear, and the small panel it opens.
 *
 * The panel is deliberately two switches rather than a screen. A real settings
 * screen is a React surface with its own layout and persistence, and stubbing
 * one here would mean building it twice; what the button needs in order not to
 * be a lie is that it does something, and these are the two things the sandbox
 * actually has to toggle.
 */
export class SettingsButton {
  #button!: Phaser.GameObjects.Image;
  #panel: Phaser.GameObjects.GameObject[] = [];
  #toggles: Toggle[] = [];
  #open = false;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const { settings } = HUD_ART;

    this.#button = this.scene.add
      .image(settings.x, settings.y, SETTINGSBUTTON_TEXTURE_KEY, 'rest');
    fitWidth(this.#button, settings.size);
    this.#objects.push(this.#button);

    const hit = new Phaser.Geom.Rectangle(
      settings.x - settings.size / 2, settings.y - settings.size / 2, settings.size, settings.size,
    );
    this.#button
      .setInteractive(hit, Phaser.Geom.Rectangle.Contains)
      // The pressed frame is the art's own, not a tint: the two were drawn to
      // register exactly, which is the only reason the sheet has two cells.
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.#button.setFrame('press');
        this.#toggle();
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.#button.setFrame('rest'))
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.#button.setFrame('rest'));

    this.#buildPanel();
    this.#setOpen(false);
  }

  #buildPanel(): void {
    const { settings } = HUD_ART;
    const width = 300;
    const rowHeight = 46;
    const rows = ['FULLSCREEN', 'HITBOXES'];
    const height = rowHeight * rows.length + 28;
    const x = settings.x + settings.size * 0.6;
    const y = settings.y - height - settings.size * 0.6;

    const back = this.scene.add
      .rectangle(x, y, width, height, PALETTE.night, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(HUD.pixel, HUD.frameLine, 1);
    this.#panel.push(back);

    this.#toggles = rows.map((name, i) => {
      const rowY = y + 20 + i * rowHeight;
      const label = this.#text(x + 18, rowY, name, 0, 0);
      const pip = this.scene.add
        .rectangle(x + width - 44, rowY + 8, 26, 26, PALETTE.dusk, 1)
        .setOrigin(0, 0.5)
        .setStrokeStyle(HUD.pixel / 2, HUD.frameLine, 1);

      const toggle: Toggle = { label, pip, on: false };
      const hit = new Phaser.Geom.Rectangle(x, rowY - 8, width, rowHeight);
      back.setInteractive();
      label
        .setInteractive(hit, Phaser.Geom.Rectangle.Contains)
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          this.#flip(toggle, name);
        });

      this.#panel.push(pip);
      return toggle;
    });
  }

  #flip(toggle: Toggle, name: string): void {
    toggle.on = !toggle.on;
    toggle.pip.setFillStyle(toggle.on ? PALETTE.magenta : PALETTE.dusk, 1);

    if (name === 'FULLSCREEN') eventBus.emit('game:toggle-fullscreen', {});
    else eventBus.emit('debug:toggle-bodies', { enabled: toggle.on });
  }

  #text(x: number, y: number, value: string, originX: number, originY: number) {
    const text = this.scene.add
      .text(x, y, value, {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.hintSize}px`,
        color: HUD.ink,
      })
      .setOrigin(originX, originY);
    this.#texts.push(text);
    this.#panel.push(text);
    return text;
  }

  #toggle(): void {
    this.#setOpen(!this.#open);
  }

  #setOpen(open: boolean): void {
    this.#open = open;
    for (const object of this.#panel) {
      (object as Phaser.GameObjects.Image).setVisible(open);
    }
  }

  /** Reflect a fullscreen change that came from somewhere else. */
  setFullscreen(active: boolean): void {
    const toggle = this.#toggles[0];
    if (!toggle) return;
    toggle.on = active;
    toggle.pip.setFillStyle(active ? PALETTE.magenta : PALETTE.dusk, 1);
  }

  destroy(): void {
    for (const object of [...this.#objects, ...this.#panel]) object.destroy();
    this.#objects = [];
    this.#panel = [];
    this.#texts = [];
    this.#toggles = [];
  }
}
