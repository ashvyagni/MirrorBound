import Phaser from 'phaser';

import { abilityIcon, weaponIcon } from '../animation/abilityIcons';
import { BARSPLATES_TEXTURE_KEY } from '../animation/barsPlatesAtlas.generated';
import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { GLYPHS_TEXTURE_KEY } from '../animation/glyphsAtlas.generated';
import { isItemName } from '../animation/items';
import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { AbilitySlot, Inventory, WeaponInfo } from '../contracts';
import { eventBus } from '../EventBus';
import { controlArt } from './controlArt';
import { fitInside, fitWidth } from './fit';
import { Panel } from './Panel';

/**
 * What you are carrying, on `I`.
 *
 * The screen is built around the two hands, because the two hands are the
 * whole of the build: abilities belong to weapons, so what is in them decides
 * what the four ability keys do. Putting them at the top and showing the
 * granted pair under each is the difference between "a list of swords" and
 * "the reason you would carry this one".
 *
 * Clicking a weapon puts it in the **first** hand; the small second button on
 * its row puts it in the **offhand**. Two buttons rather than a modifier key,
 * because a modifier is something you have to be told about and a button is
 * something you can see.
 *
 * Nothing here changes anything locally. Every click is a command, and the
 * screen redraws when the next snapshot says it happened -- so a refused
 * equip leaves the display showing what is actually held rather than what was
 * asked for.
 */
const WIDTH = 1640;
const HEIGHT = 960;
const L = {
  pad: 40,
  handTop: -286,
  hand: 108,
  listTop: -40,
  rowStep: 76,
  slot: 62,
} as const;

export class InventoryScreen {
  #panel!: Panel;
  #texts: Phaser.GameObjects.Text[] = [];
  #rows: Phaser.GameObjects.GameObject[] = [];
  #escape: ((event: KeyboardEvent) => void) | null = null;

