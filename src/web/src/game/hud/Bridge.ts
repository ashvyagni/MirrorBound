import { icon } from '../animation/icons';
import { abilityIcon } from '../animation/abilityIcons';
import type { Recharging } from './CooldownRail';
import type { WeaponId } from '../animation/weaponClips';
import { BIOMES, type BiomeName } from '../constants';
import type {
  AreaSnap, CommandMessage, GameSnapshot, Inventory, PlayerSnap, SkillNode, Vec2,
} from '../contracts';
import { eventBus } from '../EventBus';
import { POTIONS, type LoadoutSnapshot, type WeaponSlot } from '../state/Loadout';
import { Interactions } from '../state/Interactions';
import { saves } from '../state/Saves';
import { runFromDungeon } from '../world/Run';

/**
 * Snapshots in, interface events out.
 *
 * The HUD was built for a sandbox that simulated itself: it listened for
 * `vitals:changed` and `loadout:changed` and drew whatever arrived. The server
 * owns all of that now and speaks in `GameSnapshot`s twenty times a second.
 *
 * Rather than teach nine HUD panels to read a snapshot, one object reads it and
 * says the nine things the HUD already understands. That keeps the panels as
 * pure views of already-decided state -- none of them knows a server exists --
 * and it keeps the translation auditable, because there is exactly one file to
 * read when the portrait disagrees with the health bar.
 *
 * It runs the other way too: the hotbar and the potion dial emit intents, and
 * this turns them into `ui:command`s. A click on a potion is a request, not a
 * decision; the count only changes when the server says it did.
 *
 * ## Why it pushes rather than polls
 *
 * Every emit below is behind a change check. A snapshot arrives whether or not
 * anything in it moved, and re-emitting `loadout:changed` at 20Hz would make
 * the hotbar rebuild its icons twenty times a second to show the same sword.
 */

/** Two carried weapons, in the order the hotbar draws them. */
type Hands = readonly (WeaponId | null)[];

const ANIMATIONS: ReadonlySet<string> = new Set<WeaponId>(['sword', 'bow', 'fireStaff', 'iceStaff']);

/**
 * A weapon id as the art knows it.
 *
 * The server's weapon ids are item ids -- `rusted_blade`, `hunting_bow` -- and
 * the sheet to draw is on the weapon's `animation` field. Detail snapshots
 * carry the whole `WeaponInfo`; the frequent ones carry only the id, so the
 * mapping is cached as it is seen.
 */
export class Bridge {
  #teardown: Array<() => void> = [];
  #animations = new Map<string, WeaponId>();

  // Last-emitted state, so nothing is re-sent unchanged.
  #vitals = '';
  #loadout = '';
  #cooldowns = '';
  #run = '';
  #paused: boolean | null = null;
  #interact = '';
  #interactions = new Interactions();
  #phase = '';

  /** Cached from the last detail snapshot; the frequent ones omit it. */
  #hands: Hands = [null, null];
  #counts: Record<string, number> = {};
  #potionIndex = 0;
  #skills: readonly SkillNode[] = [];
  #skillKey = '';
  #areas: readonly AreaSnap[] = [];
  #campaignKey = '';
  #inventory: Inventory | null = null;
  #inventoryKey = '';

