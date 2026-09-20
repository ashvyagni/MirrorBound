/**
 * Combat and world feedback: slashes, sparks, damage numbers, death bursts,
 * spell effects, telegraphs, callouts, camera shake.
 *
 * Everything is fire-and-forget: create, tween, destroy. Quality lowers
 * particle counts; damage numbers and shake can be turned off in settings.
 */

import Phaser from 'phaser';

import { EFFECTS, effectKey, type EffectDef, type EffectId } from '../animation/abilityClips';
import { GOAT_BODY_RATIO } from '../animation/goatAtlas.generated';
import { CAMERA, DEPTH, PALETTE, PLAYER_DISPLAY_HEIGHT } from '../constants';
import type { Vec2 } from '../contracts';
import type { Settings } from '../../ui/settings';

const PLAYER_BODY = PLAYER_DISPLAY_HEIGHT * GOAT_BODY_RATIO;

/**
 * How far Flame Burst's wave is swept, and over how long.
 *
 * The reach is the ability's own `area` on the server (170 units); it is
 * repeated rather than imported because `Vfx` knows nothing about ability
 * definitions, and the caller passes the real number when it has it.
 */
const FLAME_BURST_REACH = 170;
const FLAME_BURST_TRAVEL = 260;

export class Vfx {
  #settings: Settings;

  constructor(private readonly scene: Phaser.Scene, settings: Settings) {
    this.#settings = settings;
  }

  setSettings(settings: Settings): void {
    this.#settings = settings;
  }

