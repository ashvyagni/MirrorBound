import type { CommandMessage, GameSnapshot, ServerEvent } from './contracts';
import type { ConnectionStatus, PlayerSnapshot } from './types';
import type { Settings } from '../ui/settings';

/**
 * The only channel between React and Phaser (and the network).
 *
 * React never reaches into a scene; Phaser never touches the DOM. Everything
 * crosses here, typed.
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
