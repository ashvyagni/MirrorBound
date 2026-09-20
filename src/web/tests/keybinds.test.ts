import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Input: { Keyboard: { KeyCodes: {
  W:87,S:83,A:65,D:68,UP:38,DOWN:40,LEFT:37,RIGHT:39,SHIFT:16,J:74,SPACE:32,
  ONE:49,TWO:50,THREE:51,FOUR:52,FIVE:53,SIX:54,SEVEN:55,EIGHT:56,NINE:57,ZERO:48,
  Q:81,F:70,G:71,E:69,C:67,I:73,K:75,M:77,P:80,F3:114,R:82,H:72,T:84,
  BACK_SLASH:220,ESC:27,F5:116,F12:123,TAB:9,CTRL:17,ALT:18,BACKSPACE:8,ENTER:13,COMMA:188,PERIOD:190,
} } } } }));
import {
  ACTIONS, DEFAULT_BINDINGS, Keybinds, MOUSE, keyName, mouseCode,
} from '../src/game/state/Keybinds';
beforeEach(() => localStorage.clear());
it('assigns every default key to one action, including F/H/T', () => {
  const bindings=new Keybinds();
  const codes=ACTIONS.flatMap(({action})=>bindings.codes(action));
  expect(new Set(codes).size).toBe(codes.length);
  expect(bindings.actionFor(70)).toBe('healthPotion');
  expect(bindings.actionFor(72)).toBe('potionUse');
  expect(bindings.actionFor(84)).toBe('companion');
});
it('defaults attack to the left mouse button and dash to space', () => {
  const bindings=new Keybinds();
  expect(bindings.actionFor(MOUSE.left)).toBe('attack');
  expect(bindings.codes('attack')).toEqual([MOUSE.left,74]);
  expect(bindings.actionFor(32)).toBe('dash');
});
it('binds, stores and names mouse buttons like any other key', () => {
  const bindings=new Keybinds();
  bindings.set('ability1','primary',mouseCode(2));
  expect(bindings.actionFor(MOUSE.right)).toBe('ability1');
  // Survives the round trip through storage, which used to reject anything
  // above 255 and would have silently dropped every mouse binding.
  expect(new Keybinds().actionFor(MOUSE.right)).toBe('ability1');
  expect(keyName(MOUSE.left)).toBe('M1');
  expect(keyName(MOUSE.right)).toBe('M2');
  expect(keyName(MOUSE.forward)).toBe('M5');
});
it('ignores a v1 table rather than migrating it', () => {
  // v1 had no `dash` row and kept Space under `attack`. Reading it binding by
  // binding would hand Space back to attack and leave dash unbound, so the
  // whole table is dropped and the v2 defaults take over.
  localStorage.setItem('mirrorbound.keybinds.v1',JSON.stringify({...DEFAULT_BINDINGS,
    attack:{primary:90,secondary:32}}));
  const bindings=new Keybinds();
  expect(bindings.actionFor(90)).toBeNull();
  expect(bindings.actionFor(32)).toBe('dash');
  expect(bindings.actionFor(MOUSE.left)).toBe('attack');
});
it('keeps custom v2 keys across a reload', () => {
  const bindings=new Keybinds();
  bindings.set('attack','primary',90);
  expect(new Keybinds().actionFor(90)).toBe('attack');
});
it('steals a rebound key and never leaves duplicate primary/secondary codes', () => {
  const bindings=new Keybinds();
  bindings.set('potionUse','primary',70);
  expect(bindings.actionFor(70)).toBe('potionUse');
  expect(bindings.codes('healthPotion')).toEqual([]);
  // Space is dash's by default, so attack takes it from dash and keeps J.
  bindings.set('attack','primary',32);
  expect(bindings.codes('attack')).toEqual([32,74]);
  expect(bindings.codes('dash')).toEqual([]);
  expect(new Keybinds().actionFor(70)).toBe('potionUse');
});
