import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { GameSnapshot, ServerEvent } from '../src/game/contracts';
import { eventBus } from '../src/game/EventBus';
import { DialogueScreen } from '../src/ui/DialogueScreen';
import { closeConversation, getUiState } from '../src/ui/store';
import { useHotkeys } from '../src/ui/useHotkeys';
import village from './fixtures/village.json';

vi.mock('../src/game/state/Keybinds', () => ({
  eventKeyCode: (e: KeyboardEvent) => e.keyCode,
  keybinds: { actionFor: (code: number) => code === 69 ? 'interact' : null },
}));

const host = document.createElement('div');
let root: ReturnType<typeof createRoot>;
const requests = vi.fn();
let off: () => void;
function Screen() { useHotkeys(); return <DialogueScreen />; }
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  requests.mockClear();
  document.body.append(host);
  root = createRoot(host);
  off = eventBus.on('ui:command', requests);
  await act(async () => {
    eventBus.emit('game:snapshot', structuredClone(village) as GameSnapshot);
    root.render(<Screen />);
  });
});
afterEach(async () => {
  await act(async () => { closeConversation(); root.unmount(); });
  off();
  host.remove();
  vi.unstubAllGlobals();
});

async function talk(npc = village.npcs[0]!) {
  await act(async () => eventBus.emit('game:events', [{
    tick: 1, type: 'NPC_TALK',
    data: { npc: npc.id, name: npc.name, role: npc.role, lines: npc.lines, stock: npc.stock },
  }] satisfies ServerEvent[]));
}

it('E requests the same NPC as the prompt through lite snapshots, and Escape closes the response', async () => {
  const snap = structuredClone(village) as GameSnapshot;
  delete snap.npcs;
  await act(async () => {
    eventBus.emit('game:snapshot', snap);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', keyCode: 69 }));
  });
  expect(requests).toHaveBeenCalledWith({ type: 'COMMAND', action: 'TALK', npcId: 'smith_oren' });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  await talk(village.npcs[1]!);
  expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Oren the Smith');
  expect(requests).toHaveBeenCalledWith({ type: 'COMMAND', action: 'PAUSE' });
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(requests).toHaveBeenCalledWith({ type: 'COMMAND', action: 'RESUME' });
});

it('reopening a conversation starts at the first line again', async () => {
  await talk();
  await act(async () => (host.querySelector('.speech') as HTMLButtonElement).click());
  expect(host.querySelector('.speech__line')?.textContent).toBe(village.npcs[0]!.lines[1]);
  await act(async () => closeConversation());
  await talk();
  expect(host.querySelector('.speech__line')?.textContent).toBe(village.npcs[0]!.lines[0]);
});

it('shop buttons request purchases and wait for the server inventory before showing ownership', async () => {
  const snap = structuredClone(village) as GameSnapshot;
  snap.player.inventory!.gold = 500;
  await act(async () => eventBus.emit('game:snapshot', snap));
  await talk(village.npcs[1]!);
  const buy = host.querySelector('.btn--buy') as HTMLButtonElement;
  await act(async () => buy.click());
  expect(requests).toHaveBeenCalledWith({ type: 'COMMAND', action: 'BUY_ITEM', npcId: 'smith_oren', itemId: 'iron_sword' });
  expect(getUiState().playerDetail.inventory?.gold).toBe(500);
  expect(buy.textContent).toBe('45 gold');
  snap.player.inventory!.gold = 455;
  // Only id is used by this view; ownership comes back in the server's inventory.
  snap.player.inventory!.weapons.push({ ...snap.player.weapon!, id: 'iron_sword' });
  await act(async () => eventBus.emit('game:snapshot', structuredClone(snap)));
  expect(buy.textContent).toBe('Owned');
  expect(buy.disabled).toBe(true);
});
