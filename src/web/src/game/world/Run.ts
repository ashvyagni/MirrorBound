import type { DungeonInfo } from '../contracts';

/**
 * The run, as the map screen draws it.
 *
 * The sandbox generated this locally -- it reimplemented `DEFAULT_SEQUENCE` and
 * `biome_for` from `dungeon/templates.py` so there was something to draw with
 * no server attached. The server sends the real thing now, so all that is left
 * here is the shape the map screen reads and the one function that fills it.
 *
 * Keeping the shape rather than handing `DungeonInfo` straight to the screen is
 * deliberate: the map draws rooms in a grid with a kind per token, and `type`
 * arrives as a free-form string. Narrowing it once, here, means the screen
 * never has to decide what to do with a room type it has never heard of.
 */
export type Biome = 'grove' | 'ruins' | 'crypt';
export type RoomKind =
  | 'entrance' | 'combat' | 'exploration' | 'treasure' | 'event' | 'elite' | 'boss';

const KINDS: ReadonlySet<string> = new Set<RoomKind>([
  'entrance', 'combat', 'exploration', 'treasure', 'event', 'elite', 'boss',
]);

const BIOMES: ReadonlySet<string> = new Set<Biome>(['grove', 'ruins', 'crypt']);

export interface RunRoom {
  index: number;
  kind: RoomKind;
  biome: Biome;
  name: string;
  visited: boolean;
  cleared: boolean;
}

export interface Run {
  rooms: RunRoom[];
  /** Index of the room the player is standing in. */
  current: number;
}

/**
 * A `DungeonInfo` as the map screen wants it.
 *
 * Unknown room types fall back to `combat` and unknown biomes to `grove`, so a
 * server that grows a new room kind draws a plain token on an old client
 * instead of a hole.
 */
export function runFromDungeon(dungeon: DungeonInfo): Run {
  return {
    current: dungeon.currentIndex,
    rooms: dungeon.rooms.map((room) => ({
      index: room.index,
      kind: (KINDS.has(room.type) ? room.type : 'combat') as RoomKind,
      biome: (BIOMES.has(room.biome) ? room.biome : 'grove') as Biome,
      name: room.name,
      visited: room.visited,
      cleared: room.cleared,
    })),
  };
}
