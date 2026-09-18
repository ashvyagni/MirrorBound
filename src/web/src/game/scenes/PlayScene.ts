import Phaser from 'phaser';

import { ROOM, PALETTE, VIEW } from '../constants';
import { Goat } from '../entities/Goat';
import { eventBus } from '../EventBus';
import { KeyboardIntentSource } from '../input/KeyboardIntentSource';
import { WebSocketClient } from '../network/WebSocketClient';
import type { IntentSource, PlayerSnapshot, GameSnapshot, EnemySnapshot, TwinSnapshot } from '../types';

const SPAWN = { x: ROOM.width / 2, y: ROOM.height / 2 } as const;

export class PlayScene extends Phaser.Scene {
  static readonly KEY = 'play';

  goat!: Goat;
  #source!: IntentSource;
  #wsClient!: WebSocketClient;
  #lastSnapshot: PlayerSnapshot | null = null;
  #teardown: Array<() => void> = [];
  #roomGraphics!: Phaser.GameObjects.Graphics;
  #enemyGraphics!: Phaser.GameObjects.Graphics;
  #twinGraphics!: Phaser.GameObjects.Graphics;
  #gameSnapshot: GameSnapshot | null = null;

  constructor() {
    super(PlayScene.KEY);
  }

  create(): void {
    this.#buildRoom();
    this.#buildLighting();

    this.goat = new Goat(this, SPAWN.x, SPAWN.y);
    this.physics.world.setBounds(0, 0, ROOM.width, ROOM.height);

    this.#source = new KeyboardIntentSource(this.input.keyboard!);
    if (this.#source instanceof KeyboardIntentSource) {
      this.#source.setScene(this);
    }

    // Initialize graphics for entities
    this.#enemyGraphics = this.add.graphics();
    this.#twinGraphics = this.add.graphics();

    this.cameras.main.setBackgroundColor(PALETTE.night);
    this.cameras.main.startFollow(this.goat, true, 0.09, 0.09);
    this.cameras.main.setBounds(0, 0, ROOM.width, ROOM.height);

    // Connect to server
    this.#wsClient = new WebSocketClient();
    this.#wsClient.connect();

    // Listen for game snapshots
    this.#teardown.push(
      eventBus.on('game:snapshot', (snapshot) => {
        this.#gameSnapshot = snapshot;
        this.#updateFromSnapshot(snapshot);
      })
    );

    this.#wireCommands();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#dispose());

    eventBus.emit('game:ready', { scene: PlayScene.KEY });
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;

    const intent = this.#source.sample(dt);
    this.goat.step(dt, intent);

