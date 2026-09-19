import { useEffect, useState } from 'react';

import { eventBus } from '@/game/EventBus';

import { getSettings, updateSettings } from './settings';
import { useUi } from './store';

function Trait({ name, value, confidence, trend }: { name: string; value: number; confidence: number; trend?: number }) {
  return (
    <div className="dbg-trait" title={`confidence ${Math.round(confidence * 100)}%`}>
      <span className="dbg-trait__name">{name.replace(/_/g, ' ')}</span>
      <span className="dbg-trait__bar">
        <i style={{ width: `${Math.round(value * 100)}%`, opacity: 0.3 + confidence * 0.7 }} />
        <em style={{ left: `${Math.round(confidence * 100)}%` }} />
      </span>
      <span className="dbg-trait__val">{value.toFixed(2)}{trend !== undefined && trend !== 0 && <b data-up={trend > 0}>{trend > 0 ? '▲' : '▼'}</b>}</span>
    </div>
  );
}

/**
 * The judge's window into the AI: what the player model believes, what it
 * predicts, what the twin chose and why, what the twin has learned, and what
 * the Mirror is countering. Toggle with F3.
 */
export function DebugOverlay() {
  const [enabled, setEnabled] = useState(getSettings().debugOverlay);
  useEffect(() => eventBus.on('ui:settings', (s) => setEnabled(s.debugOverlay)), []);
  const snap = useUi((s) => s.snapshot);
  const events = useUi((s) => s.recentEvents);
  if (!enabled || !snap) return null;
  const model = snap.playerModel;
  const twin = snap.twin;
  const style = snap.twinModel;
  const utilities = Object.entries(twin.intent.utilities).sort((a, b) => b[1] - a[1]);
  // Strongest habit first, and only a handful: the detector holds one per
  // context and the list is for reading, not for auditing.
  const patterns = [...(model.patterns ?? [])].sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  const patternEvents = model.pattern_events ?? [];
  const max = utilities[0]?.[1] ?? 1;
  const twinActions = events.filter((e) => e.type === 'TWIN_OUTCOME').slice(-4).reverse();
  const counters = events.filter((e) => e.type === 'BOSS_COUNTER').slice(-4).reverse();

  return (
    <aside className="dbg" aria-label="AI debug overlay">
      <header className="dbg__head">
        <strong>AI view</strong>
        <span>tick {snap.tick}</span>
        <button type="button" className="btn btn--ghost btn--xs" onClick={() => updateSettings({ debugOverlay: false })}>hide · F3</button>
      </header>

      <section>
        <h4>Player profile <small>value · bar opacity = confidence</small></h4>
        {Object.entries(model.traits).map(([name, t]) => (
          <Trait key={name} name={name} value={t.value} confidence={t.confidence} trend={t.recent_trend} />
        ))}
      </section>

      <section>
        <h4>Prediction <small>what you'll do next</small></h4>
        {model.predictions.length === 0 && <p className="dbg__muted">Not enough repeated behaviour yet.</p>}
        {model.predictions.map((p) => (
          <div key={p.token} className="dbg-pred">
            <span>{p.token.toLowerCase()}</span>
            <span className="dbg-pred__bar"><i style={{ width: `${Math.round(p.confidence * 100)}%` }} /></span>
            <span>{Math.round(p.confidence * 100)}% <small>n={p.order}</small></span>
          </div>
        ))}
      </section>

      <section>
        <h4>Habits <small>sequences it has decided are real</small></h4>
        {patterns.length === 0 && (
          // A habit can be held and then lost, which leaves no current pattern
          // but a history that says otherwise. Saying "nothing yet" over a list
          // of what it learned and forgot reads as a bug.
          <p className="dbg__muted">
            {patternEvents.length === 0
              ? 'Nothing repeated enough yet. Do the same three things twice.'
              : 'Nothing held right now — what it had went stale.'}
          </p>
        )}
        {patterns.map((p) => (
          <div key={p.sequence.join('>')} className="dbg-pattern" title={`held since tick ${p.first_detected_tick}`}>
            <span className="dbg-pattern__seq">
              {p.sequence.map((token, i) => (
                <span key={`${token}-${i}`} data-last={i === p.sequence.length - 1}>
                  {token.toLowerCase()}
                </span>
              ))}
            </span>
            <span className="dbg-pattern__bar"><i style={{ width: `${Math.round(p.confidence * 100)}%` }} /></span>
            <span>{Math.round(p.confidence * 100)}%</span>
          </div>
        ))}
        {patternEvents.length > 0 && (
          <ul className="dbg__list">
            {/* Newest first: what just changed is what you want to read. */}
            {[...patternEvents].reverse().slice(0, 4).map((e, i) => (
              <li key={i} data-ok={e.kind === 'DETECTED'}>
                {e.kind === 'DETECTED' ? 'learned' : 'forgot'} · {e.pattern.sequence.join(' → ').toLowerCase()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>Twin decision <small>{twin.intent.intentType} · {Math.round(twin.intent.confidence * 100)}%</small></h4>
        <p className="dbg__reason">{twin.intent.reason}{twin.intent.targetId ? ` → ${twin.intent.targetId}` : ''}</p>
        {utilities.map(([name, u]) => (
          <div key={name} className="dbg-util" data-chosen={name === twin.intent.intentType}>
            <span>{name.toLowerCase()}</span>
            <span className="dbg-util__bar"><i style={{ width: `${Math.round((u / Math.max(max, 0.01)) * 100)}%` }} /></span>
            <span>{u.toFixed(2)}</span>
          </div>
        ))}
        {twinActions.length > 0 && (
          <ul className="dbg__list">
            {twinActions.map((e, i) => (
              <li key={i} data-ok={Boolean(e.data.success)}>
                {String(e.data.intent).toLowerCase()} · {e.data.success ? 'worked' : 'failed'} · dealt {e.data.damage_dealt} took {e.data.damage_taken}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>Twin learning <small>{style.playerEventsSeen} observations · {style.outcomesSeen} outcomes</small></h4>
        {Object.entries(style.dims).map(([name, d]) => (
          <Trait key={name} name={name} value={d.value} confidence={d.confidence} trend={d.recent_trend} />
        ))}
        {style.lessons.length > 0 && (
          <ul className="dbg__list dbg__list--lessons">{style.lessons.slice(-3).map((l, i) => <li key={i}>{l}</li>)}</ul>
        )}
      </section>

      <section>
        <h4>Spatial <small>hot cells drawn on the floor</small></h4>
        <div className="dbg__cells">
          {Object.entries(model.spatial).map(([layer, cells]) => (
            <span key={layer} className="chip chip--dim">{layer} {cells.length}</span>
          ))}
        </div>
      </section>

      {snap.boss && (
        <section>
          <h4>The Mirror <small>phase {snap.boss.phase}</small></h4>
          <p className="dbg__reason">{snap.boss.activeCounter ? `countering: ${snap.boss.activeCounter}` : 'generic behaviour'}</p>
          <div className="dbg__cells">
            {Object.entries(snap.boss.countersUsed).map(([c, n]) => <span key={c} className="chip chip--warn">{c} ×{n}</span>)}
          </div>
          {counters.length > 0 && <ul className="dbg__list">{counters.map((e, i) => <li key={i}>{String(e.data.detail)}</li>)}</ul>}
        </section>
      )}
    </aside>
  );
}
