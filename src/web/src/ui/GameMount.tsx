import type { Game } from 'phaser';
import { useEffect, useRef, useState } from 'react';

import { eventBus } from '@/game/EventBus';

/**
 * Owns the Phaser instance's lifetime.
 *
 * Phaser is imported dynamically so the engine chunk loads only here, and the
 * game is destroyed on unmount -- which React 19's development Strict Mode
 * exercises on every mount, so a leak would show up immediately as two games
 * fighting over one canvas.
 */
export function GameMount() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let game: Game | undefined;
    let cancelled = false;

    const offLoading = eventBus.on('game:loading', (e) => setProgress(e.progress));
    const offReady = eventBus.on('game:ready', () => setReady(true));
    const offFull = eventBus.on('game:fullscreen', (e) => setFull(e.active));

    void import('@/game/createGame').then(({ createGame }) => {
      // The effect may already have been torn down by a fast unmount.
      if (cancelled) return;
      game = createGame(host, host.parentElement ?? undefined);
    });

    return () => {
      cancelled = true;
      offLoading();
      offReady();
      offFull();
      game?.destroy(true);
      game = undefined;
    };
  }, []);

  return (
    <div className="stage">
      <div ref={hostRef} className="stage__canvas" aria-label="Game viewport" role="img" />

      <button
        type="button"
        className="stage__full"
        // Emitted straight from the click: fullscreen is only granted inside a
        // user gesture, and the bus is synchronous so the gesture carries.
        onClick={() => eventBus.emit('game:toggle-fullscreen', {})}
        aria-pressed={full}
        title={full ? 'Leave fullscreen' : 'Fullscreen'}
      >
        {full ? 'Exit fullscreen' : 'Fullscreen'}
      </button>
      {!ready && (
        <div className="stage__loading" role="status">
          <span>Loading atlas</span>
          <div className="stage__bar">
            <i style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      )}
    </div>
  );
}
