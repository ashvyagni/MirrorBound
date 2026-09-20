/**
 * The player: Logesh's goat sheet, driven by server state.
 *
 * Position is predicted locally from the frame's intent so movement feels
 * instant, then reconciled toward each authoritative snapshot. Everything else
 * (state, facing, health) is displayed exactly as the server says.
 */

import Phaser from 'phaser';

import {
  CLIPS, goatAnimationKey, goatViewFor, goatViewKey, GOAT_VIEWS, isVerticalClip,
  type ClipName, type GoatView,
} from '../animation/goatClips';
import { GOAT_BODY_RATIO, GOAT_TEXTURE_KEY } from '../animation/goatAtlas.generated';
import { NET, PLAYER_DISPLAY_HEIGHT, TILE } from '../constants';
import type { PlayerSnap, RoomFull, Vec2 } from '../contracts';
import type { Facing, Intent, PlayerSnapshot, PlayerState } from '../types';
import { EntityView } from './EntityView';

/**
 * The sheet has no drinking pose and no sustained channel, so both borrow:
 * a channel is a cast held open, and a drink stands still.
 */
const STATE_CLIP: Record<PlayerSnap['state'], ClipName> = {
  idle: 'idle', walk: 'walk', run: 'run', attack: 'attack', cast: 'attack', channel: 'attack',
  drink: 'idle', dash: 'run', hurt: 'hurt', dead: 'die',
};
const UI_STATE: Record<PlayerSnap['state'], PlayerState> = {
  idle: 'idle', walk: 'walk', run: 'run', attack: 'attack', cast: 'attack', channel: 'attack',
  drink: 'idle', dash: 'run', hurt: 'hurt', dead: 'die',
};

export class PlayerView extends EntityView {
  readonly sprite: Phaser.Physics.Arcade.Sprite | Phaser.GameObjects.Sprite;
  #facing: Facing = 1;
  facingVec: Vec2 = { x: 1, y: 0 };
  /**
   * The last direction the goat actually travelled in.
   *
   * Kept apart from `facingVec`, which points at the cursor. Which sheet the
   * *legs* are drawn on is a question about movement: aiming right while
   * walking north is a walk north, and picking the view off the aim meant the
   * front and back sheets essentially never played -- a player with a mouse
   * is nearly always aiming sideways.
   */
  #moveDir: Vec2 = { x: 0, y: 1 };
  #clip: ClipName = 'idle';
  #view: GoatView = 'side';
  snap: PlayerSnap | null = null;
  #speed = 175;
  #room: RoomFull | null = null;
  #afterimageTimer = 0;
  #invulnPhase = 0;

