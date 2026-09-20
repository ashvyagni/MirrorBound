import Phaser from 'phaser';

import { goatAnimationKey } from '../animation/goatClips';
import { GOAT_TEXTURE_KEY } from '../animation/goatAtlas.generated';
import { HOTBAR_TEXTURE_KEY } from '../animation/hotbarAtlas.generated';
import { ICONS_TEXTURE_KEY } from '../animation/iconsAtlas.generated';
import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { POTIONDIAL_TEXTURE_KEY } from '../animation/potionDialAtlas.generated';
import { weaponIcon } from '../animation/abilityIcons';
import { HUD, HUD_ART, PALETTE, PIXEL_FONT } from '../constants';
import { eventBus } from '../EventBus';
import { keybinds, keyName } from '../state/Keybinds';
import { POTIONS, type LoadoutSnapshot } from '../state/Loadout';
import { artHeight, artWidth, fitInside, fitWidth } from './fit';

/** One of the two weapon slots on the plate. */
interface Hand {
  icon: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  highlight: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
}

/**
 * The plate: a weapon in each hand and the potion dial between them.
 *
 * The slots are positions on one drawn plate rather than three separate
 * frames, so the spacing is whatever the art says it is -- `slotSpacing` is
 * measured off the plate, and redrawing it wider moves all three together.
 */
export class Hotbar {
  #hands: Hand[] = [];
  #dial!: Phaser.GameObjects.Image;
  #potionIcon!: Phaser.GameObjects.Sprite;
  #potionCount!: Phaser.GameObjects.Text;
  /** Where the dial is turning to, in degrees, and where it is now. */
  #dialTarget = 0;
  #objects: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  /** Drawn sizes, solved from the plate so one number resizes the whole bar. */
  #item = 0;
  #dialSize = 0;

