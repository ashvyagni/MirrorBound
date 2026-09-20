import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { eventBus } from '../EventBus';
import { controlArt } from './controlArt';
import { Panel } from './Panel';

/** The same muted violet the settings screen rules its sections with. */
const RULE_COLOUR = 0x53456a;

/**
 * How a run ends: the Mirror broken, or the Mirror keeping you.
 *
 * In the canvas rather than in React, like every other screen that survived the
 * move: this has to work in fullscreen, where there is no DOM panel beside the
 * game. A full React victory dialog used to exist and was unmounted when the
 * rest of the interface came inside; this is that screen rebuilt on the same
 * chrome as the pause and settings panels.
 *
 * Both endings share a layout on purpose. The run is the same run and the
 * numbers mean the same thing whichever way it finished, and giving defeat its
 * own smaller treatment would say the losing run counted for less.
 */
const WIDTH = 860;
const HEIGHT = 760;
/** Vertical pitch of the stat rows. Eight of them have to clear the buttons. */
const ROW = 40;

export type Ending = 'victory' | 'defeat';

export interface EndStats {
  seconds: number;
  enemiesKilled: number;
  roomsCleared: number;
  damageDealt: number;
  damageTaken: number;
  essenceCollected: number;
  twinKills: number;
  level: number;
}

interface Copy {
  title: string;
  line: string;
  colour: string;
}

/**
 * What each ending says.
 *
 * Neither line congratulates or commiserates. The whole premise is that the
 * Mirror learned you, so both endings are about what it learned -- which is the
 * only thing that makes the loss interesting rather than just a loss.
 */
const COPY: Record<Ending, Copy> = {
  victory: {
    title: 'The Mirror is broken',
    line: 'It learned how you fight. You fought differently anyway.',
    colour: HUD.ink,
  },
  defeat: {
    title: 'The Mirror keeps you',
    line: 'It learned how you fight. This time that was enough.',
    colour: HUD.dimInk,
  },
};

const ROWS: ReadonlyArray<readonly [string, (s: EndStats) => string]> = [
  ['Time', (s) => `${Math.floor(s.seconds / 60)}:${String(Math.floor(s.seconds % 60)).padStart(2, '0')}`],
  ['Level reached', (s) => `${s.level}`],
  ['Enemies felled', (s) => `${s.enemiesKilled}`],
  ['Of those, the twin', (s) => `${s.twinKills}`],
  ['Rooms cleared', (s) => `${s.roomsCleared}`],
  ['Damage dealt', (s) => `${s.damageDealt}`],
  ['Damage taken', (s) => `${s.damageTaken}`],
  ['Essence gathered', (s) => `${s.essenceCollected}`],
];

export class EndScreen {
  #panel!: Panel;
  #title!: Phaser.GameObjects.Text;
  #line!: Phaser.GameObjects.Text;
  #rows: Phaser.GameObjects.Text[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  #ending: Ending | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  get open(): boolean {
    return this.#panel?.visible ?? false;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;
    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'The run', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    // The run is over, so nothing behind this is worth clicking through.
    const blocker = this.scene.add
      .zone(0, 0, VIEW.width * RENDER_SCALE, VIEW.height * RENDER_SCALE)
      .setInteractive()
      .on('pointerdown', () => eventBus.emit('hud:pointer-used', {}));
    this.#panel.container.addAt(blocker, 0);

    const left = -WIDTH / 2 + this.#panel.inset + 40;
    const right = WIDTH / 2 - this.#panel.inset - 40;

    this.#title = this.#text(0, -HEIGHT / 2 + this.#panel.inset + 74, '', 40, HUD.ink);
    this.#line = this.#text(0, -HEIGHT / 2 + this.#panel.inset + 124, '', 20, HUD.dimInk);
    // Wrapped inside the frame rather than trusting the line to fit: both
    // endings ran to the border at 22px, and a new line would be worse.
    this.#line.setWordWrapWidth(right - left, true).setAlign('center');

    let y = -HEIGHT / 2 + this.#panel.inset + 186;
    ROWS.forEach(([label], i) => {
      this.#text(left, y, label.toUpperCase(), 21, HUD.dimInk, 0);
      this.#rows.push(this.#text(right, y, '', 24, HUD.ink, 1));
      // A drawn rule scaled to this width comes out as a thick bar -- the
      // divider art is short and `fitWidth` scales it uniformly. A hairline is
      // what the row wants, so it is one.
      if (i < ROWS.length - 1) {
        const rule = this.scene.add
          .rectangle(left, y + ROW / 2, right - left, 2, RULE_COLOUR)
          .setOrigin(0, 0.5).setAlpha(0.5);
        this.#panel.body.add(rule);
      }
      y += ROW;
    });

    // Same seed replays the run you just had; a new seed is a different world.
    // Offered as two buttons rather than one, because "again" means both and
    // the difference matters more here than anywhere else in the game.
    const buttonY = HEIGHT / 2 - this.#panel.inset - 58;
    this.#button(-150, buttonY, 'RUN IT AGAIN', 280, () => this.#restart());
    this.#button(150, buttonY, 'NEW DUNGEON', 280,
      () => this.#restart(Math.floor(Math.random() * 1e9)));

    this.#panel.setVisible(false);
  }

  #text(x: number, y: number, value: string, size: number, colour: string, originX = 0.5) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#texts.push(t);
    this.#panel.body.add(t);
    return t;
  }

  #button(x: number, y: number, caption: string, width: number, onPress: () => void): void {
    const image = this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', width, 58));
    image.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        onPress();
      });
    this.#panel.body.add(image);
    this.#text(x, y, caption, 23, HUD.ink);
  }

  #restart(seed?: number): void {
    eventBus.emit('ui:command',
      seed === undefined
        ? { type: 'COMMAND', action: 'RESTART' }
        : { type: 'COMMAND', action: 'RESTART', seed });
    this.hide();
  }

  /**
   * Show the ending, or update the numbers on one already showing.
   *
   * Idempotent per ending, because this is driven off every snapshot and the
   * run stays finished: rebuilding the panel twenty times a second would make
   * the buttons unclickable.
   */
  show(ending: Ending, stats: EndStats): void {
    if (this.#ending !== ending) {
      this.#ending = ending;
      const copy = COPY[ending];
      this.#title.setText(copy.title).setColor(copy.colour);
      this.#line.setText(copy.line);
      this.#panel.setTitle(ending === 'victory' ? 'The run' : 'The run ends');
      this.#panel.setVisible(true);
    }
    ROWS.forEach(([, read], i) => this.#rows[i]?.setText(read(stats)));
  }

  hide(): void {
    this.#ending = null;
    this.#panel?.setVisible(false);
  }

  destroy(): void {
    this.hide();
    this.#panel?.destroy();
    this.#texts = [];
    this.#rows = [];
  }
}
