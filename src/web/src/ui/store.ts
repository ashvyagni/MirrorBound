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
  CampaignSnap, CommandMessage, GameSnapshot, Inventory, NpcSnap, PlayerStats, RoomFull,
  ServerEvent, SkillNode, WeaponInfo,
} from '@/game/contracts';
import { isRoomFull } from '@/game/contracts';
import { eventBus } from '@/game/EventBus';
import type { ConnectionStatus } from '@/game/types';

export type Screen =
  | 'none' | 'pause' | 'inventory' | 'skills' | 'settings' | 'controls'
  | 'character' | 'map' | 'dialogue' | 'naming';

/** An open conversation. Held here, not invented here: every line comes from the server. */
export interface Conversation {
  npcId: string;
  name: string;
  role: string;
  lines: string[];
  stock: NpcSnap['stock'];
}

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
  campaign: CampaignSnap | null;
  npcs: NpcSnap[];
  /** The NPC you are standing next to, if any: what the interact prompt names. */
  nearbyNpc: NpcSnap | null;
  conversation: Conversation | null;
  /** Set once, before the campaign starts, so the opening asks who you are. */
  namePrompt: 'player' | 'twin' | null;
  /**
   * The Controls screen is waiting for a key to bind.
   *
   * Held here rather than in that component because the global hotkey handler
   * has to know: while a rebind is armed, the next key press is a binding and
   * must not also open the inventory.
   */
  rebinding: { action: string; slot: 'primary' | 'secondary' } | null;
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
  campaign: null,
  npcs: [],
  nearbyNpc: null,
  conversation: null,
  namePrompt: null,
  rebinding: null,
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

/** Send a command to the server. The UI never changes game state itself. */
export function command(message: Omit<CommandMessage, 'type'>): void {
  eventBus.emit('ui:command', { ...message, type: 'COMMAND' });
}

export function closeConversation(): void {
  set({ conversation: null });
  if (state.screen === 'dialogue') openScreen('none');
}

export function setRebinding(rebinding: UiState['rebinding']): void {
  set({ rebinding });
}

export function askForNames(which: 'player' | 'twin'): void {
  set({ namePrompt: which });
  openScreen('naming');
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
/** The opening name prompt is a one-off, not a thing that can come back. */
let askedForName = false;

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
  if (snap.campaign) {
    patch.campaign = snap.campaign;
    // Ask who you are, once, before the campaign has gone anywhere. Only in a
    // village, so it never interrupts a fight, and never after the first area
    // is behind you -- by then the name has been in dialogue and changing it
    // mid-story would read as a bug rather than a choice.
    if (
      !askedForName
      && snap.campaign.playerName === 'Wanderer'
      && snap.campaign.completed.length === 0
      && isRoomFull(snap.room) && snap.room.safe
    ) {
      askedForName = true;
      window.setTimeout(() => askForNames('player'), 600);
    }
  }
  if (snap.npcs) patch.npcs = snap.npcs;
  // Who you could talk to right now. Computed from the authoritative positions
  // rather than tracked, so it can never drift out of step with the world.
  const npcs = patch.npcs ?? state.npcs;
  if (npcs.length) {
    const p = snap.player.position;
    const near = npcs.find((n) => Math.hypot(n.position.x - p.x, n.position.y - p.y) <= n.radius) ?? null;
    if ((near?.id ?? null) !== (state.nearbyNpc?.id ?? null)) patch.nearbyNpc = near;
  } else if (state.nearbyNpc) {
    patch.nearbyNpc = null;
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
      case 'ROOM_CLEARED': {
        // The last room of a run has nothing north of it, so pointing that way
        // sends the player at a sealed wall. `isRoomFull` because a lite room
        // snapshot carries no doors to read.
        const room = state.room;
        const onward = room !== null && isRoomFull(room)
          && room.doors.some((d) => d.side === 'north' && d.targetIndex !== null && !d.locked);
        pushToast('good', 'Room cleared', onward ? 'The gate is open. Head north.' : 'Nothing left in here.');
        break;
      }
      case 'ROOM_ENTER':
        if (e.data.first_visit) pushToast('info', String(e.data.name ?? 'New room'), String(e.data.room_type ?? '').replace(/^\w/, (c: string) => c.toUpperCase()));
        break;
      case 'ITEM_PICKUP':
        if (e.data.kind === 'weapon') pushToast('good', 'New weapon', `${String(e.data.item_id).replace('_', ' ')} - equip it from the inventory (I)`);
        else if (e.data.kind === 'relic') pushToast('good', 'Relic found', String(e.data.item_id).replace('_', ' '));
        break;
      case 'SKILL_UNLOCKED':
        // The same event carries a respec, which has no skill to name.
        if (e.data.respec) {
          pushToast('good', 'Unlearned', `${e.data.refunded} point${e.data.refunded === 1 ? '' : 's'} back.`);
        } else {
          pushToast('good', 'Skill unlocked', String(e.data.skill).replace('_', ' '));
        }
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
      case 'AREA_DISCOVERED':
        pushToast('info', `${String(e.data.name)} is on your map`, String(e.data.subtitle ?? ''));
        break;
      case 'AREA_ENTER':
        pushToast('info', String(e.data.name ?? 'Somewhere new'), String(e.data.subtitle ?? ''));
        break;
      case 'NPC_TALK':
        set({
          conversation: {
            npcId: String(e.data.npc), name: String(e.data.name), role: String(e.data.role),
            lines: (e.data.lines ?? []) as string[], stock: (e.data.stock ?? []) as NpcSnap['stock'],
          },
        });
        openScreen('dialogue');
        break;
      case 'SHOP_PURCHASE':
        pushToast('good', 'Bought', `${String(e.data.item).replace(/_/g, ' ')} for ${e.data.price} gold`);
        break;
      case 'GOLD_GAINED':
        break;   // too frequent for a toast; the HUD counter is the feedback
      case 'QUEST_UPDATED':
        if (e.data.rescued) {
          pushToast('good', 'You found your twin', 'It will follow, and it will learn.');
          // Naming it is the first thing you get to decide about it.
          if (!state.campaign?.twinNamed) window.setTimeout(() => askForNames('twin'), 900);
        } else if (e.data.first && e.data.seal) {
          pushToast('good', `${String(e.data.name)} is quiet`, `+${e.data.gold} gold`);
        }
        break;
      case 'CHECKPOINT_SAVED':
        pushToast('info', 'Progress saved', e.data.safe ? 'The village remembers.' : 'You can pick this up again.');
        break;
      case 'TWIN_WEAPON_SWITCH':
        pushToast('ai', 'Your twin changed weapon', String(e.data.weapon).replace(/_/g, ' '));
        break;
      case 'ABILITY_INTERRUPTED':
        pushToast('warn', 'Cast interrupted', 'You were hit mid-channel.');
        break;
      case 'ACTION_REJECTED':
        if (e.data.action === 'BUY_ITEM' || e.data.action === 'TRAVEL') {
          pushToast('warn', 'Not yet', String(e.data.reason ?? ''));
        }
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

// Dev-only handle for QA scripts and the console: `__mirrorbound.getUiState().snapshot`.
if (import.meta.env.DEV) {
  (window as unknown as { __mirrorbound?: unknown }).__mirrorbound = {
    getUiState, eventBus, openScreen, pushToast, command,
  };
}
