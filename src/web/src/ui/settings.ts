/**
 * Render quality, as `main` defines it.
 *
 * Only the type is here. `main`'s settings store carries nine of these and a
 * screen to change them; the world renderer needs one of them, so this branch
 * carries one of them rather than the store it lives in.
 */
export type Quality = 'high' | 'medium' | 'low';

/** What the sandbox renders at until there is a settings screen to change it. */
export const DEFAULT_QUALITY: Quality = 'high';
