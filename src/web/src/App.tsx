import { CharacterScreen } from './ui/CharacterScreen';
import { DebugOverlay } from './ui/DebugOverlay';
import { DialogueScreen } from './ui/DialogueScreen';
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
 * pause screen, the console, the interaction prompt and the toasts. That is
 * hand-drawn chrome assembled from the atlases, and it belongs on the same
 * surface as the art it frames. React does not render any of it and cannot
 * reach it; it goes through the event bus like everything else.
 *
 * **Here, in the DOM**: what is left, and the list only shrinks -- the
 * character sheet, dialogue, naming, and the AI debug view. They are styled
 * from the same tokens as the canvas chrome (see `styles.css`), so the two
 * halves read as one interface rather than as a game with a website over it.
 *
 * Nothing appears twice. When a screen moves into the canvas it comes out of
 * this list, which is why `Hud`, `MapScreen`, `SettingsScreen`,
 * `ControlsScreen`, `PauseMenu`, `Toasts` and the death and victory overlays
 * are no longer here, and neither are the skill tree and the inventory:
 * `HudScene` draws all of them.
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
        <DebugOverlay />
      </div>
      <CharacterScreen />
      <DialogueScreen />
      <NamingScreen />
      <ConnectionOverlay />
    </div>
  );
}
