import { useEffect, useState } from 'react';

interface Rect { x: number; y: number; w: number; h: number }
interface AtlasFrame { frame: Rect }
interface Atlas { frames: Record<string, AtlasFrame>; meta: { size: { w: number; h: number } } }

const cache = new Map<string, Promise<Atlas>>();

function loadAtlas(name: string): Promise<Atlas> {
  let p = cache.get(name);
  if (!p) {
    p = fetch(`/game/${name}/${name}.json`).then((r) => r.json() as Promise<Atlas>);
    cache.set(name, p);
  }
  return p;
}

/**
 * Shows one frame of a shipped atlas as a CSS sprite: the goat's face for the
 * player, the companion's idle pose for the twin. The browser already has the
 * PNG for the game, so this is a cache hit and never drifts from the art.
 */
export function Portrait({ atlas, frame, size = 48, className }: { atlas: string; frame: string; size?: number; className?: string }) {
  const [rect, setRect] = useState<{ frame: Rect; sheet: { w: number; h: number } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAtlas(atlas).then((data) => {
      if (cancelled) return;
      const f = data.frames[frame];
      if (f) setRect({ frame: f.frame, sheet: data.meta.size });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [atlas, frame]);

  if (!rect) return <span className={`portrait ${className ?? ''}`} style={{ width: size, height: size }} />;
  const scale = size / Math.max(rect.frame.w, rect.frame.h);
  return (
    <span className={`portrait ${className ?? ''}`} style={{ width: size, height: size }}>
      <span
        style={{
          width: rect.frame.w * scale,
          height: rect.frame.h * scale,
          backgroundImage: `url(/game/${atlas}/${atlas}.png)`,
          backgroundSize: `${rect.sheet.w * scale}px ${rect.sheet.h * scale}px`,
          backgroundPosition: `-${rect.frame.x * scale}px -${rect.frame.y * scale}px`,
        }}
      />
    </span>
  );
}
