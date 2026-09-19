/**
 * Controls, and rebinding them.
 *
 * The list was display-only until now: it showed hardcoded keys that happened
 * to match hardcoded keys elsewhere. It reads and writes the one `Keybinds`
 * table that both Phaser and React sample, so what is shown here is what the
 * game actually does.
 *
 * Arming a row puts the global hotkey handler on hold (`rebinding` in the
 * store), so the key you press to bind "inventory" does not also open the
 * inventory on its way past.
 */

import { useEffect, useState } from 'react';

import {
  ACTIONS, Keybinds, eventKeyCode, keyName, keybinds, type Action, type ActionInfo, type Conflict,
} from '@/game/state/Keybinds';

import { openScreen, setRebinding, useUi } from './store';

type Slot = 'primary' | 'secondary';

const GROUPS = ['Movement', 'Combat', 'Items', 'Interface'] as const;

function KeyButton({ action, slot, armed, onArm }: {
  action: Action; slot: Slot; armed: boolean; onArm: () => void;
}) {
  const binding = keybinds.get(action);
  const code = slot === 'primary' ? binding.primary : binding.secondary;
  return (
    <button
      type="button"
      className="keycap"
      data-armed={armed}
      data-empty={code === undefined || code < 0}
      onClick={onArm}
      title={armed ? 'Press any key' : 'Click, then press a key'}
    >
      {armed ? 'press a key…' : keyName(code)}
    </button>
  );
}

export function ControlsScreen() {
  const screen = useUi((s) => s.screen);
  const armed = useUi((s) => s.rebinding);
  // Bumped on every change so the rows re-read the table, which lives outside
  // React because the game scene reads it too.
  const [version, setVersion] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => keybinds.onChange(() => setVersion((n) => n + 1)), []);

  // Disarm on close, so an armed row cannot swallow the next key press after
  // the screen is gone.
  useEffect(() => {
    if (screen !== 'controls' && armed) setRebinding(null);
  }, [screen, armed]);

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') { setRebinding(null); setNote(null); return; }
      const code = eventKeyCode(e);
      if (!code) return;
      if (Keybinds.reserved(code)) {
        setNote(`${keyName(code)} is reserved — it is how you get out of here.`);
        setRebinding(null);
        return;
      }
      const stolen: Conflict | null = keybinds.set(armed.action as Action, armed.slot, code);
      setNote(stolen ? `${keyName(code)} was taken from “${stolen.label}”.` : null);
      setRebinding(null);
    };
    // Capture, so this runs before the global handler ever sees the key.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [armed]);

  if (screen !== 'controls') return null;

  const rows = (group: (typeof GROUPS)[number]): ActionInfo[] =>
    ACTIONS.filter((a) => a.group === group);

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--lg" data-version={version}>
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">Controls</h2>
            <p className="dialog__muted">Click a key, then press the one you want.</p>
          </div>
          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { keybinds.reset(); setNote('Back to the defaults.'); }}
            >
              Reset
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => openScreen('pause')}>Back</button>
          </div>
        </header>

        <div className="binds">
          {GROUPS.map((group) => (
            <section key={group} className="binds__group">
              <h3 className="sheet__h">{group}</h3>
              {rows(group).map(({ action, label }) => (
                <div key={action} className="binds__row">
                  <span className="binds__label">{label}</span>
                  <KeyButton
                    action={action}
                    slot="primary"
                    armed={armed?.action === action && armed.slot === 'primary'}
                    onArm={() => { setNote(null); setRebinding({ action, slot: 'primary' }); }}
                  />
                  <KeyButton
                    action={action}
                    slot="secondary"
                    armed={armed?.action === action && armed.slot === 'secondary'}
                    onArm={() => { setNote(null); setRebinding({ action, slot: 'secondary' }); }}
                  />
                  <button
                    type="button"
                    className="binds__clear"
                    disabled={keybinds.get(action).secondary === undefined}
                    onClick={() => keybinds.clearSecondary(action)}
                    title="Remove the second key"
                    aria-label={`Remove the second key for ${label}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>

        <p className="dialog__muted">
          {note ?? 'Facing follows your last movement. Attacks and abilities fire that way — the mouse is only for menus. Escape always pauses and cannot be rebound.'}
        </p>
      </div>
    </div>
  );
}
