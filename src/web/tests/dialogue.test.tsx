import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GameSnapshot, ServerEvent } from '../src/game/contracts';
import { eventBus } from '../src/game/EventBus';
import { closeConversation, getUiState, openScreen } from '../src/ui/store';
import { useHotkeys } from '../src/ui/useHotkeys';
import village from './fixtures/village.json';

/**
 * Dialogue is drawn by the canvas now (`game/hud/DialogueScreen.ts`), so what
 * is testable here is the contract it is driven by: which NPC the interact key
 * asks about, the conversation raised on the bus when the server answers, and
 * the purse that rides alongside it so an open shop stays honest.
 *
 * What the screen does with a conversation -- stepping lines, dimming what you
 * already own, sizing the plate -- lives with the thing that draws it.
 */

vi.mock('../src/game/state/Keybinds', () => ({
  eventKeyCode: (e: KeyboardEvent) => e.keyCode,
  keybinds: { actionFor: (code: number) => code === 69 ? 'interact' : null },
}));

const host = document.createElement('div');
let root: ReturnType<typeof createRoot>;
const requests = vi.fn();
const conversations: { conversation: { npcId: string; name: string; lines: string[]; stock: unknown[] }; gold: number; owned: string[] }[] = [];
const purses: { gold: number; owned: string[] }[] = [];
let off: (() => void)[] = [];

function Hotkeys() { useHotkeys(); return null; }

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  requests.mockClear();
  conversations.length = 0;
  purses.length = 0;
  document.body.append(host);
  root = createRoot(host);
  off = [
    eventBus.on('ui:command', requests),
    eventBus.on('hud:conversation', (c) => conversations.push(c as never)),
    eventBus.on('hud:purse', (p) => purses.push(p)),
  ];
  await act(async () => {
    eventBus.emit('game:snapshot', structuredClone(village) as GameSnapshot);
    root.render(<Hotkeys />);
  });
});
afterEach(async () => {
  await act(async () => { closeConversation(); root.unmount(); });
  for (const stop of off) stop();
  host.remove();
  vi.unstubAllGlobals();
});

async function talk(npc = village.npcs[0]!) {
  await act(async () => eventBus.emit('game:events', [{
    tick: 1, type: 'NPC_TALK',
    data: { npc: npc.id, name: npc.name, role: npc.role, lines: npc.lines, stock: npc.stock },
  }] satisfies ServerEvent[]));
}

it('E requests the same NPC as the prompt, through lite snapshots', async () => {
  const snap = structuredClone(village) as GameSnapshot;
  delete snap.npcs;
  await act(async () => {
    eventBus.emit('game:snapshot', snap);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69 }));
  });
  expect(requests).toHaveBeenCalledWith({ type: 'COMMAND', action: 'TALK', npcId: 'smith_oren' });
  expect(conversations).toHaveLength(0);
});

it('the server answering raises the conversation, and borrows the pause', async () => {
  await talk(village.npcs[1]!);
  expect(conversations).toHaveLength(1);
  expect(conversations[0]!.conversation.name).toBe('Oren the Smith');
  expect(conversations[0]!.conversation.lines).toEqual(village.npcs[1]!.lines);
  expect(conversations[0]!.conversation.stock).toHaveLength(village.npcs[1]!.stock.length);
  expect(getUiState().screen).toBe('dialogue');
  expect(requests).toHaveBeenCalledWith({ type: 'COMMAND', action: 'PAUSE' });

  // The canvas closes itself and says so; the store gives the pause back.
  await act(async () => eventBus.emit('ui:screen-close', { screen: 'dialogue' }));
  expect(getUiState().screen).toBe('none');
  expect(requests).toHaveBeenCalledWith({ type: 'COMMAND', action: 'RESUME' });
});

it('the purse travels with the conversation and is refreshed by the server', async () => {
  const snap = structuredClone(village) as GameSnapshot;
  snap.player.inventory!.gold = 500;
  await act(async () => eventBus.emit('game:snapshot', snap));
  await talk(village.npcs[1]!);
  expect(conversations[0]!.gold).toBe(500);
  expect(conversations[0]!.owned).not.toContain('iron_sword');

  // Buying is a request; ownership only arrives with the server's inventory.
  purses.length = 0;
  snap.player.inventory!.gold = 455;
  snap.player.inventory!.weapons.push({ ...snap.player.weapon!, id: 'iron_sword' });
  await act(async () => eventBus.emit('game:snapshot', structuredClone(snap)));
  expect(purses.at(-1)!.gold).toBe(455);
  expect(purses.at(-1)!.owned).toContain('iron_sword');
});

it('leaving a conversation never shows the pause screen, even for a frame', async () => {
  /**
   * Reported twice, and intermittent both times, which is the tell: the pause
   * *panel* followed `snapshot.paused` while the RESUME that ends a
   * conversation takes a round trip to be confirmed. In the gap the store had
   * already announced the menu closed, so the panel had every reason it needed
   * to draw itself -- for exactly one server tick.
   *
   * What is asserted is the whole visible sequence, in order. Anything that
   * puts a `paused: true` after the conversation opens is the bug coming back.
   */
  // One interleaved log, because the bug was purely an ordering one: both
  // events fired either way, and only their order decided whether the panel
  // had a moment where the world was paused and no menu was open.
  const log: string[] = [];
  const stop = [
    eventBus.on('game:pause', ({ paused }) => log.push(`pause:${paused}`)),
    eventBus.on('ui:modal', ({ open }) => log.push(`modal:${open}`)),
  ];

  await talk(village.npcs[1]!);
  expect(log).toEqual(['modal:true', 'pause:true']);

  log.length = 0;
  await act(async () => eventBus.emit('ui:screen-close', { screen: 'dialogue' }));

  // The pause comes back FIRST, then the menu is announced closed. The other
  // way round leaves a window where `paused` is true and nothing is open,
  // which is exactly when the pause screen draws itself.
  expect(log).toEqual(['pause:false', 'modal:false']);

  for (const off of stop) off();
});

it('a pause the player asked for survives opening and closing a screen', async () => {
  // The borrowed-pause rule: a menu must not resume a world the player paused
  // themselves.
  const pauses: boolean[] = [];
  const stop = eventBus.on('game:pause', ({ paused }) => pauses.push(paused));

  await act(async () => { eventBus.emit('ui:command', { type: 'COMMAND', action: 'PAUSE' }); });
  expect(pauses).toEqual([true]);

  await act(async () => { openScreen('inventory'); });
  await act(async () => { openScreen('none'); });

  // Never resumed: the screen found the world already paused and left it alone.
  expect(pauses).toEqual([true]);
  stop();
});
