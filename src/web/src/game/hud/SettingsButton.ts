import Phaser from 'phaser';

import { SETTINGSBUTTON_TEXTURE_KEY } from '../animation/settingsButtonAtlas.generated';
import { HUD_ART } from '../constants';
import { eventBus } from '../EventBus';
import { fitWidth } from './fit';

/**
 * The gear.
 *
 * It used to carry a two-switch panel of its own, because there was no settings
 * screen for it to open and a button that does nothing is worse than no button.
 * There is one now, so the panel is gone and this is what it should always have
 * been: a button that opens a screen.
 */
export class SettingsButton {
  #button!: Phaser.GameObjects.Image;
  #objects: Phaser.GameObjects.GameObject[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Kept so `HudScene` can hand every label to the font reload in one list. */
  get texts(): readonly Phaser.GameObjects.Text[] {
    return [];
  }

  build(): void {
    const { settings } = HUD_ART;

    this.#button = this.scene.add
      .image(settings.x, settings.y, SETTINGSBUTTON_TEXTURE_KEY, 'rest');
    fitWidth(this.#button, settings.size);
    this.#objects.push(this.#button);

    // No hit area passed, on purpose. Phaser takes the frame's own bounds and
    // applies the object's origin and scale itself. A hand-built rectangle is
    // in the object's LOCAL texture space -- this one used to be built from
    // absolute canvas coordinates, which put the gear's hit area about
    // eighteen hundred pixels away from the gear and made it unclickable.
    this.#button
      .setInteractive({ useHandCursor: true })
      // The pressed frame is the art's own, not a tint: the two were drawn to
      // register exactly, which is the only reason the sheet has two cells.
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        eventBus.emit('hud:pointer-used', {});
        this.#button.setFrame('press');
        eventBus.emit('settings:toggle', {});
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.#button.setFrame('rest'))
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.#button.setFrame('rest'));
  }

  /** Reflect a fullscreen change that came from somewhere else. The screen
   *  reads `scale.isFullscreen` directly, so there is nothing to store. */
  setFullscreen(_active: boolean): void {}

  /**
   * Show or hide the whole piece.
   *
   * Used by the Sanctum cutscene, which is a scene rather than a moment of
   * play: a hotbar and a minimap over it say "you are playing" while the one
   * thing the game wants is for you to watch. Visibility rather than destroy,
   * because the scene ends and everything has to come back exactly as it was.
   */
  setVisible(on: boolean): void {
    for (const object of this.#objects) {
      // Not every GameObject carries the Visible component -- a Zone used as a
      // hit area does not -- so this asks rather than asserts.
      (object as unknown as Partial<Phaser.GameObjects.Components.Visible>).setVisible?.(on);
    }
  }

  destroy(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
  }
}
