import Phaser from 'phaser';

import { DEPTH, HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import { CooldownRail } from '../hud/CooldownRail';
import { Flourish } from '../hud/Flourish';
import { MapScreen } from '../hud/MapScreen';
import { Hotbar } from '../hud/Hotbar';
import { Minimap, type MapView } from '../hud/Minimap';
import { Portrait } from '../hud/Portrait';
import { SettingsButton } from '../hud/SettingsButton';
import { SettingsScreen } from '../hud/SettingsScreen';
import { Console } from '../hud/Console';
import { InteractPrompt } from '../hud/InteractPrompt';
import { PauseScreen } from '../hud/PauseScreen';
import { Toast } from '../hud/Toast';
import { Bridge } from '../hud/Bridge';
import { complete, run, type CommandHost } from '../state/Commands';
import { FX } from '../world/textures';

/**
 * The interface drawn inside the game.
 *
 * A separate scene rather than part of `PlayScene` for one concrete reason: the
 * play camera is zoomed by `RENDER_SCALE` to supersample the artwork, and a
 * scroll-factor-zero object under a zoomed camera still has to be positioned in
 * that camera's transformed space. A second scene gets its own untouched
 * camera, so every number in `HUD_ART` is a plain canvas pixel.
 *
 * It holds no state the game does not already own. Swapping hands goes out on
 * the bus and comes back as `loadout:changed`, health arrives as
 * `vitals:changed`, and recharge times are pushed by the scene that owns the
 * timers -- so no view here can disagree with the game about what is in hand,
 * how hurt the goat is, or what is ready to cast.
 */
export class HudScene extends Phaser.Scene {
  static readonly KEY = 'hud';

  readonly #portrait = new Portrait(this);
  readonly #minimap = new Minimap(this);
  readonly #hotbar = new Hotbar(this);
  readonly #rail = new CooldownRail(this);
  readonly #settings = new SettingsButton(this);
  readonly #map = new MapScreen(this);
  readonly #flourish = new Flourish(this);
  readonly #settingsScreen = new SettingsScreen(this);
  readonly #pause = new PauseScreen(this);
  readonly #prompt = new InteractPrompt(this);
  readonly #toast = new Toast(this);
  readonly #bridge = new Bridge();
  /** Built in `create`, because it needs the play scene to talk to. */
  #console!: Console;
  #teardown: Array<() => void> = [];
  /** World frozen, for any reason. */
  #paused = false;
  /** A DOM screen is open over the game. */
  #modal = false;

  constructor() {
    super({ key: HudScene.KEY, active: false });
  }

  create(): void {
    const width = VIEW.width * RENDER_SCALE;
    const height = VIEW.height * RENDER_SCALE;

    // Behind the interface but over the world. This camera has no zoom, so the
    // vignette can simply be stretched across the canvas.
    this.add
      .image(width / 2, height / 2, FX.vignette)
      .setDisplaySize(width, height)
      .setDepth(DEPTH.vignette);

    this.#portrait.build();
    this.#minimap.build();
    this.#hotbar.build();
    this.#rail.build();
    this.#settings.build();
    // Last of the built pieces, so the map's scrim covers the whole interface
    // when it opens rather than sliding under the hotbar.
    this.#map.build();
    this.#settingsScreen.build();
    this.#pause.build();
    this.#prompt.build();
    this.#toast.build();

    // The console runs its commands against the play scene, which is the only
    // thing that can actually put something in the room.
    // The console talks to the server, not to the scene next door: every verb
    // it has is a message the server already accepts, and the room it would
    // otherwise be changing belongs to the server anyway.
    const host: CommandHost = {
      send: (message) => eventBus.emit('ui:command', { type: 'COMMAND', ...message }),
    };
    // The console closes on Enter, so what a command did is said by the toast
    // rather than by a panel that is no longer on screen.
    this.#console = new Console(this, complete, (line) => this.#toast.show(run(line, host)));
    this.#console.build();

    this.#loadFont();
    this.#listen();
    // Started last, so the first snapshot it translates lands in a built HUD.
    this.#bridge.start();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#dispose());

    // Last, once every piece is built and every handler is attached.
    eventBus.emit('hud:ready', {});
  }

  /**
   * Redraw every label once the pixel face arrives.
   *
   * Canvas text rasterises with whatever font is available at the moment it is
   * drawn, and a webfont is usually not there yet -- without this the whole
   * interface keeps a fallback face for the life of the page.
   */
  #loadFont(): void {
    void Promise.all(
      [HUD.nameSize, HUD.labelSize, HUD.hintSize].map(
        (size) => document.fonts.load(`${size}px "${PIXEL_FONT.family}"`),
      ),
    )
      .then(() => {
        for (const text of [
          ...this.#hotbar.texts, ...this.#rail.texts,
          ...this.#settings.texts, ...this.#map.texts,
          ...this.#settingsScreen.texts, ...this.#pause.texts,
          ...this.#prompt.texts, ...this.#console.texts, ...this.#toast.texts,
        ]) {
          text.updateText();
        }
      })
      .catch(() => { /* the fallback stack is still readable */ });
  }

  #listen(): void {
    this.#teardown.push(
      eventBus.on('vitals:changed', (vitals) => this.#portrait.set(vitals)),
      eventBus.on('loadout:changed', (loadout) => this.#hotbar.set(loadout)),
      eventBus.on('weapon:cooldowns', ({ active }) => this.#rail.set(active)),
      eventBus.on('map:changed', (view) => this.#minimap.set(view as MapView)),
      eventBus.on('game:fullscreen', ({ active }) => this.#settings.setFullscreen(active)),
      eventBus.on('run:changed', (run) => this.#map.set(run)),
      eventBus.on('campaign:changed', ({ areas, canTravel }) => this.#map.setCampaign(areas, canTravel)),
      eventBus.on('map:toggle', () => {
        this.#settingsScreen.close();
        this.#map.toggle();
      }),
      // Only one screen at a time: two scrims stack into an unreadable murk,
      // and the one underneath still takes clicks.
      eventBus.on('console:toggle', () => {
        this.#map.close();
        this.#settingsScreen.close();
        this.#console.toggle();
      }),
      // The pause SCREEN and the world being paused are not the same thing.
      // Every DOM screen asks the server to pause while it is open -- that is
      // how the skill tree stops the world behind it -- so showing this panel
      // on `paused` alone put it over the skill tree the moment K was pressed.
      // It is shown only when nothing else is.
      eventBus.on('game:pause', ({ paused }) => {
        this.#paused = paused;
        this.#pause.setVisible(paused && !this.#modal);
      }),
      eventBus.on('ui:modal', ({ open }) => {
        this.#modal = open;
        this.#pause.setVisible(this.#paused && !open);
      }),
      eventBus.on('pause:stats', (stats) => this.#pause.set(stats)),
      eventBus.on('interact:target', (target) => this.#prompt.set(target)),
      eventBus.on('settings:toggle', () => {
        this.#map.close();
        this.#settingsScreen.toggle();
      }),
      eventBus.on('flourish', ({ name }) => this.#flourish.show(name)),
      eventBus.on('flourish:clear', () => this.#flourish.clear()),

      // The face answers what just happened. It is the cheapest feedback in
      // the whole interface -- the expressions were drawn long ago and cost
      // nothing to point at.
      eventBus.on('player:changed', ({ state }) => {
        if (state === 'hurt') this.#portrait.react('face-surprised');
        else if (state === 'die') this.#portrait.react('face-sad');
        else if (state === 'attack') this.#portrait.react('face-angry');
      }),
      eventBus.on('loadout:potion-used', () => this.#portrait.react('face-happy')),
      eventBus.on('loadout:potion-empty', () => this.#portrait.react('face-confused')),
    );
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    this.#portrait.step(dt);
    this.#hotbar.step(dt);
    this.#minimap.draw();
    this.#console.step(dt);
    this.#prompt.step();
  }

  #dispose(): void {
    for (const off of this.#teardown) off();
    this.#teardown = [];
    this.#portrait.destroy();
    this.#minimap.destroy();
    this.#hotbar.destroy();
    this.#rail.destroy();
    this.#settings.destroy();
    this.#map.destroy();
    this.#settingsScreen.destroy();
    this.#pause.destroy();
    this.#prompt.destroy();
    this.#toast.destroy();
    this.#bridge.stop();
    this.#console.destroy();
    this.#flourish.destroy();
  }
}
