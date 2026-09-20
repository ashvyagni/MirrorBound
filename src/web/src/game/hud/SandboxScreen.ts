import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { CommandMessage } from '../contracts';
import { eventBus } from '../EventBus';
import { GIVEABLE } from '../state/Commands';
import { controlArt } from './controlArt';
import { fitInside } from './fit';
import { Panel } from './Panel';

/**
 * The Proving's control panel: arm the Mirror, set what it knows, drop weapons.
 *
 * Everything here is reachable from the console already. It exists as a screen
 * because the sandbox loop is "change one variable and watch again", and typing
 * three commands between every attempt is enough friction to stop anyone
 * actually doing it. Buttons that show their current state also answer "what is
 * it set to right now", which a console cannot.
 *
 * It changes nothing itself. Every control sends the same `ui:command` the
 * console sends and waits for the server to answer, so the sandbox cannot drift
 * away from the rules the rest of the game runs under -- a boss configured here
 * is the boss, not a preview of one.
 */
const WIDTH = 1180;
const HEIGHT = 700;
/** Heading to its own chips, and one section to the next. */
const CHIPS = 82;
const SECTION = 124;

const SKILLS: readonly { label: string; value: number; blurb: string }[] = [
  { label: 'BLIND', value: 0, blurb: 'Generic until it has watched you' },
  { label: 'HALF', value: 0.5, blurb: 'Leans toward a counter' },
  { label: 'TOTAL', value: 1, blurb: 'Counters from the first second' },
];

const SPAWNABLE: readonly { id: string; label: string }[] = [
  // First, because it is the one you want most often: the sandbox loop is
  // "change one thing and measure again", and everything else here hits back.
  { id: 'dummy', label: 'DUMMY' },
  { id: 'mirror', label: 'MIRROR' },
  { id: 'warden', label: 'WARDEN' },
  { id: 'skeleton', label: 'KNIGHT' },
  { id: 'archer', label: 'ARCHER' },
  { id: 'hound', label: 'HOUND' },
  { id: 'brute', label: 'BRUTE' },
  { id: 'spitter', label: 'SPITTER' },
  { id: 'sprout', label: 'SPROUT' },
  { id: 'shardling', label: 'SHARD' },
];

export class SandboxScreen {
  #panel!: Panel;
  #rows: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  #notice!: Phaser.GameObjects.Text;

