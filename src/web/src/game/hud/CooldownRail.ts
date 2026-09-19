import Phaser from 'phaser';

import { COOLDOWNRAIL_TEXTURE_KEY } from '../animation/cooldownRailAtlas.generated';
import { ICONS_TEXTURE_KEY } from '../animation/iconsAtlas.generated';
import { slotInfo, type SlotId } from '../animation/weaponClips';
import { HUD, HUD_ART, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { fitInside, fitWidth } from './fit';
import { controlArt } from './controlArt';

/** One socket on the rail. Built once, shown only while something needs it. */
interface Socket {
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Sprite;
  sweep: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

type Recharging = Partial<Record<SlotId, { left: number; total: number }>>;

/**
 * What is recharging, stacked up the right-hand side.
 *
 * Only cooling abilities appear here. The hotbar already says what the weapon
 * can do; this rail answers the different question of what it cannot do *yet*,
 * and an entry that is always present answers neither.
 *
 * Sockets are built to capacity up front and hidden, rather than created as
 * cooldowns start. Three or four game objects churning several times a second
 * is how a HUD ends up rebuilding texture batches in the middle of a fight.
 */
export class CooldownRail {
  #sockets: Socket[] = [];
  #objects: Phaser.GameObjects.GameObject[] = [];
  #texts: Phaser.GameObjects.Text[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  get texts(): readonly Phaser.GameObjects.Text[] {
    return this.#texts;
  }

  /** Drawn size of a socket. Solved from the rail's own channel, so the two
   *  cannot disagree -- see `#socketSize`. */
  #size = 0;

  build(): void {
    const { rail } = HUD_ART;
    this.#size = rail.socket;
    this.#innerH = rail.socket * rail.opening.h;

    // Wide enough that the socket fills its channel: the channel is the gap
    // between the rail's two walls, measured off the art, and a rail sized
    // without reference to it is a rail whose sockets grow through its walls.
    const width = rail.socket / rail.socketFill / rail.channelRatio;
    // Size the rail to the sockets it actually carries. Preserve both caps
    // instead of vertically squashing the whole texture; keep its bottom fixed.
    const railHeight = Math.ceil(rail.socket * ((rail.capacity - 1) * rail.pitchRatio + 1.8));
    const canvasHeight = VIEW.height * RENDER_SCALE;
    const art = this.scene.add.image(rail.x, canvasHeight - rail.bottom - railHeight / 2,
      controlArt(this.scene, COOLDOWNRAIL_TEXTURE_KEY, 'rail', Math.round(width), railHeight, 32));
    this.#objects.push(art);

    // Stacked upward from the bottom of the rail, so a new cooldown pushes in
    // at the bottom and older ones sit above it -- the direction the eye
    // already travels from the hotbar.
    const bottom = art.y + railHeight / 2 - this.#size * 0.9;
    this.#sockets = Array.from({ length: rail.capacity }, (_, i) =>
      this.#buildSocket(rail.x, bottom - i * this.#size * rail.pitchRatio));
  }

  /** The opening's height, which bounds the sweep. Set once in `build`. */
  #innerH = 0;

  #buildSocket(x: number, y: number): Socket {
    const size = this.#size;
    const { opening, openingBottom } = HUD_ART.rail;
    // The hole in the middle of the socket art, which is what everything below
    // has to stay inside.
    const innerW = size * opening.w;
    const innerH = size * opening.h;
    const innerBottom = y + (openingBottom - 0.5) * size;

    // Grows downward as the timer runs out, so a socket empties from the top --
    // the direction that reads as filling back up. Same rule as the old bar.
    // Bounded by the opening, not the socket: sized to the socket it reaches
    // past the frame on every side.
    const sweep = this.scene.add
      .rectangle(x, innerBottom, innerW, 0, PALETTE.night, 0.72)
      .setOrigin(0.5, 1);
    const icon = this.scene.add.sprite(x, y - size * 0.06, ICONS_TEXTURE_KEY, 'fireBall');
    const frame = this.scene.add
      .image(x, y, COOLDOWNRAIL_TEXTURE_KEY, 'socket');
    fitWidth(frame, size);
    // Low in the opening, under the icon. Any lower and it crosses the frame;
    // the icon is nudged up by the same amount to keep them apart.
    const label = this.scene.add
      .text(x, y + innerH * 0.30, '', {
        fontFamily: PIXEL_FONT.stack,
        fontSize: `${HUD.hintSize}px`,
        color: HUD.ink,
      })
      .setOrigin(0.5, 0.5);

    const socket: Socket = { frame, icon, sweep, label };
    this.#texts.push(label);
    this.#objects.push(sweep, icon, frame, label);
    this.#hide(socket);
    return socket;
  }

  #hide(socket: Socket): void {
    socket.frame.setVisible(false);
    socket.icon.setVisible(false);
    socket.sweep.setVisible(false);
    socket.label.setVisible(false);
  }

  /**
   * Show whatever is recharging.
   *
   * Sorted by time remaining, soonest at the bottom, so the rail does not
   * reshuffle as timers pass each other -- an entry that jumps position while
   * you are watching it is worse than no entry at all.
   */
  set(recharging: Recharging): void {
    const entries = Object.entries(recharging)
      .filter((entry): entry is [string, { left: number; total: number }] => Boolean(entry[1]))
      .sort((a, b) => a[1].left - b[1].left)
      .slice(0, HUD_ART.rail.capacity);

    this.#sockets.forEach((socket, i) => {
      const entry = entries[i];
      if (!entry) {
        this.#hide(socket);
        return;
      }
      const [id, timer] = entry;
      const info = slotInfo(id as SlotId);

      socket.frame.setVisible(true);
      socket.icon.setVisible(true).setTexture(ICONS_TEXTURE_KEY, info.icon);
      fitInside(socket.icon, this.#size * 0.52);

      socket.sweep.setVisible(true);
      socket.sweep.height = this.#innerH * Phaser.Math.Clamp(timer.left / timer.total, 0, 1);

      socket.label.setVisible(true).setText(Math.max(timer.left, 0).toFixed(1));
    });
  }

  destroy(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
    this.#texts = [];
    this.#sockets = [];
  }
}
