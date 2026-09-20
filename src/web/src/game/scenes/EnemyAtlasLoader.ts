/**
 * Enemy sheets, fetched per room instead of all at boot.
 *
 * Twelve families at four sheets each is 51 MB, and a room draws at most a few
 * of them, so loading the lot before the title screen clears made the first
 * load eight times heavier than it needed to be. The room snapshot names the
 * sprites its spawn table will use (`RoomFull.enemySprites`), which is exactly
 * when the client first hears about a room, so that is the cue.
 *
 * Two rules hold this together:
 *
 * - **Nothing is ever fetched twice.** A family is remembered once its four
 *   atlases are in the texture cache, so walking back into a cleared room
 *   loads nothing at all.
 * - **A family is only announced ready once its animations exist.** Phaser
 *   keys animations globally but a clip whose frames name an unloaded texture
 *   is a clip that draws nothing, so registration happens here, after the
 *   fetch, rather than in `PreloadScene`.
 *
 * Until a family is ready its enemies draw as the painted stand-in; see
 * `EnemyView.adoptArt`.
 */

import Phaser from 'phaser';

import {
  enemyTextures, hasEnemyArt, registerEnemyAnimations, type EnemySpriteName,
} from '../animation/enemyClips';
import { DARK_WEAPON_TEXTURES, registerDarkWeaponAnimations } from '../animation/weaponClips';
import { DARK_EFFECT_TEXTURES, registerDarkEffectAnimations } from '../animation/abilityClips';

/**
 * Everything an armed boss needs drawn in its own colours: the weapons in its
 * hands and whatever leaves them. One bundle, because they are wanted at the
 * same instant and splitting them would show a black staff throwing an orange
 * fireball for as long as the second fetch took.
 */
const DARK_BUNDLE: readonly string[] = [...DARK_WEAPON_TEXTURES, ...DARK_EFFECT_TEXTURES];

export class EnemyAtlasLoader {
  readonly #scene: Phaser.Scene;
  /** Families whose atlases are loaded and whose clips are registered. */
  readonly #ready = new Set<EnemySpriteName>();
  /** Families asked for but not yet fetched. */
  readonly #queue: EnemySpriteName[] = [];
  /** Families whose fetch failed; not retried within a session. */
  readonly #failed = new Set<EnemySpriteName>();
  #busy = false;
  #stopped = false;
  /**
   * The Mirror's copies of the player's weapons -- twenty-six sheets that are
   * needed only once something in the room is armed with one.
   *
   * Not a creature and so not a `family`, but it wants exactly the same
   * treatment: fetched at most once, registered only after its textures have
   * actually arrived, and never retried if they do not. It rides along in the
   * same batch rather than starting a second load, because a scene has one
   * loader and two `COMPLETE` listeners on it race.
   */
  #darkWeapons: 'idle' | 'queued' | 'ready' | 'failed' = 'idle';
  readonly #onReady: (sprites: readonly EnemySpriteName[]) => void;

  constructor(scene: Phaser.Scene, onReady: (sprites: readonly EnemySpriteName[]) => void) {
    this.#scene = scene;
    this.#onReady = onReady;
  }

  /** Whether this sprite can be drawn from Logesh's sheets right now. */
  isReady(sprite: string): sprite is EnemySpriteName {
    return hasEnemyArt(sprite) && this.#ready.has(sprite);
  }

  /**
   * Whether asking for this sprite would do anything.
   *
   * Lets the per-snapshot backstop skip a sprite with no sheet, or one already
   * loaded, without allocating a request list twenty times a second.
   */
  needs(sprite: string): boolean {
    return hasEnemyArt(sprite)
      && !this.#ready.has(sprite) && !this.#failed.has(sprite) && !this.#queue.includes(sprite);
  }

