import Phaser from 'phaser';

import type { ClipName } from '../animation/goatClips';
import { COMPANION, GROUND_Y, PALETTE, RENDER_SCALE, VIEW } from '../constants';
import { Bro } from '../entities/Bro';
import { Goat } from '../entities/Goat';
import { eventBus } from '../EventBus';
import { KeyboardIntentSource } from '../input/KeyboardIntentSource';
import type { IntentSource, PlayerSnapshot } from '../types';

const SPAWN = { x: VIEW.width * 0.32, y: GROUND_Y } as const;

export class PlayScene extends Phaser.Scene {
  static readonly KEY = 'play';

  #goat!: Goat;
  #bro!: Bro;
  #source!: IntentSource;
  #ground!: Phaser.GameObjects.Rectangle;
  #lastSnapshot: PlayerSnapshot | null = null;
  #lastBroClip: string | null = null;
  #teardown: Array<() => void> = [];

  constructor() {
    super(PlayScene.KEY);
  }

  create(): void {
    this.#buildBackdrop();
    this.#buildGround();

    this.#goat = new Goat(this, SPAWN.x, SPAWN.y);
    this.physics.add.collider(this.#goat, this.#ground);

    // Behind the goat in the display list, so it reads as hanging back.
    this.#bro = new Bro(this, SPAWN.x, SPAWN.y + COMPANION.neckOffsetY);
    this.children.moveBelow(this.#bro, this.#goat);
    this.#bro.snapTo(this.#followTarget());

    this.#source = new KeyboardIntentSource(this.input.keyboard!);

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setBackgroundColor(PALETTE.dusk);
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

    const intent = this.#source.sample(dt);
    this.#goat.step(dt, intent);
    this.#bro.step(dt, this.#followTarget());
    if (intent.companionAttack) this.#bro.attack();

    if (this.#bro.clip !== this.#lastBroClip) {
      this.#lastBroClip = this.#bro.clip;
      eventBus.emit('bro:changed', { clip: this.#bro.clip, mood: this.#bro.mood });
    }

    const snapshot = this.#goat.snapshot();
    eventBus.emit('player:tick', snapshot);
    if (this.#changed(snapshot)) {
      this.#lastSnapshot = snapshot;
      this.#reactTo(snapshot.state);
      eventBus.emit('player:changed', snapshot);
    }
  }

  /** What the companion is told about the goat each frame. */
  #followTarget() {
    const state = this.#goat.state;
    return {
      x: this.#goat.x,
      y: this.#goat.y,
      facing: this.#goat.facing,
      // Only a genuinely idle goat lets the companion start performing.
      resting: state === 'idle',
      speed: Math.abs(this.#goat.body.velocity.x),
    };
  }

  /**
   * Let the companion answer what the goat just did.
   *
   * This is the whole reason it reads as a companion rather than a trailing
   * decoration -- it looks up when something happens.
   */
  #reactTo(state: PlayerSnapshot['state']): void {
    if (state === 'attack') this.#bro.perform('danceExcited');
    else if (state === 'hurt') this.#bro.perform('surprised');
    else if (state === 'die') this.#bro.perform('lookAround');
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
        if (state === 'reset') {
          this.#goat.revive(SPAWN.x, SPAWN.y - 40);
          this.#bro.snapTo(this.#followTarget());
        }
        else if (state === 'hurt') this.#goat.hit(this.#goat.facing === 1 ? -1 : 1);
        else this.#goat.kill();
      }),

      eventBus.on('bro:perform', ({ clip }) => this.#bro.perform(clip)),

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
    // The flat backdrop is the camera's own clear colour rather than a
    // screen-fixed rectangle: a scroll-factor-zero object has to be positioned
    // in the camera's transformed space, which the zoom would throw off.
    const far = VIEW.width * 12;

    // Two parallax bands give running a sense of speed without needing art.
    for (const [depth, alpha, y, h] of [
      [0.15, 0.35, GROUND_Y - 120, 240],
      [0.4, 0.5, GROUND_Y - 40, 160],
    ] as const) {
      this.add
        .rectangle(-far / 2, y, far, h, PALETTE.night, alpha)
        .setOrigin(0, 0.5)
        .setScrollFactor(depth, 1);
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
