import Phaser from 'phaser';

import { DIALOGUE_TEXTURE_KEY } from '../animation/dialogueAtlas.generated';
import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { SPEAKERS_FRAMES, SPEAKERS_TEXTURE_KEY } from '../animation/speakersAtlas.generated';
import { weaponIcon } from '../animation/abilityIcons';
import { weaponSheetFor } from '../animation/weaponClips';
import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { ShopEntry } from '../contracts';
import { eventBus } from '../EventBus';
import { controlArt } from './controlArt';
import { fitInside, fitWidth } from './fit';

/**
 * Talking to someone, and buying from them.
 *
 * Built on the dialogue sheet's own pieces -- `plate` for the speech, `nameTab`
 * for who is speaking, `chevron` for "there is more" -- which were drawn for
 * exactly this screen and had never been used: only the interact prompt and the
 * portal rings were reading that atlas.
 *
 * **The speech floats over the speaker's head** and follows them, rather than
 * sitting in a panel across the screen. A conversation is with a person, and a
 * box over the person is a box over the only thing worth looking at. The world
 * position is converted through the play camera the same way the interact
 * prompt's is, so the bubble is drawn at interface scale and stays readable
 * however far you have zoomed out.
 *
 * The shop is the one part that needs room, so it takes a column down **one
 * side** -- whichever side the speaker is not on. Nothing dims the world: a
 * scrim over a conversation hides the person you are having it with.
 *
 * Every line here was authored on the server and arrived in NPC_TALK with the
 * names already substituted. Buying is a request: the price is the server's,
 * the gold check is the server's, and the item only appears once a
 * SHOP_PURCHASE comes back. Nothing on this screen decides anything.
 */

export interface Conversation {
  npcId: string;
  name: string;
  role: string;
  lines: string[];
  stock: readonly ShopEntry[];
  /** Where the speaker is standing, so the bubble can sit over them. */
  at?: { x: number; y: number };
}

/** The speech bubble over the speaker. */
const BUBBLE_W = 560;
/** The portrait window on the bubble's left. */
const FACE = 96;
/**
 * How `dialogue.plate` is sliced around its portrait window.
 *
 * Measured off the art at mid-height, not guessed. The plate is 188px wide:
 * its own border runs x 0-12, the portrait window's frame starts at 13, the
 * hole itself is 19-48, and the art is plain interior again from 54.
 *
 * So the left column stops at 13 -- keeping the border, which an earlier fix
 * lost by skipping the whole left end and leaving the bubble open down that
 * side -- and only the stretched middle starts past the hole at 54.
 */
const PLATE_WINDOW = { column: 13, stretchFrom: 54 } as const;

/**
 * Every face the sheet holds, so an NPC with no portrait falls back rather
 * than drawing a missing frame.
 *
 * The frame names are the NPC ids verbatim, which is the whole reason the
 * lookup is this short -- `smith_oren` the NPC is `smith_oren` the face.
 */
const FACES = new Set<string>([...SPEAKERS_FRAMES.a, ...SPEAKERS_FRAMES.b]);

function faceFor(npcId: string, role: string): string | null {
  if (FACES.has(npcId)) return npcId;
  if (FACES.has(role)) return role;
  return FACES.has('villager') ? 'villager' : null;
}
/** The shortest a bubble gets; a long line grows it downward from the top. */
const BUBBLE_MIN_H = 116;

/**
 * How tall an NPC is drawn, in world units.
 *
 * The conversation is anchored at the speaker's *feet* -- that is what the
 * snapshot carries -- so the bubble has to clear their whole height or it sits
 * on top of the person you are talking to. Measured against `villager` in
 * `propArt.ts`, with a little over for the taller ones.
 */
const SPEAKER_HEIGHT = 66;
/** Clear air between the top of their head and the bottom of the bubble. */
const HEAD_ROOM = 22;

/** The shop column. */
const SHOP_W = 620;
const ROW_H = 92;
const PAD = 34;