  /**
   * Fetch the blackened weapon sheets, once, the first time anything needs one.
   *
   * Driven off the snapshot rather than off the room, because which enemies
   * are armed is not known when the room arrives -- the sandbox can arm any
   * boss standing in it at any moment. Until these land the weapon simply is
   * not drawn, the same way a creature waits on the painted stand-in.
   */
  requestDarkWeapons(): void {
    if (this.#stopped || this.#darkWeapons !== 'idle') return;
    this.#darkWeapons = 'queued';
    this.#pump();
  }

  /** Whether the dark sheets are loaded and their clips registered. */
  get darkWeaponsReady(): boolean {
    return this.#darkWeapons === 'ready';
  }

  /**
   * Stop caring about anything still in flight.
   *
   * A load started in one room can complete after the scene has shut down, and
   * upgrading a destroyed enemy would add a sprite to a dead scene.
   */
  stop(): void {
    this.#stopped = true;
    this.#queue.length = 0;
  }

  /**
   * Ask for the families a room needs.
   *
   * Safe to call with anything: sprites with no art, sprites already loaded,
   * and an empty list -- a village names no enemies, so it asks for nothing
   * and fetches nothing.
   */
  request(sprites: readonly string[]): void {
    if (this.#stopped) return;
    for (const sprite of sprites) {
      if (!this.needs(sprite) || !hasEnemyArt(sprite)) continue;
      this.#queue.push(sprite);
    }
    this.#pump();
  }

  #present(sprite: EnemySpriteName): boolean {
    return enemyTextures(sprite).every((key) => this.#scene.textures.exists(key));
  }

  #pump(): void {
    if (this.#stopped || this.#busy) return;
    const wantsDark = this.#darkWeapons === 'queued';
    if (this.#queue.length === 0 && !wantsDark) return;
    const batch = this.#queue.splice(0, this.#queue.length);

    // Anything already in the texture cache -- a scene restart keeps it --
    // needs registering but no fetch.
    const toFetch = batch.filter((sprite) => !this.#present(sprite));
    const darkToFetch = wantsDark
      ? DARK_BUNDLE.filter((key) => !this.#scene.textures.exists(key))
      : [];
    if (toFetch.length === 0 && darkToFetch.length === 0) {
      this.#settle(batch, wantsDark);
      return;
    }

    this.#busy = true;
    const started = performance.now();
    for (const sprite of toFetch) {
      for (const texture of enemyTextures(sprite)) {
        if (this.#scene.textures.exists(texture)) continue;
        this.#scene.load.setPath(`game/${texture}`);
        this.#scene.load.atlas(texture, `${texture}.png`, `${texture}.json`);
      }
    }
    for (const texture of darkToFetch) {
      this.#scene.load.setPath(`game/${texture}`);
      this.#scene.load.atlas(texture, `${texture}.png`, `${texture}.json`);
    }
    this.#scene.load.setPath();
    // COMPLETE fires whether or not every file arrived, so `#settle` checks the
    // texture cache rather than trusting it.
    this.#scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.#busy = false;
      console.info(
        `[mirrorbound] loaded ${toFetch.length} enemy ${toFetch.length === 1 ? 'family' : 'families'} `
        + `(${toFetch.join(', ')}) in ${Math.round(performance.now() - started)}ms`,
      );
      this.#settle(batch, wantsDark);
      // A room entered while the last batch was in flight queued behind it.
      this.#pump();
    });
    this.#scene.load.start();
  }

  #settle(batch: readonly EnemySpriteName[], dark: boolean): void {
    if (this.#stopped) return;
    if (dark) {
      if (DARK_BUNDLE.every((key) => this.#scene.textures.exists(key))) {
        registerDarkWeaponAnimations(this.#scene.anims);
        registerDarkEffectAnimations(this.#scene.anims);
        this.#darkWeapons = 'ready';
      } else {
        this.#darkWeapons = 'failed';
        console.warn('[mirrorbound] the Mirror\'s weapon sheets did not load; it fights bare-handed');
      }
    }
    const ready: EnemySpriteName[] = [];
    for (const sprite of batch) {
      if (!this.#present(sprite)) {
        // A sheet that would not load leaves its enemies on the painted
        // stand-in for good, which is visible and correctly sized -- better
        // than retrying every room change for art that is not there.
        this.#failed.add(sprite);
        console.warn(`[mirrorbound] enemy sheets for "${sprite}" did not load; keeping the painted texture`);
        continue;
      }
      registerEnemyAnimations(this.#scene.anims, sprite);
      this.#ready.add(sprite);
      ready.push(sprite);
    }
    if (ready.length > 0) this.#onReady(ready);
  }
}
