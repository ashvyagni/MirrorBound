import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { SKILLNODES_TEXTURE_KEY } from '../animation/skillNodesAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { SkillNode } from '../contracts';
import { eventBus } from '../EventBus';
import { controlArt } from './controlArt';
import { fitInside } from './fit';
import { Panel } from './Panel';

/**
 * The skill tree, on `K`.
 *
 * Four branches side by side, each a column of nodes you climb in order. The
 * shape is the server's: `SkillNode` arrives already carrying `unlocked`,
 * `available` and, when it is neither, the `reason` why -- so nothing here
 * decides whether a node can be taken, it only draws the answer. A node that
 * looks takeable and then refuses is the failure this avoids.
 *
 * Drawn from the `skillNodes` sheet, which has exactly the four states a node
 * can be in and an emblem per branch. The emblems are named for the server's
 * own categories in lower case, so a branch indexes its own art.
 *
 * Unlearning is a village service like resting and shopping. The server
 * enforces all three conditions; the button shows which one is missing rather
 * than greying out silently, because a dead control with no explanation reads
 * as a bug every time.
 */
const WIDTH = 1640;
const HEIGHT = 960;
const L = {
  pad: 40,
  /** Top of the branch headings. */
  headTop: -336,
  /** First node's centre. */
  nodeTop: -238,
  nodeStep: 132,
  node: 84,
  footer: 372,
} as const;

/** The four branches, in the order they are drawn. */
const BRANCHES: readonly { id: SkillNode['category']; label: string; blurb: string }[] = [
  { id: 'MOBILITY', label: 'Mobility', blurb: 'Move faster, dash more' },
  { id: 'COMBAT', label: 'Combat', blurb: 'Hit harder with weapons' },
  { id: 'MAGIC', label: 'Magic', blurb: 'More mana, stronger spells' },
  { id: 'SURVIVAL', label: 'Survival', blurb: 'Stay standing' },
];

const TIERS = ['I', 'II', 'III', 'IV', 'V'];

export class SkillScreen {
  #panel!: Panel;
  #texts: Phaser.GameObjects.Text[] = [];
  /** Everything redrawn on every change. */
  #rows: Phaser.GameObjects.GameObject[] = [];
  #subtitle!: Phaser.GameObjects.Text;
  #detail!: Phaser.GameObjects.Text;
  #respecLabel!: Phaser.GameObjects.Text;
  #respec!: Phaser.GameObjects.Image;
  #escape: ((event: KeyboardEvent) => void) | null = null;

  #nodes: readonly SkillNode[] = [];
  #points = 0;
  #blocked = '';

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  get #left(): number { return -WIDTH / 2 + this.#panel.inset + L.pad; }
  get #right(): number { return WIDTH / 2 - this.#panel.inset - L.pad; }

