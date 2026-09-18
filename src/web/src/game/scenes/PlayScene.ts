import Phaser from 'phaser';

import type { ClipName } from '../animation/goatClips';
import { COMPANION, GROUND_Y, HIT_RANGE, PALETTE, RENDER_SCALE, VIEW } from '../constants';
import type { AbilityId } from '../animation/abilityClips';
import {
  GUARD, isSpell, slotInfo, WEAPONS, WEAPON_ORDER, type SlotId, type WeaponId,
} from '../animation/weaponClips';
import { Bro } from '../entities/Bro';
import { Dummy } from '../entities/Dummy';
import { Projectile } from '../entities/Projectile';
import { Shield } from '../entities/Shield';
import { Weapon } from '../entities/Weapon';
import { Goat } from '../entities/Goat';
import { HudScene } from './HudScene';
import { eventBus } from '../EventBus';
import { DeviceIntentSource } from '../input/DeviceIntentSource';
import { Cooldowns } from '../state/Cooldowns';
import type { IntentSource, PlayerSnapshot } from '../types';

const SPAWN = { x: VIEW.width * 0.32, y: GROUND_Y } as const;

/** What Q and E step through. Bare hands are a position on the wheel rather
 *  than a separate un-equip key, so one pair of keys covers everything. */
const CAROUSEL: readonly (WeaponId | null)[] = [null, ...WEAPON_ORDER];

/** How often recharge state is pushed to the views, in seconds. Ten a second
 *  is smooth enough for a sweep and a tenth-of-a-second label, and costs
 *  nothing next to the sixty a naive per-frame push would send. */
const COOLDOWN_PUSH = 0.1;

/** Floor ticks: enough to cover the view twice over, wrapped by position. */
const MARK_SPACING = 120;
const MARK_COUNT = Math.ceil((VIEW.width * 2) / MARK_SPACING) + 2;

export class PlayScene extends Phaser.Scene {
  static readonly KEY = 'play';

  #goat!: Goat;
  #bro!: Bro;
  #weapon!: Weapon;
  #shield!: Shield;
  #dummies: Dummy[] = [];
  #shots: Projectile[] = [];
  #source!: IntentSource;
  readonly #cooldowns = new Cooldowns<SlotId>();
  /** Seconds until the next cooldown push. */
  #cooldownPush = 0;
  #wasRecharging = false;
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