  constructor(scene: Phaser.Scene, pos: Vec2) {
    super(scene, 'player_1', pos, 0.9);
    this.sprite = scene.add.sprite(pos.x, pos.y, GOAT_TEXTURE_KEY, CLIPS.idle.frames[0]);
    this.#useView('side', true);
    this.sprite.play(goatAnimationKey('idle'));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
      // One-shot clips fall back to the server-driven locomotion clip.
      if (anim.key === goatAnimationKey('attack') && this.snap && this.snap.state !== 'attack' && this.snap.state !== 'cast') {
        this.#play(STATE_CLIP[this.snap.state]);
      }
    });
  }

  get facing(): Facing {
    return this.#facing;
  }

  get state(): PlayerState {
    return this.snap ? UI_STATE[this.snap.state] : 'idle';
  }

  setRoom(room: RoomFull | null): void {
    this.#room = room;
  }

  /** Server snapshot: reconcile prediction and apply state. */
  applySnapshot(snap: PlayerSnap, speed: number | undefined, paused = false): void {
    const prev = this.snap;
    this.snap = snap;
    if (speed) this.#speed = speed;
    const err = Math.hypot(snap.position.x - this.x, snap.position.y - this.y);
    const forced = snap.state === 'dash' || snap.state === 'hurt' || snap.state === 'dead'
      || (prev !== null && prev.state === 'dash');
    if (err > NET.snapDistance || forced || prev === null) {
      this.x = snap.position.x;
      this.y = snap.position.y;
    } else {
      this.x += (snap.position.x - this.x) * NET.reconcile;
      this.y += (snap.position.y - this.y) * NET.reconcile;
    }
    this.target = { ...snap.position };
    this.velocity = { ...snap.velocity };
    this.facingVec = snap.facing;
    this.#noteMovement(snap.velocity.x, snap.velocity.y);
    if (Math.abs(snap.facing.x) > 0.2) this.#face(snap.facing.x > 0 ? 1 : -1);
    // Standing still while the world is stopped.
    //
    // A pause freezes the simulation, so `snap.state` keeps whatever it was at
    // the instant everything stopped -- walk into an NPC and start talking and
    // the player jogs on the spot behind the speech bubble for the whole
    // conversation, which reads as the game having glitched rather than
    // paused. Death is exempt: a corpse should stay a corpse.
    const clip = paused && snap.state !== 'dead' ? 'idle' : STATE_CLIP[snap.state];
    // The view can change without the clip changing -- turning from walking
    // east to walking north is the same clip on a different sheet.
    if (clip !== this.#clip || this.#viewFor(clip) !== this.#view) {
      // Keep an in-flight attack clip playing to completion.
      const attacking = this.#clip === 'attack' && this.sprite.anims.isPlaying && (snap.state === 'idle' || snap.state === 'walk' || snap.state === 'run');
      if (!attacking) this.#play(clip);
    }
    if (snap.state === 'dead') this.sprite.setAlpha(0.6);
    else if (this.sprite.alpha < 1 && snap.invulnerable === false) this.sprite.setAlpha(1);
  }

  /** Local prediction with the frame's intent. */
  predict(dt: number, intent: Intent): void {
    const snap = this.snap;
    if (!snap || snap.state === 'dead' || snap.state === 'dash' || snap.state === 'hurt') return;
    let mx = intent.moveX, my = intent.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      let speed = intent.run ? this.#speed * (290 / 175) : this.#speed;
      if (snap.moveSpeed !== undefined && snap.runSpeed !== undefined) {
        speed = intent.run ? snap.runSpeed : snap.moveSpeed;
      } else if (snap.state === 'attack' || snap.state === 'cast' || snap.state === 'drink') speed *= 0.45;
      else if (snap.state === 'channel') speed *= 0.35;
      this.x += mx * speed * dt;
      this.y += my * speed * dt;
      // Predicted locally as well as read off the snapshot, so turning to walk
      // north swaps the sheet on the frame the key goes down rather than on
      // the next snapshot.
      this.#noteMovement(mx, my);
      if (Math.abs(mx) > 0.2) this.#face(mx > 0 ? 1 : -1);
    }
    if (this.#room) {
      const r = snap.radius;
      this.x = Math.max(TILE + r, Math.min(this.#room.width - TILE - r, this.x));
      this.y = Math.max(TILE + r, Math.min(this.#room.height - TILE - r, this.y));
    }
  }

  update(dt: number): void {
    const snap = this.snap;
    // Dead: no prediction, just settle on the server position.
    if (snap && snap.state === 'dead') this.follow(dt);
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setDepth(this.depthFor(this.y));
    this.placeShadow(this.x, this.y - 2);
    if (snap?.invulnerable && snap.state !== 'dash') {
      this.#invulnPhase += dt * 18;
      this.sprite.setAlpha(0.55 + 0.45 * Math.abs(Math.sin(this.#invulnPhase)));
    } else if (snap && snap.state !== 'dead' && this.sprite.alpha !== 1) {
      this.sprite.setAlpha(1);
    }
    if (snap?.state === 'dash') {
      this.#afterimageTimer -= dt;
      if (this.#afterimageTimer <= 0) {
        this.#afterimageTimer = 0.03;
        this.#afterimage();
      }
    }
  }

  #afterimage(): void {
    const ghost = this.scene.add.image(this.x, this.y, this.sprite.texture.key, this.sprite.frame.name)
      .setOrigin(this.sprite.originX, this.sprite.originY).setScale(this.sprite.scaleX, this.sprite.scaleY)
      .setFlipX(this.sprite.flipX).setTint(0x7c6add).setAlpha(0.55).setDepth(this.sprite.depth - 0.001)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
  }

  #face(facing: Facing): void {
    if (this.#facing === facing) return;
    this.#facing = facing;
    if (GOAT_VIEWS[this.#view].mirrors) this.sprite.setFlipX(facing === -1);
  }

  /**
   * Which sheet a clip plays on.
   *
   * Only walking and running were drawn from the front and back, so everything
   * else -- idle, attack, hurt, death -- stays on the side sheet rather than
   * being faked from a walk pose.
   */
  #viewFor(clip: ClipName): GoatView {
    return isVerticalClip(clip) ? goatViewFor(this.#moveDir) : 'side';
  }

  /** Remember a real movement direction; standing still keeps the last one. */
  #noteMovement(x: number, y: number): void {
    if (Math.hypot(x, y) < 1e-3) return;
    const previous = this.#moveDir;
    this.#moveDir = { x, y };
    // Turning from east to north is the same clip on a different sheet, and
    // nothing else in `applySnapshot` would notice that the sheet has to swap.
    if (isVerticalClip(this.#clip) && goatViewFor(previous) !== goatViewFor(this.#moveDir)) {
      this.#play(this.#clip);
    }
  }

  /**
   * Point the sprite at one of the three sheets.
   *
   * Origin and scale are per sheet, because the three are cropped differently.
   * The scale is solved from the sheet's own body ratio rather than its frame
   * height, so the goat is the same size from every angle -- sizing by frame
   * height would shrink it by about a quarter the moment it turned upward.
   */
  #useView(view: GoatView, force = false): void {
    if (!force && this.#view === view) return;
    this.#view = view;
    const def = GOAT_VIEWS[view];
    this.sprite.setOrigin(def.anchor.x, def.anchor.y);
    const body = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;
    this.sprite.setScale(body / (def.frameSize.height * def.bodyRatio));
    this.sprite.setFlipX(def.mirrors && this.#facing === -1);
  }

  #play(clip: ClipName): void {
    this.#clip = clip;
    this.#useView(this.#viewFor(clip));
    this.sprite.play(goatViewKey(this.#view, clip), true);
  }

  snapshot(): PlayerSnapshot {
    return {
      state: this.state,
      clip: this.#clip,
      facing: this.#facing,
      positionX: this.x,
      positionY: this.y,
      velocityX: Math.round(this.velocity.x),
      velocityY: Math.round(this.velocity.y),
    };
  }

  override destroy(): void {
    super.destroy();
    this.sprite.destroy();
  }
}
