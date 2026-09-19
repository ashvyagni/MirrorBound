import { CharacterScreen } from './ui/CharacterScreen';
import { DebugOverlay } from './ui/DebugOverlay';
import { DialogueScreen } from './ui/DialogueScreen';
import { GameMount } from './ui/GameMount';
import { Hud } from './ui/Hud';
import { InventoryScreen } from './ui/InventoryScreen';
import { MapScreen } from './ui/MapScreen';
import { NamingScreen } from './ui/NamingScreen';
import { ControlsScreen } from './ui/ControlsScreen';
import { ConnectionOverlay, DeathOverlay, PauseMenu, Toasts, VictoryOverlay } from './ui/Overlays';
import { SettingsScreen } from './ui/SettingsScreen';
import { SkillTreeScreen } from './ui/SkillTreeScreen';
import { useHotkeys } from './ui/useHotkeys';
import './ui/store';

/**
 * The page is the game. Phaser fills the stage; React draws the HUD and the
 * menus on top of it and never touches the world directly.
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
        <Hud />
        <Toasts />
        <DebugOverlay />
      </div>
      <DeathOverlay />
      <VictoryOverlay />
      <PauseMenu />
      <CharacterScreen />
      <InventoryScreen />
      <SkillTreeScreen />
      <MapScreen />
      <DialogueScreen />
      <NamingScreen />
      <SettingsScreen />
      <ControlsScreen />
      <ConnectionOverlay />
    </div>
  );
}
