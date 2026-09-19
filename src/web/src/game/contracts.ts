/**
 * The room shape, copied from `main`'s wire contract.
 *
 * This branch has no server, so nothing arrives over a socket -- but the world
 * renderer pulled across from `main` reads exactly this, and a local generator
 * that emits it means the renderer never learns which side produced the room.
 * When the socket does land, `Grove.build()` is deleted and the snapshot is
 * passed straight in.
 *
 * Field names are the wire's, camelCase, and must stay that way.
 */

export interface Vec2 { x: number; y: number }

export interface DecorSnap {
  kind: string;
  x: number;
  y: number;
  variant: number;
  scale: number;
  blocking: boolean;
  radius: number;
  flip: boolean;
}

export interface DoorSnap {
  side: 'north' | 'south' | 'east' | 'west';
  x: number;
  y: number;
  width: number;
  targetIndex: number | null;
  locked: boolean;
  kind: 'gate' | 'arch' | 'sealed' | string;
}

export interface RoomFull {
  id: string;
  index: number;
  roomType: string;
  name: string;
  biome: 'grove' | 'ruins' | 'crypt';
  width: number;
  height: number;
  tileSize: number;
  /** Row-major, `[row][col]`. See `TILE_*` below for what the numbers mean. */
  tiles: number[][];
  decor: DecorSnap[];
  doors: DoorSnap[];
  cleared: boolean;
  seed: number;
}

/** Tile ids, matching `dungeon/generation.py` on `main`. */
export const TILE_GRASS = 0;
export const TILE_WALL = 1;
export const TILE_PATH = 2;
export const TILE_STONE = 3;
export const TILE_DIRT = 4;
export const TILE_WATER = 5;
