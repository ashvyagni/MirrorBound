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
  // The lift clears the target's own drawn height, so it scales with the
  // camera: a fixed offset sat on an NPC's face at any zoom above one.
  // 68 world units of target, 12 of head room, plus half the plate (80 tall).
  expect(y).toBeCloseTo(540 - (68 * zoom + 12 + 40));
  expect(y).toBeLessThan(540 - 46);
  expect(group.setVisible).toHaveBeenLastCalledWith(true);
  prompt.set(null);
  expect(group.setVisible).toHaveBeenLastCalledWith(false);
});

it('hides the prompt while a conversation owns the space over their head', () => {
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
      scrollX: 100, scrollY: 100, zoom: 2,
      worldView: { x: 100 + 960 * 0.5, y: 100 + 540 * 0.5 },
    } } }) },
  };
  const prompt = new InteractPrompt(scene as unknown as Phaser.Scene);
  prompt.build();
  prompt.set({ label: 'Oren the Smith', x: 1060, y: 640 });
  expect(group.setVisible).toHaveBeenLastCalledWith(true);

  prompt.setSuppressed(true);
  expect(group.setVisible).toHaveBeenLastCalledWith(false);
  // A target arriving while suppressed is remembered but not shown.
  prompt.set({ label: 'Siv the Apothecary', x: 1060, y: 640 });
  expect(group.setVisible).toHaveBeenLastCalledWith(false);

  // And it comes back, on the target it was last given.
  prompt.setSuppressed(false);
  expect(group.setVisible).toHaveBeenLastCalledWith(true);
});

describe('map snapshot continuity', () => {
  it('moves markers on lite frames while retaining NPCs, travel and respec rules', () => {
    const bridge = new Bridge();
    const map = vi.fn(), campaign = vi.fn(), skills = vi.fn();
    cleanup.push(eventBus.on('map:changed', map),eventBus.on('campaign:changed',campaign),eventBus.on('skills:changed',skills));
    bridge.start(); cleanup.push(()=>bridge.stop());
    const snap=full();
    snap.player.skillTree![0]!.unlocked=true;
    eventBus.emit('game:snapshot',snap);
    const moving=lite(snap);
    moving.player.position.x+=100;
    delete moving.campaign;
    eventBus.emit('game:snapshot',moving);
    expect(map).toHaveBeenCalledTimes(2);
    expect(map.mock.lastCall![0].player).toEqual(moving.player.position);
    expect(map.mock.lastCall![0].marks).toEqual(snap.npcs!.map(n=>n.position));
    expect(campaign).toHaveBeenCalledTimes(1);
    expect(campaign.mock.lastCall![0].canTravel).toBe(true);
    expect(skills).toHaveBeenCalledTimes(1);
    expect(skills.mock.lastCall![0].respecBlockedBy).toBe('');
  });
  it('describes contact actions without suggesting the talk key', () => {
    const bridge=new Bridge(), targets=vi.fn();
    cleanup.push(eventBus.on('interact:target', targets)); bridge.start(); cleanup.push(()=>bridge.stop());
    const snap=full(); snap.npcs=[];
    if (!('portals' in snap.room)) throw new Error('fixture needs room');
    const portal=snap.room.portals[0]!;
    snap.player.position={x:portal.x,y:portal.y};
    eventBus.emit('game:snapshot',snap);
    expect(targets.mock.lastCall![0].action).toBe('walk');
    snap.room.portals=[];
    snap.pickups=[{id:'pickup',kind:'health_potion',position:snap.player.position,radius:8} as GameSnapshot['pickups'][number]];
    eventBus.emit('game:snapshot',snap);
    expect(targets.mock.lastCall![0].action).toBe('collect');
  });
});
