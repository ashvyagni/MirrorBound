/**
 * WebSocket client: sends input/commands, receives snapshots.
 *
 * The session id comes from `?session=` (so two tabs can run two games) and
 * the seed from `?seed=` (so a run can be reproduced). Reconnects with backoff.
 */

import type { CommandMessage, GameSnapshot, InputMessage } from '../contracts';
import { eventBus } from '../EventBus';
import type { ConnectionStatus } from '../types';

import { sessionIdentity } from './sessionIdentity';

const MAX_ATTEMPTS = 12;
/** An open socket that has not delivered a snapshot in this long is considered dead. */
const SILENCE_TIMEOUT_MS = 3000;

export class WebSocketClient {
  #ws: WebSocket | null = null;
  #attempt = 0;
  #closedByUs = false;
  #seq = 0;
  #lastInputJson = '';
  #lastInputAt = 0;
  #watchdog: number | null = null;
  #firstSnapshotAt: number | null = null;
  readonly #createdAt = performance.now();
  readonly sessionId: string;
  readonly seed: string | null;

  constructor(sessionId?: string) {
    const params = new URLSearchParams(window.location.search);
    this.sessionId = sessionIdentity(sessionId);
    this.seed = params.get('seed');
  }

  get status(): ConnectionStatus {
    if (!this.#ws) return 'closed';
    switch (this.#ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      default: return 'closed';
    }
  }

  url(): string {
    const params = new URLSearchParams(window.location.search);
    const explicit = params.get('server');
    if (explicit) return `${explicit.replace(/\/$/, '')}/ws/${encodeURIComponent(this.sessionId)}${this.seed ? `?seed=${this.seed}` : ''}`;
    
    if (import.meta.env.VITE_WS_URL) {
      return `${import.meta.env.VITE_WS_URL.replace(/\/$/, '')}/ws/${encodeURIComponent(this.sessionId)}${this.seed ? `?seed=${this.seed}` : ''}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // "localhost" resolves to ::1 first in Chromium and the server listens on
    // IPv4; the fallback costs ~300 ms per connect, so go straight to 127.0.0.1.
    const pageHost = window.location.hostname || 'localhost';
    const host = pageHost === 'localhost' ? '127.0.0.1' : pageHost;
    return `${protocol}//${host}:8000/ws/${encodeURIComponent(this.sessionId)}${this.seed ? `?seed=${this.seed}` : ''}`;
  }

  connect(): void {
    this.#closedByUs = false;
    eventBus.emit('game:connection', { status: 'connecting', attempt: this.#attempt });
    const ws = new WebSocket(this.url());
    this.#ws = ws;

    ws.onopen = () => {
      this.#attempt = 0;
      eventBus.emit('game:connection', { status: 'open', attempt: 0 });
      this.#armWatchdog(ws);
    };
    ws.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (data && typeof data === 'object' && (data as { type?: string }).type === 'SNAPSHOT') {
        this.#armWatchdog(ws);
        if (this.#firstSnapshotAt === null) {
          this.#firstSnapshotAt = performance.now();
          console.info(`[mirrorbound] first snapshot ${Math.round(this.#firstSnapshotAt - this.#createdAt)}ms after connect()`);
        }
        const snapshot = data as GameSnapshot;
        eventBus.emit('game:snapshot', snapshot);
        if (snapshot.events.length) eventBus.emit('game:events', snapshot.events);
      }
    };
    ws.onclose = (event) => {
      if (event.code === 4409) {
        this.#closedByUs = true;
        eventBus.emit('game:events', [{ tick: 0, type: 'SESSION_REPLACED', data: {} }]);
      }
      if (this.#ws !== ws) return;
      this.#clearWatchdog();
      eventBus.emit('game:connection', { status: 'closed', attempt: this.#attempt });
      if (!this.#closedByUs) this.#reconnect();
    };
    ws.onerror = () => {
      eventBus.emit('game:connection', { status: 'error', attempt: this.#attempt });
    };
  }

  /** Snapshots arrive 20 times a second; silence means the socket is dead even if it says open. */
  #armWatchdog(ws: WebSocket): void {
    this.#clearWatchdog();
    this.#watchdog = window.setTimeout(() => {
      if (this.#ws !== ws || this.#closedByUs) return;
      console.warn('[mirrorbound] no snapshot for 3s; reconnecting');
      this.#ws = null;
      ws.close();
      this.#reconnect();
    }, SILENCE_TIMEOUT_MS);
  }

  #clearWatchdog(): void {
    if (this.#watchdog !== null) {
      window.clearTimeout(this.#watchdog);
      this.#watchdog = null;
    }
  }

  #reconnect(): void {
    if (this.#attempt >= MAX_ATTEMPTS) return;
    this.#attempt += 1;
    // Quick retries first (the server is usually just restarting), then back off.
    const delay = Math.min(4000, 250 * 2 ** (this.#attempt - 1));
    window.setTimeout(() => {
      if (!this.#closedByUs) this.connect();
    }, delay);
  }

  /** Send the frame's intent. Identical neutral frames are coalesced to ~10 Hz. */
  sendInput(input: Omit<InputMessage, 'type' | 'seq'>, now: number): void {
    if (this.#ws?.readyState !== WebSocket.OPEN) return;
    const message: InputMessage = { type: 'INPUT', ...input, seq: ++this.#seq };
    const json = JSON.stringify(input);
    const neutral = input.moveX === 0 && input.moveY === 0 && !input.attack && input.ability === null;
    if (neutral && json === this.#lastInputJson && now - this.#lastInputAt < 100) return;
    this.#lastInputJson = json;
    this.#lastInputAt = now;
    this.#ws.send(JSON.stringify(message));
  }

  sendCommand(command: Omit<CommandMessage, 'type'> | CommandMessage): void {
    if (this.#ws?.readyState !== WebSocket.OPEN) return;
    this.#ws.send(JSON.stringify({ ...command, type: 'COMMAND' } satisfies CommandMessage));
  }

  disconnect(): void {
    this.#closedByUs = true;
    this.#clearWatchdog();
    const ws = this.#ws;
    this.#ws = null;
    ws?.close();
  }
}
