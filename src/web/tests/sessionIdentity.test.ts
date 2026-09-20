import { beforeEach, expect, it, vi } from 'vitest';
import { sessionIdentity } from '../src/game/network/sessionIdentity';
beforeEach(() => { window.localStorage.clear(); window.history.replaceState(null,'','/'); });
it('persists the default identity across reloads and a new visit without query params', () => {
  const id=sessionIdentity();
  expect(new URLSearchParams(window.location.search).get('session')).toBe(id);
  expect(sessionIdentity()).toBe(id);
  window.history.replaceState(null,'','/');
  expect(sessionIdentity()).toBe(id);
});
it('respects explicit identities without replacing the default save', () => {
  const id=sessionIdentity();
  window.history.replaceState(null,'','/?session=other&seed=5');
  expect(sessionIdentity()).toBe('other');
  expect(sessionIdentity('argument')).toBe('argument');
  window.history.replaceState(null,'','/');
  expect(sessionIdentity()).toBe(id);
});
it('keeps reload identity even when browser storage throws', () => {
  const read=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
  const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
  const id=sessionIdentity();
  expect(sessionIdentity()).toBe(id);
  read.mockRestore(); write.mockRestore();
});
