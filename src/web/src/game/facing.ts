import type { Facing } from './types';

/**
 * Origin x for a sprite that is mirrored to face the other way.
 *
 * `flipX` mirrors the pixels *inside* the frame box. It does not move the box,
 * which still hangs off the origin exactly where it did -- so a sprite anchored
 * anywhere but the middle keeps its extent on the same side when it flips, and
 * the artwork slides across to the far end of it.
 *
 * That is invisible while an anchor sits near 0.5 and glaring once it does not:
 * the ice beam, held at 0.04 so it grows forward out of the staff, fired
 * backwards over the goat's head the moment it turned around. Mirroring the
 * origin with the texture keeps the two in step.
 */
export function mirroredOriginX(anchorX: number, flipped: boolean): number {
  return flipped ? 1 - anchorX : anchorX;
}

/** Whether a sprite drawn facing right must be flipped to match `facing`. */
export function flippedFor(facing: Facing): boolean {
  return facing === -1;
}
