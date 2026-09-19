import Phaser from 'phaser';

import { ALERTMARK_FRAMES, ALERTMARK_TEXTURE_KEY } from '../animation/alertMarkAtlas.generated';
import { animationKey, registerClips } from '../animation/clips';
import { SPROUTIDLE_FRAMES } from '../animation/sproutIdleAtlas.generated';
import { depthAt, DEPTH, GOAT_DISPLAY_HEIGHT, MOB } from '../constants';
import { FX } from '../world/textures';

/**
 * Any of the eleven creatures.
 *
 * One class rather than eleven, because they differ only in three things --
 * which sheets they use, how big they are drawn, and how fast they move -- and
 * every one of those is a number in the table below. Eleven near-identical
 * files would be eleven places to fix the next thing that turns out to be
 * wrong about all of them.
 *
 * There is no AI here. The mob notices you, walks at you, and swings when it
 * arrives; that is enough to see a sheet running in the game, which is what
 * this is for. A real controller belongs on the server.
 */
export type MobId =
  | 'sprout' | 'brute' | 'spitter'
  | 'shardling' | 'warden' | 'acolyte' | 'scarab'
  | 'skeleton' | 'archer' | 'hound' | 'slime';

export type MobClip = 'idle' | 'alert' | 'walk' | 'attack';

const CLIPS: readonly MobClip[] = ['idle', 'alert', 'walk', 'attack'];

export interface MobDef {
  id: MobId;
  name: string;
  /** Drawn height as a multiple of the goat's, from the design in the docs. */
  sizeRatio: number;
  /** World units per second. */
  speed: number;
  /** How close it comes before swinging. */
  reach: number;
}

/** The roster, in the order the biomes introduce them. */
export const MOBS: Record<MobId, MobDef> = {
  sprout:    { id: 'sprout',    name: 'Bramble Sprout', sizeRatio: 0.55, speed: 96,  reach: 44 },
  brute:     { id: 'brute',     name: 'Bark Brute',     sizeRatio: 1.50, speed: 54,  reach: 78 },
  spitter:   { id: 'spitter',   name: 'Thorn Spitter',  sizeRatio: 1.25, speed: 70,  reach: 230 },
  shardling: { id: 'shardling', name: 'Shardling',      sizeRatio: 0.50, speed: 104, reach: 40 },
  warden:    { id: 'warden',    name: 'Pillar Warden',  sizeRatio: 1.70, speed: 46,  reach: 86 },
  acolyte:   { id: 'acolyte',   name: 'Ember Acolyte',  sizeRatio: 1.15, speed: 68,  reach: 210 },
  scarab:    { id: 'scarab',    name: 'Scarab Sentinel', sizeRatio: 0.60, speed: 160, reach: 44 },
  // The crypt four take their speeds from `main`'s own ENEMY_TYPES.
  skeleton:  { id: 'skeleton',  name: 'Bone Knight',    sizeRatio: 1.10, speed: 92,  reach: 62 },
  archer:    { id: 'archer',    name: 'Hollow Archer',  sizeRatio: 1.10, speed: 78,  reach: 240 },
  hound:     { id: 'hound',     name: 'Gloom Hound',    sizeRatio: 0.60, speed: 210, reach: 46 },
  slime:     { id: 'slime',     name: 'Mire Slime',     sizeRatio: 0.80, speed: 48,  reach: 52 },
};

export const MOB_IDS = Object.keys(MOBS) as MobId[];

/** `sproutIdle`, `houndAttack`, and so on. */
function textureFor(id: MobId, clip: MobClip): string {
  return `${id}${clip[0]!.toUpperCase()}${clip.slice(1)}`;
}

export const MOB_TEXTURES: readonly string[] = [
  ...MOB_IDS.flatMap((id) => CLIPS.map((clip) => textureFor(id, clip))),
  ALERTMARK_TEXTURE_KEY,
];

export function registerMobAnimations(anims: Phaser.Animations.AnimationManager): void {
  // Every mob sheet is eight frames named the same way, so one frame list
  // serves all forty-four of them.
  const frames = [...SPROUTIDLE_FRAMES.a, ...SPROUTIDLE_FRAMES.b];
  for (const id of MOB_IDS) {
    for (const clip of CLIPS) {
      const texture = textureFor(id, clip);
      registerClips(anims, texture, {
        [clip]: {
          frames,
          frameRate: MOB.frameRate[clip],
          // Only standing and walking loop; noticing you and swinging do not.
          repeat: clip === 'idle' || clip === 'walk' ? -1 : 0,
        },
      });
    }
  }
  registerClips(anims, ALERTMARK_TEXTURE_KEY, {
    mark: {
      frames: [...ALERTMARK_FRAMES.mark, ...ALERTMARK_FRAMES.mark_b],
      frameRate: MOB.frameRate.alert,
      repeat: 0,
    },
  });
}

