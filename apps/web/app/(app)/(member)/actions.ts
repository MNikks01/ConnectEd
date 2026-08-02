'use server';

/**
 * Server Actions for the member side of the portal.
 *
 * As with the school actions, these are **not** the security boundary: publishing is authorized by
 * the API against the teacher's subject allocation, and marking a notification read is scoped to
 * the caller by the API's query. A Server Action is reachable by anyone who can reach the app.
 */
import {
  applyForChildLeaveSchema,
  applyForOwnLeaveSchema,
  leaveDecisionSchema,
  publishAcademicItemSchema,
  submitFeedbackSchema,
  upsertSyllabusTopicSchema,
} from '@connected/types';
import { revalidatePath } from 'next/cache';

import { apiErrorMessage, apiFieldErrors, callAsUser } from '@/lib/server-api';

import type { ActionResult } from '@/app/(app)/school/actions';

const OK: ActionResult = { ok: true };

async function run(mutate: () => Promise<unknown>, revalidate: string[]): Promise<ActionResult> {
  try {
    await mutate();
    for (const path of revalidate) revalidatePath(path);
    return OK;
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error), fieldErrors: apiFieldErrors(error) };
  }
}

function invalid(error: unknown): ActionResult {
  const issues =
    error instanceof Error && 'issues' in error
      ? (error as { issues: { path: (string | number)[]; message: string }[] }).issues
      : [];

  return {
    ok: false,
    message: 'Check the details you entered.',
    fieldErrors: Object.fromEntries(
      issues.map((issue) => [issue.path.join('.') || '(root)', issue.message]),
    ),
  };
}

export async function publishAcademicItemAction(
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);

  // A date input yields `''` when left blank, and `z.iso.datetime()` rejects that. Empty means
  // "no due date", so it becomes null before validation rather than an error the teacher has to
  // decode. `datetime-local` gives `2026-08-01T09:00` — seconds and a zone are required.
  const dueAt =
    typeof raw.dueAt === 'string' && raw.dueAt.trim() !== ''
      ? new Date(raw.dueAt).toISOString()
      : null;

  const parsed = publishAcademicItemSchema.safeParse({ ...raw, dueAt });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/classes/${classId}/academics`, { method: 'POST', body: parsed.data }),
    [`/classes/${classId}`],
  );
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  return run(
    () => callAsUser('/notifications/read-all', { method: 'POST' }),
    ['/notifications', '/home'],
  );
}

export async function recordSyllabusAction(
  subjectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);

  // A number input still submits a string, and the API's schema is `z.number().int()` — parsing
  // here keeps a typo ("50%") an input error rather than a type error from the server.
  const parsed = upsertSyllabusTopicSchema.safeParse({
    ...raw,
    percent: typeof raw.percent === 'string' ? Number(raw.percent) : raw.percent,
  });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/subjects/${subjectId}/syllabus`, { method: 'POST', body: parsed.data }),
    [`/subjects/${subjectId}`],
  );
}

/**
 * A parent applies for their child (FR-WF-001).
 *
 * The child is chosen from the caller's own memberships, and the API checks the link again — the
 * select is a convenience, not the boundary.
 */
export async function applyForChildLeaveAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const childId = typeof raw.childId === 'string' ? raw.childId : '';

  const parsed = applyForChildLeaveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  if (!childId) {
    return { ok: false, message: 'Choose a child.', fieldErrors: { childId: 'Required.' } };
  }

  return run(
    () => callAsUser(`/children/${childId}/leave`, { method: 'POST', body: parsed.data }),
    ['/leave'],
  );
}

/** A teacher applies for themselves (FR-WF-002). */
export async function applyForOwnLeaveAction(formData: FormData): Promise<ActionResult> {
  const parsed = applyForOwnLeaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(() => callAsUser('/me/leave', { method: 'POST', body: parsed.data }), ['/leave']);
}

/** Accept or reject (FR-WF-003, 004). Revalidates both queues; only one will be on screen. */
export async function decideLeaveAction(
  leaveId: string,
  decision: 'ACCEPT' | 'REJECT',
): Promise<ActionResult> {
  const parsed = leaveDecisionSchema.safeParse({ decision });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/leave/${leaveId}/decision`, { method: 'POST', body: parsed.data }),
    ['/leave/approvals', '/leave'],
  );
}

/** Raise a complaint or a suggestion (FR-WF-010). */
export async function submitFeedbackAction(
  schoolId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = submitFeedbackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/schools/${schoolId}/feedback`, { method: 'POST', body: parsed.data }),
    ['/complaints'],
  );
}
