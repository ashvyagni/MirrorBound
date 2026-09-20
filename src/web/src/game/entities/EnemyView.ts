/**
 * Enemies: Logesh's four-state sheets, driven entirely by the snapshot.
 *
 * Which sheet plays is read off the authoritative fields and nothing else --
 * `windingUp` for the attack, velocity for the walk, `targetId` for the alert,
 * idle otherwise. The client never decides an enemy is doing something.
 *
 * A `sprite` the art does not cover falls back to the painted texture the whole
 * game used before, so a new enemy type on the server shows up as plain art
 * rather than as a crash or a hole. Every sprite the server currently spawns is
 * drawn -- the Mirror included -- so the fallback is a safety net and not a
 * thing you can see today.
 *
 * The same fallback covers the gap while a room's sheets are still coming down
 * the wire. Enemy atlases load per room now, and a snapshot can arrive with
 * enemies in it before their family has landed, so every enemy starts on the
 * painted texture and `adoptArt` swaps it for the real sheets the moment they
 * are ready. Nothing is ever invisible or zero-sized: the stand-in is drawn at
 * the right size from the first frame, and the swap keeps its position, facing
 * and state.
 *
 * Every readability feature outranks the art: the wind-up telegraph, the hit
 * flash, the slow and burn tints, the health bar, the elite ring, the boss aura
 * and the death squash all survive unchanged, and the telegraph is drawn on its
 * own layer under the sprite so a decorative frame can never hide it.
 */

import Phaser from 'phaser';

import {
  ALERT_MARK, ENEMY_ART, ENEMY_STATES, hasEnemyArt,
  type EnemyArt, type EnemySheet, type EnemyStateName,
} from '../animation/enemyClips';

/**
 * What can be playing.
 *
 * The four every family has, plus the two only a boss is drawn for. They are
 * not in `EnemyStateName` because that type is what the preloader checks a
 * family against, and requiring a slam of every skeleton would fail the check
 * for all eleven.
 */
type PlayState = EnemyStateName | 'slam' | 'hurt';

/** How long a drawn flinch runs before the body goes back to fighting. */
const HURT_SECONDS = 0.45;
import { animationKey } from '../animation/clips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { darkTexture, WEAPONS, weaponSheetFor } from '../animation/weaponClips';
import { WeaponOverlay } from './WeaponOverlay';
import { DEPTH, PALETTE, PLAYER_DISPLAY_HEIGHT } from '../constants';
import type { EnemySnap, Vec2 } from '../contracts';
import { EntityView } from './EntityView';

/** Relative size of the painted fallback sprites, which have no body ratio. */
const PAINTED_SIZE: Record<string, number> = { skeleton: 1.0, archer: 1.0, hound: 0.95, slime: 1.0, mirror: 1.15 };

/** Above this speed the enemy is walking rather than standing. */
const MOVING_SPEED = 12;

/** The player's drawn body height: every enemy is sized as a fraction of it. */
const PLAYER_BODY = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;

/** Sprites the server sent that no sheet covers. Logged once each, not per frame. */
const reportedMissing = new Set<string>();

function reportMissingArt(sprite: string): void {
  if (reportedMissing.has(sprite)) return;
  reportedMissing.add(sprite);
  console.info(`[mirrorbound] no enemy atlas for sprite "${sprite}"; using the painted texture`);
}

