import Phaser from 'phaser';

import { DIALOGUE_TEXTURE_KEY } from '../animation/dialogueAtlas.generated';
import { ITEMS_TEXTURE_KEY } from '../animation/itemsAtlas.generated';
import { SPEAKERS_FRAMES, SPEAKERS_TEXTURE_KEY } from '../animation/speakersAtlas.generated';
import { weaponIcon } from '../animation/abilityIcons';
import { weaponSheetFor } from '../animation/weaponClips';
import { CONTROLS_TEXTURE_KEY } from '../animation/controlsAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import type { AttributeSnap, ShopEntry, WeaponInfo } from '../contracts';
import type { Purse } from '../../ui/store';
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
/**
 * Who will sell you an attribute point.
 *
 * The same three `game/world/actions.py` accepts, and duplicated here rather
 * than sent because it decides whether a *section* is drawn at all -- a screen
 * that renders an empty heading and waits for the server to refuse every row in
 * it is worse than one that does not draw the heading.
 */
const TRAINER_ROLES = new Set(['weaponsmith', 'apothecary', 'elder']);

/**
 * What the smith says each ore does, in one line.
 *
 * Shortened from `materials.py`'s `forge_note`, which is the authoritative copy.
 * Duplicated rather than sent because it is fixed text about a fixed table and
 * threading eight strings through the wire to say what the ore list already
 * implies would be a contract change for a caption.
 */
const ORE_NOTE: Readonly<Record<string, string>> = {
  iron: 'Heavier. Hits harder, recovers slower.',
  gold: 'Conducts. Spells cost less.',
  silver: 'Answers. Sharper, and your twin reads it.',
  obsidian: 'Splits armour. Chips when it lands wrong.',
  mithril: 'Quick. Swings faster, pushes nothing.',
  diamond: 'Holds its edge. A telling blow tells for more.',
  adamantine: 'Immovable. Nothing knocks you out of a swing.',
};

