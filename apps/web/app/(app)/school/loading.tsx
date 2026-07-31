/**
 * Loading state for the whole portal section.
 *
 * `role="status"` with `aria-live="polite"` announces the wait to a screen reader instead of
 * leaving it silent — a blank region reads as "nothing here", not "still fetching".
 */
export default function SchoolLoading() {
  return (
    <div role="status" aria-live="polite" style={{ padding: 'var(--ui-space-6) 0' }}>
      <p className="muted">Loading…</p>
    </div>
  );
}
