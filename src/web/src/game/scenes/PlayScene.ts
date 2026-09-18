import Phaser from 'phaser';

import type { ClipName } from '../animation/clips';
import { GROUND_Y, PALETTE, VIEW } from '../constants';
import { Goat } from '../entities/Goat';
import { eventBus } from '../EventBus';
import { KeyboardIntentSource } from '../input/KeyboardIntentSource';
import type { IntentSource, PlayerSnapshot } from '../types';

const SPAWN = { x: VIEW.width * 0.32, y: GROUND_Y } as const;

export class PlayScene extends Phaser.Scene {
  static readonly KEY = 'play';

  #goat!: Goat;
  #source!: IntentSource;
  #ground!: Phaser.GameObjects.Rectangle;
  #lastSnapshot: PlayerSnapshot | null = null;
  #teardown: Array<() => void> = [];

  constructor() {
    super(PlayScene.KEY);
  }

  create(): void {
    this.#buildBackdrop();
    this.#buildGround();

    this.#goat = new Goat(this, SPAWN.x, SPAWN.y);
    this.physics.add.collider(this.#goat, this.#ground);

    this.#source = new KeyboardIntentSource(this.input.keyboard!);

    this.cameras.main.setBackgroundColor(PALETTE.night);
    this.cameras.main.startFollow(this.#goat, true, 0.09, 0.09, 0, 60);
    this.cameras.main.setDeadzone(VIEW.width * 0.28, VIEW.height);

    this.#wireCommands();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#dispose());

    eventBus.emit('game:ready', { scene: PlayScene.KEY });
  }

  override update(_time: number, deltaMs: number): void {
    // Clamp: a backgrounded tab resumes with a huge delta that would otherwise
    // teleport the goat straight through the floor.
    const dt = Math.min(deltaMs, 50) / 1000;

    this.#goat.step(dt, this.#source.sample(dt));

    const snapshot = this.#goat.snapshot();
    eventBus.emit('player:tick', snapshot);
    if (this.#changed(snapshot)) {
      this.#lastSnapshot = snapshot;
      eventBus.emit('player:changed', snapshot);
    }
  }

  #changed(next: PlayerSnapshot): boolean {
    const prev = this.#lastSnapshot;
    return (
      prev === null ||
      prev.state !== next.state ||
      prev.clip !== next.clip ||
      prev.facing !== next.facing ||
      prev.grounded !== next.grounded
    );
  }

  #wireCommands(): void {
    this.#teardown.push(
      eventBus.on('debug:play-clip', ({ clip }) => this.#goat.previewClip(clip as ClipName)),

      eventBus.on('debug:force-state', ({ state }) => {
        if (state === 'reset') this.#goat.revive(SPAWN.x, SPAWN.y - 40);
        else if (state === 'hurt') this.#goat.hit(this.#goat.facing === 1 ? -1 : 1);
        else this.#goat.kill();
      }),

      eventBus.on('debug:toggle-bodies', ({ enabled }) => {
        const world = this.physics.world;
        if (enabled && !world.debugGraphic) world.createDebugGraphic();
        world.drawDebug = enabled;
        world.debugGraphic?.setVisible(enabled).clear();
      }),
    );
  }

  #dispose(): void {
    for (const off of this.#teardown) off();
    this.#teardown = [];
    this.#source?.destroy?.();
  }

  // --- scenery ---------------------------------------------------------------

  /**
   * Cheap, flat backdrop. Deliberately plain: this scene exists to read the
   * character clearly, so nothing behind it competes for attention.
   */
  #buildBackdrop(): void {
    const { width, height } = VIEW;
    const far = width * 3;

    this.add
      .rectangle(width / 2, height / 2, width, height, PALETTE.dusk)
      .setScrollFactor(0);

    // Two parallax bands give the running a sense of speed without art.
    for (const [depth, alpha, y, h] of [
      [0.15, 0.35, GROUND_Y - 120, 240],
      [0.4, 0.5, GROUND_Y - 40, 160],
    ] as const) {
      const band = this.add.rectangle(0, y, far, h, PALETTE.night, alpha).setOrigin(0, 0.5);
      band.setScrollFactor(depth, 1);
      band.setX(-far / 3);
    }
  }

  #buildGround(): void {
    const width = VIEW.width * 6;
    const left = -width / 2;

    this.#ground = this.add
      .rectangle(left, GROUND_Y, width, 8, PALETTE.magenta, 0.85)
      .setOrigin(0, 0);
    this.physics.add.existing(this.#ground, true);
    this.physics.world.setBounds(left, -VIEW.height * 2, width, VIEW.height * 4);

    this.add
      .rectangle(left, GROUND_Y + 8, width, VIEW.height, PALETTE.night, 0.9)
      .setOrigin(0, 0);
  }
}
