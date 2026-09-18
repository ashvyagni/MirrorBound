import Phaser from 'phaser';

import { CLIPS, goatAnimationKey, type ClipName } from '../animation/goatClips';
import {
  GOAT_ANCHOR, GOAT_FRAME_SIZE, GOAT_TEXTURE_KEY,
} from '../animation/goatAtlas.generated';
import { COMBAT, GOAT_DISPLAY_HEIGHT, MOVEMENT, PHYSICS } from '../constants';
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
  rise: 'rise',
  fall: 'fall',
  land: 'land',
  attack: 'attack',
  hurt: 'hurt',
  die: 'die',
};

export class Goat extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly #machine: StateMachine<PlayerState, Goat>;
  #intent: Intent = { ...NEUTRAL_INTENT };
  #facing: Facing = 1;
  #coyote = 0;
  #jumpBuffer = 0;
  #jumpCutArmed = false;
  #wasGrounded = true;
  #pendingKnockback: Facing = 1;
  /** Set while the debug dock is previewing a clip, which suspends the machine. */
  #previewing: ClipName | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, GOAT_TEXTURE_KEY, CLIPS.idle.frames[0]);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(GOAT_ANCHOR.x, GOAT_ANCHOR.y);
    this.setScale(GOAT_DISPLAY_HEIGHT / GOAT_FRAME_SIZE.height);
    this.#fitBody();

    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocityY(MOVEMENT.maxFallSpeed);

    this.#machine = new StateMachine<PlayerState, Goat>(this.#states(), this, 'idle');
  }

  /**
   * Size the collision box against the *source* frame.
   *
   * Arcade takes size and offset in unscaled frame pixels and multiplies by the
   * sprite's scale, so deriving both from the generated anchor keeps the box
   * centred on the goat's body and its floor exactly on the sprite's feet --
   * even if the art is re-exported at another resolution.
   */
  #fitBody(): void {
    const width = GOAT_FRAME_SIZE.width * PHYSICS.bodyWidthRatio;
    const height = GOAT_FRAME_SIZE.height * PHYSICS.bodyHeightRatio;
    const originX = GOAT_ANCHOR.x * GOAT_FRAME_SIZE.width;
    const originY = GOAT_ANCHOR.y * GOAT_FRAME_SIZE.height;

    this.body.setSize(width, height, false);
    this.body.setOffset(originX - width / 2, originY - height);
  }

  get facing(): Facing {
    return this.#facing;
  }

  get grounded(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  /** Named `motion`, not `state`: Phaser's GameObject already owns `state`. */
  get motion(): PlayerState {
    return this.#machine.current;
  }

  snapshot(): PlayerSnapshot {
    return {
      state: this.#machine.current,
      clip: this.#previewing ?? CLIP_FOR_STATE[this.#machine.current],
      facing: this.#facing,
      grounded: this.grounded,
      velocityX: Math.round(this.body.velocity.x),
      velocityY: Math.round(this.body.velocity.y),
    };
  }

  // --- driving ---------------------------------------------------------------

  /**
   * Advance one frame.
   *
   * Order matters: timers first so coyote and buffer windows are fresh, then
   * discrete requests (attack, jump), then continuous motion, and only then the
   * state machine -- which reads the velocities the rest of this produced.
   */
  step(deltaSeconds: number, intent: Intent): void {
    this.#intent = intent;

    if (this.#previewing && (intent.moveX !== 0 || intent.jump || intent.attack)) {
      this.#clearPreview();
    }

    const grounded = this.grounded;
    this.#coyote = grounded ? MOVEMENT.coyoteTime : this.#coyote - deltaSeconds;
    this.#jumpBuffer = intent.jump ? MOVEMENT.jumpBufferTime : this.#jumpBuffer - deltaSeconds;

    if (grounded && !this.#wasGrounded) {
      this.#jumpCutArmed = false;
      this.#machine.set('land');
    }

    if (intent.attack) this.#machine.set('attack');

    if (this.#jumpBuffer > 0 && this.#coyote > 0 && this.#canAct()) {
      this.#jump();
    }

    // Variable jump height: releasing early clips the rest of the rise.
    if (this.#jumpCutArmed && !intent.jumpHeld && this.body.velocity.y < 0) {
      this.body.setVelocityY(this.body.velocity.y * MOVEMENT.jumpCutMultiplier);
      this.#jumpCutArmed = false;
    }

    this.#applyHorizontal(deltaSeconds, grounded);
    this.#machine.update(deltaSeconds);
    this.#wasGrounded = grounded;
  }

  #canAct(): boolean {
    const state = this.#machine.current;
    return state !== 'hurt' && state !== 'die';
  }

  #jump(): void {
    this.body.setVelocityY(MOVEMENT.jumpVelocity);
    this.#jumpBuffer = 0;
    this.#coyote = 0;
    this.#jumpCutArmed = true;
    this.#machine.set('rise');
  }

  #applyHorizontal(deltaSeconds: number, grounded: boolean): void {
    const state = this.#machine.current;
    if (state === 'die') {
      this.body.setVelocityX(0);
      return;
    }
    // A hit takes control away; the knockback is allowed to play out.
    if (state === 'hurt') return;

    const scale = state === 'attack' ? COMBAT.attackMoveScale : 1;
    const top = this.#intent.run ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed;
    const target = this.#intent.moveX * top * scale;

    const time = grounded
      ? (target === 0 ? MOVEMENT.groundStopTime : MOVEMENT.groundAccelTime)
      : MOVEMENT.airAccelTime;

    // Exponential approach, so acceleration is identical at any frame rate.
    const blend = 1 - Math.exp(-deltaSeconds / time);
    this.body.setVelocityX(this.body.velocity.x + (target - this.body.velocity.x) * blend);

    if (this.#intent.moveX !== 0 && state !== 'attack') {
      this.#face(this.#intent.moveX > 0 ? 1 : -1);
    }
  }

  #face(facing: Facing): void {
    if (this.#facing === facing) return;
    this.#facing = facing;
    this.setFlipX(facing === -1);
  }

  // --- commands --------------------------------------------------------------

  /** Take a hit from the given direction (-1 knocks left, 1 knocks right). */
  hit(from: Facing = 1): void {
    if (this.#machine.current === 'die') return;
    this.#pendingKnockback = from;
    this.#machine.set('hurt');
  }

  kill(): void {
    this.#machine.set('die');
  }

  /** Return to a clean standing state, wherever the goat currently is. */
  revive(x?: number, y?: number): void {
    if (x !== undefined && y !== undefined) this.setPosition(x, y);
    this.body.setVelocity(0, 0);
    this.setAlpha(1);
    this.#clearPreview();
    this.#machine.set('idle', true);
  }

  /** Play a clip directly, bypassing the state machine, until input resumes. */
  previewClip(clip: ClipName): void {
    this.#previewing = clip;
    this.anims.play(goatAnimationKey(clip), true);
  }

  #clearPreview(): void {
    if (!this.#previewing) return;
    this.#previewing = null;
    this.anims.play(goatAnimationKey(CLIP_FOR_STATE[this.#machine.current]), true);
  }

  #playClip(clip: ClipName): void {
    if (this.#previewing) return;
    this.anims.play(goatAnimationKey(clip), true);
  }


  // --- states ----------------------------------------------------------------

  /** Where the goat belongs right now, judged purely from physics. */
  #locomotion(): PlayerState {
    if (!this.grounded) return this.body.velocity.y < 0 ? 'rise' : 'fall';
    const speed = Math.abs(this.body.velocity.x);
    if (speed < MOVEMENT.idleThreshold) return 'idle';
    return speed > MOVEMENT.runSpeed * MOVEMENT.runBlendThreshold ? 'run' : 'walk';
  }

  /**
   * The whole character, as a table.
   *
   * `interruptibleBy` is the important column: it is the single place that says
   * an attack cannot be cancelled by walking, a stagger cannot be cancelled by
   * anything but death, and death cannot be cancelled at all.
   */
  #states(): Record<PlayerState, StateDef<PlayerState, Goat>> {
    const free = (clip: ClipName): StateDef<PlayerState, Goat> => ({
      enter: (goat) => goat.#playClip(clip),
      update: (goat) => goat.#locomotion(),
    });

    return {
      idle: free('idle'),
      walk: free('walk'),
      run: free('run'),
      rise: free('rise'),
      fall: free('fall'),

      land: {
        enter: (goat) => goat.#playClip('land'),
        update: (goat) =>
          goat.#machine.elapsed >= MOVEMENT.landRecovery ? goat.#locomotion() : undefined,
      },

      attack: {
        enter: (goat) => goat.#playClip('attack'),
        update: (goat) =>
          goat.#machine.elapsed >= COMBAT.attackDuration ? goat.#locomotion() : undefined,
        interruptibleBy: ['hurt', 'die'],
      },

      hurt: {
        enter: (goat) => {
          goat.#playClip('hurt');
          goat.body.setVelocity(COMBAT.hurtKnockback * goat.#pendingKnockback, -180);
        },
        update: (goat) =>
          goat.#machine.elapsed >= COMBAT.hurtDuration ? goat.#locomotion() : undefined,
        interruptibleBy: ['die'],
      },

      die: {
        enter: (goat) => {
          goat.#playClip('die');
          goat.body.setVelocity(0, 0);
        },
        interruptibleBy: [],
      },
    };
  }
}
