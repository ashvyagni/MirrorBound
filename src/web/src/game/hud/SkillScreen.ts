import Phaser from 'phaser';

import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { SKILLNODES_TEXTURE_KEY } from '../animation/skillNodesAtlas.generated';
import { HUD, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { AttributeSnap, SkillNode } from '../contracts';
import { eventBus } from '../EventBus';
import { controlArt } from './controlArt';
import { fitInside } from './fit';
import { Panel } from './Panel';

/**
 * The skill tree, on `K`.
 *
 * Five branches side by side, each a column of four nodes you climb in order. The
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
// Five branches of four, so both dimensions grew with the v1.1 tree. The
// column layout below is proportional rather than pixel-authored, because a
// fifth column at fixed offsets crowds the labels into each other.
const WIDTH = 1880;
const HEIGHT = 1010;
const L = {
  pad: 40,
  /** Top of the branch headings. */
  headTop: -356,
  /** First node's centre. */
  nodeTop: -238,
  nodeStep: 132,
  node: 84,
  footer: 372,
} as const;

/** The four branches, in the order they are drawn. */
/**
 * The branches, in the order they are drawn.
 *
 * `emblem` is a frame on the skill-node sheet, and `tint` recolours it. The
 * sheet has four emblems and there are five branches — MIRROR arrived with the
 * v1.1 tree and has no art of its own, so it borrows the magic sigil in the
 * Mirror's own magenta rather than waiting for a sheet (§35: recombine before
 * commissioning). It reads as related-but-not-the-same, which is the branch.
 */
