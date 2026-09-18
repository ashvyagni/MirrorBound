import { useEffect, useState } from 'react';

import { eventBus } from '@/game/EventBus';
import type { PlayerSnapshot } from '@/game/types';

const KEYS: Array<[string, string]> = [
  ['← →  /  A D', 'Move'],
  ['Shift', 'Run'],
  ['Space  /  W', 'Jump · hold for height'],
  ['J', 'Attack'],
  ['K', 'Companion attack'],
];

export function StatusPanel({ snapshot }: { snapshot: PlayerSnapshot | null }) {
  const [bodies, setBodies] = useState(false);

  useEffect(() => {
    eventBus.emit('debug:toggle-bodies', { enabled: bodies });
  }, [bodies]);

  return (
    <section className="panel">
      <h2 className="panel__title">Controls</h2>
      <dl className="keys">
        {KEYS.map(([key, action]) => (
          <div key={key} className="keys__row">
            <dt><kbd>{key}</kbd></dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>

      <h2 className="panel__title panel__title--spaced">State</h2>
      <div className="readout">
        <Stat label="State" value={snapshot?.state ?? '—'} wide />
        <Stat label="Clip" value={snapshot?.clip ?? '—'} wide />
        <Stat label="Facing" value={snapshot ? (snapshot.facing === 1 ? 'right' : 'left') : '—'} />
        <Stat label="Grounded" value={snapshot ? (snapshot.grounded ? 'yes' : 'airborne') : '—'} />
      </div>

      <label className="toggle">
        <input type="checkbox" checked={bodies} onChange={(e) => setBodies(e.target.checked)} />
        <span>Show collision bodies</span>
      </label>
    </section>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className="readout__cell" data-wide={wide ?? false}>
      <span className="readout__label">{label}</span>
      <span className="readout__value">{value}</span>
    </div>
  );
}