  build(): void {
    const { hotbar } = HUD_ART;

    const plate = this.scene.add.image(hotbar.x, hotbar.y, HOTBAR_TEXTURE_KEY, 'plate');
    fitWidth(plate, hotbar.width);
    this.#objects.push(plate);

    // Each slot is placed on its own measured centre, and the plate's drawn
    // box is what those fractions are of -- not `hotbar.width`, which is the
    // width asked for rather than the width the trimmed art came out at.
    const plateWidth = artWidth(plate);
    const plateHeight = artHeight(plate);
    const at = (slot: { x: number; y: number }) => ({
      x: hotbar.x + plateWidth * slot.x,
      y: hotbar.y + plateHeight * slot.y,
    });

    this.#item = plateWidth * hotbar.slots[0]!.w * hotbar.itemFill;
    this.#dialSize = plateWidth * hotbar.dialRatio;

    const left = at(hotbar.slots[0]!);
    const right = at(hotbar.slots[2]!);
    const middle = at(hotbar.slots[1]!);

    this.#hands = [
      this.#buildHand(left.x, left.y, 0),
      this.#buildHand(right.x, right.y, 1),
    ];
    this.#buildDial(middle.x, middle.y);
  }

  #buildHand(x: number, y: number, index: number): Hand {
    // Behind the icon and sized to the slot's opening: the active hand is
    // shown by lighting its recess, not by drawing a second frame over the
    // plate, which would sit proud of art that is meant to be recessed.
    const highlight = this.scene.add
      .rectangle(x, y, this.#item * 1.24, this.#item * 1.24, PALETTE.magenta, 0.22)
      .setVisible(false);
    const icon = this.scene.add.sprite(x, y, ICONS_TEXTURE_KEY, 'sword');
    // Sized here as well as in `set`, so the placeholder is never drawn at the
    // sheet's natural size while waiting for the first push.
    fitInside(icon, this.#item);
    // On the plate below the recess, not under the plate: the plate's lower
    // band is 30 canvas pixels of empty metal, and the only thing beneath it
    // is the bottom of the screen.
    const label = this.#text(x, y + this.#item * 0.95, index === 0 ? 'MAIN' : keyName(keybinds.get('swapWeapon').primary), HUD.hintSize);

    const hand: Hand = { icon, label, highlight, x, y };
    this.#objects.push(highlight, icon);

    // The frame's own bounds; see the note in `SettingsButton`.
    icon
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        eventBus.emit('loadout:select', { slot: index === 0 ? 0 : 1 });
      });
    return hand;
  }

  #buildDial(x: number, y: number): void {
    this.#potionIcon = this.scene.add.sprite(x, y, ITEMS_TEXTURE_KEY, 'health_potion');
    fitInside(this.#potionIcon, this.#item * 0.86);

    this.#dial = this.scene.add.image(x, y, POTIONDIAL_TEXTURE_KEY, 'dial');
    fitWidth(this.#dial, this.#dialSize);

    this.#potionCount = this.#text(
      x + this.#dialSize * 0.34, y + this.#dialSize * 0.34, '0', HUD.hintSize,
    );
    this.#objects.push(this.#potionIcon, this.#dial);

    this.#dial
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (p: Phaser.Input.Pointer) => {
        eventBus.emit('hud:pointer-used', {});
        // Right-click turns the dial, left-click drinks. One control, both
        // things it can mean, and neither needs a second slot on the plate.
        if (p.rightButtonDown()) eventBus.emit('loadout:cycle-potion', { step: 1 });
        else eventBus.emit('loadout:use-potion', {});
      });
  }

  #text(x: number, y: number, value: string, size: number = HUD.labelSize) {
    const text = this.scene.add
      .text(x, y, value, {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${size}px`,
        color: HUD.ink,
      })
      .setOrigin(0.5, 0.5);
    this.#texts.push(text);
    this.#objects.push(text);
    return text;
  }

  /** Redraw from the loadout. Called only when it actually changes. */
  set(loadout: LoadoutSnapshot): void {
    this.#hands.forEach((hand, i) => {
      const id = loadout.weapons[i] ?? null;
      const active = loadout.active === i;

      if (id === null) {
        // An empty hand is the goat itself, idling -- the same stand-in the
        // old carousel used, and it still says "bare hands" better than a dash.
        hand.icon.setTexture(GOAT_TEXTURE_KEY);
        hand.icon.play(goatAnimationKey('idle'), true);
      } else {
        hand.icon.stop();
        const mark = weaponIcon(id);
        hand.icon.setTexture(mark.texture, mark.frame);
      }
      fitInside(hand.icon, this.#item);

      hand.icon.setAlpha(active ? 1 : 0.45);
      hand.highlight.setVisible(active);
      hand.label.setColor(active ? HUD.activeInk : HUD.dimInk);
      hand.label.setText(i === 0 ? 'MAIN' : keyName(keybinds.get('swapWeapon').primary));
    });

    const potion = POTIONS[loadout.potionIndex] ?? POTIONS[0]!;
    const count = loadout.counts[potion.id] ?? 0;
    // The item sheet's frames are named with `main`'s consumable ids, so the
    // potion indexes its own icon with nothing in between -- and an id with no
    // art is a missing-frame error rather than a blank dial.
    this.#potionIcon.setTexture(ITEMS_TEXTURE_KEY, potion.id);
    fitInside(this.#potionIcon, this.#item * 0.86);
    this.#potionIcon.setAlpha(count > 0 ? 1 : 0.3);
    this.#potionCount.setText(String(count));
    this.#potionCount.setColor(count > 0 ? HUD.ink : HUD.dimInk);

    this.#dialTarget = loadout.potionIndex * HUD_ART.hotbar.dialStep;
  }

  /** Turn the dial toward where the carousel now points. */
  step(deltaSeconds: number): void {
    const now = this.#dial.angle;
    // Shortest way round, so stepping from the last potion back to the first
    // does not unwind the whole dial.
    const delta = Phaser.Math.Angle.WrapDegrees(this.#dialTarget - now);
    if (Math.abs(delta) < 0.5) {
      this.#dial.setAngle(this.#dialTarget);
      return;
    }
    this.#dial.setAngle(now + delta * (1 - Math.exp(-deltaSeconds / 0.09)));
  }

  /**
   * Show or hide the whole piece.
   *
   * Used by the Sanctum cutscene, which is a scene rather than a moment of
   * play: a hotbar and a minimap over it say "you are playing" while the one
   * thing the game wants is for you to watch. Visibility rather than destroy,
   * because the scene ends and everything has to come back exactly as it was.
   */
  setVisible(on: boolean): void {
    for (const object of this.#objects) {
      // Not every GameObject carries the Visible component -- a Zone used as a
      // hit area does not -- so this asks rather than asserts.
      (object as unknown as Partial<Phaser.GameObjects.Components.Visible>).setVisible?.(on);
    }
  }

  destroy(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
    this.#texts = [];
    this.#hands = [];
  }
}
