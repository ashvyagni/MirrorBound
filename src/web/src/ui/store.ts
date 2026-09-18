/**
 * A tiny external store for the UI layer.
 *
 * Snapshots arrive at 20 Hz; HUD components subscribe through
 * `useSyncExternalStore` and re-render only when the slice they select
 * changes. Detail fields (inventory, skill tree, weapon) are cached from the
 * last detail snapshot so lite snapshots never blank the HUD.
 */

import { useSyncExternalStore } from 'react';

import type {
  GameSnapshot, Inventory, PlayerStats, RoomFull, ServerEvent, SkillNode, WeaponInfo,
} from '@/game/contracts';
import { isRoomFull } from '@/game/contracts';
import { eventBus } from '@/game/EventBus';
import type { ConnectionStatus } from '@/game/types';

export type Screen = 'none' | 'pause' | 'inventory' | 'skills' | 'settings' | 'controls';

export interface Toast {
  id: number;
  kind: 'info' | 'good' | 'warn' | 'ai';
  title: string;
  detail?: string;
  at: number;
}

export interface UiState {
  snapshot: GameSnapshot | null;
  room: RoomFull | null;
  playerDetail: { inventory: Inventory | null; skillTree: SkillNode[]; weapon: WeaponInfo | null; stats: PlayerStats | null; unlockedSkills: string[] };
  twinDetail: { inventory: Inventory | null; weapon: WeaponInfo | null };
  connection: ConnectionStatus;
  attempt: number;
  ready: boolean;
  loading: number;
  screen: Screen;
  toasts: Toast[];
  recentEvents: ServerEvent[];
  fullscreen: boolean;
}

let state: UiState = {
  snapshot: null,
  room: null,
  playerDetail: { inventory: null, skillTree: [], weapon: null, stats: null, unlockedSkills: [] },
  twinDetail: { inventory: null, weapon: null },
  connection: 'connecting',
  attempt: 0,
  ready: false,
  loading: 0,
  screen: 'none',
  toasts: [],
  recentEvents: [],
  fullscreen: false,
};

const listeners = new Set<() => void>();
let toastId = 0;

function set(patch: Partial<UiState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function getUiState(): UiState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUi<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function openScreen(screen: Screen): void {
  const wasOpen = state.screen !== 'none';
  set({ screen });
  const open = screen !== 'none';
  if (open !== wasOpen) eventBus.emit('ui:modal', { open });
  // Pausing is a server decision; menus just ask.
  if (open && !wasOpen) eventBus.emit('ui:command', { type: 'COMMAND', action: 'PAUSE' });
  if (!open && wasOpen) eventBus.emit('ui:command', { type: 'COMMAND', action: 'RESUME' });
}

export function toggleScreen(screen: Screen): void {
  openScreen(state.screen === screen ? 'none' : screen);
}

export function pushToast(kind: Toast['kind'], title: string, detail?: string): void {
  const toast: Toast = { id: ++toastId, kind, title, at: performance.now(), ...(detail ? { detail } : {}) };
  set({ toasts: [...state.toasts.slice(-5), toast] });
  window.setTimeout(() => {
    set({ toasts: state.toasts.filter((t) => t.id !== toast.id) });
  }, 3800);
}

// --- wiring ------------------------------------------------------------------

let lastHudPush = 0;

eventBus.on('game:snapshot', (snap) => {
  const patch: Partial<UiState> = {};
  if (isRoomFull(snap.room)) patch.room = snap.room;
  else if (state.room && state.room.index === snap.room.index) {
    patch.room = { ...state.room, cleared: snap.room.cleared, doors: snap.room.doors };
  }
  if (snap.player.inventory) {
    patch.playerDetail = {
      inventory: snap.player.inventory,
      skillTree: snap.player.skillTree ?? state.playerDetail.skillTree,
      weapon: snap.player.weapon ?? state.playerDetail.weapon,
      stats: snap.player.stats ?? state.playerDetail.stats,
      unlockedSkills: snap.player.unlockedSkills ?? state.playerDetail.unlockedSkills,
    };
  }
  if (snap.twin.inventory) {
    patch.twinDetail = { inventory: snap.twin.inventory, weapon: snap.twin.weapon ?? state.twinDetail.weapon };
  }
  // The HUD does not need every one of the 20 snapshots a second; 10 is plenty
  // and halves React work. Detail snapshots always go through.
  const now = performance.now();
  const detail = Boolean(snap.player.inventory) || isRoomFull(snap.room);
  if (detail || now - lastHudPush > 95 || snap.phase !== state.snapshot?.phase) {
    patch.snapshot = snap;
    lastHudPush = now;
  }
  if (Object.keys(patch).length) set(patch);
});

eventBus.on('game:events', (events) => {
  set({ recentEvents: [...state.recentEvents, ...events].slice(-80) });
  for (const e of events) {
    switch (e.type) {
      case 'LEVEL_UP':
        pushToast('good', `Level ${e.data.level}`, 'Skill point earned - press K');
        break;
      case 'ROOM_CLEARED':
        pushToast('good', 'Room cleared', 'The gate is open. Head north.');
        break;
      case 'ROOM_ENTER':
        if (e.data.first_visit) pushToast('info', String(e.data.name ?? 'New room'), String(e.data.room_type ?? '').replace(/^\w/, (c: string) => c.toUpperCase()));
        break;
      case 'ITEM_PICKUP':
        if (e.data.kind === 'weapon') pushToast('good', 'New weapon', `${String(e.data.item_id).replace('_', ' ')} - equip it from the inventory (I)`);
        else if (e.data.kind === 'relic') pushToast('good', 'Relic found', String(e.data.item_id).replace('_', ' '));
        break;
      case 'SKILL_UNLOCKED':
        pushToast('good', 'Skill unlocked', String(e.data.skill).replace('_', ' '));
        break;
      case 'TWIN_DOWNED':
        pushToast('warn', 'Your twin is down', 'It will recover in a few seconds.');
        break;
      case 'BOSS_COUNTER':
        pushToast('ai', 'The Mirror adapts', String(e.data.detail));
        break;
      case 'PLAYER_DIED':
        pushToast('warn', 'You fell', 'Respawning at the room entrance.');
        break;
      case 'RUN_COMPLETE':
        pushToast('good', 'The Mirror is broken', 'Run complete.');
        break;
      default:
        break;
    }
  }
});

eventBus.on('game:connection', ({ status, attempt }) => set({ connection: status, attempt }));
eventBus.on('game:ready', () => set({ ready: true }));
eventBus.on('game:loading', ({ progress }) => set({ loading: progress }));
eventBus.on('game:fullscreen', ({ active }) => set({ fullscreen: active }));
