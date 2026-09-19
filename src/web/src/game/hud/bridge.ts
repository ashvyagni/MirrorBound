/**
 * Feeds Logesh's in-game HUD from the authoritative server snapshot.
 *
 * His HUD views (`Portrait`, `Hotbar`, `CooldownRail`, `Minimap`, `MapScreen`)
 * hold no state -- they each render whatever last arrived on a bus event. In
 * the sandbox those events were emitted by local `Vitals` / `Loadout` /
 * `Cooldowns` objects. `Vitals.ts` says what to do about that:
 *
 *   "Matching the names now means the swap is deleting this file and pointing
 *    the HUD at the snapshot, rather than a rename through every view."
 *
 * This module is that swap. The emit site moved here; no view changed.
 *
 * Two vocabularies have to be reconciled on the way through, because the art
 * and the simulation were designed apart:
 *
 *   - weapons: the server's `iron_sword` is the sheet called `sword`
 *   - abilities: the server has four, the art has seven with different names
 *
 * Both are explicit tables below rather than string munging, so an unmapped id
 * is a visible gap instead of a silently wrong icon.
 */

import type { AbilitySlot, GameSnapshot, PlayerSnap } from '../contracts';
import { isRoomFull } from '../contracts';
import { eventBus } from '../EventBus';
import type { SlotId, WeaponId } from '../animation/weaponClips';
import type { LoadoutSnapshot } from '../state/Loadout';
import type { MapView } from './Minimap';
import { floorTextureKey } from '../world/WorldRenderer';
import type { Run, RunRoom, RoomKind, Biome } from '../world/Run';

/** Server weapon id -> the sheet that draws it. */
const WEAPON_SHEET: Readonly<Record<string, WeaponId>> = {
  iron_sword: 'sword',
  hunter_bow: 'bow',
  ember_staff: 'fireStaff',
  frost_staff: 'iceStaff',
};

/**
 * Server ability id -> the art slot whose icon stands in for it.
 *
 * Not a semantic mapping and not meant to be one: the server owns what an
 * ability *does*, this only picks which of the drawn icons represents it on
 * the rail. `shadow_dash` has no drawn equivalent at all -- `arrow` is used
 * because it reads as something fast and darting, which is the closest the
 * current sheet gets.
 */
const ABILITY_SLOT: Readonly<Record<string, SlotId>> = {
  arcane_bolt: 'fireBall',
  flame_burst: 'fireWave',
  binding_nova: 'iceNova',
  shadow_dash: 'arrow',
};

function weaponSheet(serverId: string): WeaponId | null {
  return WEAPON_SHEET[serverId] ?? null;
}

/** The two hands the hotbar draws: what is equipped, and the next thing owned.
 *
 * The server has one `equippedWeapon` and a list of owned weapons, not the
 * sandbox's two-slot loadout (`Loadout.ts` flags this as "a server change, not
 * a translation"). Rather than change the simulation for a HUD affordance, the
 * equipped weapon is shown in hand 0 and the next owned one in hand 1, and the
 * swap key equips it -- visually the same bar, and the server stays the only
 * thing that decides what is actually held.
 */
function loadoutFrom(player: PlayerSnap, cached: LoadoutSnapshot | null): LoadoutSnapshot {
  const inv = player.inventory;
  const owned = inv ? inv.weapons.map((w) => w.id) : [player.currentWeapon];
  const equipped = player.currentWeapon;
  const alternate = owned.find((id) => id !== equipped) ?? null;

  const counts: Record<string, number> = {};
  for (const stack of inv?.consumables ?? []) counts[stack.id] = stack.count;

  // The dial is a local choice -- the server has no concept of "selected
  // potion", only of using one by id -- so it is carried across snapshots.
  const potionIndex = cached?.potionIndex ?? 0;
  const potionIds = Object.keys(counts).length ? Object.keys(counts) : ['health_potion'];
  const potion = potionIds[potionIndex % potionIds.length] ?? 'health_potion';

  return {
    weapons: [weaponSheet(equipped), alternate ? weaponSheet(alternate) : null],
    active: 0,
    potion,
    potionIndex,
    counts,
  };
}

