import type { AreaSnap, CommandMessage, GameSnapshot, ServerEvent, SkillNode } from './contracts';
import type { ConnectionStatus, PlayerSnapshot } from './types';
import type { Settings } from '../ui/settings';
import type { BroClipName } from './animation/broClips';
import type { ClipName } from './animation/goatClips';
import type { WeaponId } from './animation/weaponClips';
import type { IconName } from './animation/icons';
import type { MapView } from './hud/Minimap';
import type { PauseStats as PauseSnapshot } from './hud/PauseScreen';
import type { LoadoutSnapshot } from './state/Loadout';
import type { VitalsSnapshot } from './state/Vitals';
import type { Run as RunSnapshot } from './world/Run';
import type { PlayerState } from './types';

/**
 * The only channel between React, Phaser and the network.
 *
 * React never reaches into a scene; Phaser never touches the DOM. Everything
 * crosses here, typed.
 *
 * It carries two families of event, and the split is the whole shape of this
 * client. `game:snapshot` and its neighbours are the server talking: they are
 * authoritative, they arrive twenty times a second, and nothing the interface
 * does can change what is in them. Everything under `vitals:`, `loadout:`,
 * `map:` and the rest is the HUD's own vocabulary -- small, already-shaped
 * facts about what to draw.
 *
 * `hud/Bridge.ts` is the only thing that speaks both. It reads a snapshot and
 * emits the second family from it, which is what lets the HUD stay a pure view
 * of already-decided state and keeps the word "snapshot" out of every panel.
 */
export interface GameEventMap {
  /** The play scene finished booting and is accepting commands. */
  'game:ready': { scene: string };
  /** Asset loading progress, 0..1. */
  'game:loading': { progress: number };
  /** A full authoritative snapshot arrived from the server. */
  'game:snapshot': GameSnapshot;
  /** Server events since the previous snapshot (VFX / audio / toasts). */
  'game:events': ServerEvent[];
  /** WebSocket state. */
  'game:connection': { status: ConnectionStatus; attempt: number };
  /** Emitted whenever the local player view's state or facing changes. */
  'player:changed': PlayerSnapshot;
  /** UI asks the server to do something discrete (equip, unlock, pause...). */
  'ui:command': CommandMessage;
  /** UI opened or closed a screen; the game stops sending movement while open. */
  'ui:modal': { open: boolean };
  /** Settings changed (volume, zoom, quality, debug overlay). */
  'ui:settings': Settings;
  /** Ask the game to enter or leave fullscreen. Must originate from a click. */
  'game:toggle-fullscreen': Record<string, never>;
  /** Reports whether the game is currently fullscreen. */
  'game:fullscreen': { active: boolean };
  /** Toggle physics/debug drawing in-world. */
  'debug:toggle-overlay': { enabled: boolean };

