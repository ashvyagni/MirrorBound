import { CLIP_ORDER, CLIPS, type ClipName } from '@/game/animation/clips';
import { eventBus } from '@/game/EventBus';

const LABELS: Record<ClipName, string> = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  rise: 'Jump · rise',
  fall: 'Jump · fall',
  land: 'Jump · land',
  attack: 'Attack',
  hurt: 'Hurt',
  die: 'Die',
};

/**
 * Plays any clip on demand.
 *
 * Driven off `CLIP_ORDER`, so a clip added to the animation table shows up here
 * with no edit -- there is no second list to forget to update.
 */
export function AnimationDock({ active }: { active: ClipName | null }) {
  return (
    <section className="panel">
      <h2 className="panel__title">Animations</h2>
      <p className="panel__hint">
        Every clip on the sheet. Playing one holds it until you move.
      </p>

      <div className="clips">
        {CLIP_ORDER.map((clip) => (
          <button
            key={clip}
            type="button"
            className="clip"
            data-active={active === clip}
            onClick={() => eventBus.emit('debug:play-clip', { clip })}
          >
            <span className="clip__name">{LABELS[clip]}</span>
            <span className="clip__meta">
              {CLIPS[clip].frames.length}f · {CLIPS[clip].frameRate}fps
            </span>
          </button>
        ))}
      </div>

      <div className="actions">
        <button type="button" onClick={() => eventBus.emit('debug:force-state', { state: 'hurt' })}>
          Take a hit
        </button>
        <button type="button" onClick={() => eventBus.emit('debug:force-state', { state: 'die' })}>
          Die
        </button>
        <button
          type="button"
          className="actions__primary"
          onClick={() => eventBus.emit('debug:force-state', { state: 'reset' })}
        >
          Reset
        </button>
      </div>
    </section>
  );
}
