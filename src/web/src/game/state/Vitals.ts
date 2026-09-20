/**
 * What the portrait and the two bars draw.
 *
 * A type and nothing else. The sandbox had a `Vitals` class here that owned
 * health, spent mana and regenerated it on a timer; the server owns all three
 * now, and a second copy that ticks on its own is a second copy that disagrees
 * during the round trip. `hud/Bridge.ts` fills this straight off the snapshot.
 */
export interface VitalsSnapshot {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  /** Current level, and how far through it, 0..1. */
  level: number;
  levelProgress: number;
  /**
   * The twin's own health and mana, or null while it is dormant.
   *
   * Null rather than zeroes: before the twin is found there is nobody to have
   * vitals, and two empty troughs under the player's own would be answering a
   * question the game has not raised yet.
   */
  twin: { health: number; maxHealth: number; mana: number; maxMana: number } | null;
}