export class EnemyView extends EntityView {
  /** Swapped out by `adoptArt` when the real sheets arrive, hence not readonly. */
  #sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  readonly #bar: Phaser.GameObjects.Graphics;
  readonly #telegraph: Phaser.GameObjects.Graphics;
  #ring: Phaser.GameObjects.Image | null = null;
  #aura: Phaser.GameObjects.Image | null = null;
  /** Null while this enemy is on the painted texture. */
  #art: EnemyArt | null = null;
  #mark: Phaser.GameObjects.Sprite | null = null;
  #markTween: Phaser.Tweens.Tween | null = null;
  #state: PlayState = 'idle';
  /** Seconds left of a drawn flinch. Only families with a `hurt` sheet use it. */
  #hurtFor = 0;
  snap: EnemySnap;
  #bob = Math.random() * 6;
  #flash = 0;
  #windPulse = 0;
  #baseScale: number;
  /** The creature's drawn height, as opposed to its padded frame box. */
  #bodyHeight: number;
  #lastHealth: number;
  #dying = false;
  /**
   * The player weapon this enemy fights with, drawn blackened.
   *
   * Only ever built for an enemy the server says is armed -- the Mirror, which
   * is `armed_with` one of your weapons and takes its reach and cadence
   * verbatim. Everything else keeps its own art and pays for none of this.
   */
  #weapon: WeaponOverlay | null = null;

