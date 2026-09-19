import { DebugOverlay } from './ui/DebugOverlay';
import { GameMount } from './ui/GameMount';
import { InventoryScreen } from './ui/InventoryScreen';
import { ConnectionOverlay, ControlsScreen, DeathOverlay, PauseMenu, Toasts, VictoryOverlay } from './ui/Overlays';
import { SettingsScreen } from './ui/SettingsScreen';
import { SkillTreeScreen } from './ui/SkillTreeScreen';
import { useHotkeys } from './ui/useHotkeys';
import './ui/store';

/**
 * The page is the game.
 *
 * Phaser fills the stage and now draws the HUD too -- Logesh's `HudScene`
 * renders the portrait, bars, hotbar, cooldown rail and minimap as art, fed
 * from the server snapshot by `game/hud/bridge.ts`. React is left with what
 * the in-game art HUD does not cover: the menus, the transient toasts, and
 * the F3 AI overlay, none of which belong inside the game camera.
 */
export default function App() {
  useHotkeys();
  return (
    <div className="stage">
      <GameMount />
      <div className="viewport">
        <Toasts />
        <DebugOverlay />
      </div>
      <DeathOverlay />
      <VictoryOverlay />
      <PauseMenu />
      <InventoryScreen />
      <SkillTreeScreen />
      <SettingsScreen />
      <ControlsScreen />
      <ConnectionOverlay />
    </div>
  );
}
