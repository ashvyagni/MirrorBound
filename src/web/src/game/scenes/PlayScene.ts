import Phaser from 'phaser';

import type { ClipName } from '../animation/goatClips';
import { COMPANION, GROUND_Y, PALETTE, RENDER_SCALE, VIEW } from '../constants';
import { Bro } from '../entities/Bro';
import { Weapon } from '../entities/Weapon';
import { Goat } from '../entities/Goat';
import { eventBus } from '../EventBus';
import { KeyboardIntentSource } from '../input/KeyboardIntentSource';
import type { IntentSource, PlayerSnapshot } from '../types';

const SPAWN = { x: VIEW.width * 0.32, y: GROUND_Y } as const;

/** Floor ticks: enough to cover the view twice over, wrapped by position. */
const MARK_SPACING = 120;
const MARK_COUNT = Math.ceil((VIEW.width * 2) / MARK_SPACING) + 2;

export class PlayScene extends Phaser.Scene {
  static readonly KEY = 'play';

  #goat!: Goat;
  #bro!: Bro;
  #weapon!: Weapon;
  #source!: IntentSource;
  #ground!: Phaser.GameObjects.Rectangle;
  #groundFill!: Phaser.GameObjects.Rectangle;
  #marks: Phaser.GameObjects.Rectangle[] = [];
  #bands: Phaser.GameObjects.Rectangle[] = [];
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

    // In front of the goat: the swing should read as passing over it.
    this.#weapon = new Weapon(this);
    this.children.moveAbove(this.#weapon, this.#goat);

    this.#source = new KeyboardIntentSource(this.input.keyboard!);

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setBackgroundColor(PALETTE.dusk);
    this.cameras.main.startFollow(this.#goat, true, 0.09, 0.09, 0, 60);
    this.cameras.main.setDeadzone(VIEW.width * 0.28, VIEW.height);

    this.#wireCommands();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#dispose());

    for (const event of [Phaser.Scale.Events.ENTER_FULLSCREEN, Phaser.Scale.Events.LEAVE_FULLSCREEN]) {
      this.scale.on(event, () => eventBus.emit('game:fullscreen', { active: this.scale.isFullscreen }));
    }

    this.#emitWeapon();
    eventBus.emit('game:ready', { scene: PlayScene.KEY });
  }

  override update(_time: number, deltaMs: number): void {
    // Clamp: a backgrounded tab resumes with a huge delta that would otherwise
    // teleport the goat straight through the floor.
    const dt = Math.min(deltaMs, 50) / 1000;

    const intent = this.#source.sample(dt);
    this.#goat.step(dt, intent);
    this.#bro.step(dt, this.#followTarget());
    this.#weapon.step(dt, { x: this.#goat.x, y: this.#goat.y, facing: this.#goat.facing });
    this.#recycleWorld();
    if (intent.companionAttack) this.#bro.attack();

    // The goat's own attack drives the weapon, so one key covers both and the
    // swing can never desync from the pose that throws it.
    if (intent.attack && this.#weapon.equipped) {
      this.#weapon.strike();
      this.#emitWeapon();
    }

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

  #emitWeapon(): void {
    eventBus.emit('weapon:changed', {
      id: this.#weapon.equipped,
      step: this.#weapon.comboStep,
      length: this.#weapon.comboLength,
    });
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

      eventBus.on('game:toggle-fullscreen', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
      }),

      eventBus.on('weapon:equip', ({ id }) => {
        this.#weapon.equip(id);
        this.#goat.setArmed(id !== null);
        this.#emitWeapon();
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
    // The flat backdrop is the camera's own clear colour rather than a
    // screen-fixed rectangle: a scroll-factor-zero object has to be positioned
    // in the camera's transformed space, which the zoom would throw off.
    const far = VIEW.width * 12;

    // Two parallax bands give running a sense of speed without needing art.
    for (const [depth, alpha, y, h] of [
      [0.15, 0.35, GROUND_Y - 120, 240],
      [0.4, 0.5, GROUND_Y - 40, 160],
    ] as const) {
      this.#bands.push(
        this.add
          .rectangle(-far / 2, y, far, h, PALETTE.night, alpha)
          .setOrigin(0, 0.5)
          .setScrollFactor(depth, 1),
      );
    }
  }

  #buildGround(): void {
    const span = VIEW.width * 3;

    this.#ground = this.add
      .rectangle(-span / 2, GROUND_Y, span, 8, PALETTE.magenta, 0.85)
      .setOrigin(0, 0);
    this.physics.add.existing(this.#ground, true);

    this.#groundFill = this.add
      .rectangle(-span / 2, GROUND_Y + 8, span, VIEW.height * 2, PALETTE.night, 0.9)
      .setOrigin(0, 0);

    // Ticks along the floor. A flat colour gives no sense of travel, and
    // without something passing by, an endless walk looks like standing still.
    for (let i = 0; i < MARK_COUNT; i += 1) {
      this.#marks.push(
        this.add.rectangle(0, GROUND_Y + 16, 26, 3, PALETTE.taupe, 0.2).setOrigin(0, 0),
      );
    }

    // Nothing clamps the goat any more; the floor is kept underneath it
    // instead, so it can keep walking in either direction forever.
    this.physics.world.setBounds(-1e7, -VIEW.height * 4, 2e7, VIEW.height * 8);
  }

  /**
   * Keep the world under the goat.
   *
   * The floor is one body that is moved rather than a strip that is generated:
   * the terrain is flat and featureless, so there is nothing to remember about
   * any particular stretch of it, and recycling one body costs nothing.
   */
  #recycleWorld(): void {
    const focus = this.#goat.x;
    const span = VIEW.width * 3;

    if (Math.abs(focus - (this.#ground.x + span / 2)) > VIEW.width * 0.5) {
      const left = focus - span / 2;
      this.#ground.setX(left);
      this.#groundFill.setX(left);
      (this.#ground.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }

    // Ticks wrap by position, so a fixed handful covers unlimited distance.
    const first = Math.floor((focus - VIEW.width) / MARK_SPACING) * MARK_SPACING;
    this.#marks.forEach((mark, i) => mark.setX(first + i * MARK_SPACING));

    for (const band of this.#bands) {
      const width = band.width;
      const drift = this.cameras.main.scrollX * (1 - band.scrollFactorX);
      band.setX(Math.floor((this.cameras.main.scrollX + drift) / width) * width - width);
    }
  }
}
