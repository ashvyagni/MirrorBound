import { useEffect, useState } from 'react';

/** A Phaser "JSON Hash" atlas, as the asset pipeline emits it. */
export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  /** Where the trimmed image sits inside the shared source box. */
  spriteSourceSize: { x: number; y: number };
  sourceSize: { w: number; h: number };
}

export interface Atlas {
  frames: Record<string, AtlasFrame>;
  meta: { size: { w: number; h: number } };
}

/**
 * Atlases the React side draws from.
 *
 * Cached by URL at module scope: the wordmark and the loadout both read sheets
 * the game has already fetched, so this is a cache hit in the browser too, and
 * two components asking for the same sheet must not race each other into two
 * requests.
 */
const cache = new Map<string, Promise<Atlas>>();

function load(url: string): Promise<Atlas> {
  let pending = cache.get(url);
  if (!pending) {
    pending = fetch(url).then((r) => r.json() as Promise<Atlas>);
    // Don't cache a failure: a transient network error should not permanently
    // leave the page without its art.
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
}

/** Null until the sheet arrives, and forever if it never does -- every caller
 *  renders something reasonable without it. */
export function useAtlas(url: string): Atlas | null {
  const [atlas, setAtlas] = useState<Atlas | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load(url)
      .then((data) => { if (!cancelled) setAtlas(data); })
      .catch(() => { /* callers degrade on their own */ });
    return () => { cancelled = true; };
  }, [url]);

  return atlas;
}

/**
 * CSS that paints one atlas frame into a box of `size` px.
 *
 * The frame is drawn at its own position within the shared source box, scaled
 * to fit -- so icons of different shapes line up on a common centre instead of
 * each filling its own bounds and jittering against its neighbours.
 */
export function frameStyle(
  atlas: Atlas | null,
  image: string,
  name: string,
  size: number,
): React.CSSProperties | undefined {
  const frame = atlas?.frames[name];
  if (!atlas || !frame) return undefined;

  const box = frame.sourceSize;
  const scale = size / Math.max(box.w, box.h);

  return {
    width: frame.frame.w * scale,
    height: frame.frame.h * scale,
    marginLeft: frame.spriteSourceSize.x * scale,
    marginTop: frame.spriteSourceSize.y * scale,
    backgroundImage: `url(${image})`,
    backgroundSize: `${atlas.meta.size.w * scale}px ${atlas.meta.size.h * scale}px`,
    backgroundPosition: `-${frame.frame.x * scale}px -${frame.frame.y * scale}px`,
  };
}
