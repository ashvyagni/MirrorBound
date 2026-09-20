import type Phaser from 'phaser';

import { DIALOGUE_TEXTURE_KEY } from '../animation/dialogueAtlas.generated';
import { HUD, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { keybinds, keyName } from '../state/Keybinds';
import { artHeight, fitWidth } from './fit';

/**
 * "Space — health potion", floating over whatever you are standing next to.
 *
 * It lives in the HUD scene, not the play scene, so it is drawn at interface
 * scale rather than world scale: a label that shrank when you zoomed out would
 * be a label you could not read at exactly the moment you had zoomed out to
 * see more of the room.
 *
 * That means the world position has to be converted, which is what
 * `#toScreen` does. The play camera is zoomed by `RENDER_SCALE` times the
 * player's own zoom, and scrolls; the HUD camera does neither.
 *
 * The key shown is read from the binding table, so rebinding Interact changes
 * the prompt with it. A prompt that says a key the game no longer listens to
 * is worse than no prompt.
 */
/** How much of the bubble's drawn height is the tail under its body. */
const TAIL = 0.22;

/**
 * How tall the thing being pointed at is, in world units.
 *
 * A target is anchored at its *base* -- an NPC's feet, a pickup's resting spot
 * -- so the prompt has to clear the whole thing or it sits on the face of
 * whoever you are about to talk to. Measured against the tallest of them, the
 * villagers; floating a little high over a potion costs nothing, and a prompt
 * over someone's head costs you the sight of them.
 */
const TARGET_HEIGHT = 68;
/** Clear air between the top of the target and the bottom of the bubble. */
const HEAD_ROOM = 12;

export class InteractPrompt {
  #plate!: Phaser.GameObjects.Image;
  #cap!: Phaser.GameObjects.Text;
  #label!: Phaser.GameObjects.Text;
  #group!: Phaser.GameObjects.Container;
  #texts: Phaser.GameObjects.Text[] = [];
  #target: { label: string; x: number; y: number; action?: 'walk' | 'collect' } | null = null;
  /** True while a conversation owns the space over the target's head. */
  #suppressed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  build(): void {
    this.#group = this.scene.add.container(0, 0).setVisible(false);

    // The bubble, not a plain button: it has a tail, so it reads as a thing
    // said by whatever is under it rather than a label that happens to be
    // nearby. `#lift` raises it by enough that the tail lands on the target.
    this.#plate = this.scene.add.image(0, 0, DIALOGUE_TEXTURE_KEY, 'prompt');
    this.#group.add(this.#plate);

    this.#cap = this.#text(0, 0, '', HUD.hintSize - 1, HUD.activeInk);
    this.#label = this.#text(0, 0, '', HUD.hintSize - 1, HUD.ink);
    this.#group.add(this.#cap);
    this.#group.add(this.#label);
  }

  #text(x: number, y: number, value: string, size: number, colour: string) {
    const t = this.scene.add
      .text(x, y, value, { fontFamily: PIXEL_FONT.stack, fontSize: `${size}px`, color: colour })
      .setOrigin(0, 0.5);
    this.#texts.push(t);
    return t;
  }

  set(target: { label: string; x: number; y: number; action?: 'walk' | 'collect' } | null): void {
    this.#target = target;
    if (!target || this.#suppressed) {
      this.#group.setVisible(false);
      return;
    }

    const key = keyName(keybinds.get('interact').primary);
    this.#cap.setText(target.action === 'walk' ? 'WALK INTO' : target.action === 'collect' ? 'WALK OVER' : key.toUpperCase());
    this.#label.setText(target.label.toUpperCase());

    // Laid out from the two texts' measured widths, so a short key and a long
    // item name both come out centred in a plate that fits them.
    const gap = 14;
    const pad = 30;
    const inner = this.#cap.width + gap + this.#label.width;
    fitWidth(this.#plate, inner + pad * 2);

    // The words sit in the bubble's body, which is the frame minus its tail.
    // Centring them on the whole frame would push them down into the point.
    const body = -artHeight(this.#plate) * TAIL * 0.5;
    this.#cap.setPosition(-inner / 2, body);
    this.#label.setPosition(-inner / 2 + this.#cap.width + gap, body);

    this.#group.setVisible(true);
  }

  /**
   * Stop offering to talk to someone you are already talking to.
   *
   * The speech bubble takes the space over their head, so leaving this up puts
   * two plates on one person -- and the offer is moot once it has been taken.
   */
  setSuppressed(suppressed: boolean): void {
    this.#suppressed = suppressed;
    if (suppressed) this.#group.setVisible(false);
    else if (this.#target) this.set(this.#target);
  }

  /** Follow the target. Called every frame the prompt is up. */
  step(): void {
    if (!this.#target || this.#suppressed) return;
    const cam = this.scene.scene.get('play')?.cameras?.main;
    const zoom = cam?.zoom ?? RENDER_SCALE;
    const p = this.#toScreen(this.#target.x, this.#target.y);
    const lift = TARGET_HEIGHT * zoom + HEAD_ROOM + artHeight(this.#plate) / 2;
    this.#group.setPosition(p.x, p.y - lift);
    // Hidden rather than clamped when it leaves the view: a prompt pinned to
    // the edge points at something you cannot see.
    this.#group.setVisible(
      p.x > 0 && p.x < VIEW.width * RENDER_SCALE && p.y > 0 && p.y < VIEW.height * RENDER_SCALE,
    );
  }

  /**
   * World point to HUD point, through the play camera.
   *
   * Measured from `worldView`, not from `scrollX`. A Phaser camera zooms about
   * its own midpoint, so `scroll` is where the camera would start if it were
   * not zoomed and `worldView` is the rectangle of world it can actually see.
   * The two are the same only at zoom 1, and this camera runs at
   * `RENDER_SCALE` -- at zoom 2 on a 1920x1080 canvas they differ by exactly
   * (960, 540), which put the prompt in the bottom-right corner of the screen
   * and flickered it in and out as the visibility check tripped.
   */
  #toScreen(x: number, y: number): { x: number; y: number } {
    const cam = this.scene.scene.get('play')?.cameras?.main;
    if (!cam) return { x, y };
    const view = cam.worldView;
    return {
      x: (x - view.x) * cam.zoom,
      y: (y - view.y) * cam.zoom,
    };
  }

  destroy(): void {
    this.#group?.destroy();
    this.#texts = [];
  }
}
