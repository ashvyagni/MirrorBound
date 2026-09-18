import { useEffect } from 'react';

import { eventBus } from '@/game/EventBus';

import { getSettings, updateSettings } from './settings';
import { getUiState, openScreen, toggleScreen } from './store';

/** Menu keys. Movement and combat keys are Phaser's. */
export function useHotkeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      const { screen, snapshot } = getUiState();
      switch (e.key) {
        case 'Escape':
        case 'p':
        case 'P':
          e.preventDefault();
          if (screen === 'none') openScreen('pause');
          else if (screen === 'pause') openScreen('none');
          else openScreen('pause');
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          toggleScreen('inventory');
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          toggleScreen('skills');
          break;
        case 'F3':
          e.preventDefault();
          updateSettings({ debugOverlay: !getSettings().debugOverlay });
          break;
        case 'f':
        case 'F':
          if (screen === 'none' || screen === 'pause') eventBus.emit('game:toggle-fullscreen', {});
          break;
        case 'Enter':
          if (snapshot?.phase === 'victory') eventBus.emit('ui:command', { type: 'COMMAND', action: 'RESTART' });
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
