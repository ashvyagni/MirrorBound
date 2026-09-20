import { beforeEach, describe, expect, it } from 'vitest';

import { eventBus } from '../src/game/EventBus';
import type { GameSnapshot } from '../src/game/contracts';
import village from './fixtures/village.json';

/**
 * What the portrait corner is told to draw.
 *
 * `Bridge` is the one place a snapshot becomes interface events, so the level
 * bar and the twin's pair are correct here or nowhere. The drawing itself is
 * `hud/Portrait.ts` and needs a canvas; this is the contract it is handed.
 */
const { Bridge } = await import('../src/game/hud/Bridge');

type Vitals = {
  health: number; maxHealth: number; mana: number; maxMana: number;
  level: number; levelProgress: number;
  twin: { health: number; maxHealth: number; mana: number; maxMana: number } | null;
};

function snapshotWith(patch: (s: GameSnapshot) => void): GameSnapshot {
  const snap = structuredClone(village) as GameSnapshot;
  patch(snap);
  return snap;
}

let seen: Vitals[];
let stop: () => void;
let bridge: InstanceType<typeof Bridge>;

beforeEach(() => {
  seen = [];
  bridge = new Bridge();
  bridge.start();
  stop = eventBus.on('vitals:changed', (v) => seen.push(v as Vitals));
  // Both, or every test after the first counts the emits of every Bridge
  // started before it -- which is a test that passes for the wrong reason
  // right up until it asserts a count.
  return () => { stop(); bridge.stop(); };
});

function send(snap: GameSnapshot) {
  eventBus.emit('game:snapshot', snap);
}

describe('what the portrait is told', () => {
  it('reports the level and how far through it you are', () => {
    send(snapshotWith((s) => {
      s.player.level = 7;
      s.player.xp = 30;
      s.player.xpToNext = 120;
    }));
    const v = seen.at(-1)!;
    expect(v.level).toBe(7);
    expect(v.levelProgress).toBeCloseTo(0.25, 3);
  });

  it('clamps progress rather than overflowing the bar', () => {
    send(snapshotWith((s) => { s.player.xp = 999; s.player.xpToNext = 100; }));
    expect(seen.at(-1)!.levelProgress).toBe(1);
  });

  it('survives a level that costs nothing', () => {
    // `xpToNext` is zero at the cap, and a bar is not a division by zero.
    send(snapshotWith((s) => { s.player.xp = 40; s.player.xpToNext = 0; }));
    expect(seen.at(-1)!.levelProgress).toBe(0);
  });

  it('sends no twin while the twin is dormant', () => {
    send(snapshotWith((s) => { s.twin.dormant = true; }));
    expect(seen.at(-1)!.twin).toBeNull();
  });

  it('sends the twin the moment it is no longer dormant', () => {
    send(snapshotWith((s) => { s.twin.dormant = true; }));
    send(snapshotWith((s) => {
      s.twin.dormant = false;
      s.twin.health = 30; s.twin.maxHealth = 60;
      s.twin.mana = 10; s.twin.maxMana = 40;
    }));
    expect(seen.at(-1)!.twin).toEqual({ health: 30, maxHealth: 60, mana: 10, maxMana: 40 });
  });

  it('finding the twin is a change, not something that waits for the next hit', () => {
    // The emit is behind a change check keyed on the values it carries. If the
    // twin were left out of that key, its bars would appear only the next time
    // the player's own health moved.
    send(snapshotWith((s) => { s.twin.dormant = true; }));
    const before = seen.length;
    send(snapshotWith((s) => { s.twin.dormant = false; }));
    expect(seen.length).toBe(before + 1);
  });

  it('a twin taking damage is a change too', () => {
    send(snapshotWith((s) => { s.twin.dormant = false; s.twin.health = 60; }));
    const before = seen.length;
    send(snapshotWith((s) => { s.twin.dormant = false; s.twin.health = 20; }));
    expect(seen.length).toBe(before + 1);
    expect(seen.at(-1)!.twin!.health).toBe(20);
  });

  it('does not re-send an unchanged corner twenty times a second', () => {
    const snap = snapshotWith((s) => { s.twin.dormant = false; });
    send(snap);
    const after = seen.length;
    send(structuredClone(snap));
    send(structuredClone(snap));
    expect(seen.length).toBe(after);
  });
});
