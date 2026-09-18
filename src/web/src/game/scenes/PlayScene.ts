import Phaser from 'phaser';

import type { ClipName } from '../animation/goatClips';
import type { AbilityId } from '../animation/abilityClips';
import {
  GUARD, isSpell, slotInfo, WEAPONS, WEAPON_ORDER, type SlotId, type WeaponId,
} from '../animation/weaponClips';
import { CAMERA, HIT_RANGE, PALETTE, RENDER_SCALE } from '../constants';
import { Bro } from '../entities/Bro';
import { Dummy } from '../entities/Dummy';
import { Projectile } from '../entities/Projectile';
import { Shield } from '../entities/Shield';
import { Weapon } from '../entities/Weapon';
import { Goat } from '../entities/Goat';
import { eventBus } from '../EventBus';
import { DeviceIntentSource } from '../input/DeviceIntentSource';
import { Cooldowns } from '../state/Cooldowns';
import { HudScene } from './HudScene';
import type { IntentSource, PlayerSnapshot, Vec2 } from '../types';
import { Room } from '../world/Room';
import { buildWorldTextures } from '../world/textures';

/** What Q and E step through. Bare hands are a position on the wheel rather
 *  than a separate un-equip key, so one pair of keys covers everything. */
const CAROUSEL: readonly (WeaponId | null)[] = [null, ...WEAPON_ORDER];

/** How often recharge state is pushed to the views, in seconds. */
const COOLDOWN_PUSH = 0.1;

export class PlayScene extends Phaser.Scene {
  static readonly KEY = 'play';

  #goat!: Goat;
  #bro!: Bro;
  #weapon!: Weapon;
  #shield!: Shield;
  #room!: Room;
  #dummies: Dummy[] = [];
  #shots: Projectile[] = [];
  #source!: IntentSource;
  readonly #cooldowns = new Cooldowns<SlotId>();
  #cooldownPush = 0;
  #wasRecharging = false;
  #lastSnapshot: PlayerSnapshot | null = null;
  #lastBroClip: string | null = null;
  #teardown: Array<() => void> = [];

  constructor() {
    super(PlayScene.KEY);
  }

