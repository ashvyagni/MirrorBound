import Phaser from 'phaser';

import { CLIPS, goatAnimationKey, type ClipName } from '../animation/goatClips';
import {
  GOAT_ANCHOR, GOAT_FRAME_SIZE, GOAT_TEXTURE_KEY,
} from '../animation/goatAtlas.generated';
import { COMBAT, depthAt, DEPTH, GOAT_DISPLAY_HEIGHT, MOVEMENT, PHYSICS } from '../constants';
import { StateMachine, type StateDef } from '../state/StateMachine';
import { FX } from '../world/textures';
import {
  NEUTRAL_INTENT,
  type Facing,
  type Intent,
  type PlayerSnapshot,
  type PlayerState,
  type Vec2,
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
  /**
   * Where the goat is pointing, which is not what the sheet can show.
   *
   * The art is drawn side-on, so the sprite only ever faces left or right --
   * but a top-down character aims in eight, and everything it throws needs the
   * real direction. Kept as the last non-zero input rather than the velocity,
   * so letting go of the keys does not swing the aim as the goat slides.
   */
  #aim: Vec2 = { x: 1, y: 0 };
  #pendingKnockback: Vec2 = { x: 1, y: 0 };
  /** Set while the debug dock is previewing a clip, which suspends the machine. */
  #previewing: ClipName | null = null;
  /** Holding a weapon, so its attack must not throw its own effect. */
  #armed = false;
  readonly #shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, GOAT_TEXTURE_KEY, CLIPS.idle.frames[0]);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setOrigin(GOAT_ANCHOR.x, GOAT_ANCHOR.y);
    this.setScale(GOAT_DISPLAY_HEIGHT / GOAT_FRAME_SIZE.height);
    this.#fitBody();

    this.#shadow = scene.add
      .image(x, y, FX.shadow)
      .setDepth(DEPTH.shadow)
      .setScale((GOAT_DISPLAY_HEIGHT * 0.5) / 64)
      .setAlpha(0.7);

    this.#machine = new StateMachine<PlayerState, Goat>(this.#states(), this, 'idle');
  }

  /**
   * Size the collision box against the *source* frame.
   *
   * Arcade takes size and offset in unscaled frame pixels and multiplies by the
   * sprite's scale, so deriving both from the generated anchor keeps the box on
   * the goat's footing -- which in a top-down view is the only part of it that
   * occupies the floor. Its head simply overlaps whatever is behind.
   */
  #fitBody(): void {
    const width = GOAT_FRAME_SIZE.width * PHYSICS.bodyWidthRatio;
    const height = GOAT_FRAME_SIZE.height * PHYSICS.bodyHeightRatio;
    const originX = GOAT_ANCHOR.x * GOAT_FRAME_SIZE.width;
    const originY = GOAT_ANCHOR.y * GOAT_FRAME_SIZE.height;

    this.body.setSize(width, height, false);
    this.body.setOffset(originX - width / 2, originY - height / 2);
  }

  /** Told by the scene when a weapon is equipped or put away. */
  setArmed(armed: boolean): void {
    this.#armed = armed;
  }

  get facing(): Facing {
    return this.#facing;
  }

  /** Where the goat is pointing. Normalised. */
  get aim(): Vec2 {
    return this.#aim;
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
      aim: { ...this.#aim },
      velocityX: Math.round(this.body.velocity.x),
      velocityY: Math.round(this.body.velocity.y),
    };
  }

  // --- driving ---------------------------------------------------------------

  /**
   * Advance one frame.
   *
   * Order matters: discrete requests first, then continuous motion, and only
   * then the state machine -- which reads the velocities the rest produced.
   */
  step(deltaSeconds: number, intent: Intent): void {
    this.#intent = intent;

    if (this.#previewing && (intent.moveX !== 0 || intent.moveY !== 0 || intent.attack)) {
      this.#clearPreview();
    }

    if (intent.attack) this.#machine.set('attack');

    this.#applyMovement(deltaSeconds);
    this.#machine.update(deltaSeconds);

    // Painter's order: whatever is further down the screen draws in front.
    this.setDepth(depthAt(this.y));
    this.#shadow.setPosition(this.x, this.y);
  }

  #applyMovement(deltaSeconds: number): void {
    const state = this.#machine.current;
    if (state === 'die') {
      this.body.setVelocity(0, 0);
      return;
    }
    // A hit takes control away; the knockback is allowed to play out.
    if (state === 'hurt') return;

    const scale = state === 'attack' ? COMBAT.attackMoveScale : 1;
    const top = this.#intent.run ? MOVEMENT.runSpeed : MOVEMENT.walkSpeed;

    // Normalised, so a diagonal is not faster than a straight line.
    let dx = this.#intent.moveX;
    let dy = this.#intent.moveY;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }

    const targetX = dx * top * scale;
    const targetY = dy * top * scale;
    const time = length === 0 ? MOVEMENT.stopTime : MOVEMENT.accelTime;

    // Exponential approach, so acceleration is identical at any frame rate.
    const blend = 1 - Math.exp(-deltaSeconds / time);
    this.body.setVelocity(
      this.body.velocity.x + (targetX - this.body.velocity.x) * blend,
      this.body.velocity.y + (targetY - this.body.velocity.y) * blend,
    );

    if (length > 0 && state !== 'attack') {
      this.#aim = { x: dx / (length || 1), y: dy / (length || 1) };
      if (dx !== 0) this.#face(dx > 0 ? 1 : -1);
    }
  }

  #face(facing: Facing): void {
    if (this.#facing === facing) return;
    this.#facing = facing;
    this.setFlipX(facing === -1);
  }

  // --- commands --------------------------------------------------------------

  /** Take a hit from the given direction, which is where it knocks the goat. */
  hit(from: Vec2 = { x: -1, y: 0 }): void {
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
    this.anims.play(goatAnimationKey(this.#resolve(CLIP_FOR_STATE[this.#machine.current])), true);
  }

  #playClip(clip: ClipName): void {
    if (this.#previewing) return;
    this.anims.play(goatAnimationKey(this.#resolve(clip)), true);
  }

  /** Swap in the swirl-free attack while armed. */
  #resolve(clip: ClipName): ClipName {
    return clip === 'attack' && this.#armed ? 'strike' : clip;
  }

  override destroy(fromScene?: boolean): void {
    this.#shadow.destroy();
    super.destroy(fromScene);
  }

  // --- states ----------------------------------------------------------------

  /** Where the goat belongs right now, judged purely from how fast it is going. */
  #locomotion(): PlayerState {
    const speed = Math.hypot(this.body.velocity.x, this.body.velocity.y);
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

      attack: {
        enter: (goat) => goat.#playClip('attack'),
        update: (goat) =>
          goat.#machine.elapsed >= COMBAT.attackDuration ? goat.#locomotion() : undefined,
        interruptibleBy: ['hurt', 'die'],
      },

      hurt: {
        enter: (goat) => {
          goat.#playClip('hurt');
          const knock = goat.#pendingKnockback;
          goat.body.setVelocity(
            COMBAT.hurtKnockback * knock.x,
            COMBAT.hurtKnockback * knock.y,
          );
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
