import type { Game } from 'phaser';
import { useEffect, useRef } from 'react';

import { useUi } from './store';

/**
 * Owns the Phaser instance's lifetime.
 *
 * Phaser is imported dynamically so the engine chunk loads only here, and the
 * game is destroyed on unmount -- which React 19's development Strict Mode
 * exercises on every mount, so a leak would show up immediately.
 *
 * It also publishes the canvas's on-screen rectangle as CSS variables on the
 * stage, so the HUD hugs the 16:9 game area instead of the letterbox.
 */
export function GameMount() {
  const hostRef = useRef<HTMLDivElement>(null);
  const ready = useUi((s) => s.ready);
  const loading = useUi((s) => s.loading);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stage = host.parentElement;
    let game: Game | undefined;
    let cancelled = false;
    let raf = 0;

    const publishRect = () => {
      const canvas = host.querySelector('canvas');
      if (!canvas || !stage) return;
      const c = canvas.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      stage.style.setProperty('--game-left', `${Math.round(c.left - s.left)}px`);
      stage.style.setProperty('--game-top', `${Math.round(c.top - s.top)}px`);
      stage.style.setProperty('--game-width', `${Math.round(c.width)}px`);
      stage.style.setProperty('--game-height', `${Math.round(c.height)}px`);
    };
    const observer = new ResizeObserver(publishRect);
    observer.observe(host);
    if (stage) observer.observe(stage);
    window.addEventListener('resize', publishRect);
    // Phaser lays the canvas out a frame or two after creation; poll briefly.
    let polls = 0;
    const poll = () => {
      publishRect();
      if (++polls < 120) raf = window.requestAnimationFrame(poll);
    };

    void import('@/game/createGame').then(({ createGame }) => {
      if (cancelled) return;
      game = createGame(host, stage ?? undefined);
      raf = window.requestAnimationFrame(poll);
    });

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener('resize', publishRect);
      window.cancelAnimationFrame(raf);
      game?.destroy(true);
      game = undefined;
    };
  }, []);

  return (
    <>
      <div ref={hostRef} className="stage__canvas" aria-label="Game viewport" role="img" />
      {!ready && (
        <div className="stage__loading" role="status">
          <span className="stage__loading-title">Mirrorbound</span>
          <div className="stage__bar"><i style={{ transform: `scaleX(${loading})` }} /></div>
          <span className="stage__loading-hint">Waking the world</span>
        </div>
      )}
    </>
  );
}