  #inventory: Inventory | null = null;
  #abilities: readonly AbilitySlot[] = [];

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
      width: WIDTH, height: HEIGHT, title: 'Carried', scrim: true,
    });
    this.#texts.push(...this.#panel.texts);

    // A standing note rather than a tooltip: it never changes, and the two
    // buttons on every weapon row are the one thing on this screen that is not
    // self-evident.
    this.#text(0, HEIGHT / 2 - this.#panel.inset - 34,
      'DRAW PUTS IT IN THE FIRST HAND  ·  OFFHAND PUTS IT IN THE SECOND  ·  WHAT YOU CARRY IS WHAT YOU CAN CAST',
      HUD.hintSize - 2, HUD.dimInk, 0.5);
    this.#buildClose();
    this.#panel.setVisible(false);
  }

  #plate(x: number, y: number, frame: string, width: number, height: number) {
    return this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, frame, width, height));
  }

  #text(x: number, y: number, value: string, size: number, colour: string, originX = 0) {
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

  set(inventory: Inventory, abilities: readonly AbilitySlot[]): void {
    this.#inventory = inventory;
    this.#abilities = abilities;
    if (this.open) this.#render();
  }

  #render(): void {
    for (const row of this.#rows) row.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((text) => text.scene);

    const inv = this.#inventory;
    if (!inv) return;

    const byId = new Map(inv.weapons.map((w) => [w.id, w]));
    const half = (this.#right - this.#left) / 2;

    // --- the two hands ------------------------------------------------------
    this.#hand(this.#left + half * 0.5, 'FIRST HAND', 'MAIN', byId.get(inv.equippedWeapon), 0);
    this.#hand(this.#left + half * 1.5, 'SECOND HAND', 'OFFHAND', byId.get(inv.offhandWeapon), 2);

    const rule = this.scene.add.image(this.#left, L.listTop - 54, BARSPLATES_TEXTURE_KEY, 'divider')
      .setOrigin(0, 0.5).setAlpha(0.3);
    fitWidth(rule, this.#right - this.#left);
    this.#add(rule);

    // --- everything owned ---------------------------------------------------
    this.#add(this.#row(this.#left, L.listTop - 22, 'WEAPONS', HUD.hintSize - 1, HUD.dimInk, 0));
    if (inv.weapons.length === 0) {
      this.#add(this.#row(this.#left, L.listTop + 26,
        'NOTHING YET — THE FIRST ONE YOU FIND IS THE FIRST TIME THE ABILITY BAR HAS ANYTHING ON IT',
        HUD.hintSize - 2, HUD.dimInk, 0));
    }
    inv.weapons.forEach((weapon, i) => {
      this.#weaponRow(weapon, this.#left, L.listTop + 26 + i * L.rowStep, inv);
    });

    // --- flasks and relics --------------------------------------------------
    const rightX = this.#left + half;
    this.#add(this.#row(rightX, L.listTop - 22, 'FLASKS AND RELICS', HUD.hintSize - 1, HUD.dimInk, 0));
    let y = L.listTop + 26;
    for (const stack of inv.consumables) {
      this.#stack(stack.id, stack.name, stack.count, rightX, y, stack.description);
      y += L.rowStep;
    }
    for (const relic of inv.relics) {
      this.#stack(relic.id, relic.name, 0, rightX, y, relic.description);
      y += L.rowStep;
    }
    this.#add(this.#row(rightX, y + 10,
      `GOLD ${inv.gold}   ·   ESSENCE ${inv.resources.essence ?? 0}   ·   SHARDS ${inv.resources.shards ?? 0}`,
      HUD.hintSize - 1, HUD.ink, 0));
  }

  /** One hand: what is in it, and the two ability keys it grants. */
  #hand(cx: number, label: string, key: string, weapon: WeaponInfo | undefined, firstSlot: number): void {
    this.#add(this.#row(cx, L.handTop - 74, `${label}   ·   ${key}`, HUD.hintSize - 1, HUD.dimInk, 0.5));

    const slot = this.scene.add.image(cx - 150, L.handTop, BARSPLATES_TEXTURE_KEY,
      weapon ? 'slotSelected' : 'slot');
    fitInside(slot, L.hand);
    this.#add(slot);

    if (weapon) {
      const art = weaponIcon(weapon.animation);
      const icon = this.scene.add.image(cx - 150, L.handTop, art.texture, art.frame);
      fitInside(icon, L.hand * 0.56);
      this.#add(icon);
      this.#add(this.#row(cx - 80, L.handTop - 26, weapon.name.toUpperCase(), HUD.labelSize, HUD.ink, 0));
      this.#add(this.#row(cx - 80, L.handTop + 4,
        `${weapon.damage} DMG   ·   ${weapon.range} REACH`, HUD.hintSize - 2, HUD.dimInk, 0));
    } else {
      this.#add(this.#row(cx - 80, L.handTop - 26, 'EMPTY', HUD.labelSize, HUD.dimInk, 0));
      this.#add(this.#row(cx - 80, L.handTop + 4, 'BARE HANDS — TWO SWIPES', HUD.hintSize - 2, HUD.dimInk, 0));
    }

    // The pair of ability keys this hand feeds, read from the live bar rather
    // than from the weapon: the server is the one that decides what is on them.
    for (let i = 0; i < 2; i += 1) {
      const ability = this.#abilities[firstSlot + i];
      const x = cx - 80 + i * 132;
      const cap = this.scene.add.image(x + 22, L.handTop + 48, BARSPLATES_TEXTURE_KEY, 'slot');
      fitInside(cap, 46);
      cap.setAlpha(ability ? 1 : 0.35);
      this.#add(cap);
      if (!ability) continue;
      const art = abilityIcon(ability.id);
      const icon = this.scene.add.image(x + 22, L.handTop + 48, art.texture, art.frame);
      fitInside(icon, 26);
      this.#add(icon);
      this.#add(this.#row(x + 48, L.handTop + 48,
        `${firstSlot + i + 1}  ${ability.name.toUpperCase()}`, HUD.hintSize - 3, HUD.dimInk, 0));
    }
  }

  /** One owned weapon: draw it, or put it in the offhand. */
  #weaponRow(weapon: WeaponInfo, x: number, y: number, inv: Inventory): void {
    const held = weapon.id === inv.equippedWeapon || weapon.id === inv.offhandWeapon;
    const slot = this.scene.add.image(x + 30, y, BARSPLATES_TEXTURE_KEY, held ? 'slotSelected' : 'slot');
    fitInside(slot, L.slot);
    this.#add(slot);

    const art = weaponIcon(weapon.animation);
    const icon = this.scene.add.image(x + 30, y, art.texture, art.frame);
    fitInside(icon, L.slot * 0.56);
    this.#add(icon);

    this.#add(this.#row(x + 74, y - 12, weapon.name.toUpperCase(), HUD.hintSize, held ? HUD.activeInk : HUD.ink, 0));
    this.#add(this.#row(x + 74, y + 14, weapon.description.toUpperCase(), HUD.hintSize - 3, HUD.dimInk, 0));

    const draw = this.#plate(x + 500, y, 'button', 120, 52);
    draw.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        eventBus.emit('ui:command', { type: 'COMMAND', action: 'EQUIP_WEAPON', weaponId: weapon.id });
      });
    this.#add(draw);
    this.#add(this.#row(x + 500, y, 'DRAW', HUD.hintSize - 2, HUD.ink, 0.5));

    const off = this.#plate(x + 630, y, 'button', 120, 52);
    off.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        eventBus.emit('ui:command', { type: 'COMMAND', action: 'SET_OFFHAND', weaponId: weapon.id });
      });
    this.#add(off);
    this.#add(this.#row(x + 630, y, 'OFFHAND', HUD.hintSize - 3, HUD.ink, 0.5));
  }

  /** A flask or a relic. Flasks are drinkable; relics simply are. */
  #stack(id: string, name: string, count: number, x: number, y: number, description: string): void {
    const slot = this.scene.add.image(x + 30, y, BARSPLATES_TEXTURE_KEY, 'slot');
    fitInside(slot, L.slot);
    this.#add(slot);

    // The item sheet does not cover everything the server can hand you, so an
    // id it has never drawn falls back to the plate alone rather than asking
    // for a frame that is not there.
    if (isItemName(id)) {
      const icon = this.scene.add.image(x + 30, y, ITEMS_TEXTURE_KEY, id);
      fitInside(icon, L.slot * 0.58);
      this.#add(icon);
    }

    this.#add(this.#row(x + 74, y - 12,
      count > 0 ? `${name.toUpperCase()}  ×${count}` : name.toUpperCase(),
      HUD.hintSize, HUD.ink, 0));
    this.#add(this.#row(x + 74, y + 14, description.toUpperCase(), HUD.hintSize - 3, HUD.dimInk, 0));

    if (count <= 0) return;
    const hit = this.scene.add.zone(x + 30, y, L.slot, L.slot).setOrigin(0.5);
    hit.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        eventBus.emit('ui:command', { type: 'COMMAND', action: 'USE_ITEM', itemId: id });
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
    if (notify) eventBus.emit('ui:screen-close', { screen: 'inventory' });
    this.#unwatchEscape();
  }


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
