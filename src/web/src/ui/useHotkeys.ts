import { useEffect } from 'react';

import { eventKeyCode, keybinds } from '@/game/state/Keybinds';

import { getSettings, updateSettings } from './settings';
import { closeConversation, command, getUiState, openScreen, toggleScreen } from './store';

/**
 * Menu and world keys. Movement and combat belong to Phaser's input, which
 * reads the same `Keybinds` table this does -- so rebinding "attack" and
 * rebinding "inventory" go through one place and cannot disagree.
 *
 * Three rules this file exists to keep: a key pressed while a text field has
 * focus never reaches the game; a key that acts on the world is only ever a
 * request, sent as a command and waiting for the server to agree; and a held
 * key never fires a discrete action more than once.
 */
export function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      // Held keys must not fire a discrete action once per repeat.
      if (e.repeat) return;
      // The Controls screen is listening for the next key press so it can bind
      // it; nothing else may act on that press.
      if (getUiState().rebinding) return;

      const { screen, snapshot, nearbyNpc } = getUiState();
      const inMenu = screen !== 'none';

      // Escape is reserved and never rebindable: it is the way out of any
      // screen, including the one where keys are rebound.
      if (e.key === 'Escape') {
        e.preventDefault();
        if (screen === 'dialogue') closeConversation();
        else if (screen === 'none') openScreen('pause');
        else openScreen(screen === 'pause' ? 'none' : 'pause');
        return;
      }
      if (e.key === 'Enter') {
        if (snapshot?.phase === 'victory') command({ action: 'RESTART' });
        return;
      }

      const action = keybinds.actionFor(eventKeyCode(e));
      if (!action) return;

      switch (action) {
        case 'pause':
          e.preventDefault();
          if (screen === 'dialogue') closeConversation();
          else if (screen === 'none') openScreen('pause');
          else openScreen(screen === 'pause' ? 'none' : 'pause');
          break;
        case 'inventory':
          e.preventDefault();
          toggleScreen('inventory');
          break;
        case 'skills':
          e.preventDefault();
          toggleScreen('skills');
          break;
        case 'character':
          e.preventDefault();
          toggleScreen('character');
          break;
        case 'map':
          e.preventDefault();
          toggleScreen('map');
          break;
        case 'debug':
          e.preventDefault();
          updateSettings({ debugOverlay: !getSettings().debugOverlay });
          break;
        case 'healthPotion':
          if (!inMenu) command({ action: 'USE_ITEM', itemId: 'health_potion' });
          break;
        case 'manaPotion':
          if (!inMenu) command({ action: 'USE_ITEM', itemId: 'mana_potion' });
          break;
        case 'swapWeapon':
          if (!inMenu) command({ action: 'SWAP_WEAPON' });
          break;
        case 'interact':
          // Talk to whoever you are standing next to.
          if (!inMenu && nearbyNpc) {
            e.preventDefault();
            command({ action: 'TALK', npcId: nearbyNpc.id });
          }
          break;
        default:
          // Movement, attack and abilities are Phaser's; it samples them from
          // the same table rather than being sent them from here.
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