  /** What the panel believes is set. The server is still the authority. */
  #weapon = '';
  #skill = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  get open(): boolean {
    return this.#panel?.visible ?? false;
  }

  get #left(): number { return -WIDTH / 2 + this.#panel.inset + 40; }
  get #right(): number { return WIDTH / 2 - this.#panel.inset - 40; }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;
    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'The Proving', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    const blocker = this.scene.add
      .zone(0, 0, VIEW.width * RENDER_SCALE, VIEW.height * RENDER_SCALE)
      .setInteractive()
      .on('pointerdown', () => eventBus.emit('hud:pointer-used', {}));
    this.#panel.container.addAt(blocker, 0);

    this.#buildClose();
    this.#notice = this.#text(0, HEIGHT / 2 - this.#panel.inset - 34, '', 20, HUD.dimInk);
    this.#panel.body.add(this.#notice);
    this.#panel.setVisible(false);
    this.#render();
  }

  #buildClose(): void {
    const x = this.#right + 6;
    const y = -HEIGHT / 2 + this.#panel.inset * 0.5 + 8;
    const button = this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', 60, 60));
    button.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.close();
      });
    this.#panel.body.add(button);
    const cross = this.scene.add.image(x, y, GLYPHS_TEXTURE_KEY, 'close');
    fitInside(cross, 28);
    this.#panel.body.add(cross);
  }

  #text(x: number, y: number, value: string, size: number, colour: string, originX = 0.5) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#texts.push(t);
    return t;
  }

  #add(object: Phaser.GameObjects.GameObject): void {
    this.#panel.body.add(object);
    this.#rows.push(object);
  }

  #section(y: number, title: string, blurb: string): void {
    this.#add(this.#text(this.#left, y, title.toUpperCase(), 22, HUD.activeInk, 0));
    this.#add(this.scene.add.rectangle(this.#left, y + 22, this.#right - this.#left, 2, 0x53456a)
      .setOrigin(0, 0.5));
    this.#add(this.#text(this.#left, y + 46, blurb, 18, HUD.dimInk, 0));
  }

  #chip(x: number, y: number, label: string, width: number, on: boolean, onPick: () => void): void {
    const chip = this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, on ? 'buttonPress' : 'button', width, 52));
    chip.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        onPick();
      });
    this.#add(chip);
    this.#add(this.#text(x, y, label, 21, on ? HUD.activeInk : HUD.dimInk));
  }

  /** A row of chips filling the content width. */
  #chipRow<T>(y: number, items: readonly T[], label: (item: T) => string,
              selected: (item: T) => boolean, pick: (item: T) => void): void {
    const gap = 10;
    const width = (this.#right - this.#left - gap * (items.length - 1)) / items.length;
    items.forEach((item, i) => {
      this.#chip(this.#left + width / 2 + i * (width + gap), y, label(item), width,
        selected(item), () => pick(item));
    });
  }

  #send(message: Omit<CommandMessage, 'type'>, notice: string): void {
    eventBus.emit('ui:command', { type: 'COMMAND', ...message });
    this.#notice.setText(notice);
  }

  #render(): void {
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((text) => text.scene);

    let y = -HEIGHT / 2 + this.#panel.inset + 58;

    this.#section(y, 'Arm the Mirror', 'It fights with the weapon’s own reach and cadence.');
    this.#chipRow(y + CHIPS, GIVEABLE, (w) => w.name.split(' · ')[0]!.toUpperCase(),
      (w) => w.id === this.#weapon,
      (w) => {
        this.#weapon = w.id;
        this.#send({ action: 'CONFIGURE_BOSS', bossWeapon: w.id },
          `The Mirror takes the ${w.name.split(' · ')[0]}.`);
        this.#render();
      });
    y += SECTION;

    this.#section(y, 'What it knows about you', 'A floor under the model’s confidence, not a cheat.');
    this.#chipRow(y + CHIPS, SKILLS, (s) => s.label, (s) => s.value === this.#skill,
      (s) => {
        this.#skill = s.value;
        this.#send({ action: 'CONFIGURE_BOSS', bossSkill: s.value }, s.blurb + '.');
        this.#render();
      });
    y += SECTION;

    this.#section(y, 'Put something in the room', 'Spawned through the ordinary path. Everything but the dummy fights back.');
    this.#chipRow(y + CHIPS, SPAWNABLE, (e) => e.label, () => false,
      (e) => this.#send({ action: 'SPAWN', enemyType: e.id }, `${e.label} is in the room.`));
    y += SECTION;

    this.#section(y, 'Drop a weapon', 'It lands in front of you; walk over it to take it.');
    this.#chipRow(y + CHIPS, GIVEABLE, (w) => w.name.split(' · ')[0]!.toUpperCase(), () => false,
      (w) => this.#send({ action: 'GIVE', weaponId: w.id },
        `Dropped the ${w.name.split(' · ')[0]}.`));
  }

  toggle(): boolean {
    const next = !this.#panel.visible;
    this.#panel.setVisible(next);
    if (next) {
      this.#notice.setText('');
      this.#render();
    }
    return next;
  }

  close(notify = true): void {
    // No Escape listener of its own: `useHotkeys` owns Escape and closes
    // whatever the store says is open, which is why this is a real screen.
    const wasOpen = this.open;
    this.#panel?.setVisible(false);
    if (wasOpen && notify) eventBus.emit('ui:screen-close', { screen: 'sandbox' });
  }

  destroy(): void {
    this.close(false);
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#panel?.destroy();
    this.#texts = [];
  }
}
