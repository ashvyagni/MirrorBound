import Phaser from 'phaser';

import { COOLDOWNRAIL_TEXTURE_KEY } from '../animation/cooldownRailAtlas.generated';
import { ICONS_TEXTURE_KEY } from '../animation/iconsAtlas.generated';
import { slotInfo, type SlotId } from '../animation/weaponClips';
import { HUD, HUD_ART, PALETTE, PIXEL_FONT, RENDER_SCALE, VIEW } from '../constants';
import { artHeight, fitInside, fitWidth } from './fit';

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

    // Wide enough that the socket fills its channel: the channel is the gap
    // between the rail's two walls, measured off the art, and a rail sized
    // without reference to it is a rail whose sockets grow through its walls.
    const width = rail.socket / rail.socketFill / rail.channelRatio;
    const art = this.scene.add.image(rail.x, 0, COOLDOWNRAIL_TEXTURE_KEY, 'rail');
    fitWidth(art, width);

    // Pinned to the bottom of the canvas rather than centred on a `y`: the
    // height follows from the width, so the only placement worth stating is
    // the gap underneath it.
    const canvasHeight = VIEW.height * RENDER_SCALE;
    const railHeight = artHeight(art);
    art.setY(canvasHeight - rail.bottom - railHeight / 2);
    this.#objects.push(art);

    // Stacked upward from the bottom of the rail, so a new cooldown pushes in
    // at the bottom and older ones sit above it -- the direction the eye
    // already travels from the hotbar.
    const bottom = art.y + railHeight / 2 - this.#size * 0.9;
    this.#sockets = Array.from({ length: rail.capacity }, (_, i) =>
      this.#buildSocket(rail.x, bottom - i * this.#size * rail.pitchRatio));
  }

  #buildSocket(x: number, y: number): Socket {
    const size = this.#size;

    // Grows downward as the timer runs out, so a socket empties from the top --
    // the direction that reads as filling back up. Same rule as the old bar.
    const sweep = this.scene.add
      .rectangle(x, y + size / 2, size * 0.82, 0, PALETTE.night, 0.72)
      .setOrigin(0.5, 1);
    const icon = this.scene.add.sprite(x, y, ICONS_TEXTURE_KEY, 'fireBall');
    const frame = this.scene.add
      .image(x, y, COOLDOWNRAIL_TEXTURE_KEY, 'socket');
    fitWidth(frame, size);
    // Inside the socket, along its bottom edge: outside it the countdown
    // drifts over the rail's wall, and there is no room out there for it.
    const label = this.scene.add
      .text(x, y + size * 0.3, '', {
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
      fitInside(socket.icon, this.#size * 0.62);

      socket.sweep.setVisible(true);
      socket.sweep.height = this.#size * Phaser.Math.Clamp(timer.left / timer.total, 0, 1);

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
