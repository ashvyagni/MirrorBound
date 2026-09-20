import { CharacterScreen } from './ui/CharacterScreen';
import { GameMount } from './ui/GameMount';
import { NamingScreen } from './ui/NamingScreen';
import { ConnectionOverlay } from './ui/Overlays';
import { useHotkeys } from './ui/useHotkeys';
import './ui/store';

/**
 * The page is the game.
 *
 * The interface is drawn in two places, and the split is deliberate rather
 * than historical.
 *
 * **Inside the canvas**, as `HudScene`: everything that sits over the world
 * and has to feel like part of it -- the portrait and its bars, the minimap in
 * its ring, the hotbar, the cooldown rail, the settings and map screens, the
 * pause screen, the console and the interaction prompt. That is
 * hand-drawn chrome assembled from the atlases, and it belongs on the same
 * surface as the art it frames. React does not render any of it and cannot
 * reach it; it goes through the event bus like everything else.
 *
 * **Here, in the DOM**: what is left, and the list only shrinks -- the
 * character sheet, naming and the connection notice. They are styled from the same tokens as the canvas chrome (see
 * `styles.css`), so the two halves read as one interface rather than as a game
 * with a website over it.
 *
 * Nothing appears twice. When a screen moves into the canvas it comes out of
 * this list, and its React file is deleted rather than left behind -- a dead
 * `.tsx` beside a live `.ts` of the same name is how someone ends up editing
 * the half nobody renders. `HudScene` now draws the HUD, the map, settings,
 * controls, the pause menu, the end screen, the sandbox panel, the
 * notification stack, dialogue, the skill tree and the inventory.
 *
 * Only one screen is ever open at a time (the store enforces it), so these
 * render in any order -- each returns null unless it is the open one.
 */
export default function App() {
  useHotkeys();
  return (
    <div className="stage">
      <GameMount />
      <div className="viewport">
      </div>
      <CharacterScreen />
      <NamingScreen />
      <ConnectionOverlay />
    </div>
  );
}
