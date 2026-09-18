import { useEffect, useState } from 'react';

import { BRO_CLIPS, BRO_CLIP_ORDER, type BroClipName } from '@/game/animation/broClips';
import { eventBus } from '@/game/EventBus';

const LABELS: Partial<Record<BroClipName, string>> = {
  danceHappy: 'Happy',
  danceSpin: 'Spin',
  danceExcited: 'Excited',
  surprised: 'Surprised',
  lookAround: 'Look around',
};

/** Only the one-shot clips are offered: the travel clips are chosen from how it
 *  is actually moving, so forcing one would be overwritten next frame. */
const EMOTES = BRO_CLIP_ORDER.filter((name) => BRO_CLIPS[name].repeat === 0);

export function CompanionPanel() {
  const [mood, setMood] = useState('resting');

  useEffect(() => eventBus.on('bro:changed', (e) => setMood(e.mood)), []);

  return (
    <section className="card">
      <header className="card__head">
        <h2 className="card__title">Companion</h2>
        <span className="pill pill--cool">{mood}</span>
      </header>
      <p className="card__note">
        Floats at the goat&rsquo;s neck and trails behind it. Performs on its own
        once things have been still for a moment.
      </p>
      <div className="chips">
        {EMOTES.map((name) => (
          <button
            key={name}
            type="button"
            className="chip"
            onClick={() => eventBus.emit('bro:perform', { clip: name })}
          >
            {LABELS[name] ?? name}
          </button>
        ))}
      </div>
    </section>
  );
}
