/**
 * Player settings. Persisted to localStorage; broadcast on the event bus so
 * the audio manager, the camera and the renderer pick changes up live.
 */

import { eventBus } from '@/game/EventBus';

/** Every quality level, in the order the settings screen offers them. */
export const QUALITIES = ['low', 'medium', 'high'] as const;

export type Quality = (typeof QUALITIES)[number];

export interface Settings {
  masterVolume: number;   // 0..1
  musicVolume: number;
  sfxVolume: number;
  zoom: number;           // camera zoom multiplier
  quality: Quality;       // particle density, ambient life
  screenShake: boolean;
  damageNumbers: boolean;
  debugOverlay: boolean;
  showTwinThoughts: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.55,
  sfxVolume: 0.9,
  zoom: 1.0,
  quality: 'high',
  screenShake: true,
  damageNumbers: true,
  debugOverlay: false,
  showTwinThoughts: true,
};

const KEY = 'mirrorbound.settings.v1';

let current: Settings = load();

function load(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode: settings simply don't persist */
  }
  eventBus.emit('ui:settings', current);
  return current;
}

export function resetSettings(): Settings {
  return updateSettings({ ...DEFAULT_SETTINGS });
}
