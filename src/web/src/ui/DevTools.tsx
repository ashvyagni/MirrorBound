import { useEffect, useState } from 'react';

import { CLIPS, CLIP_ORDER, type ClipName } from '@/game/animation/goatClips';
import { eventBus } from '@/game/EventBus';
import type { PlayerSnapshot } from '@/game/types';

const LABELS: Record<ClipName, string> = {
  idle: 'Idle', walk: 'Walk', run: 'Run',
  rise: 'Rise', fall: 'Fall', land: 'Land',
  attack: 'Attack', hurt: 'Hurt', die: 'Die',
};

/**
 * Everything that exists to inspect the game rather than play it.
 *
 * Collapsed by default and kept out of the main column: these are the controls
 * that made the page read as a debug dashboard, and none of them mean anything
 * to someone who just wants to move the character around.
 */
export function DevTools({ snapshot }: { snapshot: PlayerSnapshot | null }) {
  const [open, setOpen] = useState(false);
  const [bodies, setBodies] = useState(false);

  useEffect(() => {
    eventBus.emit('debug:toggle-bodies', { enabled: bodies });
  }, [bodies]);

  return (
    <details className="dev" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="dev__summary">
        <span>Developer tools</span>
        <span className="dev__hint">{open ? 'hide' : 'show'}</span>
      </summary>

      <div className="dev__body">
        <div className="readout">
          <Stat label="State" value={snapshot?.state ?? '—'} />
          <Stat label="Clip" value={snapshot?.clip ?? '—'} />
          <Stat label="Facing" value={snapshot ? (snapshot.facing === 1 ? 'right' : 'left') : '—'} />
          <Stat label="Grounded" value={snapshot ? (snapshot.grounded ? 'yes' : 'airborne') : '—'} />
        </div>

        <h3 className="dev__heading">Play a clip</h3>
        <div className="chips">
          {CLIP_ORDER.map((clip) => (
            <button
              key={clip}
              type="button"
              className="chip"
              data-active={snapshot?.clip === clip}
              onClick={() => eventBus.emit('debug:play-clip', { clip })}
            >
              {LABELS[clip]}
              <em>{CLIPS[clip].frames.length}f</em>
            </button>
          ))}
        </div>

        <h3 className="dev__heading">Force a state</h3>
        <div className="chips">
          <button type="button" className="chip" onClick={() => eventBus.emit('debug:force-state', { state: 'hurt' })}>Take a hit</button>
          <button type="button" className="chip" onClick={() => eventBus.emit('debug:force-state', { state: 'die' })}>Die</button>
          <button type="button" className="chip" onClick={() => eventBus.emit('debug:force-state', { state: 'reset' })}>Reset</button>
        </div>

        <label className="toggle">
          <input type="checkbox" checked={bodies} onChange={(e) => setBodies(e.target.checked)} />
          <span>Show collision bodies</span>
        </label>
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout__cell">
      <span className="readout__label">{label}</span>
      <span className="readout__value">{value}</span>
    </div>
  );
}
