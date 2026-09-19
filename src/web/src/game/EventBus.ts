import type { BroClipName } from './animation/broClips';
import type { MapView } from './hud/Minimap';
import type { Run as RunSnapshot } from './world/Run';
import type { LoadoutSnapshot } from './state/Loadout';
import type { VitalsSnapshot } from './state/Vitals';
import type { ClipName } from './animation/goatClips';
import type { SlotId, WeaponId } from './animation/weaponClips';
import type { PlayerSnapshot, PlayerState, ConnectionStatus } from './types';
import type { CommandMessage, GameSnapshot, ServerEvent } from './contracts';
import type { Settings } from '../ui/settings';

/**
 * The only channel between React and Phaser.
 *
 * Keeping it to one typed bus means the game never reaches into the DOM and
 * React never reaches into a scene -- so the game can later be driven by a
 * WebSocket feed from the backend through the same events, with nothing in the
 * UI needing to know the difference.
 */
export interface GameEventMap {
  /** The play scene finished booting and is accepting commands. */
  'game:ready': { scene: string };
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
  /** Asset loading progress, 0..1. */
  'game:loading': { progress: number };
  /** Emitted whenever the player's state or facing changes. */
  'player:changed': PlayerSnapshot;
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
  /** Ask the game to enter or leave fullscreen. Must originate from a click:
   *  browsers only grant fullscreen inside a user gesture, and the bus is
   *  synchronous, so the gesture survives the hop into Phaser. */
  'game:toggle-fullscreen': Record<string, never>;
  /** Reports whether the game is currently fullscreen. */
  'game:fullscreen': { active: boolean };
  /** Cast the ability in the given slot of the equipped weapon. */
  'weapon:cast': { slot: number };
  /** Reports what was cast, and how long it is now recharging for. The UI
   *  runs its own timer off this rather than being told every frame: the game
   *  stays the authority on whether a cast is allowed, and a sweep is purely
   *  something to look at. */
  'weapon:cast-done': { id: SlotId; cooldown: number };
  /** A cast was refused because the ability is still recharging. */
  'weapon:cast-blocked': { id: SlotId; remaining: number };
  /**
   * Everything currently recharging, pushed a few times a second while any
   * ability is, and once more as the last one finishes.
   *
   * The game is the only clock. Letting each view run its own timer instead
   * looked cheaper -- until the game paused, because a scene counts in game
   * time and `performance.now()` does not, and the two then disagree about
   * whether a spell is ready.
   */
  'weapon:cooldowns': { active: Partial<Record<SlotId, { left: number; total: number }>> };
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
  /** Where the player is in the run, for the full map. */
  'run:changed': RunSnapshot;
  /** Mark a moment: death, a room cleared, a level gained. */
  'flourish': { name: 'death' | 'victory' | 'levelUp' };
  /** Take the held mark down. Only death holds, so only death needs this. */
  'flourish:clear': Record<string, never>;
  /** Toggle physics body overlays. */
  'debug:toggle-bodies': { enabled: boolean };
  // --- network + React shell (from main) ----------------------------------
  // Logesh's views above are fed from these: PlayScene turns each authoritative
  // snapshot into `vitals:changed` / `loadout:changed` / `weapon:cooldowns` /
  // `map:changed` / `run:changed`, which is the "the emit site moves and no
  // view changes" swap his Vitals.ts note describes.

  /** A full authoritative snapshot arrived from the server. */
  'game:snapshot': GameSnapshot;
  /** Server events since the previous snapshot (VFX / audio / toasts). */
  'game:events': ServerEvent[];
  /** WebSocket state. */
  'game:connection': { status: ConnectionStatus; attempt: number };
  /** UI asks the server to do something discrete (equip, unlock, pause...). */
  'ui:command': CommandMessage;
  /** UI opened or closed a screen; the game stops sending movement while open. */
  'ui:modal': { open: boolean };
  /** Settings changed (volume, zoom, quality, debug overlay). */
  'ui:settings': Settings;
  /** Toggle the in-world AI debug drawing. */
  'debug:toggle-overlay': { enabled: boolean };

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