  constructor(scene: Phaser.Scene, snap: EnemySnap) {
    super(scene, snap.id, snap.position, snap.boss ? 1.4 : snap.elite ? 1.1 : 0.85);
    this.snap = snap;
    this.#lastHealth = snap.health;

    if (!hasEnemyArt(snap.sprite)) reportMissingArt(snap.sprite);
    const key = scene.textures.exists(`enemy:${snap.sprite}`) ? `enemy:${snap.sprite}` : 'enemy:skeleton';
    this.#baseScale = (PAINTED_SIZE[snap.sprite] ?? 1) * (snap.elite ? 1.22 : 1) * (snap.boss ? 1.25 : 1);
    this.#sprite = scene.add.image(snap.position.x, snap.position.y, key).setOrigin(0.5, 0.92).setScale(this.#baseScale);
    this.#bodyHeight = this.#sprite.displayHeight;
    // The sheets may already be in the cache -- a room re-entered, or a family
    // this area shares -- in which case this upgrades before the first frame.
    this.adoptArt();

    this.#bar = scene.add.graphics().setDepth(DEPTH.fxHigh);
    // Under the entity band: the telegraph is floor paint, so nothing the art
    // does can cover it.
    this.#telegraph = scene.add.graphics().setDepth(DEPTH.floorDecal + 3);
    if (snap.elite) {
      this.#ring = scene.add.image(snap.position.x, snap.position.y, 'enemy:elite_ring').setDepth(DEPTH.shadow + 1).setScale(0.7);
    }
    if (snap.boss) {
      this.#aura = scene.add.image(snap.position.x, snap.position.y - 30, 'fx:glow').setTint(PALETTE.magenta)
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setScale(1.6).setDepth(DEPTH.shadow + 1);
      scene.tweens.add({ targets: this.#aura, alpha: { from: 0.25, to: 0.5 }, scale: { from: 1.5, to: 1.8 }, duration: 1300, yoyo: true, repeat: -1 });
    }
    this.armWeapon();
  }

  /**
   * Put the server's weapon in this enemy's hands, from the dark sheets.
   *
   * Idempotent, and re-checked on every snapshot rather than only at birth:
   * the Mirror can be re-armed mid-fight from the sandbox, and a lite snapshot
   * carries no weapon field at all -- which must leave the weapon alone rather
   * than disarm it.
   *
   * Public because the sheets arrive after the enemy does: the loader calls
   * this again once they land, the same way `adoptArt` upgrades the body.
   */
  armWeapon(): void {
    const id = this.snap.weapon;
    if (id === undefined) return;
    const sheet = id ? weaponSheetFor(id) : null;
    if (!sheet) {
      this.#weapon?.destroy();
      this.#weapon = null;
      return;
    }
    // The blackened sheets are fetched only once something needs them, so they
    // are usually still in flight when the enemy first appears. Wait rather
    // than arm: a sprite pointed at a texture that has not arrived draws
    // Phaser's missing-texture box, which is worse than an empty hand. The
    // loader calls this again the moment they land.
    const rest = WEAPONS[sheet].idle;
    if (rest && !this.scene.textures.exists(darkTexture(rest.texture))) return;
    // `dark: true` -- the Mirror's copies, not the player's own sheets.
    this.#weapon ??= new WeaponOverlay(this.scene, true);
    this.#weapon.equip(sheet);
  }

  get sprite(): Phaser.GameObjects.Sprite | Phaser.GameObjects.Image {
    return this.#sprite;
  }

  /**
   * Whether this enemy is fighting with one of the player's weapons.
   *
   * Read off the snapshot rather than off the overlay: the sheets load lazily,
   * so a boss can be armed for a second or two before there is anything to
   * draw -- and a bolt it throws in that second should still be its own colour.
   */
  get armed(): boolean {
    return Boolean(this.snap.weapon);
  }

  /** Whether this enemy is still standing in with the painted texture. */
  get painted(): boolean {
    return this.#art === null;
  }

  /**
   * Swap the painted stand-in for Logesh's sheets once they are in the cache.
   *
   * Idempotent and safe to call on anything: an enemy with no art at all, one
   * already upgraded, or one mid-death all decline. Everything that made the
   * old sprite readable is re-derived rather than copied -- position, depth,
   * tint and scale are all reapplied by `update` on the next frame, and the
   * state is re-resolved from the snapshot -- so the swap cannot leave a
   * half-configured sprite behind.
   */
  adoptArt(): void {
    if (this.#art !== null || this.#dying) return;
    if (!hasEnemyArt(this.snap.sprite)) return;
    const art = ENEMY_ART[this.snap.sprite] as EnemyArt;
    // Every state, not just idle: a partly loaded family would otherwise swap
    // in and then fail to find a sheet the moment the enemy moved.
    if (!ENEMY_STATES.every((state) => this.scene.textures.exists(art[state].texture))) return;
    // The death sheet too, if this family has one: it is needed at the one
    // moment there is no time left to fetch it.
    if (art.death && !this.scene.textures.exists(art.death.texture)) return;

    this.#art = art;
    const sheet = art.idle;
    this.#state = 'idle';
    this.#baseScale = this.#scaleFor(sheet);
    this.#bodyHeight = sheet.frameSize.height * sheet.bodyRatio * this.#baseScale;

    const old = this.#sprite;
    const sprite = this.scene.add.sprite(old.x, old.y, sheet.texture, sheet.frames[0]);
    // Anchored on the sheet's own measured feet, so the creature stands on its
    // position instead of hovering over it.
    sprite.setOrigin(sheet.anchor.x, sheet.anchor.y).setScale(this.#baseScale);
    // `visible` too. Without it a creature hidden by something else -- the
    // Mirror is hidden for the whole hatch cinematic -- reappeared the instant
    // its sheets finished downloading, which is mid-transformation.
    sprite.setDepth(old.depth).setFlipX(old.flipX).setAlpha(old.alpha).setVisible(old.visible);
    sprite.play(animationKey(sheet.texture, 'idle'));
    this.#sprite = sprite;
    old.destroy();
    // Pick up whatever the enemy is actually doing this instant, rather than
    // showing an idle loop until the next state change.
    this.#applyState(this.#stateFor());
  }

  /**
   * Uniform scale for a sheet, solved from the artwork rather than the box.
   *
   * Never `setDisplaySize`: that measures the frame's untrimmed source box, and
   * these sheets pad differently per state -- the skeleton's idle box is
   * 285x448 and its attack box 454x385. Asking for a height in box terms would
   * make it change size every time it swung.
   */
  #scaleFor(sheet: EnemySheet): number {
    const art = this.#art;
    const ratio = (art?.sizeRatio ?? 1) * (this.snap.elite ? 1.22 : 1) * (this.snap.boss ? 1.25 : 1);
    return (PLAYER_BODY * ratio) / (sheet.frameSize.height * sheet.bodyRatio);
  }

  /**
   * How far above its position a floating enemy hangs.
   *
   * Zero for everything that walks, so the ten families anchored on their feet
   * are untouched.
   */
  #hover(): number {
    return this.#art?.floats ? this.#bodyHeight * 0.5 : 0;
  }

  /**
   * Which sheet the snapshot says to play.
   *
   * Four authoritative fields, no client state: `windingUp` is the attack,
   * velocity is the walk, having a target at all is the alert, and the rest is
   * idle.
   */
  #stateFor(): PlayState {
    // A wind-up outranks a flinch: the telegraph is the one thing on screen
    // the player has to be able to read, and hiding it behind a hurt clip
    // would make a boss unfair rather than heavy.
    if (this.snap.windingUp) return this.#art?.slam ? 'slam' : 'attack';
    if (this.#hurtFor > 0 && this.#art?.hurt) return 'hurt';
    if (Math.hypot(this.velocity.x, this.velocity.y) > MOVING_SPEED) return 'walk';
    if (this.snap.targetId !== null && this.snap.state !== 'dead') return 'alert';
    return 'idle';
  }

  /** The sheet for a state, including the three only a boss has. */
  #sheetFor(state: PlayState): EnemySheet | undefined {
    const art = this.#art;
    if (!art) return undefined;
    if (state === 'slam') return art.slam;
    if (state === 'hurt') return art.hurt;
    return art[state];
  }

  #applyState(state: PlayState): void {
    const art = this.#art;
    if (!art || state === this.#state) return;
    const sheet = this.#sheetFor(state);
    if (!sheet) return;
    this.#state = state;
    // Re-solved per sheet: the four are cropped differently, so keeping one
    // scale across them would resize the creature mid-fight.
    this.#baseScale = this.#scaleFor(sheet);
    this.#bodyHeight = sheet.frameSize.height * sheet.bodyRatio * this.#baseScale;
    const sprite = this.sprite as Phaser.GameObjects.Sprite;
    sprite.setOrigin(sheet.anchor.x, sheet.anchor.y);
    sprite.setScale(this.#baseScale);
    // Keyed by the state, not just by the sheet: a family can point several
    // states at one sheet, and the dummy points all of them at its only one.
    sprite.play(animationKey(sheet.texture, state), true);
  }

  applySnapshot(snap: EnemySnap): void {
    if (snap.health < this.#lastHealth) {
      this.#flash = 0.12;
      // Restarted rather than extended, so a flurry of hits keeps flinching
      // instead of playing one long clip through them.
      if (this.#art?.hurt) this.#hurtFor = HURT_SECONDS;
    }
    this.#lastHealth = snap.health;
    const wasWinding = this.snap.windingUp;
    this.snap = snap;
    this.syncTarget(snap.position, snap.velocity);
    if (Math.abs(snap.facing.x) > 0.2) this.sprite.setFlipX(snap.facing.x < 0);
    if (snap.windingUp && !wasWinding) this.#showMark();
    else if (!snap.windingUp && wasWinding) this.#hideMark();
    this.armWeapon();
  }

  /**
   * Swing the held weapon, if this enemy is holding one.
   *
   * Driven by the same server event that drives the player's swing, so the
   * Mirror's blade moves on the tick the damage lands rather than on a guess
   * made from its animation.
   */
  strike(comboStep = 1, thrown = false): void {
    this.#weapon?.strike(comboStep, { x: this.x, y: this.y - this.#hover() }, this.snap.facing, thrown);
  }

  hit(): void {
    this.#flash = 0.12;
  }

  // --- the alert mark ----------------------------------------------------------

  /**
   * The "!" over an enemy that has started a wind-up.
   *
   * Six frames, not the eight on the sheet: the last two came back with the
   * fade baked out -- one held thirteen pixels above half opacity and the other
   * keyed to nothing at all. The fade is this tween instead.
   */
  #showMark(): void {
    if (!this.scene.textures.exists(ALERT_MARK.texture)) return;
    if (!this.#mark) {
      const height = this.#bodyHeight * 0.34;
      this.#mark = this.scene.add.sprite(this.x, this.y, ALERT_MARK.texture, ALERT_MARK.frames[0])
        .setOrigin(ALERT_MARK.anchor.x, ALERT_MARK.anchor.y)
        .setScale(height / (ALERT_MARK.frameSize.height * ALERT_MARK.bodyRatio))
        .setDepth(DEPTH.fxHigh - 1);
    }
    this.#markTween?.stop();
    this.#mark.setVisible(true).setAlpha(0);
    this.#mark.play(animationKey(ALERT_MARK.texture, 'play'), true);
    this.#markTween = this.scene.tweens.add({ targets: this.#mark, alpha: 1, duration: 110 });
  }

  #hideMark(): void {
    const mark = this.#mark;
    if (!mark) return;
    this.#markTween?.stop();
    this.#markTween = this.scene.tweens.add({
      targets: mark, alpha: 0, duration: 160, onComplete: () => mark.setVisible(false),
    });
  }

  update(dt: number): void {
    // Runs down whether or not it is showing: a flinch that is interrupted by
    // a wind-up must not be waiting to resume once the wind-up ends.
    if (this.#hurtFor > 0) this.#hurtFor = Math.max(0, this.#hurtFor - dt);
    if (this.#dying) return;
    this.follow(dt);
    const moving = Math.hypot(this.velocity.x, this.velocity.y) > MOVING_SPEED;
    this.#applyState(this.#stateFor());
    // The painted sprites are one static frame and need the bob to look alive;
    // the drawn ones animate, so they only keep a trace of it.
    const bobAmount = this.#art ? 0.35 : 1;
    this.#bob += dt * (moving ? 14 : 3);
    const bobY = (moving ? Math.abs(Math.sin(this.#bob)) * 3 : Math.sin(this.#bob) * 1.2) * bobAmount;
    // A floating enemy is anchored on its middle, so its position would put
    // its waist on the floor. Lifting it by half its body hangs it over the
    // point it actually occupies, which is where the shadow and the telegraph
    // still go.
    this.sprite.setPosition(this.x, this.y - bobY - this.#hover());
    this.sprite.setDepth(this.depthFor(this.y));
    this.placeShadow(this.x, this.y);
    this.#ring?.setPosition(this.x, this.y);
    this.#aura?.setPosition(this.x, this.y - 30);
    if (this.#mark?.visible) this.#mark.setPosition(this.x, this.y - this.#bodyHeight - this.#hover() - 14);
    // Follows the body's hover rather than its bob: the weapon hangs from a
    // hand, and a blade bouncing out of time with the arm reads as two
    // separate things on screen.
    this.#weapon?.place({ x: this.x, y: this.y - this.#hover() }, this.snap.facing);
    this.#weapon?.setDepth(this.depthFor(this.y) + 1);

    // Wind-up telegraph.
    this.#telegraph.clear();
    if (this.snap.windingUp) {
      this.#windPulse += dt * 16;
      const pulse = 1 + 0.08 * Math.abs(Math.sin(this.#windPulse));
      this.sprite.setScale(this.#baseScale * pulse, this.#baseScale * (2 - pulse));
      this.sprite.setTint(0xff8a8a).setTintMode(Phaser.TintModes.MULTIPLY);
      const angle = Math.atan2(this.snap.facing.y, this.snap.facing.x);
      const reach = Math.max(36, Math.min(90, this.snap.radius * 3.2));
      this.#telegraph.fillStyle(0xd9413f, 0.22);
      this.#telegraph.slice(this.x, this.y, reach, angle - 0.55, angle + 0.55, false);
      this.#telegraph.fillPath();
      this.#telegraph.lineStyle(2, 0xff6a6a, 0.6);
      this.#telegraph.strokeCircle(this.x, this.y, this.snap.radius + 4);
    } else if (this.#flash > 0) {
      this.#flash -= dt;
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.sprite.setScale(this.#baseScale * 1.06, this.#baseScale * 0.96);
    } else {
      this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.snap.statusEffects.includes('slow')) this.sprite.setTint(0x9fe3ff);
      if (this.snap.statusEffects.includes('burn')) this.sprite.setTint(0xffa060);
      this.sprite.setScale(this.#baseScale);
    }

    // Health bar: shown when damaged, always for elites and bosses. Placed off
    // the drawn body rather than the frame box, which is padded by the trails.
    this.#bar.clear();
    const frac = Math.max(0, this.snap.health / this.snap.maxHealth);
    if (frac < 0.999 || this.snap.elite || this.snap.boss) {
      const w = this.snap.boss ? 70 : this.snap.elite ? 44 : 34;
      const h = this.snap.boss ? 6 : 4;
      const top = this.y - this.#bodyHeight - this.#hover() - 8;
      this.#bar.fillStyle(0x14111a, 0.75);
      this.#bar.fillRoundedRect(this.x - w / 2 - 1, top - 1, w + 2, h + 2, 2);
      this.#bar.fillStyle(this.snap.boss ? PALETTE.magenta : PALETTE.healthRed, 1);
      this.#bar.fillRoundedRect(this.x - w / 2, top, w * frac, h, 2);
      if (this.snap.elite && !this.snap.boss) {
        this.#bar.lineStyle(1, PALETTE.gold, 0.8);
        this.#bar.strokeRoundedRect(this.x - w / 2 - 1, top - 1, w + 2, h + 2, 2);
      }
    }
  }

  /**
   * Death animation, then destroy. Returns the burst position for VFX.
   *
   * Two deaths. A family with a drawn one plays it and fades from its last
   * frame; everything else gets the squash, which is uniform, cheap and reads
   * at any size. `update` has already stopped running by then, so neither can
   * be walked back on top of by the state machine.
   */
  die(): Vec2 {
    if (this.#dying) return { x: this.x, y: this.y };
    this.#dying = true;
    this.#bar.clear();
    this.#telegraph.clear();
    this.#ring?.destroy();
    this.#aura?.destroy();
    this.#markTween?.stop();
    this.#mark?.destroy();
    this.#mark = null;
    this.shadow?.destroy();
    const burst = { x: this.x, y: this.y - 14 };

    const drawn = this.#art?.death;
    if (drawn && this.scene.textures.exists(drawn.texture)) {
      const sprite = this.sprite as Phaser.GameObjects.Sprite;
      sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      const scale = this.#scaleFor(drawn);
      sprite.setOrigin(drawn.anchor.x, drawn.anchor.y).setScale(scale);
      sprite.play(animationKey(drawn.texture, 'death'), true);
      // Held on the last frame, then faded: the clip does not loop, so the
      // hold is what the fade runs over rather than a second pass of it.
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (!this.scene) return;
        this.scene.tweens.add({
          targets: sprite, alpha: 0, duration: 420, ease: 'Quad.easeIn',
          onComplete: () => this.destroy(),
        });
      });
      return burst;
    }

    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.tweens.add({
      targets: this.sprite, scaleX: this.#baseScale * 1.3, scaleY: this.#baseScale * 0.2, alpha: 0, y: this.y + 6,
      duration: 260, ease: 'Quad.easeIn', onComplete: () => this.destroy(),
    });
    return burst;
  }

  override destroy(): void {
    super.destroy();
    this.#weapon?.destroy();
    this.#weapon = null;
    this.sprite.destroy();
    this.#bar.destroy();
    this.#telegraph.destroy();
    this.#ring?.destroy();
    this.#aura?.destroy();
    this.#markTween?.stop();
    this.#mark?.destroy();
  }
}
