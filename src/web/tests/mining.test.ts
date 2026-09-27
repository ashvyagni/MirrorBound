import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameSnapshot, RoomFull, VeinSnap } from '../src/game/contracts';
import { eventBus } from '../src/game/EventBus';
import { Bridge } from '../src/game/hud/Bridge';
import village from './fixtures/village.json';

/**
 * Ore, from the client's side.
 *
 * Two things are worth testing here and neither is the drawing. The first is
 * that the prompt and the interact key agree about *which* vein they mean --
 * the server refuses a mismatch rather than working a different rock, so a
 * client that guesses wrong produces a refusal the player cannot explain. The
 * second is that a vein worked out this tick stops being offered on the next,
 * which is the whole reason `remaining` rides the snapshot instead of the room
 * payload.
 */

vi.mock('../src/game/state/Keybinds', () => ({
  keybinds: { get: () => ({ primary: 69 }) }, keyName: () => 'E',
}));

type Target = { label: string; x: number; y: number; action?: string; veinId?: string } | null;

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((off) => off()));

function vein(id: string, material: string, x: number, y: number, remaining = 3): VeinSnap {
  return { id, material, x, y, remaining, total: 3, radius: 30, variant: 0 };
}

/**
 * A snapshot with veins in it, and the player standing away from every NPC.
 *
 * The village fixture stands the player beside the smith, and people win the
 * prompt -- which is correct, and would hide every assertion in this file.
 */
function withVeins(veins: VeinSnap[], at: { x: number; y: number }): GameSnapshot {
  const snap = structuredClone(village) as GameSnapshot;
  (snap.room as RoomFull).veins = veins;
  snap.veins = veins.map((v) => ({ id: v.id, remaining: v.remaining }));
  snap.player.position = { x: at.x, y: at.y };
  snap.npcs = [];
  snap.pickups = [];
  return snap;
}

function watch(): { seen: Target[] } {
  const bridge = new Bridge();
  const seen: Target[] = [];
  cleanup.push(eventBus.on('interact:target', (t) => seen.push(t as Target)));
  bridge.start();
  cleanup.push(() => bridge.stop());
  return { seen };
}

describe('mining prompts', () => {
  it('offers the vein you are standing at, by id', () => {
    const { seen } = watch();
    const snap = withVeins([vein('v1', 'iron', 1000, 1000)], { x: 1030, y: 1000 });
    eventBus.emit('game:snapshot', snap);
    expect(seen.at(-1)).toMatchObject({ action: 'mine', label: 'iron', veinId: 'v1' });
  });

  it('offers the nearest of two veins, not the first one listed', () => {
    // Both in reach. List order would answer with the far one, and the server
    // resolves the near one -- so the prompt would name a rock the command then
    // failed to mine.
    const { seen } = watch();
    const snap = withVeins([
      vein('far', 'coal', 1000, 1000),
      vein('near', 'gold', 1050, 1000),
    ], { x: 1055, y: 1000 });
    eventBus.emit('game:snapshot', snap);
    expect(seen.at(-1)).toMatchObject({ veinId: 'near', label: 'gold' });
  });

  it('stops offering a vein the moment the snapshot says it is empty', () => {
    const { seen } = watch();
    const snap = withVeins([vein('v1', 'iron', 1000, 1000)], { x: 1030, y: 1000 });
    eventBus.emit('game:snapshot', snap);
    expect(seen.at(-1)).toMatchObject({ veinId: 'v1' });

    // Only `remaining` changes, and only on the snapshot -- the room payload
    // still describes a full vein, which is exactly the case this split exists
    // for.
    const worked = structuredClone(snap);
    worked.veins = [{ id: 'v1', remaining: 0 }];
    eventBus.emit('game:snapshot', worked);
    expect(seen.at(-1)).toBeNull();
  });

  it('does not offer a vein from across the region', () => {
    const { seen } = watch();
    eventBus.emit('game:snapshot', withVeins([vein('v1', 'iron', 1000, 1000)], { x: 1900, y: 1000 }));
    expect(seen.at(-1) ?? null).toBeNull();
  });

  it('lets a person win the prompt over a boulder', () => {
    // Otherwise a vein placed near a vendor swallows the interact key, which is
    // the kind of bug nobody reports precisely.
    const { seen } = watch();
    const snap = structuredClone(village) as GameSnapshot;
    const smith = snap.npcs!.find((n) => n.role === 'weaponsmith')!;
    (snap.room as RoomFull).veins = [vein('v1', 'iron', smith.position.x + 10, smith.position.y)];
    snap.veins = [{ id: 'v1', remaining: 3 }];
    snap.player.position = { x: smith.position.x, y: smith.position.y + 30 };
    eventBus.emit('game:snapshot', snap);
    expect(seen.at(-1)).toMatchObject({ label: smith.name });
    expect(seen.at(-1)?.action).toBeUndefined();
  });
});

describe('the hunger bar', () => {
  it('travels with the vitals rather than on a channel of its own', () => {
    // One object, so the portrait can never hold a hunger band from one tick
    // beside a health value from another.
    const bridge = new Bridge();
    const seen: { hunger?: { band: string; value: number } }[] = [];
    cleanup.push(eventBus.on('vitals:changed', (v) => seen.push(v as never)));
    bridge.start();
    cleanup.push(() => bridge.stop());

    const snap = structuredClone(village) as GameSnapshot;
    snap.player.hunger = { value: 12, max: 100, band: 'hungry', frozen: false,
                           damageMult: -0.2, damageTakenMult: 0.15, speedMult: -0.08 };
    eventBus.emit('game:snapshot', snap);
    expect(seen.at(-1)?.hunger).toMatchObject({ band: 'hungry', value: 12 });
  });

  it('does not redraw for every fraction of a step taken', () => {
    /**
     * Hunger moves continuously as the player walks, so comparing the raw value
     * would push a vitals event on every one of the twenty snapshots a second
     * and the guard in front of it would be doing nothing. A whole point is the
     * smallest change worth a redraw.
     */
    const bridge = new Bridge();
    const seen: unknown[] = [];
    cleanup.push(eventBus.on('vitals:changed', (v) => seen.push(v)));
    bridge.start();
    cleanup.push(() => bridge.stop());

    const base = structuredClone(village) as GameSnapshot;
    base.player.hunger = { value: 80, max: 100, band: 'fed', frozen: false,
                           damageMult: 0.06, damageTakenMult: 0, speedMult: 0.05 };
    eventBus.emit('game:snapshot', base);
    const after = seen.length;

    for (let i = 1; i <= 8; i++) {
      const drifting = structuredClone(base);
      drifting.player.hunger!.value = 80 - i * 0.05;   // still rounds to 80
      eventBus.emit('game:snapshot', drifting);
    }
    expect(seen.length).toBe(after);

    // And a whole point does get through.
    const moved = structuredClone(base);
    moved.player.hunger!.value = 78.4;
    eventBus.emit('game:snapshot', moved);
    expect(seen.length).toBe(after + 1);
  });
});
