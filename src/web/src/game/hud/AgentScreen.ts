import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { HUD, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { GameSnapshot, ServerEvent } from '../contracts';
import { eventBus } from '../EventBus';
import { controlArt } from './controlArt';
import { fitInside } from './fit';
import { Panel } from './Panel';

/**
 * What the agent currently believes, drawn on the canvas.
 *
 * This existed as a React panel (`ui/DebugOverlay.tsx`) that could only be
 * turned on from the settings screen -- there was no key for it, despite its
 * own comment claiming F3. It is the one window onto the thing the game is
 * actually about, so it gets a key and it gets drawn in the same chrome as
 * everything else.
 *
 * Two columns, because the content splits cleanly in half and a single column
 * of this much would need scrolling: what the model has worked out about the
 * *player* on the left, and what the two things that act on it -- the twin and
 * the Mirror -- are doing with it on the right.
 *
 * Read-only. Nothing here changes the simulation; it reports it.
 */

const WIDTH = 1280;
const HEIGHT = 820;
/** Gutter between the two columns. */
const GUTTER = 44;
/** A labelled bar, and the gap to the next one. */
const ROW = 30;
/** Section heading to its first row, and one section to the next. */
const HEAD = 34;
const SECTION = 22;

/** How many of each list to show. Enough to read a trend, not an audit log. */
const KEEP = { predictions: 4, habits: 4, history: 3, outcomes: 3, counters: 4, lessons: 3 };

interface Bar {
  value: number;
  confidence: number;
  trend?: number;
}

export class AgentScreen {
  #panel!: Panel;
  #rows: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  #snapshot: GameSnapshot | null = null;
  #events: ServerEvent[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] { return this.#texts; }
  get open(): boolean { return this.#panel?.visible ?? false; }

  get #left(): number { return -WIDTH / 2 + this.#panel.inset + 28; }
  get #right(): number { return WIDTH / 2 - this.#panel.inset - 28; }
  get #colW(): number { return (this.#right - this.#left - GUTTER) / 2; }
  get #top(): number { return -HEIGHT / 2 + this.#panel.inset + 44; }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;
    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'What it knows', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    const blocker = this.scene.add
      .zone(0, 0, VIEW.width * RENDER_SCALE, VIEW.height * RENDER_SCALE)
      .setInteractive()
      .on('pointerdown', () => eventBus.emit('hud:pointer-used', {}));
    this.#panel.container.addAt(blocker, 0);

    this.#buildClose();
    this.#panel.setVisible(false);
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

  /** The snapshot drives everything drawn here; kept even while closed. */
  setSnapshot(snapshot: GameSnapshot): void {
    this.#snapshot = snapshot;
    if (this.open) this.#render();
  }

  /** Recent events, for the three "what just happened" lists. */
  setEvents(events: readonly ServerEvent[]): void {
    this.#events = [...events];
  }

  // --- drawing primitives ----------------------------------------------------

  #text(x: number, y: number, value: string, size: number, colour: string, originX = 0): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#texts.push(t);
    this.#panel.body.add(t);
    this.#rows.push(t);
    return t;
  }

  #add<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.#panel.body.add(object);
    this.#rows.push(object);
    return object;
  }

  /** A column heading with its hint, and the y the next row sits at. */
  #heading(x: number, y: number, title: string, hint: string, width: number): number {
    this.#text(x, y, title.toUpperCase(), 21, HUD.activeInk);
    if (hint) this.#text(x + width, y, hint, 16, HUD.dimInk, 1);
    this.#add(this.scene.add.rectangle(x, y + 17, width, 2, 0x53456a).setOrigin(0, 0.5));
    return y + HEAD;
  }

  /**
   * One trait: its name, a bar, and the number.
   *
   * The bar's *length* is the value and its *opacity* is the confidence, which
   * is the same encoding the React panel used and the only honest way to show
   * two numbers in one bar -- a trait the model is sure of and one it is
   * guessing at should not look alike.
   */
  #bar(x: number, y: number, width: number, name: string, bar: Bar, tint: number = PALETTE.magenta): number {
    this.#text(x, y, name.replace(/_/g, ' '), 17, HUD.ink);
    const trackW = Math.round(width * 0.42);
    const trackX = x + width - trackW - 62;
    this.#add(this.scene.add.rectangle(trackX, y, trackW, 10, 0x2a2336).setOrigin(0, 0.5));
    const fill = this.#add(this.scene.add
      .rectangle(trackX, y, Math.max(2, Math.round(trackW * clamp01(bar.value))), 10, tint)
      .setOrigin(0, 0.5));
    fill.setAlpha(0.3 + clamp01(bar.confidence) * 0.7);
    // A notch where confidence sits, so "sure of a low value" is legible.
    this.#add(this.scene.add
      .rectangle(trackX + Math.round(trackW * clamp01(bar.confidence)), y, 2, 16, 0xcfc3d4)
      .setOrigin(0.5, 0.5)).setAlpha(0.7);
    const arrow = bar.trend && Math.abs(bar.trend) > 0.001 ? (bar.trend > 0 ? ' ▲' : ' ▼') : '';
    this.#text(x + width, y, `${bar.value.toFixed(2)}${arrow}`, 16, HUD.dimInk, 1);
    return y + ROW;
  }

  /** A line of plain text that wraps inside the column. */
  #line(x: number, y: number, width: number, value: string, colour: string = HUD.dimInk, size = 16): number {
    const t = this.#text(x, y, value, size, colour);
    t.setWordWrapWidth(width, true);
    t.setOrigin(0, 0);
    t.setY(y - 8);
    return y + Math.max(ROW - 8, t.height + 6);
  }

  #empty(x: number, y: number, width: number, why: string): number {
    return this.#line(x, y, width, why, HUD.dimInk);
  }

  // --- the two columns -------------------------------------------------------

  #render(): void {
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((t) => t.scene);

    const snap = this.#snapshot;
    if (!snap) {
      this.#line(this.#left, this.#top, this.#colW * 2, 'Nothing has been observed yet.');
      return;
    }
    this.#renderPlayerColumn(snap);
    this.#renderActorColumn(snap);
  }

  /** Left: what the model believes about the player. */
  #renderPlayerColumn(snap: GameSnapshot): void {
    const x = this.#left;
    const w = this.#colW;
    const model = snap.playerModel;
    let y = this.#top;

    y = this.#heading(x, y, 'Your profile', 'bar = value · fade = confidence', w);
    const traits = Object.entries(model.traits);
    if (traits.length === 0) y = this.#empty(x, y, w, 'Nothing measured yet — go and fight something.');
    for (const [name, t] of traits) {
      y = this.#bar(x, y, w, name, { value: t.value, confidence: t.confidence, trend: t.recent_trend });
    }

    y += SECTION;
    y = this.#heading(x, y, 'What it expects next', `tick ${snap.tick}`, w);
    if (model.predictions.length === 0) {
      y = this.#empty(x, y, w, 'Not enough repeated behaviour yet.');
    }
    for (const p of model.predictions.slice(0, KEEP.predictions)) {
      y = this.#bar(x, y, w, p.token.toLowerCase(),
        { value: p.confidence, confidence: p.confidence }, PALETTE.cyan);
    }

    y += SECTION;
    const habits = [...(model.patterns ?? [])].sort((a, b) => b.confidence - a.confidence);
    const history = model.pattern_events ?? [];
    y = this.#heading(x, y, 'Habits', 'sequences it decided are real', w);
    if (habits.length === 0) {
      // A habit can be held and then lost. Saying "nothing yet" above a list
      // of things it learned and forgot reads as a bug rather than as decay.
      y = this.#empty(x, y, w, history.length === 0
        ? 'Nothing repeated enough yet. Do the same three things twice.'
        : 'Nothing held right now — what it had went stale.');
    }
    for (const p of habits.slice(0, KEEP.habits)) {
      y = this.#bar(x, y, w, p.sequence.join(' → ').toLowerCase(),
        { value: p.confidence, confidence: p.confidence }, 0xa8e6a0);
    }
    for (const e of [...history].reverse().slice(0, KEEP.history)) {
      const learned = e.kind === 'DETECTED';
      y = this.#line(x, y, w, `${learned ? 'learned' : 'forgot'} · ${e.pattern.sequence.join(' → ').toLowerCase()}`,
        learned ? '#a8e6a0' : HUD.dimInk);
    }
  }

  /** Right: what the twin and the Mirror are doing with that belief. */
  #renderActorColumn(snap: GameSnapshot): void {
    const x = this.#left + this.#colW + GUTTER;
    const w = this.#colW;
    const twin = snap.twin;
    const style = snap.twinModel;
    let y = this.#top;

    const intent = twin.intent;
    y = this.#heading(x, y, 'Your twin', `${intent.intentType.toLowerCase()} · ${pct(intent.confidence)}`, w);
    y = this.#line(x, y, w, intent.reason + (intent.targetId ? ` → ${intent.targetId}` : ''), HUD.ink);
    const utilities = Object.entries(intent.utilities).sort((a, b) => b[1] - a[1]);
    const top = utilities[0]?.[1] ?? 1;
    for (const [name, u] of utilities.slice(0, 5)) {
      const chosen = name === intent.intentType;
      y = this.#bar(x, y, w, name.toLowerCase(),
        { value: u / Math.max(top, 0.01), confidence: chosen ? 1 : 0.45 },
        chosen ? PALETTE.magenta : 0x53456a);
    }
    for (const e of this.#recent('TWIN_OUTCOME', KEEP.outcomes)) {
      const ok = Boolean(e.data.success);
      y = this.#line(x, y, w,
        `${String(e.data.intent).toLowerCase()} · ${ok ? 'worked' : 'failed'} · dealt ${e.data.damage_dealt} took ${e.data.damage_taken}`,
        ok ? '#a8e6a0' : '#f5a4c0');
    }

    y += SECTION;
    y = this.#heading(x, y, 'What the twin has learned',
      `${style.playerEventsSeen} seen · ${style.outcomesSeen} outcomes`, w);
    for (const [name, d] of Object.entries(style.dims).slice(0, 5)) {
      y = this.#bar(x, y, w, name, { value: d.value, confidence: d.confidence, trend: d.recent_trend }, 0xb48cff);
    }
    for (const lesson of style.lessons.slice(-KEEP.lessons)) {
      y = this.#line(x, y, w, lesson, HUD.dimInk);
    }

    y += SECTION;
    const boss = snap.boss;
    y = this.#heading(x, y, 'The Mirror', boss ? `phase ${boss.phase}` : 'not in this room', w);
    if (!boss) {
      this.#empty(x, y, w, 'It is only reading you once you are in front of it.');
      return;
    }
    y = this.#line(x, y, w,
      boss.activeCounter ? `countering: ${boss.activeCounter}` : 'generic behaviour', HUD.ink);
    const used = Object.entries(boss.countersUsed);
    if (used.length > 0) {
      y = this.#line(x, y, w, used.map(([c, n]) => `${c} ×${n}`).join('   '), HUD.dimInk);
    }
    for (const e of this.#recent('BOSS_COUNTER', KEEP.counters)) {
      y = this.#line(x, y, w, String(e.data.detail), '#f5a4c0');
    }
  }

  #recent(type: string, count: number): ServerEvent[] {
    return this.#events.filter((e) => e.type === type).slice(-count).reverse();
  }

  // --- lifecycle -------------------------------------------------------------

  toggle(): boolean {
    const next = !this.#panel.visible;
    this.#panel.setVisible(next);
    if (next) this.#render();
    return next;
  }

  close(notify = true): void {
    // No Escape listener of its own: `useHotkeys` owns Escape and closes
    // whatever the store says is open, which is why this is a real screen.
    const wasOpen = this.open;
    this.#panel?.setVisible(false);
    if (wasOpen && notify) eventBus.emit('ui:screen-close', { screen: 'agent' });
  }

  destroy(): void {
    this.close(false);
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#panel?.destroy();
    this.#texts = [];
  }
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
