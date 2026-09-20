import Phaser from 'phaser';

import { MAPTOKENS_TEXTURE_KEY } from '../animation/mapTokensAtlas.generated';
import { HUD, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { AreaSnap } from '../contracts';
import { eventBus } from '../EventBus';
import type { Run, RunRoom } from '../world/Run';
import { fitInside, fitWidth } from './fit';
import { Panel } from './Panel';

/**
 * The full map, opened with `M`. Two maps, one screen.
 *
 * The minimap ring in the corner answers "what is around me". This answers the
 * two questions it cannot: **where in the world am I**, and **where in this
 * dungeon am I**. They are drawn together because they are the same question
 * at two scales, and because having to remember which key showed which is the
 * kind of thing that makes a map feel like paperwork.
 *
 * The top half is the Reach: five authored areas laid out on the map
 * coordinates the server sends, roads drawn only between two places you have
 * found, and a click to travel. The bottom half is the dungeon you are in --
 * rooms on a single winding chain, because the generator produces a linear
 * sequence and a branching map would be drawing a structure the game does not
 * have.
 *
 * Travel is the server's decision twice over: it only honours it from a
 * village, and it decides what a skipped area is worth. Clicking an area that
 * is gated is allowed and does the right thing -- everything between here and
 * there is granted as though it had been walked.
 */
const WIDTH = 1180;
const HEIGHT = 880;
const TOKEN = 74;
/** Rooms per row before the chain folds back. */
const PER_ROW = 5;

/** Where the two halves sit inside the panel. */
const WORLD_TOP = -250;
const RUN_TOP = 120;

export class MapScreen {
  #panel!: Panel;
  #texts: Phaser.GameObjects.Text[] = [];
  #objects: Phaser.GameObjects.GameObject[] = [];
  #caption!: Phaser.GameObjects.Text;
  #run: Run | null = null;
  #worldObjects: Phaser.GameObjects.GameObject[] = [];
  #worldNote!: Phaser.GameObjects.Text;
  #canTravel = false;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;

    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'The Reach', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    this.#caption = this.scene.add
      .text(0, HEIGHT / 2 - this.#panel.inset * 1.25, '', {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.hintSize}px`,
        color: HUD.dimInk,
      })
      .setOrigin(0.5, 0.5);
    this.#panel.body.add(this.#caption);
    this.#texts.push(this.#caption);

    this.#worldNote = this.scene.add
      .text(0, WORLD_TOP + 170, '', {
        fontFamily: PIXEL_FONT.stack, fontSize: `${HUD.hintSize - 1}px`, color: HUD.dimInk,
      })
      .setOrigin(0.5, 0.5);
    this.#panel.body.add(this.#worldNote);
    this.#texts.push(this.#worldNote);

    this.#panel.setVisible(false);
  }

  /**
   * The five areas of the Reach, and the roads between them.
   *
   * Clicking one travels there. The server allows travel only out of a
   * village, and it allows jumping *ahead* of the gates -- anything skipped is
   * granted as though it had been walked, so the map is a way to move around
   * the campaign rather than a list of places you may not go.
   */
  setCampaign(areas: readonly AreaSnap[], canTravel: boolean): void {
    this.#canTravel = canTravel;
    for (const o of this.#worldObjects) o.destroy();
    this.#worldObjects = [];

    const content = this.#panel.contentSize(WIDTH, HEIGHT);
    const span = content.width - 140;
    const at = (area: AreaSnap) => ({
      x: -span / 2 + area.mapX * span,
      // The authored map is nearly square and this strip is wide and short, so
      // the vertical span is compressed rather than scaled with the horizontal.
      y: WORLD_TOP + (area.mapY - 0.5) * 210,
    });

    // Roads first, and only between two places you have found -- an undrawn
    // road is the difference between "there is more" and "there is more, and
    // it is exactly here".
    for (let i = 0; i < areas.length - 1; i += 1) {
      const a = areas[i];
      const b = areas[i + 1];
      if (a?.discovered && b?.discovered) this.#worldObjects.push(...this.#road(at(a), at(b)));
    }

    for (const area of areas) this.#areaToken(area, at(area));

    this.#worldNote.setText(canTravel
      ? 'CLICK A PLACE TO TRAVEL   ·   SKIPPING AHEAD GRANTS WHAT YOU PASS'
      : 'YOU CAN ONLY SET OUT FROM A VILLAGE');
  }

  /** One area on the world map: a token, its name, and what it is. */
  #areaToken(area: AreaSnap, at: { x: number; y: number }): void {
    const frame = !area.discovered ? 'roomUnvisited'
      : area.current ? 'roomCurrent'
      : area.completed ? 'roomCleared'
      : 'roomVisited';

    const token = this.scene.add.image(at.x, at.y, MAPTOKENS_TEXTURE_KEY, frame);
    fitInside(token, TOKEN);
    token.setAlpha(area.discovered ? 1 : 0.35);
    this.#panel.body.add(token);
    this.#worldObjects.push(token);

    // A dungeon is marked with what waits at the bottom of it.
    if (area.discovered && area.kind === 'dungeon') {
      const mark = this.scene.add.image(at.x, at.y, MAPTOKENS_TEXTURE_KEY,
        area.id === 'mirror_sanctum' ? 'boss' : 'elite');
      fitInside(mark, TOKEN * 0.46);
      this.#panel.body.add(mark);
      this.#worldObjects.push(mark);
    }

    const label = this.scene.add
      .text(at.x, at.y + TOKEN * 0.72, area.discovered ? area.name.toUpperCase() : '???', {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.hintSize - 2}px`,
        color: area.current ? HUD.activeInk : area.discovered ? HUD.ink : HUD.dimInk,
      })
      .setOrigin(0.5, 0);
    this.#panel.body.add(label);
    this.#worldObjects.push(label);
    this.#texts.push(label);

    if (!area.discovered || area.current) return;
    token.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        if (!this.#canTravel) return;
        eventBus.emit('ui:command', { type: 'COMMAND', action: 'TRAVEL', areaId: area.id });
        this.close();
      });
  }

  /** A road between two areas. Same bar the dungeon corridors use. */
  #road(a: { x: number; y: number }, b: { x: number; y: number }): Phaser.GameObjects.GameObject[] {
    const bar = this.scene.add.image((a.x + b.x) / 2, (a.y + b.y) / 2,
      MAPTOKENS_TEXTURE_KEY, 'corridor');
    bar.setRotation(Math.atan2(b.y - a.y, b.x - a.x));
    fitWidth(bar, Math.hypot(b.x - a.x, b.y - a.y));
    bar.setAlpha(0.5);
    this.#panel.body.add(bar);
    return [bar];
  }

  /** Redraw from the run. Cheap enough to do on every open. */
  set(run: Run): void {
    this.#run = run;
    for (const o of this.#objects) o.destroy();
    this.#objects = [];

    const content = this.#panel.contentSize(WIDTH, HEIGHT);
    const rows = Math.ceil(run.rooms.length / PER_ROW);
    const stepX = content.width / PER_ROW;
    const stepY = Math.min(150, content.height / (rows + 0.6));
    const top = RUN_TOP - ((rows - 1) * stepY) / 2;

    const at = (index: number) => {
      const row = Math.floor(index / PER_ROW);
      const col = index % PER_ROW;
      // Serpentine: odd rows run right to left, so the chain never jumps back
      // across the whole panel to start the next line.
      const slot = row % 2 === 0 ? col : PER_ROW - 1 - col;
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
      : PALETTE.ice;
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

  close(notify = true): void {
    const wasOpen = this.open;
    this.#panel.setVisible(false);
    if (wasOpen && notify) eventBus.emit('ui:screen-close', { screen: 'map' });
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