/** Which weapon families each ore is wrong in. Mirrors `MaterialDef.spoils`. */
const ORE_SPOILS: Readonly<Record<string, readonly string[]>> = {
  gold: ['sword', 'pike'],
  obsidian: ['staff'],
};

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
  #purse: Purse = {
    gold: 0, shards: 0, essence: 0, owned: [], carried: [],
    equipped: '', materials: {}, stones: [], attributes: [], attributePoints: 0,
  };

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

  /** Show a conversation. The purse is the player's inventory, as prices. */
  show(conversation: Conversation, purse: Purse): void {
    this.#conversation = conversation;
    this.#line = 0;
    this.#setPurse(purse);
    this.#bubble.setVisible(true);
    // A smith has a panel even with nothing to sell: what you already carry
    // can still go on the bench.
    this.#shop.setVisible(conversation.stock.length > 0 || this.#isSmith(conversation));
    this.#render();
    this.step();
  }

  /** Where the speaker is now, so the bubble keeps up if they turn or drift. */
  moveSpeaker(at: { x: number; y: number }): void {
    if (this.#conversation) this.#conversation = { ...this.#conversation, at };
  }

  /** Refresh prices and ownership after a purchase, without losing the line. */
  refresh(purse: Purse): void {
    if (!this.#conversation) return;
    this.#setPurse(purse);
    this.#render();
  }

  #setPurse(purse: Purse): void {
    this.#purse = purse;
    this.#gold = purse.gold;
    this.#owned = new Set(purse.owned);
  }

  #isSmith(conversation: Conversation): boolean {
    return conversation.role === 'weaponsmith';
  }

  /** Who will teach you something, which is the same three the server accepts. */
  #isTrainer(conversation: Conversation): boolean {
    return TRAINER_ROLES.has(conversation.role);
  }

  /**
   * The weapon the forge is working on: the one in hand.
   *
   * The server will fit ore into any weapon you own, and the screen deliberately
   * offers only the equipped one. A weapon picker here would mean listing every
   * carried weapon against every carried ore, which is a grid; and "the smith
   * works on what you are holding" is both a shorter sentence and one the player
   * already has a way to answer, because what to carry is a decision the game
   * makes them make anyway.
   */
  #inHand(): WeaponInfo | undefined {
    if (!this.#conversation || !this.#isSmith(this.#conversation)) return undefined;
    return this.#purse.carried.find((w) => w.id === this.#purse.equipped);
  }

  /** Ore that could go into the weapon in hand, if it has room. */
  #fittable(): { id: string; count: number }[] {
    const weapon = this.#inHand();
    if (!weapon) return [];
    const free = (weapon.slots ?? 0) - (weapon.fitted?.length ?? 0);
    if (free <= 0) return [];
    return Object.entries(this.#purse.materials)
      .filter(([id, count]) => count > 0 && id !== 'coal')
      .map(([id, count]) => ({ id, count }));
  }

  /** What this smith can still work on: carried weapons below their last tier. */
  #benchable(): WeaponInfo[] {
    if (!this.#conversation || !this.#isSmith(this.#conversation)) return [];
    return this.#purse.carried.filter((w) => w.upgradeCost != null);
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
    const bench = this.#benchable();
    const forge = this.#fittable();
    const hand = this.#inHand();
    const socketable = hand?.hasSocket ? this.#purse.stones : [];
    const socketed = hand?.socketed ?? '';
    const training = this.#isTrainer(talk)
      ? this.#purse.attributes.filter((a) => a.points < a.max) : [];
    const h = VIEW.height * RENDER_SCALE;
    const sections = [bench.length, forge.length, socketable.length + (socketed ? 1 : 0),
                      training.length].filter((n) => n > 0).length;
    const totalH = (stock.length + bench.length + forge.length + training.length
                    + socketable.length + (socketed ? 1 : 0)) * ROW_H
      + 96 + sections * 44;
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

    let y = originY + 74;
    stock.forEach((entry) => {
      this.#stockRow(entry, left, right, y);
      y += ROW_H;
    });
    if (bench.length) {
      // §18's sink, where the resources are actually spent. Separated by a
      // heading rather than mixed into the stock: buying and upgrading are
      // different decisions and one price list for both reads as a muddle.
      y += 12;
      this.#text(this.#shop, left, y, 'ON THE BENCH', 20, HUD.activeInk, 0);
      this.#text(this.#shop, right, y,
        `${this.#purse.shards} SHARDS   ${this.#purse.essence} ESSENCE`, 16, HUD.dimInk, 1);
      y += 32;
      bench.forEach((weapon) => {
        this.#benchRow(weapon, left, right, y);
        y += ROW_H;
      });
    }
    if (forge.length && hand) {
      // The forge, and it says which weapon it is working on in the heading --
      // because it is working on the one in hand, and a player who has not
      // noticed that would otherwise put mithril in the wrong sword.
      y += 12;
      const used = hand.fitted?.length ?? 0;
      this.#text(this.#shop, left, y, `INTO YOUR ${hand.name.toUpperCase()}`, 20, HUD.activeInk, 0);
      this.#text(this.#shop, right, y, `${used}/${hand.slots ?? 0} SLOTS`, 16, HUD.dimInk, 1);
      y += 32;
      forge.forEach((ore) => {
        this.#forgeRow(ore.id, ore.count, hand, left, right, y);
        y += ROW_H;
      });
    }
    if (hand && (socketable.length || socketed)) {
      y += 12;
      this.#text(this.#shop, left, y, 'THE SOCKET', 20, HUD.activeInk, 0);
      y += 32;
      if (socketed) {
        this.#socketRow(socketed, hand, left, right, y, true);
        y += ROW_H;
      } else {
        socketable.forEach((stone) => {
          this.#socketRow(stone.id, hand, left, right, y, false, stone.name, stone.socketNote);
          y += ROW_H;
        });
      }
    }
    if (training.length) {
      y += 12;
      this.#text(this.#shop, left, y, 'WHAT YOU CAN BE TAUGHT', 20, HUD.activeInk, 0);
      this.#text(this.#shop, right, y,
        this.#purse.attributePoints > 0
          ? `${this.#purse.attributePoints} UNSPENT — OPEN SKILLS`
          : 'PAID FOR IN ORE', 16, HUD.dimInk, 1);
      y += 32;
      training.forEach((attribute) => {
        this.#trainRow(attribute, left, right, y);
        y += ROW_H;
      });
    }
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

  /**
   * One carried weapon, and what the next tier on it costs.
   *
   * The cost is spelled out in all three currencies rather than reduced to a
   * gold figure: an upgrade you cannot afford should say *which* of the three
   * you are short of, and shards and essence are the two the player has been
   * picking up for hours without a use for.
   */
  #benchRow(weapon: WeaponInfo, left: number, right: number, y: number): void {
    const cost = weapon.upgradeCost!;
    const tier = weapon.tier ?? 0;
    const afford = this.#gold >= cost.gold
      && this.#purse.shards >= cost.shards
      && this.#purse.essence >= cost.essence;

    const row = this.#add(this.#shop, this.scene.add.image(0, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', right - left, ROW_H - 14)));
    row.setOrigin(0.5, 0.5).setAlpha(0.7);

    const mark = weaponIcon(weaponSheetFor(weapon.id) ?? 'sword');
    const icon = this.#add(this.#shop, this.scene.add.image(left + 36, y, mark.texture, mark.frame));
    fitInside(icon, 38);

    // Tier as pips, because "II of III" is a thing to parse and three marks is
    // a thing to glance at.
    const pips = '\u25cf'.repeat(tier) + '\u25cb'.repeat(3 - tier);
    this.#text(this.#shop, left + 74, y - 14,
      `${weapon.name.toUpperCase()}  ${pips}`, 20, HUD.ink, 0);
    // The last tier is the one worth knowing about in advance: it is what
    // turns the weapon into something else rather than a bigger number.
    const next = tier === 2 ? `UNLOCKS ${weapon.perkName.toUpperCase()}` : 'SHARPER';
    this.#text(this.#shop, left + 74, y + 13, next, 15, HUD.dimInk, 0);

    const price = [`${cost.gold}G`,
                   cost.shards ? `${cost.shards} SHARD` : '',
                   cost.essence ? `${cost.essence} ESS` : ''].filter(Boolean).join(' ');
    if (!afford) {
      const plate = this.#add(this.#shop, this.scene.add.image(right - 94, y,
        controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', 182, 46)));
      plate.setOrigin(0.5, 0.5).setAlpha(0.4);
      this.#text(this.#shop, right - 94, y, price, 16, '#c46a7a');
      return;
    }
    this.#button(this.#shop, right - 94, y, price, 182,
      () => eventBus.emit('ui:command', {
        type: 'COMMAND', action: 'UPGRADE_WEAPON',
        npcId: this.#conversation!.npcId, weaponId: weapon.id,
      }));
  }

  /** One ore, and what fitting it into the weapon in hand would do. */
  #forgeRow(material: string, count: number, weapon: WeaponInfo,
            left: number, right: number, y: number): void {
    const row = this.#add(this.#shop, this.scene.add.image(0, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', right - left, ROW_H - 14)));
    row.setOrigin(0.5, 0.5).setAlpha(0.7);

    const note = ORE_NOTE[material] ?? 'Changes how it behaves.';
    const wrong = (ORE_SPOILS[material] ?? []).includes(weapon.family);
    this.#text(this.#shop, left + 16, y - 14,
      `${material.toUpperCase()}  ×${count}`, 20, wrong ? '#c46a7a' : HUD.ink, 0);
    this.#text(this.#shop, left + 16, y + 13,
      wrong ? `WRONG METAL FOR A ${weapon.family.toUpperCase()}` : note.toUpperCase(),
      15, HUD.dimInk, 0);

    this.#button(this.#shop, right - 78, y, 'WORK IT', 150,
      () => eventBus.emit('ui:command', {
        type: 'COMMAND', action: 'FIT_MATERIAL', npcId: this.#conversation!.npcId,
        weaponId: weapon.id, materialId: material,
      }));
  }

  /** The one socket a finished weapon has: what is in it, or what could be. */
  #socketRow(stone: string, weapon: WeaponInfo, left: number, right: number, y: number,
             filled: boolean, name = '', note = ''): void {
    const row = this.#add(this.#shop, this.scene.add.image(0, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', right - left, ROW_H - 14)));
    row.setOrigin(0.5, 0.5).setAlpha(0.7);

    this.#text(this.#shop, left + 16, y - 14,
      (name || stone).replace(/_/g, ' ').toUpperCase(), 20, HUD.ink, 0);
    this.#text(this.#shop, left + 16, y + 13,
      filled ? 'COMES BACK OUT WHOLE — UNLIKE ORE' : note.toUpperCase(), 15, HUD.dimInk, 0);

    this.#button(this.#shop, right - 78, y, filled ? 'TAKE OUT' : 'SET IT', 150,
      () => eventBus.emit('ui:command', {
        type: 'COMMAND',
        action: filled ? 'UNSOCKET_STONE' : 'SOCKET_STONE',
        npcId: this.#conversation!.npcId, weaponId: weapon.id,
        ...(filled ? {} : { stoneId: stone }),
      }));
  }

  /**
   * One attribute, and the ore the next point in it costs.
   *
   * The point is bought here and *placed* on the skill screen, which is two
   * steps on purpose: the price depends on where the attribute already is, so
   * collapsing them would mean paying a Vigour price for a point you then put
   * into Focus.
   */
  #trainRow(attribute: AttributeSnap, left: number, right: number, y: number): void {
    const cost = Object.entries(attribute.trainCost);
    const afford = cost.every(([ore, n]) => (this.#purse.materials[ore] ?? 0) >= Number(n));

    const row = this.#add(this.#shop, this.scene.add.image(0, y,
      controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', right - left, ROW_H - 14)));
    row.setOrigin(0.5, 0.5).setAlpha(0.7);

    this.#text(this.#shop, left + 16, y - 14,
      `${attribute.name.toUpperCase()}  ${attribute.points}`, 20, HUD.ink, 0);
    this.#text(this.#shop, left + 16, y + 13,
      `OPENS ${attribute.branch}`, 15, HUD.dimInk, 0);

    const price = cost.map(([ore, n]) => `${Number(n)} ${ore.toUpperCase()}`).join(' + ');
    if (!afford) {
      const plate = this.#add(this.#shop, this.scene.add.image(right - 78, y,
        controlArt(this.scene, CONTROLS_TEXTURE_KEY, 'button', 200, 46)));
      plate.setOrigin(0.5, 0.5).setAlpha(0.4);
      this.#text(this.#shop, right - 78, y, price, 15, '#c46a7a');
      return;
    }
    this.#button(this.#shop, right - 78, y, price, 200,
      () => eventBus.emit('ui:command', {
        type: 'COMMAND', action: 'TRAIN_ATTRIBUTE',
        npcId: this.#conversation!.npcId, attributeId: attribute.id,
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
