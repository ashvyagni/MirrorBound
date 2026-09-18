import { VITALS } from '../constants';

/**
 * What the two bars draw.
 *
 * Deliberately shaped like the server's `PlayerSnap` on `main` -- `health`,
 * `maxHealth`, `mana`, `maxMana` -- because that is where these numbers come
 * from once this branch takes snapshots over the socket. Matching the names now
 * means the swap is deleting this file and pointing the HUD at the snapshot,
 * rather than a rename through every view that reads it.
 *
 * It owns no clock of its own and is stepped by the scene, for the same reason
 * the cooldowns are: a paused game must not regenerate mana.
 */
export interface VitalsSnapshot {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
}

export class Vitals {
  #health: number = VITALS.maxHealth;
  #mana: number = VITALS.maxMana;
  /** Time until mana starts coming back. Reset by every spend. */
  #regenDelay = 0;

  get health(): number {
    return this.#health;
  }

  get mana(): number {
    return this.#mana;
  }

  get dead(): boolean {
    return this.#health <= 0;
  }

  snapshot(): VitalsSnapshot {
    return {
      health: this.#health,
      maxHealth: VITALS.maxHealth,
      mana: this.#mana,
      maxMana: VITALS.maxMana,
    };
  }

  step(deltaSeconds: number): void {
    if (this.dead) return;

    if (this.#regenDelay > 0) {
      this.#regenDelay -= deltaSeconds;
      return;
    }
    this.#mana = Math.min(VITALS.maxMana, this.#mana + VITALS.manaRegen * deltaSeconds);
  }

  /** Returns whether this hit was the one that killed. */
  damage(amount: number): boolean {
    if (this.dead) return false;
    this.#health = Math.max(0, this.#health - amount);
    return this.dead;
  }

  /** Whether there is enough mana, without spending any. */
  canAfford(cost: number): boolean {
    return this.#mana >= cost;
  }

  /** Spend, if it can be afforded. Returns whether it was. */
  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.#mana -= cost;
    this.#regenDelay = VITALS.manaRegenDelay;
    return true;
  }

  heal(amount: number): void {
    this.#health = Math.min(VITALS.maxHealth, this.#health + amount);
  }

  restoreMana(amount: number): void {
    this.#mana = Math.min(VITALS.maxMana, this.#mana + amount);
  }

  /** Back to full. Used on respawn. */
  reset(): void {
    this.#health = VITALS.maxHealth;
    this.#mana = VITALS.maxMana;
    this.#regenDelay = 0;
  }
}
