import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { JournalSnap, LoreSnap, QuestSnap } from '../contracts';
import { eventBus } from '../EventBus';
import { controlArt } from './controlArt';
import { fitInside } from './fit';
import { Panel } from './Panel';

/**
 * The journal, on `J`: what you were asked to do, and what you have found out.
 *
 * Two halves of one thing, which is why they share a screen rather than taking
 * a key each. A side quest exists to explain the world (§5), and the codex is
 * where the explanation lands (§15) — reading them apart would be reading the
 * question in one room and the answer in another.
 *
 * **Left: the quests.** Active ones first with their next step called out,
 * because "what do I do now" is the question a journal is opened to answer.
 * Finished ones below, dimmed, kept rather than cleared: they are the record of
 * where this run has been.
 *
 * **Right: the codex**, grouped by the section the server assigns. Click a page
 * to read it. Nothing here is generated and nothing is written by the client —
 * every line arrives on the snapshot, already filtered to what this run has
 * actually earned, so the screen cannot spoil a page the player has not found.
 *
 * Drawn from the same `Panel` as every other screen, for the reason the panel's
 * own comment gives: five copies of the same border drift apart.
 */
const WIDTH = 1700;
const HEIGHT = 980;
const L = {
  /** Where the two columns split, as a fraction of the content width. */
  split: 0.52,
  headTop: -372 as number,
  listTop: -316 as number,
  questStep: 30,
  gap: 26,
  lineHeight: 26,
} as const;

/** How a section of the codex is titled. */
const SECTIONS: Record<string, string> = {
  history: 'History',
  mirror: 'The Mirror',
  regions: 'The Reach',
  people: 'People',
};

export class JournalScreen {
  #panel!: Panel;
  #texts: Phaser.GameObjects.Text[] = [];
  /** Everything redrawn when the journal changes. */
  #rows: Phaser.GameObjects.GameObject[] = [];
  #reader!: Phaser.GameObjects.Text;
  #subtitle!: Phaser.GameObjects.Text;
  #escape: ((event: KeyboardEvent) => void) | null = null;

  #journal: JournalSnap = { active: [], completed: [], lore: [] };
  /** The page being read, so a redraw does not close it. */
  #reading = '';

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  get open(): boolean {
    return this.#panel?.visible ?? false;
  }

