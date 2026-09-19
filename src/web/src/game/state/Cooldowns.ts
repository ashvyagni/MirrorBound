/**
 * Per-key recharge timers.
 *
 * Kept apart from the scene because cooldowns outlive the thing that triggers
 * them: a spell is on cooldown whether or not its weapon is still in hand, so
 * unequipping and re-equipping must not hand the player a free cast. Keying by
 * ability rather than by slot is what makes that true.
 */
export class Cooldowns<K extends string> {
  readonly #timers = new Map<K, { left: number; total: number }>();

  /** Count every running timer down. Finished ones are dropped, so the map
   *  stays the size of what is actually recharging. */
  step(deltaSeconds: number): void {
    for (const [key, timer] of this.#timers) {
      timer.left -= deltaSeconds;
      if (timer.left <= 0) this.#timers.delete(key);
    }
  }

  ready(key: K): boolean {
    return !this.#timers.has(key);
  }

  start(key: K, seconds: number): void {
    if (seconds > 0) this.#timers.set(key, { left: seconds, total: seconds });
  }

  /** Seconds left, or 0 when ready. */
  remaining(key: K): number {
    return this.#timers.get(key)?.left ?? 0;
  }

  /** How far recharged, 0 just-cast to 1 ready. Drives the sweep on a slot. */
  progress(key: K): number {
    const timer = this.#timers.get(key);
    if (!timer) return 1;
    return 1 - timer.left / timer.total;
  }

  /** Everything still recharging, for pushing to the views. */
  snapshot(): Partial<Record<K, { left: number; total: number }>> {
    const out: Partial<Record<K, { left: number; total: number }>> = {};
    for (const [key, timer] of this.#timers) out[key] = { ...timer };
    return out;
  }

  get busy(): boolean {
    return this.#timers.size > 0;
  }

  clear(): void {
    this.#timers.clear();
  }
}
