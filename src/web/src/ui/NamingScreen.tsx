/**
 * Asking who you are, and later what you call the twin.
 *
 * The name is sent to the server and comes back sanitised; whatever the
 * server says the name is, is the name. This screen never trusts its own
 * input, which is why it shows the value from the snapshot after saving
 * rather than what was typed.
 */

import { useState } from 'react';

import { command, openScreen, useUi } from './store';

const MAX = 18;

export function NamingScreen() {
  const screen = useUi((s) => s.screen);
  const which = useUi((s) => s.namePrompt);
  const campaign = useUi((s) => s.campaign);
  const [value, setValue] = useState('');

  if (screen !== 'naming' || !which) return null;
  const naming = which === 'twin';
  const current = naming ? campaign?.twinName : campaign?.playerName;

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) command(naming ? { action: 'SET_NAME', twinName: trimmed } : { action: 'SET_NAME', playerName: trimmed });
    openScreen('none');
  };

  return (
    <div className="overlay overlay--dim">
      <div className="dialog dialog--narrow">
        <header className="dialog__head">
          <div>
            <h2 className="dialog__title">{naming ? 'Name your twin' : 'What are you called?'}</h2>
            <p className="dialog__muted">
              {naming
                ? 'It came back with you. Give it something to be called.'
                : 'The village will use it. You can change it later from the Character screen.'}
            </p>
          </div>
        </header>

        <form
          className="naming"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <label className="naming__field">
            <span className="sr-only">{naming ? 'Twin name' : 'Your name'}</span>
            <input
              autoFocus
              type="text"
              maxLength={MAX}
              value={value}
              placeholder={current ?? 'Wanderer'}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <div className="naming__actions">
            <button type="button" className="btn btn--ghost" onClick={() => openScreen('none')}>
              Keep {current ?? 'Wanderer'}
            </button>
            <button type="submit" className="btn btn--primary" disabled={!value.trim()}>Name it</button>
          </div>
        </form>
      </div>
    </div>
  );
}
