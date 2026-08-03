/**
 * Usage against a plan limit.
 *
 * The number is the truth and the bar is decoration — `aria-hidden`, because a screen reader
 * reading "2 of 5 classes" already knows everything the bar conveys, and a `<meter>` announced
 * three different ways across three screen readers conveys less.
 */
import type { PlanLimitsResponse, UsageResponse } from '@connected/types';

interface Row {
  label: string;
  used: number;
  allowed: number | null;
}

function UsageRow({ label, used, allowed }: Row) {
  // An unlimited plan gets no bar at all: a bar with nothing to fill implies a ceiling.
  if (allowed === null) {
    return (
      <div>
        <p style={{ margin: 0 }}>
          <strong>{label}</strong> — {used}, with no limit on your plan
        </p>
      </div>
    );
  }

  const full = used >= allowed;
  // Capped at 100 so a school that is over its limit sees a full bar rather than one that
  // overflows its container — being over is a state the product allows, not a rendering bug.
  const percent = Math.min(100, Math.round((used / allowed) * 100));

  return (
    <div>
      <p style={{ margin: '0 0 var(--ui-space-1)' }}>
        <strong>{label}</strong> — {used} of {allowed}
        {full ? ' · full' : ''}
      </p>

      <div
        aria-hidden="true"
        style={{
          height: '0.5rem',
          borderRadius: 'var(--ui-radius)',
          background: 'var(--ui-color-surface-2, #e5e7eb)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${String(percent)}%`,
            height: '100%',
            background: full
              ? 'var(--ui-color-danger, #b91c1c)'
              : 'var(--ui-color-accent, #2563eb)',
          }}
        />
      </div>
    </div>
  );
}

export function PlanUsage({ limits, usage }: { limits: PlanLimitsResponse; usage: UsageResponse }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      <UsageRow label="Classes" used={usage.classes} allowed={limits.classes} />
      <UsageRow label="Members" used={usage.members} allowed={limits.members} />
    </div>
  );
}
