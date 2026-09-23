import { useEffect, useState, type ReactNode } from 'react';

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

type Placed = { frame: Rect; sheet: { w: number; h: number } } | null;

/**
 * Look one frame up in a shipped atlas. Null until it arrives, and null for
 * good if that sheet has no such frame.
 *
 * The result carries the key it was resolved for, so switching atlas or frame
 * shows nothing rather than the previous art until the new one lands -- without
 * a second render to clear it.
 */
function useAtlasFrame(atlas: string, frame: string): Placed {
  const key = `${atlas}/${frame}`;
  const [found, setFound] = useState<{ key: string; placed: Placed } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAtlas(atlas).then((data) => {
      if (cancelled) return;
      const f = data.frames[frame];
      setFound({ key: `${atlas}/${frame}`, placed: f ? { frame: f.frame, sheet: data.meta.size } : null });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [atlas, frame]);

  return found?.key === key ? found.placed : null;
}

/** The background rules that put one atlas frame inside a box of `size`. */
function spriteStyle(rect: NonNullable<Placed>, atlas: string, size: number) {
  // Fit by the longer side so a tall potion and a wide fang both land inside
  // the same box without either being cropped.
  const scale = size / Math.max(rect.frame.w, rect.frame.h);
  return {
    width: rect.frame.w * scale,
    height: rect.frame.h * scale,
    backgroundImage: `url(/game/${atlas}/${atlas}.png)`,
    backgroundSize: `${rect.sheet.w * scale}px ${rect.sheet.h * scale}px`,
    backgroundPosition: `-${rect.frame.x * scale}px -${rect.frame.y * scale}px`,
  };
}

/**
 * Shows one frame of a shipped atlas as a CSS sprite: the goat's face for the
 * player, the companion's idle pose for the twin. The browser already has the
 * PNG for the game, so this is a cache hit and never drifts from the art.
 */
export function Portrait({ atlas, frame, size = 48, className }: { atlas: string; frame: string; size?: number; className?: string }) {
  const rect = useAtlasFrame(atlas, frame);

  if (!rect) return <span className={`portrait ${className ?? ''}`} style={{ width: size, height: size }} />;
  return (
    <span className={`portrait ${className ?? ''}`} style={{ width: size, height: size }}>
      <span style={spriteStyle(rect, atlas, size)} />
    </span>
  );
}

/**
 * The same sprite without the portrait's frame and background.
 *
 * Used where an inline SVG icon used to sit, so it takes that icon's own box
 * and styling rather than bringing its own -- which is why it is sized in
 * percentages instead of pixels: the box comes from whatever class the screen
 * already put on the icon (`.item__icon` is 40px, `.ability__icon` 30px), and
 * this has no business knowing which.
 *
 * `fallback` is what shows while the sheet is loading and if the sheet turns
 * out to have no such frame, which is how an id with no art keeps its drawn
 * icon instead of blinking to an empty square.
 */
export function AtlasIcon(
  { atlas, frame, className, fallback }:
  { atlas: string; frame: string; className?: string | undefined; fallback: ReactNode },
) {
  const rect = useAtlasFrame(atlas, frame);
  if (!rect) return <>{fallback}</>;
  const { w, h, x, y } = rect.frame;
  const { w: sheetW, h: sheetH } = rect.sheet;
  // The longer side fills the box and the shorter one keeps the frame's own
  // proportions, so a tall potion and a wide fang sit in the same square
  // without either being stretched.
  const landscape = w >= h;
  return (
    <span className={`icon icon--art ${className ?? ''}`} aria-hidden="true">
      <span
        style={{
          display: 'block',
          width: landscape ? '100%' : `${(w / h) * 100}%`,
          height: landscape ? `${(h / w) * 100}%` : '100%',
          backgroundImage: `url(/game/${atlas}/${atlas}.png)`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${(sheetW / w) * 100}% ${(sheetH / h) * 100}%`,
          backgroundPosition: `${sheetW > w ? (x / (sheetW - w)) * 100 : 0}% ${sheetH > h ? (y / (sheetH - h)) * 100 : 0}%`,
        }}
      />
    </span>
  );
}
