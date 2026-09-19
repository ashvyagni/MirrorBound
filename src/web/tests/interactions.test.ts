import { afterEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { GameSnapshot, NpcSnap } from '../src/game/contracts';
import { eventBus } from '../src/game/EventBus';
import { Bridge } from '../src/game/hud/Bridge';
import { InteractPrompt } from '../src/game/hud/InteractPrompt';
import { Interactions, nearbyNpc } from '../src/game/state/Interactions';
import village from './fixtures/village.json';

vi.mock('../src/game/state/Keybinds', () => ({
  keybinds: { get: () => ({ primary: 69 }) }, keyName: () => 'E',
}));

// A real seed-5 server snapshot, with tile/decor art removed to keep the fixture small.
const full = () => structuredClone(village) as GameSnapshot;
function lite(snap: GameSnapshot): GameSnapshot {
  const copy = structuredClone(snap);
  delete copy.npcs;
  delete copy.player.inventory;
  copy.room = { id: snap.room.id, index: snap.room.index, cleared: true, doors: [] };
  return copy;
}
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((off) => off()));

describe('interaction snapshots', () => {
  it('keeps a reachable NPC through every lite frame, clearing it on leaving the room', () => {
    const cache = new Interactions();
    const snap = full();
    const smith = snap.npcs![1]!;
    expect(cache.update(snap)?.id).toBe(smith.id);
    for (let i = 0; i < 19; i++) expect(cache.update(lite(snap))?.id).toBe(smith.id);
    expect(cache.update({ ...lite(snap), room: { ...lite(snap).room, id: 'next-area:0' } })).toBeNull();
    expect(cache.npcs).toEqual([]);
  });

  it('clears explicit empty data and follows updated positions within the same room', () => {
    const cache = new Interactions();
    const snap = full();
    cache.update(snap);
    const moved = lite(snap);
    moved.player.position.x += 200;
    expect(cache.update(moved)).toBeNull();
    expect(cache.update(lite(snap))).not.toBeNull();
    expect(cache.update({ ...snap, npcs: [] })).toBeNull();
  });

  it('uses the nearest NPC and includes the player radius at the server boundary', () => {
    const snap = full();
    const smith = snap.npcs![1]!;
    const player = { radius: 14, position: { x: smith.position.x + 110, y: smith.position.y } };
    expect(nearbyNpc([smith], player)).toBe(smith);
    player.position.x += 0.01;
    expect(nearbyNpc([smith], player)).toBeNull();
    const closer: NpcSnap = { ...smith, id: 'closer', position: { ...player.position } };
    expect(nearbyNpc([smith, closer], player)).toBe(closer);
  });

  it('the HUD emits one stable prompt across full/lite snapshots, then hides it out of reach', () => {
    const bridge = new Bridge();
    const targets = vi.fn();
    cleanup.push(eventBus.on('interact:target', targets));
    bridge.start();
    cleanup.push(() => bridge.stop());
    const snap = full();
    eventBus.emit('game:snapshot', snap);
    for (let i = 0; i < 19; i++) eventBus.emit('game:snapshot', lite(snap));
    expect(targets).toHaveBeenCalledExactlyOnceWith({
      label: 'Oren the Smith', ...snap.npcs![1]!.position,
    });
    const far = lite(snap);
    far.player.position.x += 20;
    eventBus.emit('game:snapshot', far);
    expect(targets).toHaveBeenLastCalledWith(null);
  });
});

it.each([1, 2, 3])('places a prompt above the world target at camera zoom %s', (zoom) => {
  // Mock only the drawing surface: exercise the actual prompt positioning and visibility.
  const object = () => ({
    width: 40, frame: { width: 200, height: 80 }, scaleY: 1,
    setVisible: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(), add: vi.fn(), destroy: vi.fn(),
  });
  const group = object();
  const scene = {
    add: { container: () => group, image: object, text: object },
    scene: { get: () => ({ cameras: { main: {
      scrollX: 100, scrollY: 100, zoom,
      worldView: { x: 100 + 960 * (1 - 1 / zoom), y: 100 + 540 * (1 - 1 / zoom) },
    } } }) },
  };
  const prompt = new InteractPrompt(scene as unknown as Phaser.Scene);
  prompt.build();
  prompt.set({ label: 'Oren the Smith', x: 1060, y: 640 });
  prompt.step();
  const [x, y] = group.setPosition.mock.lastCall!;
  expect(x).toBeCloseTo(960);
  expect(y).toBeCloseTo(540 - 46);
  expect(group.setVisible).toHaveBeenLastCalledWith(true);
  prompt.set(null);
  expect(group.setVisible).toHaveBeenLastCalledWith(false);
});
