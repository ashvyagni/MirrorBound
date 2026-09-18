import Phaser from 'phaser';

import { animationKey, CLIPS, type ClipName } from '../animation/clips';
import { ANCHOR, FRAME_SIZE, TEXTURE_KEY } from '../animation/goatAtlas.generated';
import { COMBAT, PLAYER_DISPLAY_HEIGHT, MOVEMENT, PHYSICS } from '../constants';
import { StateMachine, type StateDef } from '../state/StateMachine';
import {
  NEUTRAL_INTENT,
  type Facing,
  type Intent,
  type PlayerSnapshot,
  type PlayerState,
} from '../types';

/** States whose name is also the name of the clip they play. */
const CLIP_FOR_STATE: Record<PlayerState, ClipName> = {
  idle: 'idle',
  walk: 'walk',
  run: 'run',
  attack: 'attack',
  hurt: 'hurt',
  die: 'die',
};

export class Goat extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly #machine: StateMachine<PlayerState, Goat>;
  #intent: Intent = { ...NEUTRAL_INTENT };
  #facing: Facing = 1;
  #pendingKnockback: Facing = 1;
  /** Set while the debug dock is previewing a clip, which suspends the machine. */
  #previewing: ClipName | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURE_KEY, CLIPS.idle.frames[0]);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(ANCHOR.x, ANCHOR.y);
    this.setScale(PLAYER_DISPLAY_HEIGHT / FRAME_SIZE.height);
    this.#fitBody();

    this.body.setCollideWorldBounds(true);
    this.body.setGravityY(0);

    this.#machine = new StateMachine<PlayerState, Goat>(this.#states(), this, 'idle');
  }

  #fitBody(): void {
    const width = FRAME_SIZE.width * PHYSICS.bodyWidthRatio;
    const height = FRAME_SIZE.height * PHYSICS.bodyHeightRatio;
    const originX = ANCHOR.x * FRAME_SIZE.width;
    const originY = ANCHOR.y * FRAME_SIZE.height;

    this.body.setSize(width, height, false);
    this.body.setOffset(originX - width / 2, originY - height);
  }

  get facing(): Facing {
    return this.#facing;
  }

  get motion(): PlayerState {
    return this.#machine.current;
  }

  snapshot(): PlayerSnapshot {
    return {
      state: this.#machine.current,
      clip: this.#previewing ?? CLIP_FOR_STATE[this.#machine.current],
      facing: this.#facing,
      positionX: this.x,
      positionY: this.y,
      velocityX: Math.round(this.body.velocity.x),
      velocityY: Math.round(this.body.velocity.y),
    };
  }

  // --- driving ---------------------------------------------------------------

  step(deltaSeconds: number, intent: Intent): void {
    this.#intent = intent;

    if (this.#previewing && (intent.moveX !== 0 || intent.moveY !== 0 || intent.attack)) {
      this.#clearPreview();
    }

    if (intent.attack) this.#machine.set('attack');

    this.#applyMovement(deltaSeconds);
    this.#machine.update(deltaSeconds);
  }

  #applyMovement(deltaSeconds: number): void {
    const state = this.#machine.current;
    if (state === 'die') {
      this.body.setVelocity(0, 0);
      return;
    }
    if (state === 'hurt') return;

    const scale = state === 'attack' ? COMBAT.attackMoveScale : 1;
    const top = this.#intent.run ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed;

    // Normalize diagonal movement
    let moveX = this.#intent.moveX;
    let moveY = this.#intent.moveY;
    if (moveX !== 0 && moveY !== 0) {
      moveX *= MOVEMENT.diagonalFactor;
      moveY *= MOVEMENT.diagonalFactor;
    }

    const targetX = moveX * top * scale;
    const targetY = moveY * top * scale;

    const time = MOVEMENT.accelTime;
    const blend = 1 - Math.exp(-deltaSeconds / time);
    this.body.setVelocityX(this.body.velocity.x + (targetX - this.body.velocity.x) * blend);
    this.body.setVelocityY(this.body.velocity.y + (targetY - this.body.velocity.y) * blend);

    // Face based on aim direction or movement direction
    if (Math.abs(this.#intent.aimAngle) > 0.01) {
      this.#face(this.#intent.aimAngle > -Math.PI / 2 && this.#intent.aimAngle < Math.PI / 2 ? 1 : -1);
    } else if (this.#intent.moveX !== 0 && state !== 'attack') {
      this.#face(this.#intent.moveX > 0 ? 1 : -1);
    }
  }

  #face(facing: Facing): void {
    if (this.#facing === facing) return;
    this.#facing = facing;
    this.setFlipX(facing === -1);
  }

  // --- commands --------------------------------------------------------------

  hit(from: Facing = 1): void {
    if (this.#machine.current === 'die') return;
    this.#pendingKnockback = from;
    this.#machine.set('hurt');
  }

  kill(): void {
    this.#machine.set('die');
  }

  revive(x?: number, y?: number): void {
    if (x !== undefined && y !== undefined) this.setPosition(x, y);
    this.body.setVelocity(0, 0);
    this.setAlpha(1);
    this.#clearPreview();
    this.#machine.set('idle', true);
  }

  previewClip(clip: ClipName): void {
    this.#previewing = clip;
    this.anims.play(animationKey(clip), true);
  }

  #clearPreview(): void {
    if (!this.#previewing) return;
    this.#previewing = null;
    this.anims.play(animationKey(CLIP_FOR_STATE[this.#machine.current]), true);
  }

  #playClip(clip: ClipName): void {
    if (this.#previewing) return;
    this.anims.play(animationKey(clip), true);
  }

  // --- states ----------------------------------------------------------------

  #locomotion(): PlayerState {
    const speed = Math.sqrt(
      this.body.velocity.x ** 2 + this.body.velocity.y ** 2
    );
    if (speed < MOVEMENT.idleThreshold) return 'idle';
    return speed > MOVEMENT.runSpeed * MOVEMENT.runBlendThreshold ? 'run' : 'walk';
  }

  #states(): Record<PlayerState, StateDef<PlayerState, Goat>> {
    const free = (clip: ClipName): StateDef<PlayerState, Goat> => ({
      enter: (player) => player.#playClip(clip),
      update: (player) => player.#locomotion(),
    });

    return {
      idle: free('idle'),
      walk: free('walk'),
      run: free('run'),

      attack: {
        enter: (player) => player.#playClip('attack'),
        update: (player) =>
          player.#machine.elapsed >= COMBAT.attackDuration ? player.#locomotion() : undefined,
        interruptibleBy: ['hurt', 'die'],
      },

      hurt: {
        enter: (player) => {
          player.#playClip('hurt');
          player.body.setVelocity(COMBAT.hurtKnockback * player.#pendingKnockback, -180);
        },
        update: (player) =>
          player.#machine.elapsed >= COMBAT.hurtDuration ? player.#locomotion() : undefined,
        interruptibleBy: ['die'],
      },

      die: {
        enter: (player) => {
          player.#playClip('die');
          player.body.setVelocity(0, 0);
        },
        interruptibleBy: [],
      },
    };
  }
}
