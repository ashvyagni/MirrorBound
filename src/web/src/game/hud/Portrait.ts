import Phaser from 'phaser';

import { GOAT_FRAMES, GOAT_TEXTURE_KEY } from '../animation/goatAtlas.generated';
import { PORTRAITRING_TEXTURE_KEY } from '../animation/portraitRingAtlas.generated';
import { STATUSBARS_TEXTURE_KEY } from '../animation/statusBarsAtlas.generated';
import { HUD_ART, PALETTE } from '../constants';
import type { VitalsSnapshot } from '../state/Vitals';
import { fitWidth } from './fit';

/** One trough: the art, the fill inside it, and the pale edge chasing it. */
interface Bar {
  fill: Phaser.GameObjects.Rectangle;
  chase: Phaser.GameObjects.Rectangle;
  left: number;
  width: number;
  /** Where the fill is heading, 0..1, and where its trailing edge still is. */
  target: number;
  trail: number;
}

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

  #buildBar(x: number, y: number, frame: 'hp' | 'mp'): Bar {
    const { bars } = HUD_ART;
    // The troughs share a shape, so one frame's aspect is every frame's.
    const probe = this.scene.textures.get(STATUSBARS_TEXTURE_KEY).get(frame);
    const height = bars.width * (probe.height / probe.width);

    // The fill sits inside the trough drawn on the art, so its box is the
    // piece's box pulled in by where the art's own walls are. Measured as
    // fractions in `HUD_ART.bars.inset`, so redrawing the trough at a
    // different size does not move the fill off it.
    const left = x + bars.width * bars.inset.left;
    const width = bars.width * (1 - bars.inset.left - bars.inset.right);
    const inner = height * (1 - bars.inset.top - bars.inset.bottom);
    const colour = frame === 'hp' ? PALETTE.magenta : PALETTE.ice;

    // Chase first: it is the pale edge left behind by a change, and it has to
    // sit under the fill so a gain covers it rather than the other way round.
    const chase = this.scene.add
      .rectangle(left, y, width, inner, PALETTE.cream, 0.5)
      .setOrigin(0, 0.5);
    const fill = this.scene.add
      .rectangle(left, y, width, inner, colour, 1)
      .setOrigin(0, 0.5);
    const art = this.scene.add
      .image(x, y, STATUSBARS_TEXTURE_KEY, frame)
      .setOrigin(0, 0.5);
    fitWidth(art, bars.width);

    this.#objects.push(chase, fill, art);
    return { fill, chase, left, width, target: 1, trail: 1 };
  }

  /** Point the bars at new values. They travel there over the next few frames. */
  set(vitals: VitalsSnapshot): void {
    const ratios = [
      vitals.maxHealth > 0 ? vitals.health / vitals.maxHealth : 0,
      vitals.maxMana > 0 ? vitals.mana / vitals.maxMana : 0,
    ];
    this.#bars.forEach((bar, i) => { bar.target = Phaser.Math.Clamp(ratios[i]!, 0, 1); });
  }

  step(deltaSeconds: number): void {
    this.#stepFace(deltaSeconds);

    for (const bar of this.#bars) {
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
  }
}
