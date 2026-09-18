import Phaser from 'phaser';

import { goatAnimationKey, GOAT_TEXTURE } from '../animation/goatClips';
import { ICONS_TEXTURE_KEY } from '../animation/iconsAtlas.generated';
import { slotInfo, WEAPONS, WEAPON_ORDER, type SlotId, type WeaponId } from '../animation/weaponClips';
import { DEPTH, HUD, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { FX } from '../world/textures';
import { eventBus } from '../EventBus';

/** A slot on either bar: a frame, an icon, a label, and a recharge sweep. */
interface Slot {
  frame: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  sweep: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
}

type Recharging = Partial<Record<SlotId, { left: number; total: number }>>;

const CAROUSEL: readonly (WeaponId | null)[] = [null, ...WEAPON_ORDER];

/**
 * The bar drawn inside the game.
 *
 * A separate scene rather than part of `PlayScene` for one concrete reason:
 * the play camera is zoomed by `RENDER_SCALE` to supersample the artwork, and
 * a scroll-factor-zero object under a zoomed camera still has to be positioned
 * in that camera's transformed space. A second scene gets its own untouched
 * camera, so the bar is laid out in plain canvas pixels.
 *
 * It holds no state the game does not already own. Equipping goes out on the
 * bus and comes back as `weapon:changed`, exactly as the React panel's does,
 * and recharge times are pushed by the scene that owns the timers -- so no
 * view here can disagree with the game about what is in hand or ready.
 */
export class HudScene extends Phaser.Scene {
  static readonly KEY = 'hud';

  #weaponSlots: Slot[] = [];
  #abilitySlots: Slot[] = [];
  #equipped: WeaponId | null = null;
  #recharging: Recharging = {};
  #flash = new Map<SlotId, number>();
  #texts: Phaser.GameObjects.Text[] = [];
  #teardown: Array<() => void> = [];

  constructor() {
    super({ key: HudScene.KEY, active: false });
  }

  create(): void {
    const width = VIEW.width * RENDER_SCALE;
    const height = VIEW.height * RENDER_SCALE;
    const row = height - HUD.margin - HUD.slot - HUD.labelGap;

    // Behind the bar but over the world. Its own camera has no zoom, so it can
    // simply be stretched across the canvas.
    this.add
      .image(width / 2, height / 2, FX.vignette)
      .setDisplaySize(width, height)
      .setDepth(DEPTH.vignette);

    this.#buildWeaponBar(row);
    this.#buildAbilityBar(width, row);
    this.#onEquip(null);

    // Canvas text rasterises with whatever font is available at the moment it
    // is drawn, and a webfont is usually not there yet. Redraw once it lands,
    // or the bar keeps a fallback face for the life of the page.
    void Promise.all(
      [HUD.nameSize, HUD.labelSize, HUD.hintSize].map(
        (size) => document.fonts.load(`${size}px "${PIXEL_FONT.family}"`),
      ),
    )
      .then(() => { for (const text of this.#texts) text.updateText(); })
      .catch(() => { /* the fallback stack is still readable */ });

    this.#teardown.push(
      eventBus.on('weapon:changed', ({ id }) => this.#onEquip(id)),
      eventBus.on('weapon:cooldowns', ({ active }) => { this.#recharging = active; }),
      eventBus.on('weapon:cast-blocked', ({ id }) => this.#flash.set(id, HUD.blockFlash)),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.#teardown) off();
      this.#teardown = [];
    });
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;

    for (const [id, left] of this.#flash) {
      if (left - dt <= 0) this.#flash.delete(id);
      else this.#flash.set(id, left - dt);
    }
    this.#paintAbilities();
  }

  // --- building -------------------------------------------------------------

  #buildWeaponBar(y: number): void {
    this.#weaponSlots = CAROUSEL.map((id, i) => {
      const x = HUD.margin + i * (HUD.slot + HUD.gap);
      const slot = this.#buildSlot(
        x, y, (id === null ? 'bare' : WEAPONS[id].name).toUpperCase(), HUD.nameSize,
      );

      if (id === null) {
        // The empty hand is the goat itself, idling. A dash would say the same
        // thing; a goat says it while looking like something worth clicking.
        slot.icon.setTexture(GOAT_TEXTURE);
        slot.icon.play(goatAnimationKey('idle'));
      } else {
        slot.icon.setTexture(ICONS_TEXTURE_KEY, WEAPONS[id].icon);
      }
      this.#fitIcon(slot);

      slot.frame
        .setInteractive(
          new Phaser.Geom.Rectangle(x, y, HUD.slot, HUD.slot),
          Phaser.Geom.Rectangle.Contains,
        )
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          eventBus.emit('weapon:equip', { id });
        });
      return slot;
    });

    this.#text(HUD.margin, y - HUD.labelGap - HUD.hintSize, 'Q E  SWITCH', 0, 0, HUD.hintSize)
      .setColor(HUD.dimInk);
  }

  #buildAbilityBar(width: number, y: number): void {
    // Three are built up front and hidden: three is the most any weapon
    // offers, and rebuilding game objects on every loadout change would churn
    // textures for nothing.
    this.#abilitySlots = [0, 1, 2].map((i) => {
      const x = width - HUD.margin - (3 - i) * (HUD.slot + HUD.gap) + HUD.gap;
      const slot = this.#buildSlot(x, y, String(i + 1));

      slot.frame
        .setInteractive(
          new Phaser.Geom.Rectangle(x, y, HUD.slot, HUD.slot),
          Phaser.Geom.Rectangle.Contains,
        )
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          eventBus.emit('hud:pointer-used', {});
          eventBus.emit('weapon:cast', { slot: i });
        });
      return slot;
    });

    this.#text(
      width - HUD.margin, y - HUD.labelGap - HUD.hintSize, '1 2 3  CAST', 1, 0, HUD.hintSize,
    ).setColor(HUD.dimInk);
  }

  #buildSlot(x: number, y: number, label: string, size: number = HUD.labelSize): Slot {
    const frame = this.add.graphics();
    const icon = this.add.sprite(x + HUD.slot / 2, y + HUD.slot / 2, ICONS_TEXTURE_KEY);
    // Grows downward as the timer runs out, so a recharging ability empties
    // from the top -- the direction that reads as "filling back up".
    const sweep = this.add
      .rectangle(x, y + HUD.slot, HUD.slot, 0, PALETTE.night, 0.74)
      .setOrigin(0, 1);
    const text = this.#text(
      x + HUD.slot / 2, y + HUD.slot + HUD.labelGap, label, 0.5, 0, size,
    );

    const slot: Slot = { frame, icon, label: text, sweep, x, y };
    this.#paintFrame(slot, false, false);
    return slot;
  }

  #text(
    x: number, y: number, value: string,
    originX: number, originY: number, size: number = HUD.labelSize,
  ) {
    const text = this.add
      .text(x, y, value, {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${size}px`,
        color: HUD.ink,
      })
      .setOrigin(originX, originY);
    this.#texts.push(text);
    return text;
  }

  /** Scale an icon to sit inside the slot without distorting it. */
  #fitIcon(slot: Slot): void {
    const box = HUD.slot * HUD.iconFill;
    const { width, height } = slot.icon.frame;
    slot.icon.setScale(Math.min(box / width, box / height));
  }

  // --- pixel frames ---------------------------------------------------------

  /**
   * A chamfered rectangle, drawn only from axis-aligned blocks.
   *
   * Cutting the corners by a whole unit rather than rounding them is what makes
   * the frame read as pixel art: a rounded corner is a curve the renderer
   * antialiases, and no amount of it will ever look like it was placed on a
   * grid.
   */
  #block(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    cut: number, color: number, alpha: number,
  ): void {
    g.fillStyle(color, alpha);
    g.fillRect(x + cut, y, w - cut * 2, h);
    g.fillRect(x, y + cut, cut, h - cut * 2);
    g.fillRect(x + w - cut, y + cut, cut, h - cut * 2);
  }

  #paintFrame(slot: Slot, active: boolean, blocked: boolean): void {
    const { frame, x, y } = slot;
    const u = HUD.pixel;
    const b = u * HUD.border;
    const cut = u * HUD.chamfer;
    const line = blocked ? PALETTE.taupe : active ? PALETTE.magenta : HUD.frameLine;

    frame.clear();
    // Border, then the fill inset by the border's own thickness. Two flat
    // blocks, so every edge lands on the same grid the chamfer does.
    this.#block(frame, x, y, HUD.slot, HUD.slot, cut, line, active || blocked ? 1 : 0.92);
    this.#block(
      frame, x + b, y + b, HUD.slot - b * 2, HUD.slot - b * 2, cut - b,
      active ? PALETTE.dusk : HUD.frameFill, active ? 0.97 : 0.88,
    );
    // One lit row under the top edge and one shaded row above the bottom: a
    // two-tone bevel is the difference between a box and a *panel*, and at
    // this size it takes exactly two rectangles.
    frame.fillStyle(active ? PALETTE.pink : HUD.frameLine, active ? 0.5 : 0.28);
    frame.fillRect(x + cut, y + b, HUD.slot - cut * 2, u);
    frame.fillStyle(PALETTE.night, 0.5);
    frame.fillRect(x + cut, y + HUD.slot - b - u, HUD.slot - cut * 2, u);
  }

  // --- state ----------------------------------------------------------------

  #onEquip(id: WeaponId | null): void {
    this.#equipped = id;

    this.#weaponSlots.forEach((slot, i) => {
      const active = CAROUSEL[i] === id;
      this.#paintFrame(slot, active, false);
      slot.icon.setAlpha(active ? 1 : 0.5);
      slot.label.setColor(active ? HUD.activeInk : HUD.dimInk);
    });

    const abilities = id ? WEAPONS[id].abilities : [];
    this.#abilitySlots.forEach((slot, i) => {
      const ability = abilities[i];
      const shown = ability !== undefined;
      slot.frame.setVisible(shown);
      slot.icon.setVisible(shown);
      slot.label.setVisible(shown);
      slot.sweep.setVisible(shown);
      if (!ability) return;
      slot.icon.setTexture(ICONS_TEXTURE_KEY, slotInfo(ability).icon);
      this.#fitIcon(slot);
      this.#paintFrame(slot, false, false);
    });
  }

  /** Redraw the recharge sweeps. Three rectangles a frame, and a frame is
   *  repainted only when a slot actually changes state. */
  #paintAbilities(): void {
    const abilities = this.#equipped ? WEAPONS[this.#equipped].abilities : [];

    this.#abilitySlots.forEach((slot, i) => {
      const ability = abilities[i];
      if (!ability) return;

      const timer = this.#recharging[ability];
      const blocked = this.#flash.has(ability);

      slot.sweep.height = timer ? HUD.slot * (timer.left / timer.total) : 0;
      slot.icon.setAlpha(timer ? 0.42 : 1);
      slot.label.setText(timer ? `${Math.max(timer.left, 0).toFixed(1)}` : String(i + 1));
      slot.label.setColor(blocked ? HUD.activeInk : timer ? HUD.dimInk : HUD.ink);
      this.#paintFrame(slot, false, blocked);
    });
  }
}