  // --- the HUD's own vocabulary, fed by hud/Bridge.ts ------------------------
  /**
   * The HUD scene has built and subscribed.
   *
   * `scene.launch` defers the new scene's `create` to the next step, so
   * anything the play scene pushes during its own `create` is emitted into an
   * empty room -- which left the plate showing the placeholder icons it was
   * constructed with, at their natural size. The HUD says when it is listening
   * and the state is pushed then.
   */
  'hud:ready': Record<string, never>;
  /** Emitted every frame; the UI throttles this itself. */
  'player:tick': PlayerSnapshot;
  /** Force a specific clip, ignoring the state machine. For the debug dock. */
  'debug:play-clip': { clip: ClipName };
  /** Ask the character to take a hit, die, or reset. */
  'debug:force-state': { state: Extract<PlayerState, 'hurt' | 'die'> | 'reset' };
  /** Make the companion perform an emote now. */
  'bro:perform': { clip: BroClipName };
  /** Emitted when the companion changes what it is doing. */
  'bro:changed': { clip: BroClipName; mood: string };
  /** Equip a weapon, or pass null to put it away. */
  'weapon:equip': { id: WeaponId | null };
  /** Reports the equipped weapon and where the combo is up to. */
  'weapon:changed': { id: WeaponId | null; step: number; length: number };
  /** Cast the ability in the given slot of the equipped weapon. */
  'weapon:cast': { slot: number };
  /**
   * Everything currently recharging, pushed a few times a second while any
   * ability is, and once more as the last one finishes.
   *
   * The game is the only clock. Letting each view run its own timer instead
   * looked cheaper -- until the game paused, because a scene counts in game
   * time and `performance.now()` does not, and the two then disagree about
   * whether a spell is ready.
   */
  'weapon:cooldowns': { active: Partial<Record<IconName, { left: number; total: number }>> };
  /** The in-game bar handled this frame's click, so nothing else should also
   *  act on it -- clicking a weapon slot must not swing the weapon too. */
  'hud:pointer-used': Record<string, never>;
  /**
   * Health and mana, pushed whenever either changes.
   *
   * Shaped like the server's player snapshot on `main`, so the day this branch
   * starts reading one the emit site moves and no view changes.
   */
  'vitals:changed': VitalsSnapshot;
  /** The two carried weapons, which hand is in use, and the selected potion. */
  'loadout:changed': LoadoutSnapshot;
  /** Put a weapon into one of the two hands. Null empties it. */
  'loadout:set-slot': { slot: 0 | 1; id: WeaponId | null };
  /** Swap which hand is in use. */
  'loadout:swap': Record<string, never>;
  /** Draw from a named hand. */
  'loadout:select': { slot: 0 | 1 };
  /** Turn the potion dial. */
  'loadout:cycle-potion': { step: -1 | 1 };
  /** Drink the selected potion. */
  'loadout:use-potion': Record<string, never>;
  /** A potion was drunk, and what it did. Drives the flash on the dial. */
  'loadout:potion-used': { id: string; heal: number; mana: number };
  /** A potion was refused: the dial is pointing at an empty stack. */
  'loadout:potion-empty': { id: string };
  /** Where everything is, for the minimap. Pushed a few times a second: the
   *  map is 260 pixels across, and nothing on it moves a whole pixel in a
   *  frame. */
  'map:changed': MapView;
  /** Open or close the full map. */
  'map:toggle': Record<string, never>;
  /** The Reach: every area, and whether you can set out right now. */
  'campaign:changed': {
    areas: readonly AreaSnap[];
    /** Travel only ever leaves from a village; the map says so when it cannot. */
    canTravel: boolean;
  };
  /** Where the player is in the run, for the full map. */
  'run:changed': RunSnapshot;
  /** Mark a moment: death, a room cleared, a level gained. */
  'flourish': { name: 'death' | 'victory' | 'levelUp' };
  /** Take the held mark down. Only death holds, so only death needs this. */
  'flourish:clear': Record<string, never>;
  /** Open or close the settings screen. */
  'settings:toggle': Record<string, never>;
  /** Stop the game reading the keyboard, while a key is being rebound. */
  'input:suspend': { suspended: boolean };
  /** Put the Mirror in the room, for testing. */
  'debug:spawn-boss': Record<string, never>;
  /** Open or close the console. */
  'console:toggle': Record<string, never>;
  /** Open or close the skill tree. */
  'skills:toggle': Record<string, never>;
  /** The tree, its points, and whether unlearning is allowed here. */
  'skills:changed': {
    nodes: readonly SkillNode[];
    points: number;
    /** Empty when unlearning is allowed; otherwise why it is not. */
    respecBlockedBy: string;
  };
  /** Pause or resume. The play scene stops; the HUD does not. */
  'game:pause': { paused: boolean };
  /** What the pause screen shows. Pushed when it opens. */
  'pause:stats': PauseSnapshot;
  /** What the goat is standing next to, or null. Drives the prompt. */
  'interact:target': { label: string; x: number; y: number } | null;
  /** Toggle physics body overlays. */
  'debug:toggle-bodies': { enabled: boolean };
}

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

class TypedEventBus {
  readonly #handlers = new Map<keyof GameEventMap, Set<Handler<never>>>();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<K>): () => void {
    let set = this.#handlers.get(event);
    if (!set) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<K>): void {
    this.#handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.#handlers.get(event);
    if (!set) return;
    // Copy first: a handler may unsubscribe itself while we iterate.
    for (const handler of [...set]) (handler as Handler<K>)(payload);
  }

  clear(): void {
    this.#handlers.clear();
  }
}

export const eventBus = new TypedEventBus();
