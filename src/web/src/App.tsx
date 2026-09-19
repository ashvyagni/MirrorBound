import { DebugOverlay } from './ui/DebugOverlay';
import { GameMount } from './ui/GameMount';
import { Hud } from './ui/Hud';
import { InventoryScreen } from './ui/InventoryScreen';
import { ConnectionOverlay, ControlsScreen, DeathOverlay, PauseMenu, Toasts, VictoryOverlay } from './ui/Overlays';
import { SettingsScreen } from './ui/SettingsScreen';
import { SkillTreeScreen } from './ui/SkillTreeScreen';
import { useHotkeys } from './ui/useHotkeys';
import './ui/store';

/**
 * The page is the game. Phaser fills the stage; React draws the HUD and the
 * menus on top of it and never touches the world directly.
 */
export default function App() {
  useHotkeys();
  return (
    <div className="stage">
      <GameMount />
      <div className="viewport">
        <Hud />
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