    // And the shield in front of the sword, since it is what the goat puts
    // between itself and whatever is coming.
    this.#shield = new Shield(this);
    this.children.moveAbove(this.#shield, this.#weapon);

    // A few targets to test against, spaced out along the endless floor.
    for (const x of [SPAWN.x + 420, SPAWN.x + 900, SPAWN.x - 460]) {
      this.#dummies.push(new Dummy(this, x, GROUND_Y));
    }
    this.#shots = Array.from({ length: 12 }, () => new Projectile(this));

    this.#source = new DeviceIntentSource(this.input.keyboard!, this.input);

    this.cameras.main.setZoom(RENDER_SCALE);
    this.cameras.main.setBackgroundColor(PALETTE.dusk);
    this.cameras.main.startFollow(this.#goat, true, 0.09, 0.09, 0, 60);
    this.cameras.main.setDeadzone(VIEW.width * 0.28, VIEW.height);

    this.#wireCommands();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#dispose());

    for (const event of [Phaser.Scale.Events.ENTER_FULLSCREEN, Phaser.Scale.Events.LEAVE_FULLSCREEN]) {
      this.scale.on(event, () => eventBus.emit('game:fullscreen', { active: this.scale.isFullscreen }));
    }

    // The HUD is its own scene so it can use an unzoomed camera. The play
    // camera is zoomed by `RENDER_SCALE`, and anything pinned to it has to be
    // positioned in that transformed space -- which is exactly the arithmetic
    // a second camera does for free.
    this.scene.launch(HudScene.KEY);

    this.#emitWeapon();
    eventBus.emit('game:ready', { scene: PlayScene.KEY });
  }

  override update(_time: number, deltaMs: number): void {
    // Clamp: a backgrounded tab resumes with a huge delta that would otherwise
    // teleport the goat straight through the floor.
    const dt = Math.min(deltaMs, 50) / 1000;

    const intent = this.#source.sample(dt);
    this.#cooldowns.step(dt);
    this.#pushCooldowns(dt);
    this.#goat.step(dt, intent);
    this.#bro.step(dt, this.#followTarget());
    const held = { x: this.#goat.x, y: this.#goat.y, facing: this.#goat.facing };
    this.#weapon.step(dt, held);
    // A guard that drops on its own starts its cooldown from that moment,
    // rather than from when it went up.
    if (this.#shield.step(dt, held)) this.#startCooldown(GUARD);
    this.#recycleWorld();
    if (intent.companionAttack) this.#bro.attack();

    // The goat's own attack drives the weapon, so one key covers both and the
    // swing can never desync from the pose that throws it.
    if (intent.attack && this.#weapon.equipped) {
      this.#weapon.strike();
      this.#emitWeapon();
      this.#strikeNearby(this.#goat.x + 70 * this.#goat.facing);   // a swing is a point
    }

    if (intent.ability !== null) this.#cast(intent.ability);
    if (intent.weaponCycle !== 0) this.#cycleWeapon(intent.weaponCycle);

    for (const shot of this.#shots) {
      if (!shot.busy) continue;
      if (shot.step(dt)) this.#strikeNearby(shot.span);
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

  /** Fire the ability in a slot, if the equipped weapon has one there and it
   *  has finished recharging. */
  #cast(slot: number): void {
    const id = this.#weapon.equipped;
    if (!id) return;
    const entry = WEAPONS[id].abilities[slot];
    if (!entry) return;

    // A second press inside the parry window is a counter, not a new guard, so
    // it has to reach the shield even though the slot is still recharging.
    if (entry === GUARD && this.#shield.parryOpen) {
      this.#shield.trigger();
      eventBus.emit('weapon:cast-done', { id: GUARD, cooldown: 0 });
      return;
    }

    if (!this.#cooldowns.ready(entry)) {
      eventBus.emit('weapon:cast-blocked', {
        id: entry,
        remaining: this.#cooldowns.remaining(entry),
      });
      return;
    }

    if (!isSpell(entry)) {
      this.#shield.trigger();
      // No cooldown yet: it starts when the guard comes down, so holding one up
      // does not eat into the wait for the next.
      eventBus.emit('weapon:cast-done', { id: entry, cooldown: 0 });
      return;
    }

    if (!this.#shots.some((s) => !s.busy)) return;   // all twelve in flight

    this.#startCooldown(entry);
    // The weapon's own motion, if it has one for this spell. Without it the
    // staff carries on idling and the spell reads as arriving from nowhere.
    //
    // The spell waits for the frame that throws it rather than leaving on the
    // same tick the wind-up starts, so it comes off the head once the staff
    // has actually swung out. A weapon with no cast sheet fires immediately,
    // since there is no motion to wait for.
    const swung = this.#weapon.cast(entry, () => this.#launch(entry));
    if (!swung) this.#launch(entry);
  }

  /** Put a spell in the air, wherever the goat is by the time it is thrown. */
  #launch(ability: AbilityId): void {
    const shot = this.#shots.find((s) => !s.busy);
    if (!shot) return;   // dropping one beats stuttering
    shot.launch(ability, this.#goat.x, this.#goat.y, this.#goat.facing);
  }

  #startCooldown(slot: SlotId): void {
    const { cooldown } = slotInfo(slot);
    this.#cooldowns.start(slot, cooldown);
    eventBus.emit('weapon:cast-done', { id: slot, cooldown });
  }

  /**
   * Tell the views what is recharging.
   *
   * Pushed on a timer rather than every frame, and only while something is
   * actually recharging -- plus one final push as the last timer ends, so a
   * view is never left holding a stale sweep.
   */
  #pushCooldowns(deltaSeconds: number): void {
    const recharging = this.#cooldowns.busy;
    this.#cooldownPush -= deltaSeconds;

    if (!recharging && !this.#wasRecharging) return;
    if (recharging && this.#cooldownPush > 0) return;

    this.#cooldownPush = COOLDOWN_PUSH;
    this.#wasRecharging = recharging;
    eventBus.emit('weapon:cooldowns', { active: this.#cooldowns.snapshot() });
  }

  /** Step the carousel. Equipping goes through the same path a click does, so
   *  there is one place that decides what being armed means. */
  #cycleWeapon(step: number): void {
    const here = CAROUSEL.indexOf(this.#weapon.equipped);
    const next = CAROUSEL[(here + step + CAROUSEL.length) % CAROUSEL.length]!;
    eventBus.emit('weapon:equip', { id: next });
  }

  /**
   * Anything the given stretch of ground touches reacts.
   *
   * Takes a span rather than a point because effects are not all points: a
   * swing lands in one place, but a beam covers everything along its length,
   * and `HIT_RANGE` is the slop around either.
   */
  #strikeNearby(where: number | { from: number; to: number }): void {
    const { from, to } = typeof where === 'number' ? { from: where, to: where } : where;
    for (const dummy of this.#dummies) {
      if (dummy.reacting) continue;
      if (dummy.x > from - HIT_RANGE && dummy.x < to + HIT_RANGE) dummy.hit();
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

      eventBus.on('weapon:cast', ({ slot }) => this.#cast(slot)),

      eventBus.on('weapon:equip', ({ id }) => {
        this.#weapon.equip(id);
        this.#shield.lower();
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
    this.#cooldowns.clear();
    this.scene.stop(HudScene.KEY);
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