  build(): void {
    const cx = (VIEW.width * RENDER_SCALE) / 2;
    const cy = (VIEW.height * RENDER_SCALE) / 2;

    this.#panel = new Panel(this.scene, cx, cy, {
      width: WIDTH, height: HEIGHT, title: 'Skills', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    this.#subtitle = this.#text(0, -396, '', HUD.hintSize, HUD.dimInk);

    // One line under the columns, filled by whichever node the pointer is on.
    // A tooltip would have to follow the pointer and be clipped to the panel;
    // a fixed line cannot be either.
    this.#detail = this.#text(0, L.footer - 74, '', HUD.hintSize, HUD.ink);

    this.#respec = this.#plate(this.#right - 150, L.footer, 'button', 300, 68);
    this.#respec.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        if (this.#blocked) {
          this.#detail.setText(this.#blocked.toUpperCase());
          return;
        }
        eventBus.emit('ui:command', { type: 'COMMAND', action: 'RESPEC' });
      });
    this.#panel.body.add(this.#respec);
    this.#respecLabel = this.#text(this.#right - 150, L.footer, 'UNLEARN ALL', HUD.hintSize, HUD.ink);

    this.#buildClose();
    this.#panel.setVisible(false);
  }

  #plate(x: number, y: number, frame: string, width: number, height: number) {
    return this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, frame, width, height));
  }

  #text(x: number, y: number, value: string, size: number, colour: string, originX = 0.5) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#panel.body.add(t);
    this.#texts.push(t);
    return t;
  }

  #buildClose(): void {
    const x = this.#right - 34;
    const y = -HEIGHT / 2 + this.#panel.inset + 62;
    const button = this.#plate(x, y, 'button', 76, 76);
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

  /** New tree, new points, new reason. Redrawn whole; it is a few dozen objects. */
  set(nodes: readonly SkillNode[], points: number, respecBlockedBy: string): void {
    this.#nodes = nodes;
    this.#points = points;
    this.#blocked = respecBlockedBy;
    if (this.open) this.#render();
  }

  #render(): void {
    for (const row of this.#rows) row.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((text) => text.scene);

    this.#subtitle.setText(this.#points > 0
      ? `${this.#points} POINT${this.#points > 1 ? 'S' : ''} TO SPEND`
      : 'LEVEL UP TO EARN POINTS');
    this.#respecLabel.setColor(this.#blocked ? HUD.dimInk : HUD.ink);

    const span = this.#right - this.#left;
    const colWidth = span / BRANCHES.length;

    BRANCHES.forEach((branch, i) => {
      const x = this.#left + colWidth * (i + 0.5);

      const emblem = this.scene.add.image(x - 110, L.headTop, SKILLNODES_TEXTURE_KEY,
        branch.id.toLowerCase());
      fitInside(emblem, 52);
      this.#add(emblem);
      this.#add(this.#row(x - 70, L.headTop, branch.label.toUpperCase(), HUD.labelSize, HUD.ink, 0));
      this.#add(this.#row(x - 70, L.headTop + 30, branch.blurb.toUpperCase(), HUD.hintSize - 3, HUD.dimInk, 0));

      const column = this.#nodes
        .filter((n) => n.category === branch.id)
        .sort((a, b) => a.tier - b.tier);

      column.forEach((node, tier) => {
        const y = L.nodeTop + tier * L.nodeStep;
        // The link is drawn from the node above, and lit only when this one is
        // reachable -- so the eye can follow how far up the branch it may go.
        if (tier > 0) {
          const link = this.scene.add.rectangle(x - 150, y - L.nodeStep / 2, 4, L.nodeStep - L.node, 0xf5a4c0);
          link.setAlpha(node.unlocked || node.available ? 0.8 : 0.18);
          this.#add(link);
        }
        this.#node(node, x, y);
      });
    });
  }

  #node(node: SkillNode, x: number, y: number): void {
    const frame = node.unlocked ? 'unlocked' : node.available ? 'available' : 'locked';
    const icon = this.scene.add.image(x - 150, y, SKILLNODES_TEXTURE_KEY, frame);
    fitInside(icon, L.node);
    this.#add(icon);

    const ink = node.unlocked ? HUD.activeInk : node.available ? HUD.ink : HUD.dimInk;
    this.#add(this.#row(x - 150, y + L.node * 0.62,
      TIERS[node.tier - 1] ?? String(node.tier), HUD.hintSize - 3, HUD.dimInk, 0.5));
    this.#add(this.#row(x - 96, y - 14, node.name.toUpperCase(), HUD.hintSize, ink, 0));
    this.#add(this.#row(x - 96, y + 16,
      node.unlocked ? 'LEARNED' : node.available ? `${node.cost} PT` : node.reason.toUpperCase(),
      HUD.hintSize - 3, HUD.dimInk, 0));

    // The whole node takes the pointer, not the 84px disc: a hit area the size
    // of the icon is a hit area you have to aim at.
    const hit = this.scene.add.zone(x - 4, y, 300, L.node).setOrigin(0.5);
    hit.setInteractive({ useHandCursor: node.available });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.#detail.setText(node.description.toUpperCase());
    });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      eventBus.emit('hud:pointer-used', {});
      if (node.unlocked) return;
      if (!node.available) {
        this.#detail.setText(node.reason.toUpperCase());
        return;
      }
      eventBus.emit('ui:command', { type: 'COMMAND', action: 'UNLOCK_SKILL', skillId: node.id });
    });
    this.#add(hit);
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

  get open(): boolean {
    return this.#panel.visible;
  }

  toggle(): boolean {
    const next = !this.open;
    this.#panel.setVisible(next);
    if (next) {
      this.#render();
    } else {
      this.#unwatchEscape();
    }
    return next;
  }

  close(notify = true): void {
    if (!this.open) return;
    this.#panel.setVisible(false);
    if (notify) eventBus.emit('ui:screen-close', { screen: 'skills' });
    this.#unwatchEscape();
  }

  /**
   * Escape closes it.
   *
   * Listened for on the window rather than through Phaser, for the same reason
   * the console does: Phaser only reports keys it has been asked for, and this
   * has to answer one it never asked about.
   */

  #unwatchEscape(): void {
    if (!this.#escape) return;
    window.removeEventListener('keydown', this.#escape, { capture: true });
    this.#escape = null;
  }

  destroy(): void {
    this.#unwatchEscape();
    this.#panel?.destroy();
    this.#rows = [];
    this.#texts = [];
  }
}
