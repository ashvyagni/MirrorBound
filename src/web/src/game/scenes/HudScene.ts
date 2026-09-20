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
import { Cinematic } from '../hud/Cinematic';
import { DialogueScreen } from '../hud/DialogueScreen';
import { Notifications } from '../hud/Notifications';
import { EndScreen } from '../hud/EndScreen';
import type { ServerEvent } from '../contracts';
import { AgentScreen } from '../hud/AgentScreen';
import { SandboxScreen } from '../hud/SandboxScreen';
import { PauseScreen } from '../hud/PauseScreen';
import { Toast } from '../hud/Toast';
import { Bridge } from '../hud/Bridge';
import { InventoryScreen } from '../hud/InventoryScreen';
import { SkillScreen } from '../hud/SkillScreen';
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
/**
 * How many recent server events the agent view keeps.
 *
 * Enough for its three short history lists to survive a quiet second, small
 * enough that it is never worth thinking about: this is a debug window, not a
 * telemetry buffer.
 */
const AGENT_EVENT_TAIL = 120;

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
  readonly #end = new EndScreen(this);
  readonly #cinematic = new Cinematic(this);
  readonly #sandbox = new SandboxScreen(this);
  readonly #agent = new AgentScreen(this);
  /** Recent server events, for the agent view's history lists. */
  #agentEvents: ServerEvent[] = [];
  readonly #notices = new Notifications(this);
  readonly #dialogue = new DialogueScreen(this);
  readonly #prompt = new InteractPrompt(this);
  readonly #toast = new Toast(this);
  readonly #bridge = new Bridge();
  readonly #skills = new SkillScreen(this);
  readonly #inventory = new InventoryScreen(this);
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
    this.#skills.build();
    this.#inventory.build();
    this.#end.build();
    this.#sandbox.build();
    this.#agent.build();
    this.#dialogue.build();
    this.#notices.build();
    this.#cinematic.build();

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
          ...this.#portrait.texts, ...this.#hotbar.texts, ...this.#rail.texts,
          ...this.#settings.texts, ...this.#map.texts,
          ...this.#settingsScreen.texts, ...this.#pause.texts, ...this.#end.texts,
          ...this.#sandbox.texts, ...this.#agent.texts, ...this.#notices.texts, ...this.#dialogue.texts,
          ...this.#prompt.texts, ...this.#console.texts, ...this.#toast.texts,
          ...this.#skills.texts, ...this.#inventory.texts,
        ]) {
          text.updateText();
        }
      })
      .catch(() => { /* the fallback stack is still readable */ });
  }

  #showScreen(screen: string): void {
    const panels = { map: this.#map, settings: this.#settingsScreen,
      skills: this.#skills, inventory: this.#inventory, console: this.#console,
      sandbox: this.#sandbox, agent: this.#agent };
    // Dialogue is opened by an NPC rather than by a key, so it is not in the
    // toggle list -- but anything else opening has to close it.
    if (screen !== 'dialogue') this.#dialogue.close(false);
    for (const [name, panel] of Object.entries(panels)) {
      if (name === screen) { if (!panel.open) panel.toggle(); }
      else panel.close(false);
    }
  }

  #listen(): void {
    this.#teardown.push(
      eventBus.on('ui:screen', ({ screen }) => this.#showScreen(screen)),

      // The agent view reads the raw snapshot rather than a translated one:
      // it is a window onto the model itself, so anything `Bridge` distilled
      // on the way past would be the wrong thing to show in it.
      eventBus.on('game:snapshot', (snapshot) => this.#agent.setSnapshot(snapshot)),
      eventBus.on('game:events', (events) => {
        // A rolling tail, because the three "what just happened" lists want
        // more than one snapshot's worth and a snapshot only carries its own.
        this.#agentEvents = [...this.#agentEvents, ...events].slice(-AGENT_EVENT_TAIL);
        this.#agent.setEvents(this.#agentEvents);
      }),

      eventBus.on('hud:notice', ({ kind, title, detail }) => this.#notices.show(kind, title, detail)),
      eventBus.on('hud:conversation', ({ conversation, gold, owned }) => {
        this.#dialogue.show(conversation, gold, owned);
        // The offer to talk is moot once it has been taken, and the bubble
        // wants the same air over their head.
        this.#prompt.setSuppressed(true);
      }),
      eventBus.on('hud:purse', ({ gold, owned }) => this.#dialogue.refresh(gold, owned)),
      eventBus.on('hud:speaker', ({ at }) => this.#dialogue.moveSpeaker(at)),
      eventBus.on('ui:screen-close', ({ screen }) => {
        if (screen === 'dialogue') this.#prompt.setSuppressed(false);
      }),
      eventBus.on('cutscene:state', ({ playing }) => {
        if (playing) this.#cinematic.begin();
        else this.#cinematic.end();
        // Everything that says "you are playing" goes away for the scene. A
        // hotbar, a minimap and a health bar over a cinematic are three things
        // asking to be read at the one moment the game wants you watching --
        // and the letterbox bars are drawn over half of them anyway.
        for (const piece of [this.#portrait, this.#minimap, this.#hotbar,
                             this.#rail, this.#settings]) {
          piece.setVisible(!playing);
        }
        // The prompt has its own switch: it is suppressed during conversations
        // too, and a second flag would let the two disagree.
        this.#prompt.setSuppressed(playing);
      }),
      eventBus.on('cutscene:line', ({ text }) => this.#cinematic.say(text)),
      eventBus.on('run:ended', (ended) => {
        if (ended.ending === null) this.#end.hide();
        else this.#end.show(ended.ending, ended.stats);
      }),
      eventBus.on('vitals:changed', (vitals) => this.#portrait.set(vitals)),
      eventBus.on('loadout:changed', (loadout) => this.#hotbar.set(loadout)),
      eventBus.on('weapon:cooldowns', ({ active }) => this.#rail.set(active)),
      eventBus.on('map:changed', (view) => this.#minimap.set(view as MapView)),
      eventBus.on('game:fullscreen', ({ active }) => this.#settings.setFullscreen(active)),
      eventBus.on('run:changed', (run) => this.#map.set(run)),
      eventBus.on('campaign:changed', ({ areas, canTravel }) => this.#map.setCampaign(areas, canTravel)),
      eventBus.on('skills:changed', ({ nodes, points, respecBlockedBy }) =>
        this.#skills.set(nodes, points, respecBlockedBy)),
      eventBus.on('inventory:changed', ({ inventory, abilities }) =>
        this.#inventory.set(inventory, abilities)),
      // Only one screen at a time: two scrims stack into an unreadable murk,
      // and the one underneath still takes clicks.
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
    this.#dialogue.step();
    // The bubble moves with whoever is speaking, so what the notice column has
    // to dodge changes every frame.
    this.#notices.avoid(this.#dialogue.bubbleBand);
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
    this.#end.destroy();
    this.#sandbox.destroy();
    this.#agent.destroy();
    this.#dialogue.destroy();
    this.#notices.destroy();
    this.#cinematic.destroy();
    this.#pause.destroy();
    this.#prompt.destroy();
    this.#toast.destroy();
    this.#skills.destroy();
    this.#inventory.destroy();
    this.#bridge.stop();
    this.#console.destroy();
    this.#flourish.destroy();
  }
}