export class DialogueScreen {
  #bubble!: Phaser.GameObjects.Container;
  #shop!: Phaser.GameObjects.Container;
  #rows: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];
  #conversation: Conversation | null = null;
  #line = 0;
  /** The bubble's current height, which grows with the line being spoken. */
  #bubbleH = BUBBLE_MIN_H;
  #gold = 0;
  #owned = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] { return this.#texts; }
  get open(): boolean { return this.#bubble?.visible ?? false; }

  /** The band of screen the speech bubble occupies, or null when closed. */
  get bubbleBand(): { top: number; bottom: number } | null {
    if (!this.open) return null;
    return {
      top: this.#bubble.y - this.#bubbleH / 2 - 28,   // the name tab sits above
      bottom: this.#bubble.y + this.#bubbleH / 2,
    };
  }

  build(): void {
    // Two roots. The bubble is moved every frame to sit over the speaker; the
    // shop is pinned to a side of the screen and does not move, because a
    // price list that drifts with the camera is a price list you cannot click.
    this.#bubble = this.scene.add.container(0, 0).setVisible(false);
    this.#shop = this.scene.add.container(0, 0).setVisible(false);
  }

  /** Show a conversation. `gold` and `owned` come from the player's inventory. */
  show(conversation: Conversation, gold: number, owned: Iterable<string>): void {
    this.#conversation = conversation;
    this.#line = 0;
    this.#gold = gold;
    this.#owned = new Set(owned);
    this.#bubble.setVisible(true);
    this.#shop.setVisible(conversation.stock.length > 0);
    this.#render();
    this.step();
  }

  /** Where the speaker is now, so the bubble keeps up if they turn or drift. */
  moveSpeaker(at: { x: number; y: number }): void {
    if (this.#conversation) this.#conversation = { ...this.#conversation, at };
  }

  /** Refresh prices and ownership after a purchase, without losing the line. */
  refresh(gold: number, owned: Iterable<string>): void {
    if (!this.#conversation) return;
    this.#gold = gold;
    this.#owned = new Set(owned);
    this.#render();
  }

  /**
   * Follow the speaker. Called every frame by the HUD scene.
   *
   * Clamped inside the viewport so a speaker at the edge of the screen still
   * has a readable bubble rather than half of one off the side.
   */
  step(): void {
    const at = this.#conversation?.at;
    if (!this.open || !at) return;
    const w = VIEW.width * RENDER_SCALE;
    const h = VIEW.height * RENDER_SCALE;
    const cam = this.scene.scene.get('play')?.cameras?.main;
    const zoom = cam?.zoom ?? RENDER_SCALE;
    const p = this.#toScreen(at.x, at.y);

    // Lifted by the speaker's own drawn height, so the bubble's *bottom* edge
    // clears the top of their head. A fixed lift put a 128-tall bubble halfway
    // down whoever was talking, which hid the one thing worth looking at.
    const lift = SPEAKER_HEIGHT * zoom + HEAD_ROOM + this.#bubbleH / 2;
    const halfW = BUBBLE_W / 2 + 20;
    this.#bubble.setPosition(
      Math.min(Math.max(p.x, halfW), w - halfW),
      Math.min(Math.max(p.y - lift, this.#bubbleH / 2 + 24), h - this.#bubbleH),
    );
    // The shop takes the side the speaker is not on.
    const rightSide = p.x < w / 2;
    this.#shop.setX(rightSide ? w - SHOP_W / 2 - 30 : SHOP_W / 2 + 30);
  }

  /** World point to HUD point, through the play camera. See `InteractPrompt`. */
  #toScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.scene.scene.get('play')?.cameras?.main;
    if (!cam) return { x, y };
    const view = cam.worldView;
    return { x: (x - view.x) * cam.zoom, y: (y - view.y) * cam.zoom };
  }

  #text(parent: Phaser.GameObjects.Container, x: number, y: number, value: string,
        size: number, colour: string, originX = 0.5) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(originX, 0.5);
    this.#texts.push(t);
    parent.add(t);
    this.#rows.push(t);
    return t;
  }

  #add<T extends Phaser.GameObjects.GameObject>(parent: Phaser.GameObjects.Container, object: T): T {
    parent.add(object);
    this.#rows.push(object);
    return object;
  }

  #render(): void {
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#texts = this.#texts.filter((t) => t.scene);

