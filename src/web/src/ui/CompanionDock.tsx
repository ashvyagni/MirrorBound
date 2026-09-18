import { useEffect, useState } from 'react';

import { BRO_CLIP_ORDER, BRO_CLIPS, type BroClipName } from '@/game/animation/broClips';
import { eventBus } from '@/game/EventBus';

const LABELS: Record<BroClipName, string> = {
  idle: 'Idle',
  hover: 'Hover',
  moveRight: 'Move right',
  moveLeft: 'Move left',
  moveUp: 'Move up',
  moveDown: 'Move down',
  danceHappy: 'Dance · happy',
  danceSpin: 'Dance · spin',
  danceExcited: 'Dance · excited',
  surprised: 'Surprised',
  lookAround: 'Look around',
};

/**
 * The companion's clips, and what it is doing right now.
 *
 * Only the one-shot clips can be triggered: the looping travel clips are
 * chosen from how it is actually moving, so forcing one would just be
 * overwritten on the next frame.
 */
export function CompanionDock() {
  const [clip, setClip] = useState<BroClipName | null>(null);
  const [mood, setMood] = useState('resting');

  useEffect(
    () => eventBus.on('bro:changed', (e) => {
      setClip(e.clip);
      setMood(e.mood);
    }),
    [],
  );

  return (
    <section className="panel">
      <h2 className="panel__title">Companion</h2>
      <p className="panel__hint">
        Floats at the goat&rsquo;s neck and trails behind it. Performs on its own
        once everything has been still for a moment.
      </p>

      <div className="readout">
        <div className="readout__cell">
          <span className="readout__label">Clip</span>
          <span className="readout__value">{clip ? LABELS[clip] : '—'}</span>
        </div>
        <div className="readout__cell">
          <span className="readout__label">Mood</span>
          <span className="readout__value">{mood}</span>
        </div>
      </div>

      <div className="clips">
        {BRO_CLIP_ORDER.filter((name) => BRO_CLIPS[name].repeat === 0).map((name) => (
          <button
            key={name}
            type="button"
            className="clip"
            data-active={clip === name}
            onClick={() => eventBus.emit('bro:perform', { clip: name })}
          >
            <span className="clip__name">{LABELS[name]}</span>
            <span className="clip__meta">
              {BRO_CLIPS[name].frames.length}f · {BRO_CLIPS[name].frameRate}fps
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