const BRANCHES: readonly {
  id: SkillNode['category']; label: string; blurb: string; emblem: string; tint?: number;
}[] = [
  { id: 'MOBILITY', label: 'Mobility', blurb: 'Move faster, dash more', emblem: 'mobility' },
  { id: 'COMBAT', label: 'Combat', blurb: 'Hit harder with weapons', emblem: 'combat' },
  { id: 'MAGIC', label: 'Magic', blurb: 'More mana, stronger spells', emblem: 'magic' },
  { id: 'SURVIVAL', label: 'Survival', blurb: 'Stay standing', emblem: 'survival' },
  { id: 'MIRROR', label: 'Mirror', blurb: 'What follows you', emblem: 'magic', tint: PALETTE.magenta },
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
  #attributes: readonly AttributeSnap[] = [];
  #attributePoints = 0;

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
  set(nodes: readonly SkillNode[], points: number, respecBlockedBy: string,
      attributes: readonly AttributeSnap[] = [], attributePoints = 0): void {
    this.#nodes = nodes;
    this.#points = points;
    this.#blocked = respecBlockedBy;
    this.#attributes = attributes;
    this.#attributePoints = attributePoints;
    if (this.open) this.#render();
  }

  #render(): void {
    for (const row of this.#rows) row.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((text) => text.scene);

    // Two currencies, and the subtitle has to say which is which: skill points
    // come from levelling and attribute points mostly come out of the ground, so
    // "2 points" on its own would be the least useful true sentence available.
    const parts: string[] = [];
    if (this.#points > 0) parts.push(`${this.#points} SKILL PT${this.#points > 1 ? 'S' : ''}`);
    if (this.#attributePoints > 0) {
      parts.push(`${this.#attributePoints} ATTRIBUTE PT${this.#attributePoints > 1 ? 'S' : ''}`);
    }
    this.#subtitle.setText(parts.length
      ? parts.join('   ')
      : 'LEVEL UP, OR MINE AND TRAIN, TO EARN POINTS');
    this.#respecLabel.setColor(this.#blocked ? HUD.dimInk : HUD.ink);

    const span = this.#right - this.#left;
    const colWidth = span / BRANCHES.length;
    // Everything inside a column is placed against its own left edge rather
    // than at an offset from its centre, so adding a branch narrows the columns
    // instead of overlapping their labels.
    const colLeft = -colWidth / 2 + 12;

    BRANCHES.forEach((branch, i) => {
      const x = this.#left + colWidth * (i + 0.5);

      const emblem = this.scene.add.image(x + colLeft, L.headTop, SKILLNODES_TEXTURE_KEY,
        branch.emblem);
      fitInside(emblem, 46);
      if (branch.tint !== undefined) emblem.setTint(branch.tint);
      this.#add(emblem);
      this.#add(this.#row(x + colLeft + 38, L.headTop, branch.label.toUpperCase(),
        HUD.labelSize, HUD.ink, 0));
      this.#add(this.#row(x + colLeft + 38, L.headTop + 24, branch.blurb.toUpperCase(),
        HUD.hintSize - 3, HUD.dimInk, 0));
      // The attribute that gates this branch, on the branch it gates.
      //
      // Not a screen of its own. An attribute exists to open the deep nodes of
      // one branch, and putting the five in a separate panel would mean reading
      // "requires 5 Might" here and going somewhere else to find out what Might
      // is at -- which is the question the line was raising.
      this.#attribute(branch.id, x + colLeft, L.headTop + 54, colWidth);

      const column = this.#nodes
        .filter((n) => n.category === branch.id)
        .sort((a, b) => a.tier - b.tier);

      column.forEach((node, tier) => {
        const y = L.nodeTop + tier * L.nodeStep;
        // The link is drawn from the node above, and lit only when this one is
        // reachable -- so the eye can follow how far up the branch it may go.
        if (tier > 0) {
          const link = this.scene.add.rectangle(x + colLeft + 26, y - L.nodeStep / 2,
            4, L.nodeStep - L.node, 0xf5a4c0);
          link.setAlpha(node.unlocked || node.available ? 0.8 : 0.18);
          this.#add(link);
        }
        this.#node(node, x + colLeft, y, colWidth);
      });
    });
  }

  /**
   * One attribute, with a way to spend a point into it.
   *
   * The `+` appears only when there is something to spend and the attribute is
   * not already at its ceiling -- and when it is absent the number is still
   * there, because "what is my Might" is a question worth answering whether or
   * not the answer can change right now.
   */
  #attribute(branch: SkillNode['category'], x: number, y: number, colWidth: number): void {
    const attribute = this.#attributes.find((a) => a.branch === branch);
    if (!attribute) return;

    const capped = attribute.points >= attribute.max;
    const spendable = this.#attributePoints > 0 && !capped;
    this.#add(this.#row(x, y, `${attribute.name.toUpperCase()}  ${attribute.points}`,
      HUD.hintSize, attribute.points > 0 ? HUD.activeInk : HUD.dimInk, 0));

    if (!spendable) {
      if (capped) {
        this.#add(this.#row(x + colWidth - 48, y, 'MAX', HUD.hintSize - 4, HUD.dimInk, 1));
      }
      return;
    }
    const plus = this.#row(x + colWidth - 48, y, '+', HUD.labelSize, HUD.ink, 0.5);
    this.#add(plus);
    const hit = this.scene.add.zone(x + colWidth - 48, y, 44, 36).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
      this.#detail.setText(attribute.description.toUpperCase());
      plus.setColor(HUD.activeInk);
    });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => plus.setColor(HUD.ink));
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      eventBus.emit('hud:pointer-used', {});
      eventBus.emit('ui:command', {
        type: 'COMMAND', action: 'SPEND_ATTRIBUTE', attributeId: attribute.id,
      });
    });
    this.#add(hit);
  }

  #node(node: SkillNode, x: number, y: number, colWidth: number): void {
    const frame = node.unlocked ? 'unlocked' : node.available ? 'available' : 'locked';
    const icon = this.scene.add.image(x + 26, y, SKILLNODES_TEXTURE_KEY, frame);
    fitInside(icon, L.node);
    this.#add(icon);

    const ink = node.unlocked ? HUD.activeInk : node.available ? HUD.ink : HUD.dimInk;
    this.#add(this.#row(x + 26, y + L.node * 0.62,
      TIERS[node.tier - 1] ?? String(node.tier), HUD.hintSize - 3, HUD.dimInk, 0.5));
    this.#add(this.#row(x + 78, y - 14, node.name.toUpperCase(), HUD.hintSize, ink, 0));
    this.#add(this.#row(x + 78, y + 16,
      node.unlocked ? 'LEARNED' : node.available ? `${node.cost} PT` : node.reason.toUpperCase(),
      HUD.hintSize - 3, HUD.dimInk, 0));

    // The whole node takes the pointer, not the 84px disc: a hit area the size
    // of the icon is a hit area you have to aim at. Sized to the column so it
    // never reaches into the branch beside it.
    const hit = this.scene.add.zone(x + colWidth / 2 - 12, y, colWidth - 24, L.node).setOrigin(0.5);
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
