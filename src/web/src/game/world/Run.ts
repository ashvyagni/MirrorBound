/**
 * The shape of a run, so the map has something true to draw.
 *
 * `biome_for()` on `main` splits a run three ways by position -- grove near the
 * surface, ruins in the middle, crypt at the bottom -- and the room sequence is
 * a fixed pattern of types. Both are ported here rather than invented, so the
 * map shows the run you would actually get.
 *
 * Only the first room exists as geometry today; the rest are known positions on
 * a known path. That is exactly what a map is for, and drawing eight rooms you
 * cannot yet walk into is honest as long as they are marked unvisited.
 */

export type Biome = 'grove' | 'ruins' | 'crypt';
export type RoomKind =
  | 'entrance' | 'combat' | 'exploration' | 'treasure' | 'event' | 'elite' | 'boss';

export interface RunRoom {
  index: number;
  kind: RoomKind;
  biome: Biome;
  name: string;
  visited: boolean;
  cleared: boolean;
}

/** `biome_for(index, total)` from `dungeon/templates.py`, unchanged. */
export function biomeFor(index: number, total: number): Biome {
  const frac = index / Math.max(1, total - 1);
  if (frac < 0.4) return 'grove';
  if (frac < 0.8) return 'ruins';
  return 'crypt';
}

/** `DEFAULT_SEQUENCE` on `main`: what a run is made of, in order. */
const SEQUENCE: readonly RoomKind[] = [
  'entrance', 'combat', 'exploration', 'combat', 'treasure',
  'combat', 'elite', 'combat', 'event', 'boss',
];

const NAMES: Record<Biome, readonly string[]> = {
  grove: ['Wakewood Clearing', 'The Mossy Threshold', 'Fernhollow', 'Thornmere'],
  ruins: ['Fallen Colonnade', 'The Split Arch', 'Kiln Yard', 'Statuary'],
  crypt: ['Ossuary', 'The Long Descent', 'Cold Vault', 'Mirror Hall'],
};

export interface Run {
  rooms: RunRoom[];
  /** Index of the room the player is standing in. */
  current: number;
}

export function buildRun(current = 0): Run {
  const total = SEQUENCE.length;
  const rooms = SEQUENCE.map((kind, index) => {
    const biome = biomeFor(index, total);
    return {
      index,
      kind,
      biome,
      name: NAMES[biome][index % NAMES[biome].length]!,
      // Everything behind you is walked; everything ahead is not yet drawn.
      visited: index <= current,
      cleared: index < current,
    };
  });
  return { rooms, current };
}
