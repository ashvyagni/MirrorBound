import Phaser from 'phaser';

import { GOAT_FRAMES, GOAT_TEXTURE_KEY } from '../animation/goatAtlas.generated';
import { PORTRAITRING_TEXTURE_KEY } from '../animation/portraitRingAtlas.generated';
import { STATUSBARS_TEXTURE_KEY } from '../animation/statusBarsAtlas.generated';
import { VITALS_TEXTURE_KEY } from '../animation/vitalsAtlas.generated';
import { HUD, HUD_ART, PALETTE, PIXEL_FONT } from '../constants';
import type { VitalsSnapshot } from '../state/Vitals';
import { fitWidth } from './fit';

/** One trough: the art, the fill inside it, and the pale edge chasing it. */
interface Bar {
  fill: Phaser.GameObjects.Rectangle;
  chase: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Image;
  left: number;
  width: number;
  /** Where the fill is heading, 0..1, and where its trailing edge still is. */
  target: number;
  trail: number;
}

/** Everything `#buildBar` needs to know that differs between the two sheets. */
type BarFrame = 'hp' | 'mp' | 'twinHealth' | 'twinMana' | 'levelTrough';

/**
 * Which sheet each trough comes from, and which way round it is composited.
 *
 * The player's own two are drawn with a transparent window, so the fill sits
 * *behind* the art and shows through it. Sheet 92's three came back with their
 * interiors painted in, so the same arrangement would hide the fill entirely --
 * they are drawn art-first with the fill laid over the top, which also lets the
 * level bar's ten dividers read as darker lines across the filled part rather
 * than disappearing under it.
 */
const BAR_ART: Record<BarFrame, { texture: string; fillOver: boolean }> = {
  hp: { texture: STATUSBARS_TEXTURE_KEY, fillOver: false },
  mp: { texture: STATUSBARS_TEXTURE_KEY, fillOver: false },
  twinHealth: { texture: VITALS_TEXTURE_KEY, fillOver: true },
  twinMana: { texture: VITALS_TEXTURE_KEY, fillOver: true },
  levelTrough: { texture: VITALS_TEXTURE_KEY, fillOver: true },
};

/** The colour each trough fills with. */
const BAR_TINT: Record<BarFrame, number> = {
  hp: PALETTE.magenta,
  mp: PALETTE.ice,
  twinHealth: PALETTE.magenta,
  twinMana: PALETTE.ice,
  // The level bar takes the interface's own accent rather than a vital's
  // colour: it is not a resource, and reading it should not mean checking
  // which of the two above it is not.
  levelTrough: PALETTE.arcane,
};

/**
 * The goat's face in its ring, with health and mana beside it.
 *
 * The face is not new art. `GOAT_FRAMES.face` is ten expressions already on the
 * character sheet, and the ring was drawn open across the top so the head
 * breaks it -- which is why the portrait needed one piece generated rather than
 * two, and why the face here can never drift from the one in the wordmark.
 */
/**
 * How long the bars take to catch up to a new value, in seconds.
 *
 * The number is here rather than in `constants.ts` because it is a property of
 * this animation and nothing else reads it -- the server's numbers arrive
 * instantly and this is only how fast the drawn bar chases them.
 */
const CHASE_TIME = 0.18;

export class Portrait {
  #face!: Phaser.GameObjects.Sprite;
  #bars: Bar[] = [];
  /** The twin's pair, built once and hidden until there is a twin. */
  #twinBars: Bar[] = [];
  #twinArt: Phaser.GameObjects.GameObject[] = [];
  #level!: Bar;
  #levelText!: Phaser.GameObjects.Text;
  #texts: Phaser.GameObjects.Text[] = [];
  #expression = 0;
  #hold = 0;
  #objects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  build(): void {
    const { portrait, bars } = HUD_ART;

    // The ring first, and the head *over* it. Putting the head behind reads as
    // a face at the bottom of a hole: the ring's top arc is thinner precisely
    // so a crown can break it, and it can only break it from in front. The
    // horn clearing the rim on the upper right is the whole silhouette.
    const ring = this.scene.add
      .image(portrait.x, portrait.y, PORTRAITRING_TEXTURE_KEY, 'ring');
    fitWidth(ring, portrait.size);