    // Send input to server
    this.#wsClient.sendInput({
      moveX: intent.moveX,
      moveY: intent.moveY,
      attack: intent.attack,
      run: intent.run,
      aimAngle: intent.aimAngle,
      ability: intent.ability,
    });

    // Update local snapshot for UI
    const snapshot = this.goat.snapshot();
    eventBus.emit('player:tick', snapshot);
    if (this.#changed(snapshot)) {
      this.#lastSnapshot = snapshot;
      eventBus.emit('player:changed', snapshot);
    }

    // Render enemies and twin from server data
    this.#renderEntities();
  }

  #updateFromSnapshot(snapshot: GameSnapshot): void {
    // Update player position from server (smooth interpolation could be added here)
    if (snapshot.player) {
      // For now, trust server position
      // this.goat.setPosition(snapshot.player.positionX, snapshot.player.positionY);
    }
  }

  #renderEntities(): void {
    if (!this.#gameSnapshot) return;

    // Clear previous frame
    this.#enemyGraphics.clear();
    this.#twinGraphics.clear();

    // Render enemies
    for (const enemy of this.#gameSnapshot.enemies) {
      this.#renderEnemy(enemy);
    }

    // Render twin
    if (this.#gameSnapshot.twin) {
      this.#renderTwin(this.#gameSnapshot.twin);
    }
  }

  #renderEnemy(enemy: EnemySnapshot): void {
    const gfx = this.#enemyGraphics;
    const x = enemy.positionX;
    const y = enemy.positionY;
    const radius = 14;

    // Enemy body
    gfx.fillStyle(PALETTE.skeleton, 0.8);
    gfx.fillCircle(x, y, radius);

    // Health bar
    const barWidth = 30;
    const barHeight = 4;
    const healthPercent = enemy.health / enemy.maxHealth;
    const barX = x - barWidth / 2;
    const barY = y - radius - 10;

    gfx.fillStyle(PALETTE.healthRed, 1);
    gfx.fillRect(barX, barY, barWidth, barHeight);
    gfx.fillStyle(PALETTE.healthGreen, 1);
    gfx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  }

  #renderTwin(twin: TwinSnapshot): void {
    const gfx = this.#twinGraphics;
    const x = twin.positionX;
    const y = twin.positionY;
    const radius = 12;

    // Twin body (blue tint)
    gfx.fillStyle(PALETTE.twin, 0.8);
    gfx.fillCircle(x, y, radius);

    // Glow effect
    gfx.lineStyle(2, PALETTE.twin, 0.4);
    gfx.strokeCircle(x, y, radius + 4);

    // Health bar
    const barWidth = 24;
    const barHeight = 3;
    const healthPercent = twin.health / twin.maxHealth;
    const barX = x - barWidth / 2;
    const barY = y - radius - 8;

    gfx.fillStyle(PALETTE.healthRed, 1);
    gfx.fillRect(barX, barY, barWidth, barHeight);
    gfx.fillStyle(PALETTE.healthGreen, 1);
    gfx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  }

  #changed(next: PlayerSnapshot): boolean {
    const prev = this.#lastSnapshot;
    return (
      prev === null ||
      prev.state !== next.state ||
      prev.clip !== next.clip ||
      prev.facing !== next.facing
    );
  }

  #wireCommands(): void {
    this.#teardown.push(
      eventBus.on('debug:play-clip', ({ clip }) => this.goat.previewClip(clip as any)),

      eventBus.on('debug:force-state', ({ state }) => {
        if (state === 'reset') this.goat.revive(SPAWN.x, SPAWN.y);
        else if (state === 'hurt') this.goat.hit(this.goat.facing === 1 ? -1 : 1);
        else this.goat.kill();
      }),

      eventBus.on('debug:toggle-bodies', ({ enabled }) => {
        const world = this.physics.world;
        if (enabled && !world.debugGraphic) world.createDebugGraphic();
        world.drawDebug = enabled;
        world.debugGraphic?.setVisible(enabled).clear();
      }),
    );
  }

  #dispose(): void {
    for (const off of this.#teardown) off();
    this.#teardown = [];
    this.#source?.destroy?.();
    this.#wsClient?.disconnect();
  }

  // --- room rendering --------------------------------------------------------

  #buildRoom(): void {
    this.#roomGraphics = this.add.graphics();
    this.#drawRoom();
  }

  #drawRoom(): void {
    const gfx = this.#roomGraphics;
    gfx.clear();

    // Floor
    gfx.fillStyle(PALETTE.floor, 1);
    gfx.fillRect(0, 0, ROOM.width, ROOM.height);

    // Floor tile grid
    gfx.lineStyle(1, 0x252540, 0.3);
    for (let x = 0; x <= ROOM.width; x += ROOM.tileSize) {
      gfx.lineBetween(x, 0, x, ROOM.height);
    }
    for (let y = 0; y <= ROOM.height; y += ROOM.tileSize) {
      gfx.lineBetween(0, y, ROOM.width, y);
    }

    // Walls
    const wallThickness = 16;
    gfx.fillStyle(PALETTE.wall, 1);
    gfx.fillRect(0, 0, ROOM.width, wallThickness); // top
    gfx.fillRect(0, ROOM.height - wallThickness, ROOM.width, wallThickness); // bottom
    gfx.fillRect(0, 0, wallThickness, ROOM.height); // left
    gfx.fillRect(ROOM.width - wallThickness, 0, wallThickness, ROOM.height); // right

    // Wall edge highlight
    gfx.fillStyle(PALETTE.wallEdge, 0.5);
    gfx.fillRect(0, wallThickness, ROOM.width, 4); // top inner
    gfx.fillRect(0, ROOM.height - wallThickness - 4, ROOM.width, 4); // bottom inner
    gfx.fillRect(wallThickness, 0, 4, ROOM.height); // left inner
    gfx.fillRect(ROOM.width - wallThickness - 4, 0, 4, ROOM.height); // right inner

    // Door openings (visual only - collision handled by server)
    const doorWidth = 64;
    const doorX = ROOM.width / 2 - doorWidth / 2;
    gfx.fillStyle(PALETTE.floor, 1);
    gfx.fillRect(doorX, 0, doorWidth, wallThickness + 4); // top door
    gfx.fillRect(doorX, ROOM.height - wallThickness - 4, doorWidth, wallThickness + 4); // bottom door
  }

  #buildLighting(): void {
    // Atmospheric vignette effect
    const vignette = this.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(100);

    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const radius = Math.max(VIEW.width, VIEW.height) * 0.7;

    // Radial darkening from edges
    for (let i = 0; i < 8; i++) {
      const r = radius - i * 30;
      const alpha = 0.02 * (8 - i);
      vignette.fillStyle(0x000000, alpha);
      vignette.fillCircle(cx, cy, r);
    }
  }
}