  get #left(): number {
    return -WIDTH / 2 + this.#panel.inset + 24;
  }

  get #right(): number {
    return WIDTH / 2 - this.#panel.inset - 24;
  }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;
    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'Journal', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    // Placed against the column headings rather than against the panel's top
    // edge. Measured from the top it landed six pixels from `listTop` and drew
    // straight through the first line of the codex.
    this.#subtitle = this.#text(0, L.headTop - 38, '', HUD.hintSize, HUD.dimInk);

    // The reader sits under the codex list and holds whichever page is open.
    this.#reader = this.scene.add
      .text(0, 0, '', {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.hintSize}px`,
        color: HUD.ink,
        wordWrap: { width: WIDTH * (1 - L.split) - 120 },
        lineSpacing: 7,
      })
      .setOrigin(0, 0);
    this.#panel.body.add(this.#reader);
    this.#texts.push(this.#reader);

    this.#buildClose();
    this.#panel.setVisible(false);
  }

  /** New journal from the server. Redrawn whole; it is a few dozen objects. */
  set(journal: JournalSnap): void {
    this.#journal = journal;
    if (this.open) this.#render();
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    this.#panel.setVisible(true);
    this.#render();
    this.#escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.close();
    };
    window.addEventListener('keydown', this.#escape);
  }

  close(): void {
    this.#panel.setVisible(false);
    if (this.#escape) {
      window.removeEventListener('keydown', this.#escape);
      this.#escape = null;
    }
    eventBus.emit('ui:screen-close', { screen: 'journal' });
  }

  // --- drawing ----------------------------------------------------------------

  #render(): void {
    for (const row of this.#rows) row.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((text) => text.scene);

    const { active, completed, lore } = this.#journal;
    this.#subtitle.setText(
      active.length === 0 && completed.length === 0
        ? 'NOBODY HAS ASKED YOU FOR ANYTHING YET'
        : `${active.length} OPEN   ${completed.length} DONE   ${lore.length} LEARNED`);

    this.#renderQuests(active, completed);
    this.#renderCodex(lore);
  }

  #renderQuests(active: readonly QuestSnap[], completed: readonly QuestSnap[]): void {
    const x = this.#left;
    let y = L.headTop;
    this.#add(this.#row(x, y, 'ASKED OF YOU', HUD.labelSize, HUD.ink, 0));
    y = L.listTop;

    if (active.length === 0) {
      this.#add(this.#row(x, y, 'NOTHING OPEN. TALK TO PEOPLE.', HUD.hintSize, HUD.dimInk, 0));
      y += L.gap * 2;
    }
    for (const quest of active) {
      this.#add(this.#row(x, y, quest.name.toUpperCase(), HUD.hintSize, HUD.activeInk, 0));
      y += L.questStep;
      // The next step only. A journal that lists every step of every quest is
      // a journal you have to read to find the one line you opened it for.
      this.#add(this.#row(x + 18, y, `> ${quest.current.toUpperCase()}`,
        HUD.hintSize - 3, HUD.ink, 0));
      y += L.questStep;
      const done = quest.steps.filter((s) => s.done).length;
      this.#add(this.#row(x + 18, y,
        `${done}/${quest.steps.length} DONE   ${quest.rewardGold} GOLD`,
        HUD.hintSize - 4, HUD.dimInk, 0));
      y += L.gap + 12;
    }

    if (completed.length > 0) {
      y += L.gap;
      this.#add(this.#row(x, y, 'BEHIND YOU', HUD.labelSize, HUD.dimInk, 0));
      y += L.questStep + 6;
      for (const quest of completed) {
        this.#add(this.#row(x + 18, y, quest.name.toUpperCase(), HUD.hintSize - 2, HUD.dimInk, 0));
        y += L.questStep;
      }
    }
  }

  #renderCodex(lore: readonly LoreSnap[]): void {
    const x = this.#left + (this.#right - this.#left) * L.split;
    let y = L.headTop;
    this.#add(this.#row(x, y, 'WHAT YOU KNOW', HUD.labelSize, HUD.ink, 0));
    y = L.listTop;

    if (lore.length === 0) {
      this.#add(this.#row(x, y, 'NOTHING YET. GO AND FIND OUT.', HUD.hintSize, HUD.dimInk, 0));
      this.#reader.setText('');
      return;
    }

    // Grouped by section, in the order the sections are declared, so the codex
    // has a shape rather than being the order things happened to be found in.
    const order = Object.keys(SECTIONS);
    const sections = [...new Set(lore.map((p) => p.section))]
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));

    for (const section of sections) {
      this.#add(this.#row(x, y, (SECTIONS[section] ?? section).toUpperCase(),
        HUD.hintSize - 3, HUD.dimInk, 0));
      y += L.questStep;
      for (const page of lore.filter((p) => p.section === section)) {
        const open = page.id === this.#reading;
        const label = this.#row(x + 18, y, `${open ? '- ' : '  '}${page.title.toUpperCase()}`,
          HUD.hintSize, open ? HUD.activeInk : HUD.ink, 0);
        this.#add(label);
        const hit = this.scene.add
          .zone(x + 18, y, (this.#right - x) - 18, L.questStep)
          .setOrigin(0, 0.5)
          .setInteractive({ useHandCursor: true });
        hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          // Clicking the open page closes it, which is how a reader expects a
          // list of things to read to behave.
          this.#reading = open ? '' : page.id;
          this.#render();
        });
        this.#add(hit);
        y += L.questStep;
      }
      y += 10;
    }

    const reading = lore.find((p) => p.id === this.#reading);
    this.#reader.setPosition(x, y + 16);
    this.#reader.setText(reading ? reading.body : 'PICK SOMETHING TO READ.');
    this.#reader.setColor(reading ? HUD.ink : HUD.dimInk);
  }

  // --- chrome -------------------------------------------------------------------

  #buildClose(): void {
    const x = this.#right - 34;
    const y = -HEIGHT / 2 + this.#panel.inset + 62;
    const button = this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', 76, 76));
    button.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.close();
      });
    this.#panel.body.add(button);
    const cross = this.scene.add.image(x, y, GLYPHS_TEXTURE_KEY, 'close');
    fitInside(cross, 32);
    this.#panel.body.add(cross);
  }

  #text(x: number, y: number, value: string, size: number, colour: string) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(0.5, 0.5);
    this.#panel.body.add(t);
    this.#texts.push(t);
    return t;
  }

  #row(x: number, y: number, value: string, size: number, colour: string, originX: number) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#texts.push(t);
    return t;
  }

  #add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.#panel.body.add(object);
    this.#rows.push(object);
    return object;
  }

  destroy(): void {
    if (this.#escape) window.removeEventListener('keydown', this.#escape);
    this.#panel?.destroy();
    this.#texts = [];
    this.#rows = [];
  }
}
