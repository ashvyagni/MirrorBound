/**
 * WebSocket client: sends input/commands, receives snapshots.
 *
 * The session id comes from `?session=` (so two tabs can run two games) and
 * the seed from `?seed=` (so a run can be reproduced). Reconnects with backoff.
 */

import type { CommandMessage, GameSnapshot, InputMessage } from '../contracts';
import { eventBus } from '../EventBus';
import type { ConnectionStatus } from '../types';

const MAX_ATTEMPTS = 8;

export class WebSocketClient {
  #ws: WebSocket | null = null;
  #attempt = 0;
  #closedByUs = false;
  #seq = 0;
  #lastInputJson = '';
  #lastInputAt = 0;
  readonly sessionId: string;
  readonly seed: string | null;

  constructor(sessionId?: string) {
    const params = new URLSearchParams(window.location.search);
    this.sessionId = sessionId ?? params.get('session') ?? `web-${Math.random().toString(36).slice(2, 8)}`;
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
    if (explicit) return `${explicit.replace(/\/$/, '')}/ws/${this.sessionId}${this.seed ? `?seed=${this.seed}` : ''}`;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    return `${protocol}//${host}:8000/ws/${this.sessionId}${this.seed ? `?seed=${this.seed}` : ''}`;
  }

  connect(): void {
    this.#closedByUs = false;
    eventBus.emit('game:connection', { status: 'connecting', attempt: this.#attempt });
    const ws = new WebSocket(this.url());
    this.#ws = ws;

    ws.onopen = () => {
      this.#attempt = 0;
      eventBus.emit('game:connection', { status: 'open', attempt: 0 });
    };
    ws.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (data && typeof data === 'object' && (data as { type?: string }).type === 'SNAPSHOT') {
        const snapshot = data as GameSnapshot;
        eventBus.emit('game:snapshot', snapshot);
        if (snapshot.events.length) eventBus.emit('game:events', snapshot.events);
      }
    };
    ws.onclose = () => {
      if (this.#ws !== ws) return;
      eventBus.emit('game:connection', { status: 'closed', attempt: this.#attempt });
      if (!this.#closedByUs) this.#reconnect();
    };
    ws.onerror = () => {
      eventBus.emit('game:connection', { status: 'error', attempt: this.#attempt });
    };
  }

  #reconnect(): void {
    if (this.#attempt >= MAX_ATTEMPTS) return;
    this.#attempt += 1;
    const delay = Math.min(6000, 500 * 2 ** this.#attempt);
    window.setTimeout(() => {
      if (!this.#closedByUs) this.connect();
    }, delay);
  }

  /** Send the frame's intent. Identical neutral frames are coalesced to ~10 Hz. */
  sendInput(input: Omit<InputMessage, 'type' | 'seq'>, now: number): void {
    if (this.#ws?.readyState !== WebSocket.OPEN) return;
    const message: InputMessage = { type: 'INPUT', ...input, seq: ++this.#seq };
    const { seq: _seq, ...rest } = message;
    const json = JSON.stringify(rest);
    const neutral = input.moveX === 0 && input.moveY === 0 && !input.attack && input.ability === null;
    if (neutral && json === this.#lastInputJson && now - this.#lastInputAt < 100) return;
    this.#lastInputJson = json;
    this.#lastInputAt = now;
    this.#ws.send(JSON.stringify(message));
  }

  sendCommand(command: Omit<CommandMessage, 'type'>): void {
    if (this.#ws?.readyState !== WebSocket.OPEN) return;
    this.#ws.send(JSON.stringify({ type: 'COMMAND', ...command } satisfies CommandMessage));
  }

  disconnect(): void {
    this.#closedByUs = true;
    const ws = this.#ws;
    this.#ws = null;
    ws?.close();
  }
}
