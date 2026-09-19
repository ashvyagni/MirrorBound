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
}