  start(): void {
    this.#teardown.push(
      eventBus.on('game:snapshot', (snap) => this.#onSnapshot(snap)),
      // The interface asking for something. None of these change anything
      // locally -- they ask, and the next snapshot answers.
      eventBus.on('loadout:swap', () => this.#send({ action: 'SWAP_WEAPON' })),
      eventBus.on('loadout:select', ({ slot }) => {
        if (slot !== this.#activeSlot()) this.#send({ action: 'SWAP_WEAPON' });
      }),
      eventBus.on('loadout:cycle-potion', ({ step }) => {
        this.#potionIndex = (this.#potionIndex + step + POTIONS.length) % POTIONS.length;
        this.#loadout = '';   // force the dial to redraw on the next snapshot
      }),
      eventBus.on('loadout:use-potion', () => {
        const potion = POTIONS[this.#potionIndex];
        if (potion) this.#send({ action: 'USE_ITEM', itemId: potion.id });
      }),
    );
  }

  #send(message: Omit<CommandMessage, 'type'>): void {
    eventBus.emit('ui:command', { type: 'COMMAND', ...message });
  }

  #activeSlot(): WeaponSlot {
    return 0;
  }

  #onSnapshot(snap: GameSnapshot): void {
    this.#interactions.update(snap);
    saves.update(snap);
    const p = snap.player;
    this.#learnWeapons(p);
    this.#emitVitals(p, snap);
    this.#emitLoadout(p);
    this.#emitCooldowns(p);
    this.#emitRoom(snap);
    this.#emitRun(snap);
    this.#emitPause(snap);
    this.#emitInteract(snap);
    this.#emitPhase(snap);
    this.#emitSkills(snap);
    this.#emitCampaign(snap);
    this.#emitInventory(snap);
  }

