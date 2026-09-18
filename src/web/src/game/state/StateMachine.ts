/**
 * A small, explicit state machine.
 *
 * Character logic collapses into unreadable if-chains fast. Forcing every state
 * to declare its own entry, update and exit keeps "what can interrupt what" in
 * one readable table instead of scattered across an update loop.
 */
export interface StateDef<S extends string, Ctx> {
  /** Runs once when the state becomes active. */
  enter?(ctx: Ctx, from: S | null): void;
  /** Runs every frame while active. Return a state name to transition. */
  update?(ctx: Ctx, deltaSeconds: number): S | void;
  /** Runs once when the state is left. */
  exit?(ctx: Ctx, to: S): void;
  /**
   * States that may interrupt this one. Omit to allow any.
   * Listing them explicitly is what stops an attack being cancelled by a stray
   * walk, or a death being undone by a jump.
   */
  interruptibleBy?: readonly S[];
}

export class StateMachine<S extends string, Ctx> {
  #current: S;
  #previous: S | null = null;
  #elapsed = 0;

  constructor(
    private readonly states: Readonly<Record<S, StateDef<S, Ctx>>>,
    private readonly ctx: Ctx,
    initial: S,
  ) {
    this.#current = initial;
    this.states[initial].enter?.(ctx, null);
  }

  get current(): S {
    return this.#current;
  }

  get previous(): S | null {
    return this.#previous;
  }

  /** Seconds spent in the current state. */
  get elapsed(): number {
    return this.#elapsed;
  }

  /** Whether a transition to `next` would be accepted right now. */
  canEnter(next: S): boolean {
    if (next === this.#current) return false;
    const allowed = this.states[this.#current].interruptibleBy;
    return allowed === undefined || allowed.includes(next);
  }

  /** Transition if permitted. Returns whether it happened. */
  set(next: S, force = false): boolean {
    if (!force && !this.canEnter(next)) return false;
    if (next === this.#current) return false;

    this.states[this.#current].exit?.(this.ctx, next);
    this.#previous = this.#current;
    this.#current = next;
    this.#elapsed = 0;
    this.states[next].enter?.(this.ctx, this.#previous);
    return true;
  }

  update(deltaSeconds: number): void {
    this.#elapsed += deltaSeconds;
    const next = this.states[this.#current].update?.(this.ctx, deltaSeconds);
    // Forced: `interruptibleBy` governs interruption from outside. A state that
    // decides for itself that it is finished is always allowed to leave, or an
    // attack that blocks interrupts would block its own exit and wedge.
    if (next) this.set(next, true);
  }
}
