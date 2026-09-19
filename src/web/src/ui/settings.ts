/**
 * Player settings.
 *
 * The shape is `main`'s verbatim, all nine of them, even though this branch can
 * only honour three today -- there is no audio module here, nothing shakes,
 * nothing draws damage numbers and there is no twin to have thoughts about. A
 * matching shape means adopting `main`'s store later is deleting this file, and
 * it means a setting saved here is still the right setting when the systems
 * behind it arrive.
 *
 * What the settings screen shows is a different question, and the answer is
 * "the ones that do something" -- see `SETTINGS_AVAILABLE`.
 */

import { eventBus } from '@/game/EventBus';

export type Quality = 'high' | 'medium' | 'low';
export const QUALITIES: readonly Quality[] = ['low', 'medium', 'high'];

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

/** What this branch renders at until the settings screen changes it. */
export const DEFAULT_QUALITY: Quality = DEFAULT_SETTINGS.quality;

/**
 * The settings with something behind them here.
 *
 * Listed rather than inferred, because a setting that silently does nothing is
 * worse than one that is absent: it teaches the player that the screen is a
 * decoration. The six left out need an audio manager, a shake, floating
 * numbers and a twin -- none of which exist on this branch yet.
 */
export const SETTINGS_AVAILABLE: ReadonlySet<keyof Settings> =
  new Set(['zoom', 'quality', 'debugOverlay']);

/** Every setting, in the order a screen should list them. */
export const SETTINGS_KEYS: ReadonlyArray<keyof Settings> = [
  'masterVolume', 'musicVolume', 'sfxVolume', 'zoom', 'quality',
  'screenShake', 'damageNumbers', 'debugOverlay', 'showTwinThoughts',
];

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
    /* private mode: settings simply do not persist */
  }
  eventBus.emit('ui:settings', current);
  return current;
}

export function resetSettings(): Settings {
  return updateSettings({ ...DEFAULT_SETTINGS });
}
