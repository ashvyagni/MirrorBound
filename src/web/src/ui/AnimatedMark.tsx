import { useEffect, useMemo, useState } from 'react';

import { GOAT_FRAMES } from '@/game/animation/goatAtlas.generated';

import { useAtlas, type AtlasFrame } from './atlas';

interface Placed {
  rect: AtlasFrame['frame'];
  offsetX: number;
  offsetY: number;
}

const ATLAS_URL = '/game/goat/goat.json';
const IMAGE_URL = '/game/goat/goat.png';
const HOLD_MS = 2100;
const MARK_HEIGHT = 46;

/**
 * The wordmark's goat: its own expression row, cycling.
 *
 * The frames are read from the shipped atlas rather than exported again as
 * separate images -- the browser has already fetched it for the game, so this
 * is a cache hit, and the logo cannot drift out of sync with the sheet.
 *
 * Every expression is positioned inside one shared box, computed from the union
 * of them all. Laying each out on its own bounds instead would make the head
 * jump a few pixels every time the face changed.
 */
export function AnimatedMark() {
  const atlas = useAtlas(ATLAS_URL);
  const [index, setIndex] = useState(0);

  const placed = useMemo<Placed[] | null>(() => {
    if (!atlas) return null;
    const faces = GOAT_FRAMES.face
      .map((name) => atlas.frames[name])
      .filter((f): f is AtlasFrame => Boolean(f));
    if (!faces.length) return null;

    const left = Math.min(...faces.map((f) => f.spriteSourceSize.x));
    const top = Math.min(...faces.map((f) => f.spriteSourceSize.y));
    return faces.map((f) => ({
      rect: f.frame,
      offsetX: f.spriteSourceSize.x - left,
      offsetY: f.spriteSourceSize.y - top,
    }));
  }, [atlas]);

  const box = useMemo(() => {
    if (!placed) return null;
    return {
      w: Math.max(...placed.map((p) => p.offsetX + p.rect.w)),
      h: Math.max(...placed.map((p) => p.offsetY + p.rect.h)),
    };
  }, [placed]);

  useEffect(() => {
    if (!placed || placed.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % placed.length),
      HOLD_MS,
    );
    return () => window.clearInterval(timer);
  }, [placed]);

  const frame = placed?.[index];
  // Scale so the shared box is a fixed height; the plate behind is inset, which
  // is what lets the horns and ear tips break its edge.
  const scale = box ? MARK_HEIGHT / box.h : 1;

  return (
    <span
      className="mark"
      style={box ? { width: box.w * scale, height: box.h * scale } : undefined}
      aria-hidden="true"
    >
      <span className="mark__plate" />
      {frame && atlas && (
        <span
          className="mark__face"
          key={index}
          style={{
            width: frame.rect.w * scale,
            height: frame.rect.h * scale,
            left: frame.offsetX * scale,
            top: frame.offsetY * scale,
            backgroundImage: `url(${IMAGE_URL})`,
            backgroundSize: `${atlas.meta.size.w * scale}px ${atlas.meta.size.h * scale}px`,
            backgroundPosition: `-${frame.rect.x * scale}px -${frame.rect.y * scale}px`,
          }}
        />
      )}
    </span>
  );
}
