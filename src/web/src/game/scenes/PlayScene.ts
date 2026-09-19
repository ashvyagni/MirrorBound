import Phaser from 'phaser';

import type { ClipName } from '../animation/goatClips';
import type { AbilityId } from '../animation/abilityClips';
import {
  GUARD, isSpell, slotInfo, WEAPONS, type SlotId, type WeaponId,
} from '../animation/weaponClips';
import {
  CAMERA, GOAT_DISPLAY_HEIGHT, HIT_RANGE, PALETTE, PHYSICS, RENDER_SCALE, TILE, VITALS,
} from '../constants';
import { Bro } from '../entities/Bro';
import { Dummy } from '../entities/Dummy';
import { Projectile } from '../entities/Projectile';
import { Shield } from '../entities/Shield';
import { Weapon } from '../entities/Weapon';
import { Goat } from '../entities/Goat';
import { eventBus } from '../EventBus';
import { DeviceIntentSource } from '../input/DeviceIntentSource';
import { Cooldowns } from '../state/Cooldowns';
import { Loadout, type WeaponSlot } from '../state/Loadout';
import { Vitals } from '../state/Vitals';
import { HudScene } from './HudScene';
import type { IntentSource, PlayerSnapshot, Vec2 } from '../types';
import { blockers, buildGrove, type GroveRoom } from '../world/Grove';
import { buildRun } from '../world/Run';
import { TextureFactory } from '../world/TextureFactory';
import { WorldRenderer } from '../world/WorldRenderer';
import { Ambient } from '../world/Ambient';
import { getSettings } from '../../ui/settings';
import { buildWorldTextures } from '../world/textures';

/** How often recharge state is pushed to the views, in seconds. */
const COOLDOWN_PUSH = 0.1;

/** How often the minimap is told where everything is, in seconds. */
const MAP_PUSH = 0.12;

export class PlayScene extends Phaser.Scene {
  static readonly KEY = 'play';

  #goat!: Goat;
  #bro!: Bro;
  #weapon!: Weapon;
  #shield!: Shield;
  #grove!: GroveRoom;
  #world!: WorldRenderer;
  #ambient!: Ambient;
  /** Blocking props the goat has to walk around. */
  #blockers: Array<{ x: number; y: number; r: number }> = [];
  #dummies: Dummy[] = [];
  #shots: Projectile[] = [];
  #source!: IntentSource;
  readonly #cooldowns = new Cooldowns<SlotId>();
  readonly #vitals = new Vitals();
  readonly #loadout = new Loadout();
  #cooldownPush = 0;
  #mapPush = 0;
  #wasRecharging = false;
  #lastSnapshot: PlayerSnapshot | null = null;
  #lastBroClip: string | null = null;
  #teardown: Array<() => void> = [];

  constructor() {
    super(PlayScene.KEY);
  }

