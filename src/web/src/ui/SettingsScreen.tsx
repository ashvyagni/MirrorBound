import { useEffect, useState } from 'react';

import { eventBus } from '@/game/EventBus';

import { getSettings, resetSettings, updateSettings, type Quality, type Settings } from './settings';
import { openScreen, useUi } from './store';

function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string;
}) {
  return (
    <label className="setting">
      <span className="setting__label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="setting__value">{format ? format(value) : `${Math.round(value * 100)}%`}</span>
    </label>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="setting setting--toggle">
      <span className="setting__label">{label}{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsScreen() {
  const screen = useUi((s) => s.screen);
  const fullscreen = useUi((s) => s.fullscreen);
  const [settings, setSettings] = useState<Settings>(getSettings());
  useEffect(() => eventBus.on('ui:settings', setSettings), []);
  if (screen !== 'settings') return null;
  const set = (patch: Partial<Settings>) => setSettings(updateSettings(patch));

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--wide">
        <header className="dialog__head">
          <h2 className="dialog__title">Settings</h2>
          <button type="button" className="btn btn--ghost" onClick={() => openScreen('pause')}>Back</button>
        </header>
        <div className="settings">
          <section>
            <h3 className="settings__group">Audio</h3>
            <Slider label="Master volume" value={settings.masterVolume} onChange={(v) => set({ masterVolume: v })} />
            <Slider label="Music" value={settings.musicVolume} onChange={(v) => set({ musicVolume: v })} />
            <Slider label="Effects" value={settings.sfxVolume} onChange={(v) => set({ sfxVolume: v })} />
          </section>
          <section>
            <h3 className="settings__group">Display</h3>
            <Slider label="Camera zoom" value={settings.zoom} min={0.7} max={1.5} step={0.05} onChange={(v) => set({ zoom: v })} format={(v) => `${v.toFixed(2)}×`} />
            <label className="setting">
              <span className="setting__label">Quality<small>Particles, ambient life, water</small></span>
              <select value={settings.quality} onChange={(e) => set({ quality: e.target.value as Quality })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <Toggle label="Screen shake" value={settings.screenShake} onChange={(v) => set({ screenShake: v })} />
            <Toggle label="Damage numbers" value={settings.damageNumbers} onChange={(v) => set({ damageNumbers: v })} />
            <Toggle label="Twin thoughts" hint="Show the twin's current intent above its head" value={settings.showTwinThoughts} onChange={(v) => set({ showTwinThoughts: v })} />
            <Toggle label="AI debug overlay" hint="F3 · heatmaps, intents, predictions" value={settings.debugOverlay} onChange={(v) => set({ debugOverlay: v })} />
            <div className="setting">
              <span className="setting__label">Window</span>
              <button type="button" className="btn" onClick={() => eventBus.emit('game:toggle-fullscreen', {})}>
                {fullscreen ? 'Leave fullscreen' : 'Go fullscreen'}
              </button>
            </div>
          </section>
        </div>
        <footer className="dialog__actions dialog__actions--between">
          <button type="button" className="btn btn--ghost" onClick={() => setSettings(resetSettings())}>Reset to defaults</button>
          <span className="dialog__muted">Settings save automatically.</span>
        </footer>
      </div>
    </div>
  );
}