  get #density(): number {
    return this.#settings.quality === 'high' ? 1 : this.#settings.quality === 'medium' ? 0.55 : 0.25;
  }

  #burst(x: number, y: number, texture: string, count: number, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): void {
    const n = Math.max(1, Math.round(count * this.#density));
    const emitter = this.scene.add.particles(x, y, texture, { ...cfg, emitting: false }).setDepth(DEPTH.fxHigh);
    emitter.explode(n, 0, 0);
    this.scene.time.delayedCall(((cfg.lifespan as { max?: number })?.max ?? (cfg.lifespan as number) ?? 600) + 50, () => emitter.destroy());
  }

  // --- drawn effects ----------------------------------------------------------

  /**
   * Play one of Logesh's effect sheets standing on the floor at `pos`.
   *
   * Fire-and-forget: it plays once and destroys itself, so the caller must
   * invoke it once per server event and never once per snapshot -- snapshots
   * repeat at 20 Hz and a pillar spawned per snapshot is twenty pillars.
   *
   * Returns false when the atlas is not loaded, so the caller can fall back to
   * particles rather than silently dropping the feedback.
   */
  groundEffect(id: EffectId, pos: Vec2, sizeMult = 1, facing?: Vec2): boolean {
    return this.groundEffectSprite(id, pos, sizeMult, facing) !== null;
  }

  /**
   * The same, handing back the sprite so a caller can move it.
   *
   * Only Flame Burst needs this: its sheet is a wave that rolls, so the sprite
   * has to travel while it plays. Everything else stays where it is put and
   * uses the boolean form above.
   */
  groundEffectSprite(
    id: EffectId, pos: Vec2, sizeMult = 1, facing?: Vec2,
  ): Phaser.GameObjects.Sprite | null {
    const def: EffectDef = EFFECTS[id];
    if (!this.scene.textures.exists(def.texture)) return null;
    const sprite = this.scene.add.sprite(pos.x, pos.y, def.texture, def.frames[0]);
    // Uniform scale solved from the artwork, not `setDisplaySize`: that reads
    // the untrimmed source box, which these sheets pad by wildly different
    // amounts frame to frame.
    sprite.setScale((PLAYER_BODY * def.sizeRatio * sizeMult) / (def.frameSize.height * def.bodyRatio));
    const anchorX = def.anchorX ?? def.anchor.x;
    sprite.setOrigin(anchorX, def.anchor.y);
    sprite.setDepth(def.ground ? DEPTH.fxLow : DEPTH.entityTop);
    if (def.ground) {
      this.#standOnFloor(sprite);
      // Re-planted each frame because the sheet's artwork shifts within its
      // box; `#standOnFloor` reads the *current* frame, so a moving effect
      // keeps its feet on the floor as it travels rather than sliding up it.
      sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => this.#standOnFloor(sprite));
    } else if (facing && (facing.x !== 0 || facing.y !== 0)) {
      // Mirror first, then turn by the mirrored angle, so the effect's own "up"
      // stays upward at every angle. The origin has to mirror with it or the
      // effect keeps its reach on the side the art was drawn for.
      const flipped = facing.x < 0;
      sprite.setFlipX(flipped);
      sprite.setOrigin(flipped ? 1 - anchorX : anchorX, def.anchor.y);
      sprite.setRotation(flipped ? Math.atan2(-facing.y, -facing.x) : Math.atan2(facing.y, facing.x));
    }
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
    sprite.play(effectKey(def));
    return sprite;
  }

  /**
   * Put the *artwork's* bottom edge on the sprite's y, frame by frame.
   *
   * A fixed origin of 1 is not the fix and is worse: the atlas shares one
   * source box across a sheet, and only whichever frame reaches lowest actually
   * touches its bottom edge -- pinning to the box grounds that one frame and
   * leaves the rest hovering by the difference. So the origin comes from each
   * frame's own trim.
   */
  #standOnFloor(sprite: Phaser.GameObjects.Sprite): void {
    const frame = sprite.frame;
    const boxHeight = frame.realHeight || frame.height;
    if (!boxHeight) return;
    sprite.setOrigin(sprite.originX, (frame.y + frame.height) / boxHeight);
  }

  // --- combat -------------------------------------------------------------------

  slash(pos: Vec2, facing: Vec2, colour = 0xffffff, scale = 1): void {
    const angle = Math.atan2(facing.y, facing.x);
    const arc = this.scene.add.image(pos.x + facing.x * 26, pos.y - 18 + facing.y * 18, 'fx:slash')
      .setRotation(angle + Math.PI / 2).setScale(0.7 * scale, 0.9 * scale).setTint(colour).setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
    this.scene.tweens.add({
      targets: arc, alpha: 0, scaleX: 1.1 * scale, scaleY: 1.2 * scale, duration: 180, ease: 'Quad.easeOut',
      onComplete: () => arc.destroy(),
    });
  }

  hitSparks(pos: Vec2, colour = 0xffffff, count = 8): void {
    this.#burst(pos.x, pos.y - 10, 'fx:spark', count, {
      lifespan: { min: 180, max: 380 }, speed: { min: 70, max: 190 }, scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 }, tint: colour, blendMode: 'ADD', gravityY: 260,
    });
  }

  damageNumber(pos: Vec2, amount: number, crit = false, colour = '#fff1c9'): void {
    if (!this.#settings.damageNumbers || amount <= 0) return;
    const text = this.scene.add.text(pos.x + (Math.random() - 0.5) * 16, pos.y - 30, `${Math.round(amount)}`, {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: crit ? '22px' : '16px', fontStyle: crit ? 'bold' : 'normal',
      color: crit ? '#ffd27a' : colour, stroke: '#14111a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(DEPTH.fxHigh + 1);
    if (crit) text.setScale(1.3);
    this.scene.tweens.add({
      targets: text, y: text.y - 34, alpha: { from: 1, to: 0 }, scale: crit ? 1 : 0.9, duration: 720, ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  deathBurst(pos: Vec2, colour = 0xaaaaaa, big = false): void {
    this.#burst(pos.x, pos.y, 'fx:soft', big ? 40 : 18, {
      lifespan: { min: 350, max: 800 }, speed: { min: 40, max: big ? 220 : 140 }, scale: { start: big ? 0.9 : 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: [colour, 0xffffff], blendMode: 'ADD', gravityY: 120,
    });
    const flash = this.scene.add.image(pos.x, pos.y, 'fx:glow').setTint(colour).setScale(big ? 1.2 : 0.5).setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh);
    this.scene.tweens.add({ targets: flash, scale: big ? 2.6 : 1.3, alpha: 0, duration: 380, onComplete: () => flash.destroy() });
    if (big) this.shake(CAMERA.shake.heavy, 260);
  }

  impact(pos: Vec2, kind: string): void {
    const colour = kind.includes('fire') ? PALETTE.ember : kind.includes('ice') ? PALETTE.ice
      : kind.includes('arcane') ? PALETTE.arcane : kind.includes('mirror') ? PALETTE.magenta : 0xe8e4dc;
    this.hitSparks(pos, colour, kind.includes('fire') ? 16 : 7);
    if (kind.includes('fire')) {
      // The fire bolt carries a 56-unit blast radius on the server; the pillar
      // is what says so. It stands upright wherever it lands.
      this.groundEffect('firePillar', pos, 0.55);
      const ring = this.scene.add.image(pos.x, pos.y, 'fx:ring').setTint(PALETTE.ember).setScale(0.2).setAlpha(0.8)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
      this.scene.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    }
  }

  // --- abilities -------------------------------------------------------------------

  /**
   * Flame Burst: a wave that rolls out along the cone it damages.
   *
   * The damage is instant -- the server resolves a 170-unit arc the moment the
   * key goes down -- but the art is a *rolling* wave, and drawing it parked at
   * the caster's feet made the one spell whose sheet shows travel the one that
   * visibly did not. So the sprite is swept outward across the cone's real
   * reach while its own animation plays.
   *
   * The sweep is deliberately shorter than the clip: the wave should still be
   * expanding when it reaches the edge of what it hit, not arrive and stop.
   */
  flameCone(pos: Vec2, facing: Vec2, reach = FLAME_BURST_REACH): void {
    const angle = Phaser.Math.RadToDeg(Math.atan2(facing.y, facing.x));
    const from = { x: pos.x + facing.x * 34, y: pos.y + facing.y * 22 };
    const wave = this.groundEffectSprite('fireWave', from, 1);
    if (wave) {
      this.scene.tweens.add({
        targets: wave,
        x: pos.x + facing.x * reach,
        y: pos.y + facing.y * reach * 0.62,   // the floor is foreshortened
        duration: FLAME_BURST_TRAVEL,
        ease: 'Quad.easeOut',
      });
    }
    this.#burst(pos.x + facing.x * 20, pos.y - 12 + facing.y * 14, 'fx:soft', 46, {
      lifespan: { min: 300, max: 620 }, speed: { min: 220, max: 420 }, angle: { min: angle - 38, max: angle + 38 },
      scale: { start: 0.9, end: 0.1 }, alpha: { start: 0.95, end: 0 }, tint: [0xfff1a8, 0xffb13d, 0xff7a3d, 0xd62e6c],
      blendMode: 'ADD',
    });
    this.shake(CAMERA.shake.hit, 150);
  }

  /**
   * Flame Pillar: a column of fire where the caster stands.
   *
   * It had no case in the client's ability switch at all, so the one spell
   * that is *only* a visual -- it damages in a radius and spawns nothing --
   * fired silently. The sheet had been drawn, sliced and never played.
   */
  firePillar(pos: Vec2, radius: number): void {
    // Sized off the server's own radius, like the nova, rather than a number
    // chosen to look right against one particular arena.
    if (!this.groundEffect('firePillar', pos, Math.max(0.7, radius / 120))) {
      // No sheet: still say something happened, or the spell reads as a
      // mis-press. Same rule the boss nova follows.
      this.hitSparks(pos, PALETTE.ember, 18);
    }
    const ring = this.scene.add.image(pos.x, pos.y - 6, 'fx:ring').setTint(PALETTE.ember)
      .setScale(0.1).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
    this.scene.tweens.add({
      targets: ring, scale: (radius * 2) / 84, alpha: 0, duration: 420, ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.#burst(pos.x, pos.y - 10, 'fx:soft', 30, {
      lifespan: { min: 380, max: 760 }, speed: { min: radius * 0.5, max: radius * 1.2 },
      scale: { start: 0.9, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xfff1a8, 0xffb13d, 0xff7a3d], blendMode: 'ADD',
    });
    this.shake(CAMERA.shake.hit, 170);
  }

  /**
   * A lance of ice out from the staff's head.
   *
   * Stretched along its length rather than scaled uniformly: the sheet draws a
   * bright star at the beam's source and a shaft running off to the right, and
   * scaling the whole thing to a 760-unit reach would make the star enormous.
   * So the height is the sheet's own and only X is stretched, which is exactly
   * what a lance getting longer looks like.
   *
   * `from` is the staff's head, not the caster: the server resolves the hitbox
   * from the same point, so what is drawn and what hit you are one line.
   */
  beam(from: Vec2, facing: Vec2, reach: number): void {
    const def = EFFECTS.iceBeam;
    if (!this.scene.textures.exists(def.texture)) {
      this.arcaneCast(from, facing);
      return;
    }
    const sprite = this.scene.add.sprite(from.x, from.y, def.texture, def.frames[0]);
    // Anchored on its source so it grows outward from the staff rather than
    // from its own middle.
    sprite.setOrigin(def.anchorX ?? 0.03, def.anchor.y);
    sprite.setDepth(DEPTH.fxHigh);

    const height = (PLAYER_BODY * def.sizeRatio) / (def.frameSize.height * def.bodyRatio);
    // The drawn shaft is most of the frame; solving X against the full frame
    // width would fall short of the reach by the star's own margin.
    sprite.setScale(reach / def.frameSize.width, height);
    sprite.setRotation(Math.atan2(facing.y, facing.x));
    sprite.setBlendMode(Phaser.BlendModes.ADD);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
    sprite.play(effectKey(def));

    this.#burst(from.x, from.y, 'fx:spark', 14, {
      lifespan: { min: 180, max: 420 }, speed: { min: 40, max: 160 },
      scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: [PALETTE.ice, 0xffffff], blendMode: 'ADD',
    });
    this.shake(CAMERA.shake.hit, 120);
  }

  nova(pos: Vec2, radius: number): void {
    // Erupts from the ground, so its base belongs on the floor line. Sized off
    // the server's own radius rather than a number picked to look right.
    //
    // The boss has its own drawn ring, which arrives with its sheets when the
    // arena loads. `groundEffect` returns false if it has not, and `iceNova`
    // -- which is always loaded -- is the stand-in, so the one attack that can
    // kill you outright is never an unannounced one.
    const size = Math.max(0.6, radius / 150);
    if (!this.groundEffect('shardRing', pos, size)) this.groundEffect('iceNova', pos, size);
    const ring = this.scene.add.image(pos.x, pos.y - 8, 'fx:ring').setTint(PALETTE.arcane).setScale(0.1).setAlpha(1)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
    this.scene.tweens.add({ targets: ring, scale: (radius * 2) / 84, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const ring2 = this.scene.add.image(pos.x, pos.y - 8, 'fx:ring').setTint(0xffffff).setScale(0.1).setAlpha(0.7)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxLow);
    this.scene.tweens.add({ targets: ring2, scale: (radius * 2) / 84, alpha: 0, duration: 560, delay: 60, ease: 'Quad.easeOut', onComplete: () => ring2.destroy() });
    this.#burst(pos.x, pos.y - 8, 'fx:spark', 36, {
      lifespan: { min: 400, max: 800 }, speed: { min: radius * 0.8, max: radius * 1.6 }, scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [PALETTE.arcane, 0xffffff], blendMode: 'ADD',
    });
    this.shake(CAMERA.shake.hit, 180);
  }

  dash(pos: Vec2, direction: Vec2): void {
    const angle = Phaser.Math.RadToDeg(Math.atan2(-direction.y, -direction.x));
    this.#burst(pos.x, pos.y - 14, 'fx:soft', 14, {
      lifespan: { min: 200, max: 420 }, speed: { min: 60, max: 160 }, angle: { min: angle - 25, max: angle + 25 },
      scale: { start: 0.6, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: PALETTE.violet, blendMode: 'ADD',
    });
  }

  arcaneCast(pos: Vec2, facing?: Vec2): void {
    const flash = this.scene.add.image(pos.x, pos.y - 20, 'fx:glow').setTint(PALETTE.arcane).setScale(0.4).setAlpha(0.8)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh);
    this.scene.tweens.add({ targets: flash, scale: 0.9, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
    // The lance the bolt leaves along. This is the one ability the server marks
    // `pierce`, which is what a lance says and a puff of glow does not.
    if (facing) this.groundEffect('iceBeam', { x: pos.x, y: pos.y - 22 }, 0.6, facing);
  }

  // --- world --------------------------------------------------------------------------

  pickup(pos: Vec2, colour: number): void {
    this.#burst(pos.x, pos.y - 6, 'fx:spark', 10, {
      lifespan: { min: 240, max: 480 }, speed: { min: 30, max: 110 }, scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [colour, 0xffffff], blendMode: 'ADD', gravityY: -120,
    });
  }

  heal(pos: Vec2, amount: number): void {
    this.#burst(pos.x, pos.y - 10, 'fx:soft', 14, {
      lifespan: { min: 500, max: 900 }, speedY: { min: -90, max: -30 }, speedX: { min: -30, max: 30 },
      scale: { start: 0.5, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: PALETTE.healthGreen, blendMode: 'ADD',
    });
    this.damageNumber(pos, amount, false, '#8fe69a');
  }

  levelUp(pos: Vec2): void {
    const beam = this.scene.add.image(pos.x, pos.y - 10, 'fx:glow').setTint(PALETTE.gold).setScale(0.8, 2.2).setAlpha(0.9)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fxHigh);
    this.scene.tweens.add({ targets: beam, scaleX: 2.2, scaleY: 3.2, alpha: 0, duration: 700, onComplete: () => beam.destroy() });
    this.#burst(pos.x, pos.y - 10, 'fx:spark', 40, {
      lifespan: { min: 600, max: 1100 }, speed: { min: 60, max: 200 }, scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [PALETTE.gold, 0xffffff, PALETTE.pink], blendMode: 'ADD', gravityY: -60,
    });
    this.callout(pos, 'LEVEL UP', '#ffd27a');
  }

  callout(pos: Vec2, text: string, colour = '#ffffff', size = 14): void {
    const t = this.scene.add.text(pos.x, pos.y - 64, text, {
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: colour,
      stroke: '#14111a', strokeThickness: 4, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.fxHigh + 2).setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 10, duration: 160 });
    this.scene.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  }

  telegraphRing(pos: Vec2, radius: number, duration: number, colour = PALETTE.magenta): void {
    const g = this.scene.add.graphics().setDepth(DEPTH.floorDecal + 3);
    const start = this.scene.time.now;
    const ev = this.scene.time.addEvent({
      delay: 16, loop: true, callback: () => {
        const t = Math.min(1, (this.scene.time.now - start) / (duration * 1000));
        g.clear();
        g.lineStyle(3, colour, 0.9);
        g.strokeCircle(pos.x, pos.y, radius);
        g.fillStyle(colour, 0.12 + 0.25 * t);
        g.fillCircle(pos.x, pos.y, radius * t);
        if (t >= 1) {
          ev.remove();
          g.destroy();
        }
      },
    });
  }

  /**
   * Room change: the exit event and the new room arrive in the same snapshot,
   * so this is one gesture -- a quick dip to black, then a fade back in over
   * whatever has already been built.
   */
  roomTransition(): void {
    const cam = this.scene.cameras.main;
    cam.resetFX();
    cam.fadeOut(140, 10, 6, 16, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress >= 1) cam.fadeIn(520, 10, 6, 16);
    });
  }

  fadeIn(duration = 500): void {
    const cam = this.scene.cameras.main;
    cam.resetFX();
    cam.fadeIn(duration, 10, 6, 16);
  }

  shake(intensity: number, duration: number = CAMERA.shake.duration): void {
    if (!this.#settings.screenShake) return;
    this.scene.cameras.main.shake(duration, intensity);
  }

  hurtFlash(): void {
    this.scene.cameras.main.flash(120, 120, 20, 30, false);
    this.shake(CAMERA.shake.hit, 120);
  }
}
