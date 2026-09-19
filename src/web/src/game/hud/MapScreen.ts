import type Phaser from 'phaser';

import { MAPTOKENS_TEXTURE_KEY } from '../animation/mapTokensAtlas.generated';
import { HUD, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { Run, RunRoom } from '../world/Run';
import { fitWidth } from './fit';
import { Panel } from './Panel';

/**
 * The full map, opened with `M`.
 *
 * The minimap ring in the corner answers "what is around me". This answers the
 * different question of "where am I in the run", which is why it is a screen
 * rather than a bigger ring: it shows rooms you have not reached, and a live
 * view by definition cannot.
 *
 * Rooms are laid out on a single winding chain rather than a graph. `main`'s
 * generator produces a linear sequence, so a branching map would be drawing a
 * structure the game does not have.
 */
const WIDTH = 1180;
const HEIGHT = 620;
const TOKEN = 74;
/**
 * Least horizontal room a token may have before the chain folds onto another
 * line: the token itself plus enough gap for a corridor to read between two.
 *
 * The fold used to be a fixed five-per-row. That suited the ten-room sequence
 * the sandbox invented, but the server generates seven: the second row held
 * two, and because odd rows run right to left it pinned them to the far
 * corner, so the map read "1 2 3 4 5", then 6 alone on the right with 7 back
 * to its left, across an otherwise empty line.
 *
 * Folding is now decided by whether the tokens would actually collide, so a
 * run that fits on one line gets one line whatever its length.
 */
const MIN_STEP = TOKEN * 1.5;

export class MapScreen {
  #panel!: Panel;
  #texts: Phaser.GameObjects.Text[] = [];
  #objects: Phaser.GameObjects.GameObject[] = [];
  #caption!: Phaser.GameObjects.Text;
  #run: Run | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;

    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'The Descent', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    this.#caption = this.scene.add
      .text(0, HEIGHT / 2 - this.#panel.inset - HUD.hintSize, '', {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.hintSize}px`,
        color: HUD.dimInk,
      })
      .setOrigin(0.5, 0.5);
    this.#panel.body.add(this.#caption);
    this.#texts.push(this.#caption);

    this.#panel.setVisible(false);
  }

  /** Redraw from the run. Cheap enough to do on every open. */
  set(run: Run): void {
    this.#run = run;
    for (const o of this.#objects) o.destroy();
    this.#objects = [];

    const content = this.#panel.contentSize(WIDTH, HEIGHT);
    const count = Math.max(1, run.rooms.length);
    const fitPerRow = Math.max(1, Math.floor(content.width / MIN_STEP));
    const rows = Math.max(1, Math.ceil(count / fitPerRow));
    // Spread the rooms evenly over however many rows they need, rather than
    // filling fixed-width rows and leaving the last one a stub.
    const perRow = Math.ceil(count / rows);
    const stepX = content.width / perRow;
    const stepY = Math.min(150, content.height / (rows + 0.6));
    // Nudged up by half the caption's lane so a single row sits optically
    // centred in the space it actually has rather than in the whole panel.
    const top = -((rows - 1) * stepY) / 2 - HUD.hintSize * 0.5;

    const at = (index: number) => {
      const row = Math.floor(index / perRow);
      const col = index % perRow;
      // Serpentine: odd rows run right to left, so the chain never jumps back
      // across the whole panel to start the next line. With balanced rows the
      // reversal lands the fold directly under the room it follows.
      const slot = row % 2 === 0 ? col : perRow - 1 - col;
      return {
        x: -content.width / 2 + stepX * (slot + 0.5),
        y: top + row * stepY,
      };
    };

    // Corridors first, so a room token always sits on top of its own links.
    for (let i = 0; i < run.rooms.length - 1; i += 1) {
      this.#link(at(i), at(i + 1));
    }
    for (const room of run.rooms) this.#token(room, at(room.index), run.current);

    const here = run.rooms[run.current];
    this.#caption.setText(
      here ? `${here.name.toUpperCase()}   ·   ${here.biome.toUpperCase()}   ·   ROOM ${run.current + 1} OF ${run.rooms.length}` : '',
    );
  }

  /** One connector between two rooms, rotated to lie along the gap. */
  #link(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const bar = this.scene.add.image(
      (a.x + b.x) / 2, (a.y + b.y) / 2, MAPTOKENS_TEXTURE_KEY, 'corridor',
    );
    const gap = Math.hypot(b.x - a.x, b.y - a.y) - TOKEN * 0.9;
    fitWidth(bar, Math.max(12, gap));
    bar.setRotation(Math.atan2(b.y - a.y, b.x - a.x));
    bar.setAlpha(0.75);
    this.#panel.body.add(bar);
    this.#objects.push(bar);
  }

  #token(room: RunRoom, at: { x: number; y: number }, current: number): void {
    const state = room.index === current ? 'roomCurrent'
      : room.cleared ? 'roomCleared'
      : room.visited ? 'roomVisited'
      : 'roomUnvisited';

    const hex = this.scene.add.image(at.x, at.y, MAPTOKENS_TEXTURE_KEY, state);
    fitWidth(hex, TOKEN);
    this.#panel.body.add(hex);
    this.#objects.push(hex);

    // The mark that says what kind of room it is, laid over the hexagon. Plain
    // combat rooms get nothing: most rooms are combat, and a mark every room
    // carries is a mark that distinguishes none of them.
    const mark = room.kind === 'treasure' ? 'treasure'
      : room.kind === 'elite' ? 'elite'
      : room.kind === 'boss' ? 'boss'
      : null;

    if (mark) {
      const glyph = this.scene.add.image(at.x, at.y, MAPTOKENS_TEXTURE_KEY, mark);
      fitWidth(glyph, TOKEN * 0.52);
      // An unreached room shows its shape, not its contents.
      glyph.setAlpha(room.visited ? 1 : 0.35);
      this.#panel.body.add(glyph);
      this.#objects.push(glyph);
    }

    const label = this.scene.add
      .text(at.x, at.y + TOKEN * 0.62, String(room.index + 1), {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.hintSize}px`,
        color: room.index === current ? HUD.activeInk : HUD.dimInk,
      })
      .setOrigin(0.5, 0.5);
    this.#panel.body.add(label);
    this.#objects.push(label);
    this.#texts.push(label);

    // A biome pip under the number, so the three stretches of a run read as
    // three stretches without needing a legend.
    const tint = room.biome === 'grove' ? 0x6f9e5c
      : room.biome === 'ruins' ? 0x9a938f
      : PALETTE.frost;
    const pip = this.scene.add.rectangle(at.x, at.y - TOKEN * 0.62, 18, 5, tint, room.visited ? 1 : 0.4);
    this.#panel.body.add(pip);
    this.#objects.push(pip);
  }

  toggle(): boolean {
    this.#panel.setVisible(!this.#panel.visible);
    return this.#panel.visible;
  }

  get open(): boolean {
    return this.#panel.visible;
  }

  close(): void {
    this.#panel.setVisible(false);
  }

  get run(): Run | null {
    return this.#run;
  }

  destroy(): void {
    for (const o of this.#objects) o.destroy();
    this.#objects = [];
    this.#panel?.destroy();
    this.#texts = [];
  }
}
