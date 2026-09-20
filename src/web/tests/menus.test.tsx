import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { eventBus } from '../src/game/EventBus';
import type { GameSnapshot } from '../src/game/contracts';
import { getUiState, openScreen } from '../src/ui/store';
import { useHotkeys } from '../src/ui/useHotkeys';
import village from './fixtures/village.json';

vi.mock('../src/game/state/Keybinds', () => ({
  eventKeyCode: (e: KeyboardEvent) => e.keyCode,
  keybinds: { actionFor: (code: number) => ({ 73:'inventory', 75:'skills', 77:'map', 84:'companion', 70:'healthPotion', 80:'pause' }[code] ?? null) },
}));
const requests = vi.fn();
let off: () => void;
const host = document.createElement('div');
let root: ReturnType<typeof createRoot>;
function TestUi() { useHotkeys(); return null; }
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.body.append(host);
  root = createRoot(host);
  off = eventBus.on('ui:command', requests);
  await act(async () => {
    openScreen('none');
    eventBus.emit('game:snapshot', structuredClone(village) as GameSnapshot);
    root.render(<TestUi />);
  });
  requests.mockClear();
});
afterEach(async () => {
  await act(async () => { openScreen('none'); root.unmount(); });
  off(); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});
async function key(key: string, keyCode: number) {
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', {key,keyCode,cancelable:true})));
}
it('canvas menus toggle, switch without resuming, and close on one Escape', async () => {
  await key('i',73);
  expect(getUiState().screen).toBe('inventory');
  await key('k',75);
  expect(getUiState().screen).toBe('skills');
  expect(requests.mock.calls.map(([c])=>c.action)).toEqual(['PAUSE']);
  await key('Escape',27);
  expect(getUiState().screen).toBe('none');
  expect(requests.mock.calls.map(([c])=>c.action)).toEqual(['PAUSE','RESUME']);
  await key('i',73); await key('i',73);
  expect(getUiState().screen).toBe('none');
});
it('closing a canvas menu preserves an existing manual pause', async () => {
  await act(async () => eventBus.emit('game:snapshot', {...structuredClone(village),paused:true} as GameSnapshot));
  await key('m',77); await key('Escape',27);
  expect(requests).not.toHaveBeenCalled();
});
it('every canvas menu suppresses potion and companion commands and honours close buttons', async () => {
  for (const screen of ['inventory','skills','map','settings','console'] as const) {
    await act(async () => eventBus.emit(`${screen}:toggle`,{}));
    requests.mockClear();
    await key('f',70); await key('t',84);
    expect(requests).not.toHaveBeenCalled();
    await act(async () => eventBus.emit('ui:screen-close',{screen}));
    expect(getUiState().screen).toBe('none');
    expect(requests).toHaveBeenCalledExactlyOnceWith({type:'COMMAND',action:'RESUME'});
  }
  requests.mockClear(); await key('t',84);
  expect(requests).toHaveBeenCalledExactlyOnceWith({type:'COMMAND',action:'TWIN_CALL'});
});
it('raises a notice for gameplay feedback, with the text the player reads', async () => {
  // Notices are drawn by the canvas HUD now, so what the store owes is the
  // event and its wording. How long one holds, how many fit and what happens
  // when the same message arrives twice are questions for the thing that
  // draws them -- `hud/Notifications.ts` -- because they are questions about
  // what is on screen.
  const notices: { kind: string; title: string; detail?: string }[] = [];
  const stop = eventBus.on('hud:notice', (n) => notices.push(n));
  const events = [
    {type:'SHOP_PURCHASE',tick:1,data:{item:'iron_sword',price:45}},
    {type:'ACTION_REJECTED',tick:2,data:{action:'TWIN_CALL',reason:'twin unavailable'}},
  ];
  await act(async () => { eventBus.emit('game:events',events); });
  stop();

  expect(notices).toHaveLength(2);
  expect(notices.map((n) => `${n.title} ${n.detail ?? ''}`).join(' ')).toContain('iron sword for 45 gold');
  expect(notices.map((n) => n.kind)).toContain('warn');
});

it('preserves a manual pause requested immediately before opening a menu', async () => {
  await key('p',80); // No paused snapshot has arrived yet.
  await key('m',77); await key('Escape',27);
  expect(requests.mock.calls.map(([c])=>c.action)).toEqual(['PAUSE']);
  await key('p',80);
  expect(requests.mock.calls.map(([c])=>c.action)).toEqual(['PAUSE','RESUME']);
});
it('reasserts pause when reconnecting with a menu still open', async () => {
  await key('i',73); requests.mockClear();
  await act(async () => {
    eventBus.emit('game:connection',{status:'closed',attempt:1});
    eventBus.emit('game:connection',{status:'open',attempt:0});
  });
  expect(requests).toHaveBeenCalledExactlyOnceWith({type:'COMMAND',action:'PAUSE'});
});
