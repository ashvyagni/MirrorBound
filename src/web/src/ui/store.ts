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
import { Interactions } from '@/game/state/Interactions';
import type { NoticeKind } from '@/game/hud/Notifications';
import type { ConnectionStatus } from '@/game/types';

export type Screen =
  | 'none' | 'pause' | 'inventory' | 'skills' | 'settings' | 'controls'
  | 'character' | 'map' | 'dialogue' | 'naming' | 'console' | 'sandbox' | 'agent';

/** An open conversation. Held here, not invented here: every line comes from the server. */
export interface Conversation {
  npcId: string;
  name: string;
  role: string;
  lines: string[];
  stock: NpcSnap['stock'];
}

export interface UiState {
  snapshot: GameSnapshot | null;
  room: RoomFull | null;
  playerDetail: { inventory: Inventory | null; skillTree: SkillNode[]; weapon: WeaponInfo | null; stats: PlayerStats | null; unlockedSkills: string[] };
  twinDetail: { inventory: Inventory | null; weapon: WeaponInfo | null };
  connection: ConnectionStatus;
  attempt: number;
  connectionMessage: string | null;
  ready: boolean;
  loading: number;
  screen: Screen;
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
  connectionMessage: null,
  ready: false,
  loading: 0,
  screen: 'none',
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

let resumeAfterMenu = false;
let pendingPause: boolean | null = null;
let serverPaused = false;
export function isPauseRequested(): boolean { return pendingPause ?? serverPaused; }
eventBus.on('ui:command', (cmd) => {
  const wanted = cmd.action === 'PAUSE' ? true
    : cmd.action === 'RESUME' || cmd.action === 'RESTART' ? false
    : null;
  if (wanted === null) return;
  const changed = wanted !== isPauseRequested();
  pendingPause = wanted;
  // The pause *panel* follows the request, not the server's confirmation.
  //
  // It used to follow only `snapshot.paused`, which arrives a round trip
  // later, so closing a conversation showed the pause screen for exactly as
  // long as the server took to answer the RESUME -- a flash on a slow tick and
  // nothing at all on a fast one, which is why it looked intermittent. The
  // panel is pure interface and nothing else listens to this, so the intent is
  // the right thing for it to track; the snapshot still corrects it for pauses
  // nobody here asked for.
  if (changed) eventBus.emit('game:pause', { paused: wanted });
});

export function openScreen(screen: Screen): void {
  if (state.screen === screen) return;
  const wasOpen = state.screen !== 'none';
  const open = screen !== 'none';
  if (open && !wasOpen) resumeAfterMenu = !isPauseRequested();
  set({ screen, ...(screen !== 'dialogue' ? { conversation: null } : {}) });

  // A menu borrows the pause; closing it must preserve an existing manual one.
  //
  // Order matters both ways, and it is the same rule each time: settle the
  // thing that *hides* the pause panel before the thing that could reveal it.
  // On the way out that means giving the pause back first -- announcing the
  // menu closed while the world was still paused is what put the pause screen
  // on screen for a moment on the way out of a conversation.
  if (!open && wasOpen && resumeAfterMenu) {
    resumeAfterMenu = false;
    command({ action: 'RESUME' });
  }
  if (open !== wasOpen) eventBus.emit('ui:modal', { open });
  eventBus.emit('ui:screen', { screen });
  // On the way in the modal flag is already set, so the pause cannot show.
  if (open && !wasOpen && resumeAfterMenu) command({ action: 'PAUSE' });
}

for (const screen of ['inventory', 'skills', 'map', 'settings', 'console', 'sandbox', 'agent'] as const) {
  eventBus.on(`${screen}:toggle`, () => toggleScreen(screen));
}
eventBus.on('ui:screen-close', ({ screen }) => {
  if (state.screen === screen) openScreen('none');
});
eventBus.on('hud:ready', () => {
  eventBus.emit('ui:screen', { screen: state.screen });
  eventBus.emit('ui:modal', { open: state.screen !== 'none' });
});

export function toggleScreen(screen: Screen): void {
  openScreen(state.screen === screen ? 'none' : screen);
}

/** Send a command to the server. The UI never changes game state itself. */
export function command(message: Omit<CommandMessage, 'type'>): void {
  eventBus.emit('ui:command', { ...message, type: 'COMMAND' });
}

/** What the player can afford and already has, for an open shop. */
function purse(): { gold: number; owned: string[] } {
  const inventory = state.playerDetail.inventory;
  return {
    gold: inventory?.gold ?? 0,
    owned: [
      ...(inventory?.weapons ?? []).map((w) => w.id),
      ...(inventory?.relics ?? []).map((r) => r.id),
    ],
  };
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

/**
 * Raise a notice over the world.
 *
 * The canvas draws it. This used to hold a list for a React component to
 * render as a rounded DOM box with a CSS shadow, which sat over hand-drawn
 * chrome and gave away that the game is a web page; `hud/Notifications.ts`
 * builds the same message out of the plate that was drawn for it. Nothing here
 * tracks what is on screen -- how long a notice holds, and how many fit, are
 * questions for the thing that draws them.
 */
export function pushToast(kind: NoticeKind, title: string, detail?: string): void {
  eventBus.emit('hud:notice', { kind, title, ...(detail ? { detail } : {}) });
}

// --- wiring ------------------------------------------------------------------

let lastHudPush = 0;
/** The opening name prompt is a one-off, not a thing that can come back. */
let askedForName = false;
const interactions = new Interactions();

eventBus.on('game:snapshot', (snap) => {
  serverPaused = snap.paused;
  if (pendingPause === snap.paused) pendingPause = null;
  const patch: Partial<UiState> = {};
  if (isRoomFull(snap.room)) patch.room = snap.room;
  else if (state.room && state.room.id === snap.room.id) {
    patch.room = { ...state.room, cleared: snap.room.cleared, doors: snap.room.doors };
  }
  else patch.room = null;
  if (snap.player.inventory) {
    patch.playerDetail = {
      inventory: snap.player.inventory,
      skillTree: snap.player.skillTree ?? state.playerDetail.skillTree,
      weapon: snap.player.weapon ?? state.playerDetail.weapon,
      stats: snap.player.stats ?? state.playerDetail.stats,
      unlockedSkills: snap.player.unlockedSkills ?? state.playerDetail.unlockedSkills,
    };
    // An open shop has to stay honest about what you can afford, and the gold
    // only changes on the detail snapshots this block runs for.
    const inventory = snap.player.inventory;
    eventBus.emit('hud:purse', {
      gold: inventory.gold,
      owned: [...inventory.weapons.map((w) => w.id), ...inventory.relics.map((r) => r.id)],
    });
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
  const near = interactions.update(snap);
  if (interactions.npcs !== state.npcs) patch.npcs = interactions.npcs;
  // A conversation in progress keeps track of where the speaker is: the camera
  // moves even when they do not, and the bubble is anchored to them.
  if (state.conversation) {
    const speaker = interactions.npcs.find((n) => n.id === state.conversation!.npcId);
    if (speaker) eventBus.emit('hud:speaker', { at: speaker.position });
  }
  if (near !== state.nearbyNpc) patch.nearbyNpc = near;
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
      case 'TWIN_CALLED':
        pushToast('info', 'Your twin is regrouping', 'Following you for three seconds.');
        break;
      case 'TWIN_ITEM_GIVEN':
        pushToast('good', 'Weapon transferred', String(e.data.weapon).replace(/_/g, ' '));
        break;
      case 'TWIN_REVIVED':
        if (e.data.restored) pushToast('good', 'Your twin is back', 'The Mirror no longer holds it.');
        break;
      case 'TWIN_TAKEN':
        pushToast('warn', 'The Mirror has taken your twin', 'Defeat it to bring your twin back.');
        break;
      case 'TWIN_DOWNED':
        pushToast('warn', 'Your twin is down', 'It will recover in a few seconds.');
        break;
      case 'BOSS_COUNTER':
        pushToast('ai', 'The Mirror adapts', String(e.data.detail));
        break;
      case 'PLAYER_DIED':
        // The Sanctum is the one room where dying ends the run; the end screen
        // says so, and promising a respawn there would be a lie.
        if (!e.data.final) pushToast('warn', 'You fell', 'Respawning at the room entrance.');
        break;
      case 'SAVE_CREATED':
        // A new run is a new character, so the game has to be willing to ask
        // for a name again. `askedForName` is a module-level latch that only
        // ever went one way, which is why every slot after the first arrived
        // nameless and was never asked -- the same latch the reset below had
        // to reload the page to escape.
        //
        // Cleared rather than forced: if a name was typed into the new-run
        // prompt the server has already taken it, the campaign is no longer
        // called Wanderer, and the condition below will not fire.
        askedForName = false;
        pushToast('good', 'A new run', e.data.named ? 'Saved and ready.' : 'Name yourself when you land.');
        break;
      case 'DATA_RESET':
        // Reload rather than patch the page back to its opening state.
        //
        // A reset leaves a lot of module-level state behind that has no reason
        // to know about it -- the "have we asked for a name yet" latch most of
        // all, which is why a reset used to drop you into a nameless fresh
        // campaign with no prompt. The server has already thrown the profile
        // away, so a reload is a genuine new start rather than a cosmetic one.
        pushToast('warn', 'Everything erased', 'Starting over…');
        window.setTimeout(() => window.location.reload(), 700);
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
      case 'NPC_TALK': {
        // Parsed here, drawn by the canvas. The purse travels with it so the
        // screen never has to reach back into this store for it.
        const npcId = String(e.data.npc);
        const speaker = state.npcs.find((n) => n.id === npcId);
        const conversation = {
          npcId, name: String(e.data.name), role: String(e.data.role),
          lines: (e.data.lines ?? []) as string[], stock: (e.data.stock ?? []) as NpcSnap['stock'],
          // Where they are standing, so the bubble can sit over their head.
          ...(speaker ? { at: speaker.position } : {}),
        };
        set({ conversation });
        eventBus.emit('hud:conversation', { conversation, ...purse() });
        openScreen('dialogue');
        break;
      }
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
      case 'SESSION_REPLACED':
        set({ connectionMessage: 'This save is open in another tab. Close that tab and reload to continue here.' });
        pushToast('warn', 'This save is open in another tab', 'Close the other tab and reload to continue here.');
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
        if (e.data.reason) {
          pushToast('warn', 'Not yet', String(e.data.reason ?? ''));
        }
        break;
      default:
        break;
    }
  }
});

eventBus.on('game:connection', ({ status, attempt }) => {
  set({ connection: status, attempt, ...(status === 'open' ? { connectionMessage: null } : {}) });
  if (status === 'open' && (state.screen !== 'none' || isPauseRequested())) command({ action: 'PAUSE' });
});
eventBus.on('game:ready', () => set({ ready: true }));
eventBus.on('game:loading', ({ progress }) => set({ loading: progress }));
eventBus.on('game:fullscreen', ({ active }) => set({ fullscreen: active }));

// Dev-only handle for QA scripts and the console: `__mirrorbound.getUiState().snapshot`.
if (import.meta.env.DEV) {
  (window as unknown as { __mirrorbound?: unknown }).__mirrorbound = {
    getUiState, eventBus, openScreen, pushToast, command,
  };
}