  create(): void {
    buildWorldTextures(this);

    // The room comes from `main`'s renderer now, fed a locally generated
    // `RoomFull` -- see `world/Grove.ts`. The renderer does not know which side
    // produced it, which is the point: when the socket lands, the generator is
    // deleted and the snapshot goes straight in.
    this.#grove = buildGrove();
    const textures = new TextureFactory(this);
    const quality = getSettings().quality;
    this.#world = new WorldRenderer(this, textures, quality);
    this.#world.build(this.#grove.room);
    this.#ambient = new Ambient(this, quality);
    this.#ambient.build(this.#grove.room);
    this.#blockers = blockers(this.#grove.room);

    const spawn = this.#grove.playerSpawn;
    this.#goat = new Goat(this, spawn.x, spawn.y);

    // Nothing is layered by hand any more: every entity sets its own depth
    // from its `y` each frame, so the display list sorts itself.
    this.#bro = new Bro(this, spawn.x, spawn.y);
    this.#bro.snapTo(this.#followTarget());

    this.#weapon = new Weapon(this);
    this.#shield = new Shield(this);

    // On the room's own spawn points now, which the generator already kept
    // clear of the path, the pond and every tree it placed.
    for (const at of this.#grove.enemySpawns) {
      this.#dummies.push(new Dummy(this, at.x, at.y));
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
    // The hands start full, so the weapon has to be handed to the entities
    // that draw it. The *views* are told once the HUD says it is listening --
    // see `hud:ready`.
    this.#equip(this.#loadout.equipped);
    eventBus.emit('game:ready', { scene: PlayScene.KEY });
  }

  #setUpCamera(): void {
    const camera = this.cameras.main;
    // `RENDER_SCALE` supersamples the artwork and the setting scales on top of
    // it, so a player zooming out gets more of the room rather than a softer
    // picture of the same amount.
    camera.setZoom(RENDER_SCALE * getSettings().zoom);
    camera.setBackgroundColor(PALETTE.night);
    camera.setBounds(0, 0, this.#grove.room.width, this.#grove.room.height);
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
    this.#vitals.step(dt);
    this.#pushCooldowns(dt);
    this.#pushMap(dt);
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
    if (intent.weaponSlot !== null) this.#selectHand(intent.weaponSlot);
    if (intent.potionCycle !== 0) this.#cyclePotion(intent.potionCycle);
    if (intent.potionUse) this.#usePotion();
    if (intent.mapToggle) eventBus.emit('map:toggle', {});

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

  /**
   * Keep the goat inside the walls and out of the trees.
   *
   * Still not physics bodies. A room holds about sixty props, most of which
   * never move and most of which the goat is nowhere near; pushing out of the
   * few circles it actually overlaps is cheaper than asking Arcade to maintain
   * sixty static bodies, and it cannot get stuck between two of them the way
   * overlapping bodies can.
   */
  #clampToRoom(): void {
    const { room } = this.#grove;
    const edge = TILE;
    let x = Phaser.Math.Clamp(this.#goat.x, edge, room.width - edge);
    let y = Phaser.Math.Clamp(this.#goat.y, edge, room.height - edge);

    // The goat's footing is what occupies the floor, so it is what a trunk
    // pushes against -- not its horns, which hang over whatever is behind it.
    const foot = GOAT_DISPLAY_HEIGHT * PHYSICS.bodyWidthRatio * 0.5;
    for (const b of this.#blockers) {
      const dx = x - b.x;
      const dy = y - b.y;
      const reach = b.r + foot;
      const distance = Math.hypot(dx, dy);
      if (distance >= reach || distance === 0) continue;
      x = b.x + (dx / distance) * reach;
      y = b.y + (dy / distance) * reach;
    }

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

    // Mana is charged before the cooldown starts, so a refused cast leaves
    // both untouched -- the alternative spends the wait without the spell.
    if (!this.#vitals.spend(slotInfo(entry).cost)) {
      eventBus.emit('weapon:cast-blocked', { id: entry, remaining: 0 });
      return;
    }
    this.#emitVitals();
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

  /**
   * Swap which hand is in use.
   *
   * Goes out on the bus and comes back rather than reaching into the weapon
   * directly, so the key, the plate and the React panel all arrive at the same
   * code -- there is one place that decides what being armed means.
   */
  #swapWeapon(): void {
    this.#loadout.swap();
    eventBus.emit('weapon:equip', { id: this.#loadout.equipped });
  }

  /** Draw from a named hand. Re-pressing the hand already in use does nothing
   *  rather than putting the weapon away, which would make the key a toggle
   *  and lose the one property worth having: Q is always the first weapon. */
  #selectHand(slot: WeaponSlot): void {
    if (this.#loadout.active === slot) return;
    this.#loadout.select(slot);
    eventBus.emit('weapon:equip', { id: this.#loadout.equipped });
  }

  #cyclePotion(step: number): void {
    this.#loadout.cyclePotion(step);
    this.#emitLoadout();
  }

  /** Drink what the dial is pointing at, if there is any of it left. */
  #usePotion(): void {
    const potion = this.#loadout.usePotion();
    if (!potion) {
      eventBus.emit('loadout:potion-empty', { id: this.#loadout.potion.id });
      return;
    }
    if (potion.heal) this.#vitals.heal(potion.heal);
    if (potion.mana) this.#vitals.restoreMana(potion.mana);

    eventBus.emit('loadout:potion-used', {
      id: potion.id, heal: potion.heal ?? 0, mana: potion.mana ?? 0,
    });
    this.#emitVitals();
    this.#emitLoadout();
  }

  /** Everything a freshly built view needs to draw itself correctly. */
  #pushAll(): void {
    // The run is fixed for the session, so it is pushed once rather than
    // watched -- the map reads it whenever it opens.
    eventBus.emit('run:changed', buildRun(0));
    this.#emitVitals();
    this.#emitLoadout();
    this.#emitWeapon();
    eventBus.emit('weapon:cooldowns', { active: this.#cooldowns.snapshot() });
  }

  #emitVitals(): void {
    eventBus.emit('vitals:changed', this.#vitals.snapshot());
  }

  #emitLoadout(): void {
    eventBus.emit('loadout:changed', this.#loadout.snapshot());
  }

  /**
   * Tell the minimap where everything is.
   *
   * On a timer rather than every frame: the map is 260 pixels across and a
   * goat crossing the whole room moves about eighty of them, so nothing on it
   * travels a pixel between pushes.
   */
  #pushMap(deltaSeconds: number): void {
    this.#mapPush -= deltaSeconds;
    if (this.#mapPush > 0) return;
    this.#mapPush = MAP_PUSH;

    const { room } = this.#grove;
    eventBus.emit('map:changed', {
      room: { width: room.width, height: room.height },
      // The grid itself, so the minimap paints the floor rather than a disc.
      // Repainting is keyed off `roomId`, so sending it every push is free.
      tiles: room.tiles,
      biome: room.biome,
      roomId: room.id,
      player: { x: this.#goat.x, y: this.#goat.y },
      marks: this.#dummies.map((d) => ({ x: d.x, y: d.y })),
    });
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

  /** Hand a weapon to the entities that draw it, and tell the views. */
  #equip(id: WeaponId | null): void {
    this.#weapon.equip(id);
    this.#shield.lower();
    this.#goat.setArmed(id !== null);
    this.#emitWeapon();
    this.#emitLoadout();
  }

  /** Take a hit: health first, then the stagger, and death if it ran out. */
  #hurt(): void {
    const aim = this.#goat.aim;
    const killed = this.#vitals.damage(VITALS.hitDamage);
    this.#emitVitals();
    if (killed) {
      this.#goat.kill();
      eventBus.emit('flourish', { name: 'death' });
    } else {
      this.#goat.hit({ x: -aim.x, y: -aim.y });
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
          this.#goat.revive(this.#grove.playerSpawn.x, this.#grove.playerSpawn.y);
          this.#bro.snapTo(this.#followTarget());
          this.#vitals.reset();
          this.#emitVitals();
          eventBus.emit('flourish:clear', {});
        }
        else if (state === 'hurt') this.#hurt();
        else {
          this.#vitals.damage(this.#vitals.health);
          this.#emitVitals();
          this.#goat.kill();
        }
      }),

      eventBus.on('hud:ready', () => this.#pushAll()),

      // Settings arrive as a whole; each system takes the part that concerns
      // it rather than being told about its own field individually.
      eventBus.on('ui:settings', (settings) => {
        this.cameras.main.setZoom(RENDER_SCALE * settings.zoom);
        this.#world.setQuality(settings.quality);
        this.#ambient.setQuality(settings.quality);
      }),
      eventBus.on('loadout:swap', () => this.#swapWeapon()),
      eventBus.on('loadout:select', ({ slot }) => this.#selectHand(slot as WeaponSlot)),
      eventBus.on('loadout:cycle-potion', ({ step }) => this.#cyclePotion(step)),
      eventBus.on('loadout:use-potion', () => this.#usePotion()),

      eventBus.on('loadout:set-slot', ({ slot, id }) => {
        this.#loadout.setSlot(slot as WeaponSlot, id);
        eventBus.emit('weapon:equip', { id: this.#loadout.equipped });
      }),

      eventBus.on('bro:perform', ({ clip }) => this.#bro.perform(clip)),

      eventBus.on('game:toggle-fullscreen', () => {
        if (this.scale.isFullscreen) this.scale.stopFullscreen();
        else this.scale.startFullscreen();
      }),

      eventBus.on('weapon:cast', ({ slot }) => this.#cast(slot)),

      // Equipping a weapon puts it in the hand currently in use, then hands it
      // to the entities that draw it. One path, whether the request came from
      // a key, the plate or the React panel.
      eventBus.on('weapon:equip', ({ id }) => {
        if (id !== this.#loadout.equipped) this.#loadout.equip(id);
        this.#equip(id);
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
    this.#world.destroy();
    this.#ambient.destroy();
    this.scene.stop(HudScene.KEY);
  }
}
