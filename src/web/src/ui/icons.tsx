/**
 * Icons for abilities, weapons, items and resources.
 *
 * Logesh's `items` sheet names its frames with `main`'s own ids -- the point of
 * which was that nothing needs a lookup table -- so anything he drew shows as
 * real art and everything else keeps the inline SVG below. Abilities are all
 * still drawn: his icon sheet names its eight frames after the spells his own
 * branch had, none of which are ids this server sends.
 */

import type { JSX } from 'react';

import { isItemName } from '@/game/animation/items';
import { ITEMS_TEXTURE_KEY } from '@/game/animation/itemsAtlas.generated';

import { AtlasIcon } from './Portrait';

const ICONS: Record<string, JSX.Element> = {
  arcane_bolt: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="#3b2a66" />
      <path d="M6 16 L26 16" stroke="#b48cff" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 9 L27 16 L18 23" fill="none" stroke="#e8dcff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="16" r="2.4" fill="#fff" />
    </svg>
  ),
  flame_burst: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="#5a2418" />
      <path d="M16 5 C 22 11, 24 15, 22 21 C 21 25, 18 27, 16 27 C 12 27, 9 24, 9 19 C 9 15, 12 12, 13 9 C 14 12, 16 13, 17 13 C 17 10, 16 8, 16 5 Z" fill="#ff7a3d" />
      <path d="M16 15 C 19 18, 19 22, 16 24 C 13 22, 13 18, 16 15 Z" fill="#fff1a8" />
    </svg>
  ),
  shadow_dash: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="#222036" />
      <path d="M5 20 L14 20" stroke="#7c6add" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
      <path d="M7 15 L15 15" stroke="#7c6add" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
      <path d="M12 10 L22 16 L12 22 Z" fill="#e8dcff" />
    </svg>
  ),
  binding_nova: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="#1c2a3a" />
      <circle cx="16" cy="16" r="8" fill="none" stroke="#a0cae4" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="3.5" fill="#fff" />
      <path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29" stroke="#a0cae4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  sword: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 26 L20 12" stroke="#e9e2d8" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M20 12 L25 7" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M9 19 L13 23" stroke="#b08040" strokeWidth="3" strokeLinecap="round" />
      <path d="M5 27 L8 24" stroke="#5a3d2a" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  ),
  bow: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 5 C 22 10, 22 22, 9 27" fill="none" stroke="#c9a27a" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M9 5 L9 27" stroke="#f5a4c0" strokeWidth="1.4" />
      <path d="M9 16 L26 16" stroke="#e8e4dc" strokeWidth="2" />
      <path d="M23 13 L27 16 L23 19" fill="none" stroke="#e8e4dc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  staff: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M12 28 L20 8" stroke="#c9a27a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="21" cy="7" r="4.5" fill="#9fe3ff" stroke="#fff" strokeWidth="1.5" />
    </svg>
  ),
  essence: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="9" fill="#c05bff" />
      <circle cx="13" cy="13" r="3" fill="#fff" opacity="0.7" />
    </svg>
  ),
  shards: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 4 L24 13 L20 28 L12 28 L8 13 Z" fill="#bfeeff" stroke="#3a6a8a" strokeWidth="1.5" />
      <path d="M16 4 L20 28 L16 24 L13 13 Z" fill="#fff" opacity="0.5" />
    </svg>
  ),
  health_potion: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M13 4 H19 V11 L25 19 V27 H7 V19 L13 11 Z" fill="#e04a5a" stroke="#4a1a22" strokeWidth="1.5" />
      <rect x="12" y="2" width="8" height="4" fill="#c9a27a" />
    </svg>
  ),
  mana_potion: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M13 4 H19 V11 L25 19 V27 H7 V19 L13 11 Z" fill="#4f8fe6" stroke="#1a2a4a" strokeWidth="1.5" />
      <rect x="12" y="2" width="8" height="4" fill="#c9a27a" />
    </svg>
  ),
  relic: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="9" fill="none" stroke="#f0c060" strokeWidth="3" />
      <circle cx="16" cy="16" r="3.5" fill="#d62e6c" />
    </svg>
  ),
  skull: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 4 C 9 4, 6 9, 6 15 C 6 19, 8 21, 10 23 V27 H22 V23 C 24 21, 26 19, 26 15 C 26 9, 23 4, 16 4 Z" fill="#dcd4c4" />
      <circle cx="12" cy="15" r="2.5" fill="#2a2230" />
      <circle cx="20" cy="15" r="2.5" fill="#2a2230" />
    </svg>
  ),
};

/** Whether Logesh drew this id, so a caller can choose a better generic icon. */
export function hasItemArt(id: string): boolean {
  return isItemName(id);
}

export function Icon({ name, className }: { name: string; className?: string }) {
  const svg = ICONS[name] ?? ICONS.essence;
  const drawn = <span className={`icon ${className ?? ''}`}>{svg}</span>;
  if (!isItemName(name)) return drawn;
  // Falls back to the drawn icon while the sheet is loading, so nothing pops
  // in as an empty box.
  return <AtlasIcon atlas={ITEMS_TEXTURE_KEY} frame={name} className={className} fallback={drawn} />;
}

export function weaponIcon(family: string): string {
  return family === 'bow' ? 'bow' : family === 'staff' ? 'staff' : 'sword';
}