  /** Remember which sheet each weapon id draws with, as detail snapshots pass. */
  #learnWeapons(p: PlayerSnap): void {
    const seen = [p.weapon, ...(p.inventory?.weapons ?? [])];
    for (const weapon of seen) {
      if (weapon && ANIMATIONS.has(weapon.animation)) {
        this.#animations.set(weapon.id, weapon.animation as WeaponId);
      }
    }
  }

  #art(weaponId: string | undefined): WeaponId | null {
    if (!weaponId) return null;
    return this.#animations.get(weaponId) ?? null;
  }

  #emitVitals(p: PlayerSnap, snap: GameSnapshot): void {
    // A dormant twin contributes nothing to the key, so finding it is a change
    // and losing it is a change -- without that the bars would appear only on
    // the next time the player took damage.
    const t = snap.twin.dormant ? null : snap.twin;
    const key = `${p.health}/${p.maxHealth}/${p.mana}/${p.maxMana}/${p.level}/${p.xp}/${p.xpToNext}`
      + `/${t ? `${t.health}/${t.maxHealth}/${t.mana}/${t.maxMana}` : 'none'}`;
    if (key === this.#vitals) return;
    this.#vitals = key;
    eventBus.emit('vitals:changed', {
      health: p.health, maxHealth: p.maxHealth, mana: p.mana, maxMana: p.maxMana,
      level: p.level,
      // `xpToNext` is what the level costs, not what is left of it, so the
      // fraction is a plain division rather than one minus anything.
      levelProgress: p.xpToNext > 0 ? Math.min(1, Math.max(0, p.xp / p.xpToNext)) : 0,
      twin: t ? { health: t.health, maxHealth: t.maxHealth, mana: t.mana, maxMana: t.maxMana } : null,
    });
  }

  #emitLoadout(p: PlayerSnap): void {
    const inventory = p.inventory;
    if (inventory) {
      this.#hands = [this.#art(inventory.equippedWeapon), this.#art(inventory.offhandWeapon)];
      this.#counts = Object.fromEntries(
        inventory.consumables.map((stack) => [stack.id, stack.count]),
      );
    }
    const potion = POTIONS[this.#potionIndex] ?? POTIONS[0]!;
    const snapshot: LoadoutSnapshot = {
      weapons: this.#hands,
      // The equipped weapon is always drawn in the first hand: SWAP_WEAPON
      // trades the pair rather than moving a cursor between them, so there is
      // no second "selected" state for the hotbar to show.
      active: 0,
      potion: potion.id,
      potionIndex: this.#potionIndex,
      counts: this.#counts,
    };
    const key = JSON.stringify(snapshot);
    if (key === this.#loadout) return;
    this.#loadout = key;
    eventBus.emit('loadout:changed', snapshot);
  }

  #emitCooldowns(p: PlayerSnap): void {
    const active: Recharging[] = [];
    for (const slot of p.abilities) {
      if (slot.cooldown > 0) {
        active.push({ id: slot.id, icon: abilityIcon(slot.id), left: slot.cooldown, total: slot.cooldownTotal });
      }
    }
    // The potion's shared cooldown rides the same rail: it is a thing you are
    // waiting on, which is the only thing the rail is about.
    if (p.potionCooldown > 0) {
      active.push({ id: 'potion', icon: icon('sword'), left: p.potionCooldown, total: p.potionCooldownTotal });
    }
    const key = JSON.stringify(active);
    if (key === this.#cooldowns) return;
    this.#cooldowns = key;
    eventBus.emit('weapon:cooldowns', { active });
  }

  #emitRoom(snap: GameSnapshot): void {
    const room = this.#interactions.room;
    if (!room) return;
    const biome: BiomeName = (room.biome in BIOMES ? room.biome : 'grove') as BiomeName;
    // Everything worth walking towards: enemies, and the people in a village.
    const marks: Vec2[] = [
      ...snap.enemies.filter((e) => e.active).map((e) => e.position),
      ...this.#interactions.npcs.map((n) => n.position),
    ];
    eventBus.emit('map:changed', {
      room: { width: room.width, height: room.height },
      tiles: room.tiles,
      biome,
      roomId: room.id,
      roomSeed: room.seed,
      player: snap.player.position,
      marks,
    });
  }

  #emitRun(snap: GameSnapshot): void {
    if (!snap.dungeon) {
      if (this.#run) { this.#run = ''; eventBus.emit('run:changed', { current: 0, rooms: [] }); }
      return;
    }
    const run = runFromDungeon(snap.dungeon);
    const key = JSON.stringify(run);
    if (key === this.#run) return;
    this.#run = key;
    eventBus.emit('run:changed', run);
  }

  #emitPause(snap: GameSnapshot): void {
    if (snap.paused === this.#paused) return;
    this.#paused = snap.paused;
    eventBus.emit('game:pause', { paused: snap.paused });
    if (!snap.paused) return;
    const room = this.#interactions.room;
    eventBus.emit('pause:stats', {
      elapsed: snap.stats.seconds,
      room: room?.name ?? '—',
      biome: room?.biome ?? '—',
      health: snap.player.health,
      maxHealth: snap.player.maxHealth,
      kills: snap.stats.enemiesKilled,
      casts: snap.stats.abilitiesCast,
      rooms: snap.stats.roomsCleared,
    });
  }

  /**
   * The nearest thing worth pressing Interact at.
   *
   * Computed from the authoritative positions rather than tracked, so it can
   * never drift out of step with the world -- the same rule main's store uses.
   */
  #emitInteract(snap: GameSnapshot): void {
    const me = snap.player.position;
    const near = (p: Vec2, reach: number) =>
      Math.hypot(p.x - me.x, p.y - me.y) < reach;

    let best: { label: string; x: number; y: number; action?: 'walk' | 'collect' } | null = null;
    const npc = this.#interactions.update(snap);
    if (npc) {
      best = { label: npc.name, x: npc.position.x, y: npc.position.y };
    }
    if (!best && this.#interactions.room) {
      for (const portal of this.#interactions.room.portals) {
        if (near(portal, portal.radius + 32)) {
          best = { action: 'walk', label: portal.label, x: portal.x, y: portal.y };
          break;
        }
      }
    }
    if (!best) {
      for (const pickup of snap.pickups) {
        if (near(pickup.position, 44)) {
          best = { action: 'collect', label: pickup.kind.replace(/_/g, ' '), x: pickup.position.x, y: pickup.position.y };
          break;
        }
      }
    }
    const key = best ? `${best.action ?? 'talk'}:${best.label}@${Math.round(best.x)},${Math.round(best.y)}` : '';
    if (key === this.#interact) return;
    this.#interact = key;
    eventBus.emit('interact:target', best);
  }

  /**
   * The skill tree, when the server last sent one.
   *
   * `skillTree` rides detail snapshots only, so it is cached here the way the
   * inventory is -- opening the tree between two detail frames must not show
   * an empty one.
   */
  #emitSkills(snap: GameSnapshot): void {
    const tree = snap.player.skillTree;
    if (tree) this.#skills = tree;
    if (this.#skills.length === 0) return;

    // The three rules the server enforces, spelled out so a disabled button
    // says why rather than just refusing.
    const room = this.#interactions.room;
    const blocked = !this.#skills.some((n) => n.unlocked) ? 'Nothing learned yet'
      : room && !room.safe ? 'Only in a village'
      : snap.enemies.some((e) => e.active) ? 'Not in a fight'
      : '';

    const key = `${snap.player.skillPoints}|${blocked}|`
      + this.#skills.map((n) => `${n.unlocked ? 1 : 0}${n.available ? 1 : 0}`).join('');
    if (key === this.#skillKey) return;
    this.#skillKey = key;
    eventBus.emit('skills:changed', {
      nodes: this.#skills,
      points: snap.player.skillPoints,
      respecBlockedBy: blocked,
    });
  }

  /**
   * The Reach, for the map screen.
   *
   * Cached like the inventory: `campaign` rides detail snapshots only, and
   * opening the map between two of them must not show an empty world.
   */
  #emitCampaign(snap: GameSnapshot): void {
    if (snap.campaign) this.#areas = snap.campaign.areas;
    if (this.#areas.length === 0) return;
    const room = this.#interactions.room;
    // The server honours travel only from a village. Saying so up front beats
    // a click that is silently refused.
    const canTravel = room?.roomType === 'village';
    const key = `${canTravel}|` + this.#areas
      .map((a) => `${a.id}${a.discovered ? 1 : 0}${a.completed ? 1 : 0}${a.open ? 1 : 0}${a.current ? 1 : 0}`)
      .join('');
    if (key === this.#campaignKey) return;
    this.#campaignKey = key;
    eventBus.emit('campaign:changed', { areas: this.#areas, canTravel });
  }

  /**
   * Everything carried.
   *
   * Cached for the same reason as the tree and the campaign: `inventory` rides
   * detail snapshots only. The ability slots come from the frequent ones, so
   * they are read fresh -- a cooldown that lagged a detail frame would make
   * the inventory disagree with the rail beside it.
   */
  #emitInventory(snap: GameSnapshot): void {
    if (snap.player.inventory) this.#inventory = snap.player.inventory;
    if (!this.#inventory) return;
    const inventory = this.#inventory;
    const key = JSON.stringify(inventory) + snap.player.abilities.map((a) => a.id).join();
    if (key === this.#inventoryKey) return;
    this.#inventoryKey = key;
    eventBus.emit('inventory:changed', { inventory, abilities: snap.player.abilities });
  }

  #emitPhase(snap: GameSnapshot): void {
    if (snap.phase === this.#phase) return;
    this.#phase = snap.phase;
    if (snap.phase === 'dead') eventBus.emit('flourish', { name: 'death' });
    else if (snap.phase === 'victory') eventBus.emit('flourish', { name: 'victory' });
    else eventBus.emit('flourish:clear', {});

    // A run ends two ways. `dead` is not one of them -- that is the ordinary
    // setback, and the respawn timer is already counting.
    if (snap.phase === 'victory' || snap.phase === 'defeat') {
      const s = snap.stats;
      eventBus.emit('run:ended', {
        ending: snap.phase,
        stats: {
          seconds: s.seconds,
          enemiesKilled: s.enemiesKilled,
          roomsCleared: s.roomsCleared,
          damageDealt: s.damageDealt,
          damageTaken: s.damageTaken,
          essenceCollected: s.essenceCollected,
          twinKills: snap.twin.kills,
          level: snap.player.level,
        },
      });
    } else {
      eventBus.emit('run:ended', { ending: null });
    }
  }

  stop(): void {
    for (const off of this.#teardown) off();
    this.#teardown = [];
  }
}
