import type { ClipName } from './animation/clips';
import type { PlayerSnapshot, PlayerState, GameSnapshot, EnemySnapshot, TwinSnapshot } from './types';

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
  /** Toggle physics body overlays. */
  'debug:toggle-bodies': { enabled: boolean };
  /** Full game snapshot from server. */
  'game:snapshot': GameSnapshot;
  /** Enemy update from server. */
  'enemy:update': EnemySnapshot[];
  /** Twin update from server. */
  'twin:update': TwinSnapshot;
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
    for (const handler of [...set]) (handler as Handler<K>)(payload);
  }

  clear(): void {
    this.#handlers.clear();
  }
}

export const eventBus = new TypedEventBus();