  create(): void {
    buildWorldTextures(this);
    this.#room = new Room(this);
    this.#room.build();

    const spawn = { x: this.#room.width / 2, y: this.#room.height / 2 };
    this.#goat = new Goat(this, spawn.x, spawn.y);

    // Nothing is layered by hand any more: every entity sets its own depth
    // from its `y` each frame, so the display list sorts itself.
    this.#bro = new Bro(this, spawn.x, spawn.y);
    this.#bro.snapTo(this.#followTarget());

    this.#weapon = new Weapon(this);
    this.#shield = new Shield(this);

    // Targets spread around the room rather than along a line, since there is
    // a second axis to spread them on now.
    for (const [x, y] of [[-200, -120], [220, -60], [-160, 170], [180, 160]] as const) {
      this.#dummies.push(new Dummy(this, spawn.x + x, spawn.y + y));
    }
    this.#shots = Array.from({ length: 12 }, () => new Projectile(this));

    this.#source = new DeviceIntentSource(this.input.keyboard!, this.input);

    this.#setUpCamera();
    this.#wireCommands();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#dispose());

    for (const event of [Phaser.Scale.Events.ENTER_FULLSCREEN, Phaser.Scale.Events.LEAVE_FULLSCREEN]) {
      this.scale.on(event, () => eventBus.emit('game:fullscreen', { active: this.scale.isFullscreen }));
    }

    this.scene.launch(HudScene.KEY);
    this.#emitWeapon();
    eventBus.emit('game:ready', { scene: PlayScene.KEY });
  }

  #setUpCamera(): void {
    const camera = this.cameras.main;
    camera.setZoom(RENDER_SCALE);
    camera.setBackgroundColor(PALETTE.night);
    camera.setBounds(0, 0, this.#room.width, this.#room.height);
    camera.startFollow(this.#goat, true, CAMERA.lerp, CAMERA.lerp);
    camera.setDeadzone(CAMERA.deadzone.width, CAMERA.deadzone.height);

    // The vignette is drawn by the HUD scene, not here. This camera is zoomed
    // by `RENDER_SCALE`, and a scroll-factor-zero object under a zoomed camera
    // still has to be positioned in that camera's transformed space -- which
    // put it over one corner of the room instead of over the screen.
  }

  override update(_time: number, deltaMs: number): void {
    // Clamp: a backgrounded tab resumes with a huge delta that would otherwise
    // teleport everything across the room.
    const dt = Math.min(deltaMs, 50) / 1000;

    const intent = this.#source.sample(dt);
    this.#cooldowns.step(dt);
    this.#pushCooldowns(dt);
    this.#goat.step(dt, intent);
    this.#clampToRoom();
    this.#bro.step(dt, this.#followTarget());

    const held = { x: this.#goat.x, y: this.#goat.y, aim: this.#goat.aim, facing: this.#goat.facing };
    this.#weapon.step(dt, held);
    if (this.#shield.step(dt, held)) this.#startCooldown(GUARD);

    if (intent.companionAttack) this.#bro.attack();

    // The goat's own attack drives the weapon, so one key covers both and the
    // swing can never desync from the pose that throws it.
    if (intent.attack && this.#weapon.equipped) {
      this.#weapon.strike();
      this.#emitWeapon();
      this.#strikeAt(this.#reachPoint(70));
    }

    if (intent.ability !== null) this.#cast(intent.ability);
    if (intent.weaponCycle !== 0) this.#cycleWeapon(intent.weaponCycle);

    for (const shot of this.#shots) {
      if (!shot.busy) continue;
      if (shot.step(dt)) this.#strikeAt({ x: shot.x, y: shot.y });
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

  /** Keep the goat off the walls. Cheaper than four static bodies, and there
   *  is nothing else in the room to collide with yet. */
  #clampToRoom(): void {
    const bounds = this.#room.bounds;
    const x = Phaser.Math.Clamp(this.#goat.x, bounds.left, bounds.right);
    const y = Phaser.Math.Clamp(this.#goat.y, bounds.top, bounds.bottom);
    if (x !== this.#goat.x || y !== this.#goat.y) this.#goat.setPosition(x, y);
  }

  /** A point `distance` in front of the goat, along the way it is aiming. */
  #reachPoint(distance: number): Vec2 {
    const aim = this.#goat.aim;
    return { x: this.#goat.x + aim.x * distance, y: this.#goat.y + aim.y * distance };
  }

  /** Fire the ability in a slot, if the equipped weapon has one there. */
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
    // The weapon's own motion, if it has one for this spell, with the spell
    // held back until the frame that actually throws it.
    const swung = this.#weapon.cast(entry, () => this.#launch(entry));
    if (!swung) this.#launch(entry);
  }

  /** Put a spell in the air, wherever the goat is by the time it is thrown. */
  #launch(ability: AbilityId): void {
    const shot = this.#shots.find((s) => !s.busy);
    if (!shot) return;   // dropping one beats stuttering
    shot.launch(ability, this.#goat.x, this.#goat.y, this.#goat.aim, this.#goat.facing);
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
   * Anything near `point` reacts.
   *
   * A radius rather than the span an effect covers: with two axes, "within
   * reach of where this landed" is a circle, and testing one is cheaper than
   * reasoning about an oriented box.
   */
  #strikeAt(point: Vec2): void {
    for (const dummy of this.#dummies) {
      if (dummy.reacting) continue;
      if (Phaser.Math.Distance.Between(dummy.x, dummy.y, point.x, point.y) < HIT_RANGE) {
        dummy.hit();
      }
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
    return {
      x: this.#goat.x,
      y: this.#goat.y,
      aim: this.#goat.aim,
      facing: this.#goat.facing,
      // Only a genuinely idle goat lets the companion start performing.
      resting: this.#goat.motion === 'idle',
      speed: Math.hypot(this.#goat.body.velocity.x, this.#goat.body.velocity.y),
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
      prev.facing !== next.facing
    );
  }

  #wireCommands(): void {
    this.#teardown.push(
      eventBus.on('debug:play-clip', ({ clip }) => this.#goat.previewClip(clip as ClipName)),

      eventBus.on('debug:force-state', ({ state }) => {
        if (state === 'reset') {
          this.#goat.revive(this.#room.width / 2, this.#room.height / 2);
          this.#bro.snapTo(this.#followTarget());
        }
        else if (state === 'hurt') {
          const aim = this.#goat.aim;
          this.#goat.hit({ x: -aim.x, y: -aim.y });
        }
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
        // The dock emits this as it mounts, which in development Strict Mode
        // can land while a scene is being torn down and replaced.
        const world = this.physics?.world;
        if (!world) return;
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
    this.#room.destroy();
    this.scene.stop(HudScene.KEY);
  }
}
