/** One default checkpoint per browser profile; explicit session links stay isolated. */
export function sessionIdentity(explicit?: string): string {
  const url = new URL(window.location.href);
  const requested = explicit || url.searchParams.get('session');
  if (requested) return requested;
  const key = 'mirrorbound.session.v1';
  let id: string | null = null;
  try { id = window.localStorage.getItem(key); } catch { /* URL fallback below */ }
  if (!id) id = `web-${crypto.randomUUID()}`;
  try { window.localStorage.setItem(key, id); } catch { /* URL still survives reload */ }
  // Keep the chosen identity visible and stable even when storage is unavailable.
  url.searchParams.set('session', id);
  window.history.replaceState(window.history.state, '', url);
  return id;
}