    this.#face = this.scene.add.sprite(
      portrait.x + portrait.size * portrait.faceShiftX,
      portrait.y - portrait.size * portrait.faceLift,
      GOAT_TEXTURE_KEY,
      GOAT_FRAMES.face[0],
    );
    this.#fitFace();

    this.#objects.push(ring, this.#face);

    for (const [i, frame] of (['hp', 'mp'] as const).entries()) {
      this.#bars.push(this.#buildBar(bars.x, bars.y + i * bars.gap, frame));
    }
    this.#buildTwinBars();
    this.#buildLevel();
  }

  get texts(): readonly Phaser.GameObjects.Text[] { return this.#texts; }

  /**
   * The twin's health and mana, under the player's own.
   *
   * Built once and hidden, rather than created when the twin is found: the
   * twin comes and goes -- it is dormant before the crypt, taken at the
   * Sanctum's threshold, and downed in between -- and building art on each of
   * those is three chances to leak a sprite.
   */
  #buildTwinBars(): void {
    const { bars, twinBars } = HUD_ART;
    for (const [i, frame] of (['twinHealth', 'twinMana'] as const).entries()) {
      const x = bars.x + twinBars.indent;
      const y = bars.y + i * bars.gap + twinBars.drop;
      this.#twinBars.push(this.#buildBar(x, y, frame, twinBars.width));
    }
    const { bars: b, twinBars: t } = HUD_ART;
    const mark = this.scene.add
      .image(b.x + t.markX, b.y + t.drop, VITALS_TEXTURE_KEY, 'twinMark')
      .setOrigin(0, 0.5);
    fitWidth(mark, t.markSize);
    this.#objects.push(mark);
    this.#twinArt.push(mark);
    this.#showTwin(false);
  }

  /** The level bar and the plate its number sits in. */
  #buildLevel(): void {
    const { bars, level } = HUD_ART;
    this.#level = this.#buildBar(bars.x, level.y, 'levelTrough', level.width);

    const plate = this.scene.add
      .image(level.plateX, level.y, VITALS_TEXTURE_KEY, 'levelPlate')
      .setOrigin(0.5, 0.5);
    fitWidth(plate, level.plateSize);
    this.#levelText = this.scene.add
      .text(level.plateX, level.y - 2, '1', {
        fontFamily: PIXEL_FONT.stack, fontSize: `${HUD.labelSize}px`, color: HUD.ink,
      })
      .setOrigin(0.5, 0.5);
    this.#objects.push(plate, this.#levelText);
    this.#texts.push(this.#levelText);
  }

  #showTwin(on: boolean): void {
    for (const bar of this.#twinBars) {
      bar.fill.setVisible(on);
      bar.chase.setVisible(on);
      bar.art.setVisible(on);
    }
    for (const o of this.#twinArt) {
      (o as unknown as Partial<Phaser.GameObjects.Components.Visible>).setVisible?.(on);
    }
  }

  /**
   * Size the face to the ring's opening.
   *
   * Against the *union* of the ten expressions rather than the frame in hand:
   * they trim to different boxes, and fitting each to its own would resize the
   * head every time the expression changed. `AnimatedMark` solves the same
   * problem the same way for the same reason.
   */
  #fitFace(): void {
    const { portrait } = HUD_ART;
    const texture = this.scene.textures.get(GOAT_TEXTURE_KEY);
    let widest = 1;
    let tallest = 1;
    for (const name of GOAT_FRAMES.face) {
      const frame = texture.get(name);
      widest = Math.max(widest, frame.width);
      tallest = Math.max(tallest, frame.height);
    }
    const box = portrait.size * portrait.faceScale;
    this.#face.setScale(Math.min(box / widest, box / tallest));
  }

  #buildBar(x: number, y: number, frame: BarFrame, drawnWidth?: number): Bar {
    const { bars, twinBars, level } = HUD_ART;
    const art = BAR_ART[frame];
    const width = drawnWidth ?? bars.width;
    const inset = frame === 'levelTrough' ? level.inset
      : art.texture === VITALS_TEXTURE_KEY ? twinBars.inset
      : bars.inset;
    const probe = this.scene.textures.get(art.texture).get(frame);
    const height = width * (probe.height / probe.width);

    // The fill sits inside the trough drawn on the art, so its box is the
    // piece's box pulled in by where the art's own walls are. Measured as
    // fractions in `HUD_ART.bars.inset`, so redrawing the trough at a
    // different size does not move the fill off it.
    const left = x + width * inset.left;
    const span = width * (1 - inset.left - inset.right);
    const inner = height * (1 - inset.top - inset.bottom);
    const colour = BAR_TINT[frame];

    // Creation order is depth order in this scene, so "fill over" and "fill
    // behind" is simply which of the two is added first.
    const make = {
      chase: () => this.scene.add
        .rectangle(left, y, span, inner, PALETTE.cream, 0.5).setOrigin(0, 0.5),
      fill: () => this.scene.add
        .rectangle(left, y, span, inner, colour, 1).setOrigin(0, 0.5),
      art: () => {
        const image = this.scene.add.image(x, y, art.texture, frame).setOrigin(0, 0.5);
        fitWidth(image, width);
        return image;
      },
    };

    let chase: Phaser.GameObjects.Rectangle;
    let fill: Phaser.GameObjects.Rectangle;
    let image: Phaser.GameObjects.Image;
    if (art.fillOver) {
      image = make.art();
      chase = make.chase();
      fill = make.fill();
    } else {
      // Chase first: it is the pale edge left behind by a change, and it has to
      // sit under the fill so a gain covers it rather than the other way round.
      chase = make.chase();
      fill = make.fill();
      image = make.art();
    }

    this.#objects.push(chase, fill, image);
    return { fill, chase, art: image, left, width: span, target: 1, trail: 1 };
  }

  /** Point the bars at new values. They travel there over the next few frames. */
  set(vitals: VitalsSnapshot): void {
    const ratios = [
      vitals.maxHealth > 0 ? vitals.health / vitals.maxHealth : 0,
      vitals.maxMana > 0 ? vitals.mana / vitals.maxMana : 0,
    ];
    this.#bars.forEach((bar, i) => { bar.target = Phaser.Math.Clamp(ratios[i]!, 0, 1); });

    this.#level.target = Phaser.Math.Clamp(vitals.levelProgress, 0, 1);
    const level = String(Math.max(1, Math.round(vitals.level)));
    if (this.#levelText.text !== level) this.#levelText.setText(level);

    const twin = vitals.twin;
    this.#showTwin(twin !== null);
    if (twin) {
      const theirs = [
        twin.maxHealth > 0 ? twin.health / twin.maxHealth : 0,
        twin.maxMana > 0 ? twin.mana / twin.maxMana : 0,
      ];
      this.#twinBars.forEach((bar, i) => { bar.target = Phaser.Math.Clamp(theirs[i]!, 0, 1); });
    }
  }

  step(deltaSeconds: number): void {
    this.#stepFace(deltaSeconds);

    for (const bar of [...this.#bars, ...this.#twinBars, this.#level]) {
      // The fill snaps to the truth; only the pale edge lags. A fill that
      // lagged too would leave the bar disagreeing with the game about whether
      // there is any health left.
      bar.fill.width = bar.width * bar.target;

      if (bar.trail > bar.target) {
        const blend = 1 - Math.exp(-deltaSeconds / CHASE_TIME);
        bar.trail += (bar.target - bar.trail) * blend;
        if (bar.trail - bar.target < 0.002) bar.trail = bar.target;
      } else {
        bar.trail = bar.target;   // a gain has nothing to trail
      }
      bar.chase.width = bar.width * bar.trail;
      bar.chase.setVisible(bar.trail > bar.target + 0.001);
    }
  }

  /** Cycle the expression. Purely decorative, and deliberately slow. */
  #stepFace(deltaSeconds: number): void {
    this.#hold -= deltaSeconds;
    if (this.#hold > 0) return;
    this.#hold = HUD_ART.portrait.faceHold;
    this.#expression = (this.#expression + 1) % GOAT_FRAMES.face.length;
    this.#face.setFrame(GOAT_FRAMES.face[this.#expression]!);
  }

  /** Show a face that matches what just happened, until the cycle moves on. */
  react(frame: string): void {
    const index = GOAT_FRAMES.face.indexOf(frame as never);
    if (index === -1) return;
    this.#expression = index;
    this.#hold = HUD_ART.portrait.faceHold;
    this.#face.setFrame(frame);
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
    this.#bars = [];
    this.#twinBars = [];
    this.#twinArt = [];
    this.#texts = [];
  }
}