function cooldownsFrom(abilities: AbilitySlot[]): Partial<Record<SlotId, { left: number; total: number }>> {
  const active: Partial<Record<SlotId, { left: number; total: number }>> = {};
  for (const ability of abilities) {
    if (ability.cooldown <= 0) continue;
    const slot = ABILITY_SLOT[ability.id];
    if (!slot) continue;
    active[slot] = { left: ability.cooldown, total: Math.max(ability.cooldownTotal, 0.01) };
  }
  return active;
}

function runFrom(snap: GameSnapshot): Run | null {
  const dungeon = snap.dungeon;
  if (!dungeon) return null;
  const rooms: RunRoom[] = dungeon.rooms.map((room) => ({
    index: room.index,
    kind: room.type as RoomKind,
    biome: room.biome as Biome,
    name: room.name,
    visited: room.visited,
    cleared: room.cleared,
  }));
  return { rooms, current: dungeon.currentIndex };
}

function mapFrom(
  snap: GameSnapshot,
  size: { width: number; height: number },
  doors: readonly { x: number; y: number; locked: boolean }[],
  floorKey: string | null,
): MapView {
  return {
    room: size,
    player: snap.player.position,
    // `marks` is enemies only. The twin used to be folded in here and drawn in
    // the same colour, which made the one friendly thing on the map
    // indistinguishable from the things trying to kill you.
    marks: snap.enemies.map((e) => e.position),
    twin: snap.twin.position,
    doors,
    floorKey,
  };
}

/** Cheap structural compare, so the HUD is not handed 20 identical objects a
 *  second. The views redraw on every `set`, and most snapshots change nothing
 *  a bar can show. */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Start feeding the HUD. Returns an unsubscribe function.
 *
 * `hud:ready` matters: `scene.launch` defers the HUD's `create` by a step, so
 * anything pushed before then lands in an empty room and the bar keeps the
 * placeholder it was built with. The last snapshot is replayed on that signal.
 */
export function bridgeSnapshotToHud(): () => void {
  let lastVitals: unknown = null;
  let lastLoadout: LoadoutSnapshot | null = null;
  let lastCooldowns: unknown = null;
  let lastRun: unknown = null;
  let roomSize = { width: 0, height: 0 };
  // Doors only ride full-room snapshots, so they are cached like the size is.
  let doors: { x: number; y: number; locked: boolean }[] = [];
  // Named from the room, so the minimap can draw the same floor image the
  // world renderer already composed instead of painting terrain twice.
  let floorKey: string | null = null;
  let latest: GameSnapshot | null = null;

  const push = (snap: GameSnapshot, force = false): void => {
    latest = snap;
    const p = snap.player;

    if (isRoomFull(snap.room)) {
      roomSize = { width: snap.room.width, height: snap.room.height };
      floorKey = floorTextureKey(snap.room.id, snap.room.seed);
    }
    // Lite snapshots still carry the door list, and locks change as a room is
    // cleared, so this is refreshed from whichever shape arrived.
    doors = snap.room.doors
      .filter((d) => d.targetIndex !== null)
      .map((d) => ({ x: d.x, y: d.y, locked: d.locked }));

    const vitals = { health: p.health, maxHealth: p.maxHealth, mana: p.mana, maxMana: p.maxMana };
    if (force || !same(vitals, lastVitals)) {
      lastVitals = vitals;
      eventBus.emit('vitals:changed', vitals);
    }

    const loadout = loadoutFrom(p, lastLoadout);
    if (force || !same(loadout, lastLoadout)) {
      lastLoadout = loadout;
      eventBus.emit('loadout:changed', loadout);
    }

    const active = cooldownsFrom(p.abilities);
    if (force || !same(active, lastCooldowns)) {
      lastCooldowns = active;
      eventBus.emit('weapon:cooldowns', { active });
    }

    const run = runFrom(snap);
    if (run && (force || !same(run, lastRun))) {
      lastRun = run;
      eventBus.emit('run:changed', run);
    }

    // The minimap redraws every frame from its own copy, so this one is pushed
    // unconditionally -- the dots move on every snapshot by definition.
    if (roomSize.width > 0) eventBus.emit('map:changed', mapFrom(snap, roomSize, doors, floorKey));
  };

  const offSnapshot = eventBus.on('game:snapshot', (snap) => push(snap));
  const offReady = eventBus.on('hud:ready', () => {
    if (latest) push(latest, true);
  });

  return () => {
    offSnapshot();
    offReady();
  };
}
