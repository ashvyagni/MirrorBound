import type { BroClipName } from './animation/broClips';
import type { ClipName } from './animation/goatClips';
import type { WeaponId } from './animation/weaponClips';
import type { PlayerSnapshot, PlayerState } from './types';

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
