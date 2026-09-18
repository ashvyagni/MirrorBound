/**
 * WebSocket client for server communication.
 */

import { eventBus } from '../EventBus';
import type { GameSnapshot } from '../types';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(sessionId: string = 'default') {
    this.sessionId = sessionId;
  }

  connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = '8000';
    const url = `${protocol}//${host}:${port}/ws/${this.sessionId}`;

    console.log('Connecting to:', url);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleMessage(data: any): void {
    if (data.type === 'SNAPSHOT') {
      const snapshot: GameSnapshot = {
        tick: data.tick,
        player: {
          state: 'idle',
          clip: 'idle',
          facing: 1,
          positionX: data.player.position.x,
          positionY: data.player.position.y,
          velocityX: data.player.velocity.x,
          velocityY: data.player.velocity.y,
        },
        twin: {
          positionX: data.twin.position.x,
          positionY: data.twin.position.y,
          health: data.twin.health,
          maxHealth: data.twin.maxHealth,
          state: 'idle',
        },
        enemies: data.enemies.map((e: any) => ({
          id: e.id,
          type: e.type,
          positionX: e.position.x,
          positionY: e.position.y,
          health: e.health,
          maxHealth: e.maxHealth,
          state: e.state,
        })),
        room: {
          width: data.room.width,
          height: data.room.height,
          tiles: data.room.tiles,
          roomType: data.room.roomType,
        },
      };

      eventBus.emit('game:snapshot', snapshot);
    }
  }

  sendInput(input: {
    moveX: number;
    moveY: number;
    attack: boolean;
    run: boolean;
    aimAngle: number;
    ability: number | null;
  }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'INPUT',
        ...input,
      }));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