    const talk = this.#conversation;
    if (!talk) return;
    this.#renderBubble(talk);
    if (talk.stock.length) this.#renderShop(talk);
  }

  #renderBubble(talk: Conversation): void {
    const half = BUBBLE_W / 2;
    const face = faceFor(talk.npcId, talk.role);
    // The ring is wider than the window it frames, so the text has to start
    // clear of *the ring*, not of the portrait. Sizing the text off the window
    // put the frame's right edge over the first letter of every line.
    const faceX = -half + FACE / 2 + 20;
    const ringW = FACE + 18;
    const textLeft = face ? faceX + ringW / 2 + 22 : -half + 28;
    const textWrap = half - textLeft - 30;

    // Measured before anything is sized. The speech decides how tall the plate
    // has to be, and the name decides how wide its tab is -- guessing at either
    // is what clipped "Siv the Apothecary" in half and cut long lines off the
    // bottom of the bubble. By the time a conversation opens the pixel font has
    // long since loaded, so these measurements are real.
    const line = talk.lines[Math.min(this.#line, talk.lines.length - 1)] ?? '';
    const speech = this.scene.add
      .text(textLeft, 0, line, {
        fontFamily: PIXEL_FONT.stack, fontSize: '21px', color: HUD.ink,
        wordWrap: { width: textWrap },
      })
      .setOrigin(0, 0.5);
    const nameText = this.scene.add
      .text(0, 0, talk.name.toUpperCase(), {
        fontFamily: PIXEL_FONT.stack, fontSize: '20px', color: HUD.activeInk,
      })
      .setOrigin(0.5, 0.5);

    const h = Math.max(BUBBLE_MIN_H, speech.height + 54, face ? FACE + 26 : 0);
    this.#bubbleH = h;

    // Sliced around the plate's own portrait window: the hole would otherwise
    // land in the stretched middle column and smear a transparent band right
    // across the bubble, while slicing past it entirely costs the left border.
    const plate = this.#add(this.#bubble, this.scene.add.image(0, 0,
      controlArt(this.scene, DIALOGUE_TEXTURE_KEY, 'plate', BUBBLE_W, Math.round(h), 22, PLATE_WINDOW)));
    plate.setOrigin(0.5, 0.5);

    if (face) {
      // An opaque backing first. `speakerFrame` is a window with a hole in it,
      // and a portrait smaller than the hole left the world showing through --
      // which is the transparent patch in the middle of the bubble.
      const backing = this.#add(this.#bubble,
        this.scene.add.rectangle(faceX, 0, FACE - 10, FACE - 10, HUD.frameFill, 1));
      backing.setOrigin(0.5, 0.5);
      const portrait = this.#add(this.#bubble,
        this.scene.add.image(faceX, 0, SPEAKERS_TEXTURE_KEY, face));
      // Sized to *cover* the window rather than fit inside it, so no part of
      // the backing shows around a portrait that is taller than it is wide.
      const frame = portrait.frame;
      portrait.setScale((FACE - 10) / Math.min(frame.width, frame.height));
      // Cropped back to the window it sits in, or a tall portrait spills out.
      portrait.setCrop(
        (frame.width - Math.min(frame.width, frame.height)) / 2,
        (frame.height - Math.min(frame.width, frame.height)) / 2,
        Math.min(frame.width, frame.height),
        Math.min(frame.width, frame.height),
      );
      const ring = this.#add(this.#bubble,
        this.scene.add.image(faceX, 0, DIALOGUE_TEXTURE_KEY, 'speakerFrame'));
      // By width, not `fitInside`: the frame's art is wider than it is tall, so
      // fitting it in a square box made it 142 wide against a 96 window -- over
      // the text on one side and past the plate's own edge on the other.
      fitWidth(ring, ringW);
    }

    // The tab, sized to the name it carries and sat on the plate's top edge.
    const tabW = Math.round(nameText.width + 46);
    const tabX = textLeft + tabW / 2;
    const tab = this.#add(this.#bubble, this.scene.add.image(tabX, -h / 2,
      controlArt(this.scene, DIALOGUE_TEXTURE_KEY, 'nameTab', tabW, 46, 12)));
    tab.setOrigin(0.5, 0.5);
    nameText.setPosition(tabX, -h / 2 - 2);
    this.#bubble.add(nameText);
    this.#rows.push(nameText);
    this.#texts.push(nameText);

    speech.setY(6);
    this.#bubble.add(speech);
    this.#rows.push(speech);
    this.#texts.push(speech);

    const atEnd = this.#line >= talk.lines.length - 1;
    if (!atEnd) {
      const chevron = this.#add(this.#bubble,
        this.scene.add.image(half - 26, h / 2 - 20, DIALOGUE_TEXTURE_KEY, 'chevron'));
      fitInside(chevron, 22);
      this.scene.tweens.add({ targets: chevron, y: chevron.y + 5, duration: 620, yoyo: true, repeat: -1 });
    }
    // The whole bubble advances the line, which is how a speech box is expected
    // to behave; at the last line it closes instead, so one control does both.
    plate.setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        if (atEnd) this.close();
        else {
          this.#line += 1;
          this.#render();
        }
      });
  }

  #renderShop(talk: Conversation): void {
    const stock = talk.stock;
    const h = VIEW.height * RENDER_SCALE;
    const totalH = stock.length * ROW_H + 96;
    // Below the minimap and above the hotbar: the two pieces of chrome that
    // own the corners this column runs between.
    const top = h * 0.2;
    const bottom = h * 0.88;
    this.#shop.setY(Math.min(Math.max(top + totalH / 2, h * 0.5), bottom - totalH / 2));
    const originY = -totalH / 2;
    const left = -SHOP_W / 2 + PAD;
    const right = SHOP_W / 2 - PAD;

    this.#text(this.#shop, left, originY + 22, 'FOR SALE', 20, HUD.activeInk, 0);
    // Fixed positions rather than measured ones: `Text.width` is read before
    // the pixel font has loaded, so a layout solved from it puts the coin on
    // top of the number it is supposed to sit beside.
    const purse = this.#add(this.#shop,
      this.scene.add.image(right - 132, originY + 22, ITEMS_TEXTURE_KEY, 'essence'));
    fitInside(purse, 22);
    this.#text(this.#shop, right - 112, originY + 22, `${this.#gold} GOLD`, 20, HUD.ink, 0);

    stock.forEach((entry, i) => this.#stockRow(entry, left, right, originY + 74 + i * ROW_H));
    this.#button(this.#shop, 0, originY + totalH - 14, 'LEAVE  ESC', 200, () => this.close());
  }

  #stockRow(entry: ShopEntry, left: number, right: number, y: number): void {
    const already = this.#owned.has(entry.itemId);
    const afford = this.#gold >= entry.price;

    const row = this.#add(this.#shop, this.scene.add.image(0, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', right - left, ROW_H - 14)));
    row.setOrigin(0.5, 0.5).setAlpha(0.7);

    // A weapon shows the mark its family casts; everything else is its own item.
    const mark = weaponIcon(weaponSheetFor(entry.itemId) ?? 'sword');
    const icon = this.#add(this.#shop, entry.kind === 'weapon'
      ? this.scene.add.image(left + 36, y, mark.texture, mark.frame)
      : this.scene.add.image(left + 36, y, ITEMS_TEXTURE_KEY, entry.itemId));
    fitInside(icon, 38);

    this.#text(this.#shop, left + 74, y - 14, entry.name.toUpperCase(), 20, already ? HUD.dimInk : HUD.ink, 0);
    const desc = this.#text(this.#shop, left + 74, y + 13, entry.description, 15, HUD.dimInk, 0);
    desc.setWordWrapWidth(right - left - 250, true);

    const label = already ? 'OWNED' : `${entry.price} GOLD`;
    const tone = already ? HUD.dimInk : afford ? HUD.ink : '#c46a7a';
    if (already || !afford) {
      const plate = this.#add(this.#shop, this.scene.add.image(right - 78, y,
        controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', 150, 46)));
      plate.setOrigin(0.5, 0.5).setAlpha(0.4);
      this.#text(this.#shop, right - 78, y, label, 19, tone);
      return;
    }
    this.#button(this.#shop, right - 78, y, label, 150,
      () => eventBus.emit('ui:command', {
        type: 'COMMAND', action: 'BUY_ITEM', npcId: this.#conversation!.npcId, itemId: entry.itemId,
      }));
  }

  #button(parent: Phaser.GameObjects.Container, x: number, y: number, caption: string,
          width: number, onPress: () => void): void {
    const image = this.#add(parent, this.scene.add.image(x, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', width, 46)));
    image.setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        onPress();
      });
    this.#text(parent, x, y, caption, 19, HUD.ink);
  }

  /**
   * Put it away.
   *
   * Deliberately has no Escape listener of its own. `useHotkeys` already owns
   * Escape and routes it per open screen; a second listener here closed the
   * conversation first, and the real handler then saw nothing open and asked
   * the server to pause -- which is the pause screen flashing for a frame on
   * the way out of every conversation.
   */
  close(notify = true): void {
    const wasOpen = this.open;
    this.#bubble?.setVisible(false);
    this.#shop?.setVisible(false);
    this.#conversation = null;
    // Escape is `useHotkeys`'s alone -- see the note on `close`.
    if (wasOpen && notify) eventBus.emit('ui:screen-close', { screen: 'dialogue' });
  }

  destroy(): void {
    this.close(false);
    for (const o of this.#rows) o.destroy();
    this.#rows = [];
    this.#bubble?.destroy();
    this.#shop?.destroy();
    this.#texts = [];
  }
}
