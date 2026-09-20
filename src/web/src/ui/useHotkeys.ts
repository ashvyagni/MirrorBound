import { useEffect } from 'react';

import { eventBus } from '@/game/EventBus';
import { eventKeyCode, keybinds } from '@/game/state/Keybinds';

import { closeConversation, command, getUiState, isPauseRequested, openScreen, toggleScreen } from './store';

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
      if (e.repeat || e.defaultPrevented) return;
      // The Controls screen is listening for the next key press so it can bind
      // it; nothing else may act on that press.
      if (getUiState().rebinding) return;

      const { screen, snapshot, nearbyNpc } = getUiState();
      const inMenu = screen !== 'none';

      // Escape is reserved and never rebindable: it is the way out of any
      // screen, including the one where keys are rebound.
      if (e.key === 'Escape') {
        e.preventDefault();
        // Out of whatever is open, then -- with nothing open -- into the pause
        // screen, which `HudScene` draws. Escape used to open a DOM pause
        // screen; there is no longer one, so it asks the server to pause and
        // the canvas answers.
        if (screen === 'dialogue') closeConversation();
        else if (screen !== 'none') openScreen('none');
        else command({ action: isPauseRequested() ? 'RESUME' : 'PAUSE' });
        return;
      }
      if (e.key === 'Enter') {
        if (snapshot?.phase === 'victory') command({ action: 'RESTART' });
        return;
      }

      const action = keybinds.actionFor(eventKeyCode(e));
      if (!action) return;

      switch (action) {
        // --- keys the in-canvas HUD owns -------------------------------
        // These go out on the bus rather than through the screen store: the
        // panel that answers them is a Phaser container, not a React tree.
        case 'pause':
          e.preventDefault();
          // Dialogue is still React's, so Escape-by-any-other-name closes it
          // first -- otherwise pausing behind an open conversation leaves you
          // reading a dead one.
          if (screen === 'dialogue') closeConversation();
          else if (inMenu) openScreen('none');
          else command({ action: isPauseRequested() ? 'RESUME' : 'PAUSE' });
          break;
        case 'map':
          e.preventDefault();
          eventBus.emit('map:toggle', {});
          break;
        case 'console':
          e.preventDefault();
          eventBus.emit('console:toggle', {});
          break;
        case 'potionCycle':
          if (!inMenu) eventBus.emit('loadout:cycle-potion', { step: e.shiftKey ? -1 : 1 });
          break;
        case 'potionUse':
          if (!inMenu) eventBus.emit('loadout:use-potion', {});
          break;
        case 'companion':
          if (!inMenu) command({ action: 'TWIN_CALL' });
          break;
        case 'inventory':
          e.preventDefault();
          eventBus.emit('inventory:toggle', {});
          break;
        case 'skills':
          e.preventDefault();
          eventBus.emit('skills:toggle', {});
          break;
        case 'character':
          e.preventDefault();
          toggleScreen('character');
          break;
        case 'debug':
          e.preventDefault();
          // The agent view, drawn on the canvas like every other screen. This
          // used to flip the `debugOverlay` setting, which both raised a DOM
          // sidebar and painted hot cells on the floor -- two unrelated things
          // on one switch. The floor overlay keeps that setting; the panel is
          // a screen now, so it opens, closes on Escape and shuts whatever
          // else was open, exactly like the inventory does.
          eventBus.emit('agent:toggle', {});
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