export class Mob extends Phaser.GameObjects.Sprite {
  readonly def: MobDef;
  #clip: MobClip = 'idle';
  #busy = false;
  /** True once it has noticed the player; it does not un-notice. */
  #roused = false;
  #swingCooldown = 0;
  readonly #shadow: Phaser.GameObjects.Image;
  readonly #mark: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, id: MobId, x: number, y: number) {
    const def = MOBS[id];
    super(scene, x, y, textureFor(id, 'idle'));
    this.def = def;
    scene.add.existing(this);

    /**
     * Sized against the sheet's SHARED source box, not the frame in hand.
     *
     * `frame.height` is the trimmed height of whichever frame is showing, and
     * those vary -- the skeleton's idle frames alone run 447 to 415. Sizing on
     * one would make the creature change size as it animated. `realHeight` is
     * the box every frame on the sheet shares, so one scale holds for all
     * eight, and it is computed once here and never recomputed on a clip
     * change.
     */
    this.setScale((GOAT_DISPLAY_HEIGHT * def.sizeRatio) / this.frame.realHeight);
    this.setOrigin(0.5, MOB.footAnchor);

    this.#shadow = scene.add
      .image(x, y, FX.shadow)
      .setDepth(DEPTH.shadow)
      .setScale((GOAT_DISPLAY_HEIGHT * def.sizeRatio * 0.42) / 64)
      .setAlpha(0.55);

    // One mark for all eleven, composited above whichever one is reacting --
    // which is why it is a separate sheet.
    this.#mark = scene.add
      .sprite(x, y, ALERTMARK_TEXTURE_KEY, ALERTMARK_FRAMES.mark[0])
      .setVisible(false);
    // The same rule, and this one bit hard: the mark's first frame is a 45px
    // speck and its fourth is 344px, so scaling the speck to mark height drew
    // the full mark seven times too big.
    this.#mark.setScale(
      (GOAT_DISPLAY_HEIGHT * def.sizeRatio * MOB.markScale) / this.#mark.frame.realHeight,
    );

    this.play(animationKey(textureFor(id, 'idle'), 'idle'), true);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onDone, this);
  }

  get clip(): MobClip {
    return this.#clip;
  }

  #play(clip: MobClip, interrupting = false): void {
    if (this.#busy && !interrupting) return;
    this.#clip = clip;
    this.#busy = clip === 'alert' || clip === 'attack';
    this.setTexture(textureFor(this.def.id, clip));
    this.play(animationKey(textureFor(this.def.id, clip), clip), true);
  }

  #onDone(): void {
    this.#busy = false;
    this.#play(this.#roused ? 'walk' : 'idle');
  }

  /** Notice the player: the body reacts and the mark pops over its head. */
  rouse(): void {
    if (this.#roused) return;
    this.#roused = true;
    this.#play('alert', true);

    this.#mark.setVisible(true).setAlpha(1);
    this.#mark.play(animationKey(ALERTMARK_TEXTURE_KEY, 'mark'), true);
    // The sheet's own fade never arrived as real alpha -- frame 8 keyed out
    // entirely -- so the game fades it, which it can do over any duration.
    this.scene.tweens.add({
      targets: this.#mark, alpha: 0, delay: MOB.markHold, duration: MOB.markFade,
      onComplete: () => this.#mark.setVisible(false),
    });
  }

  hit(): void {
    // No hurt sheet was drawn for the mobs: the four are idle, alert, walk and
    // attack. A flash stands in until there is one, and says so.
    // Phaser 4 replaced `setTintFill` with a tint plus a FILL tint mode.
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      this.clearTint();
      this.setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  step(deltaSeconds: number, player: { x: number; y: number } | null): void {
    this.#swingCooldown = Math.max(0, this.#swingCooldown - deltaSeconds);

    if (player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distance = Math.hypot(dx, dy);

      if (!this.#roused && distance < MOB.aggroRange) this.rouse();

      if (this.#roused && !this.#busy) {
        if (distance > this.def.reach) {
          const step = (this.def.speed * deltaSeconds) / (distance || 1);
          this.x += dx * step;
          this.y += dy * step;
          if (this.#clip !== 'walk') this.#play('walk');
        } else if (this.#swingCooldown <= 0) {
          this.#play('attack');
          this.#swingCooldown = MOB.swingCooldown;
        } else if (this.#clip !== 'idle') {
          this.#play('idle');
        }
      }

      if (Math.abs(dx) > 4) this.setFlipX(dx < 0);
    }

    this.setDepth(depthAt(this.y));
    this.#shadow.setPosition(this.x, this.y);
    this.#mark.setPosition(this.x, this.y - this.displayHeight * MOB.markLift);
    this.#mark.setDepth(depthAt(this.y) + 1);
  }

  override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.#onDone, this);
    this.#shadow.destroy();
    this.#mark.destroy();
    super.destroy(fromScene);
  }
}
