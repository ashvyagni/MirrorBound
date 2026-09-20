/**
 * The save slots the server says this profile has.
 *
 * Cached, because the list rides detail snapshots and only when it changed:
 * the server reads a directory to build it, so it is not something to re-send
 * twenty times a second. An absent `saves` field means "unchanged", exactly
 * like the omitted inventory and skill blocks beside it.
 */

import type { GameSnapshot, SaveSlot } from '../contracts';

export class Saves {
  #slots: SaveSlot[] = [];
  #active = 'auto';
  /** Bumped whenever the list changes, so a screen can tell it must redraw. */
  #revision = 0;

  get slots(): readonly SaveSlot[] { return this.#slots; }
  get active(): string { return this.#active; }
  get revision(): number { return this.#revision; }

  update(snap: GameSnapshot): void {
    if (snap.saves === undefined) return;
    this.#slots = snap.saves;
    this.#active = snap.saveSlot ?? this.#active;
    this.#revision += 1;
  }
}

/** The shared list. One profile per browser, so one of these is enough. */
export const saves = new Saves();

/** "3 minutes ago", for a list of checkpoints rather than a log. */
export function savedAgo(savedAt: number, now = Date.now() / 1000): string {
  const seconds = Math.max(0, now - savedAt);
  if (!savedAt) return 'unknown';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}
