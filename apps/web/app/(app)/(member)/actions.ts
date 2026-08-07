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
  createCommentSchema,
  createPostSchema,
  createReportSchema,
  sendMessageSchema,
  updateProfileSchema,
  applyForOwnLeaveSchema,
  leaveDecisionSchema,
  publishAcademicItemSchema,
  submitFeedbackSchema,
  upsertSyllabusTopicSchema,
  enterMarksSchema,
  createAssessmentSchema,
  correctMarkSchema,
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

// ---------------------------------------------------------------------------
// Social (S4-9). Every one of these is a thin call to an endpoint that decides
// for itself — blocking, ownership and visibility all live in the API.
// ---------------------------------------------------------------------------

export async function publishPostAction(formData: FormData): Promise<ActionResult> {
  const parsed = createPostSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser('/posts', { method: 'POST', body: parsed.data }),
    ['/social', '/accounts'],
  );
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  return run(() => callAsUser(`/posts/${postId}`, { method: 'DELETE' }), ['/social']);
}

export async function toggleLikeAction(postId: string): Promise<ActionResult> {
  return run(() => callAsUser(`/posts/${postId}/like`, { method: 'POST' }), ['/social']);
}

export async function commentAction(postId: string, formData: FormData): Promise<ActionResult> {
  const parsed = createCommentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/posts/${postId}/comments`, { method: 'POST', body: parsed.data }),
    ['/social'],
  );
}

export async function followAction(accountId: string, following: boolean): Promise<ActionResult> {
  return run(
    () => callAsUser(`/accounts/${accountId}/follow`, { method: following ? 'DELETE' : 'POST' }),
    [`/accounts/${accountId}`, '/social'],
  );
}

export async function requestConnectionAction(accountId: string): Promise<ActionResult> {
  return run(
    () => callAsUser('/connections', { method: 'POST', body: { accountId } }),
    [`/accounts/${accountId}`, '/connections'],
  );
}

export async function respondToConnectionAction(
  connectionId: string,
  accept: boolean,
): Promise<ActionResult> {
  return run(
    () =>
      accept
        ? callAsUser(`/connections/${connectionId}/accept`, { method: 'POST' })
        : callAsUser(`/connections/${connectionId}`, { method: 'DELETE' }),
    ['/connections'],
  );
}

export async function blockAction(accountId: string, blocked: boolean): Promise<ActionResult> {
  return run(
    () => callAsUser(`/accounts/${accountId}/block`, { method: blocked ? 'DELETE' : 'POST' }),
    [`/accounts/${accountId}`, '/social', '/messages'],
  );
}

export async function reportAction(
  subjectType: 'POST' | 'COMMENT' | 'MESSAGE' | 'ACCOUNT',
  subjectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createReportSchema.safeParse({
    subjectType,
    subjectId,
    reason: formData.get('reason'),
  });
  if (!parsed.success) return invalid(parsed.error);

  return run(() => callAsUser('/reports', { method: 'POST', body: parsed.data }), []);
}

export async function updateOwnProfileAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);

  const parsed = updateProfileSchema.safeParse({
    ...raw,
    // A cleared textarea arrives as '' and means "remove this", which the API expresses as null.
    bio: raw.bio === '' ? null : raw.bio,
    achievements: raw.achievements === '' ? null : raw.achievements,
  });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser('/me/profile', { method: 'PATCH', body: parsed.data }),
    ['/settings/profile', '/social'],
  );
}

export async function startThreadAction(accountId: string): Promise<ActionResult> {
  return run(() => callAsUser('/threads', { method: 'POST', body: { accountId } }), ['/messages']);
}

export async function sendMessageAction(
  threadId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/threads/${threadId}/messages`, { method: 'POST', body: parsed.data }),
    [`/messages/${threadId}`, '/messages'],
  );
}

export async function updateNotificationPrefsAction(
  preferences: { category: string; enabled: boolean }[],
): Promise<ActionResult> {
  return run(
    () =>
      callAsUser('/me/notification-prefs', {
        method: 'PATCH',
        body: { preferences },
      }),
    ['/settings/notifications', '/notifications'],
  );
}

/**
 * Two-factor enrolment (FR-AUTH-012).
 *
 * These carry more than `ok` back, which the shared `ActionResult` does not: the enrolment's QR
 * URI and, once, the recovery codes. Both are secrets that exist in exactly one response, so they
 * are threaded through rather than re-fetched — a second request for the recovery codes is a
 * second chance for somebody else to make it.
 */
export interface TwoFactorStartResult extends ActionResult {
  enrolment?: { otpauthUri: string; secret: string };
}

export interface TwoFactorConfirmResult extends ActionResult {
  recoveryCodes?: string[];
}

export async function startTwoFactorAction(): Promise<TwoFactorStartResult> {
  try {
    const enrolment = await callAsUser<{ otpauthUri: string; secret: string }>('/me/2fa', {
      method: 'POST',
    });
    return { ok: true, enrolment };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function confirmTwoFactorAction(code: string): Promise<TwoFactorConfirmResult> {
  try {
    const { recoveryCodes } = await callAsUser<{ recoveryCodes: string[] }>('/me/2fa/confirm', {
      method: 'POST',
      body: { code },
    });
    revalidatePath('/settings/security');
    return { ok: true, recoveryCodes };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function disableTwoFactorAction(code: string): Promise<ActionResult> {
  return run(
    () => callAsUser('/me/2fa', { method: 'DELETE', body: { code } }),
    ['/settings/security'],
  );
}

/**
 * Setting up an assessment (FR-GRADE-001).
 *
 * The subject is a picker rather than free text because the server refuses a subject this teacher
 * is not allocated to, and a form that lets someone type their way into a 403 is a form that
 * teaches them the product is broken.
 */
export async function createAssessmentAction(
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createAssessmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/classes/${classId}/assessments`, { method: 'POST', body: parsed.data }),
    [`/classes/${classId}/marks`],
  );
}

/**
 * Entering a class's marks — the whole class in one submission (FR-GRADE-010).
 *
 * The form posts one field per pupil, `score-<accountId>`, and an empty field means **not marked**
 * rather than zero. That distinction is the reason this parses rather than coerces: `Number('')`
 * is 0, and a teacher who tabbed past a pupil would silently award them nothing.
 */
export async function enterMarksAction(
  assessmentId: string,
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  const marks: { studentAccountId: string; score: string | null; remark?: string }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('score-')) continue;

    const studentAccountId = key.slice('score-'.length);
    const raw = typeof value === 'string' ? value.trim() : '';
    const remark = formData.get(`remark-${studentAccountId}`);

    marks.push({
      studentAccountId,
      score: raw === '' ? null : raw,
      ...(typeof remark === 'string' && remark.trim() !== '' ? { remark: remark.trim() } : {}),
    });
  }

  if (marks.length === 0) {
    return { ok: false, message: 'There was nobody to mark.' };
  }

  const parsed = enterMarksSchema.safeParse({ marks });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/assessments/${assessmentId}/marks`, { method: 'PUT', body: parsed.data }),
    [`/classes/${classId}/marks/${assessmentId}`, `/classes/${classId}/marks`],
  );
}

/**
 * Publishing them, all at once (FR-GRADE-011).
 *
 * Separate from entry on purpose, and irreversible in the sense that matters: once published, a
 * correction is one pupil at a time and audited. A teacher half-way through marking has not made a
 * decision about anybody yet.
 */
export async function publishMarksAction(
  assessmentId: string,
  classId: string,
): Promise<ActionResult> {
  return run(
    () => callAsUser(`/assessments/${assessmentId}/publish`, { method: 'POST' }),
    [`/classes/${classId}/marks/${assessmentId}`, `/classes/${classId}/marks`],
  );
}

/**
 * Correcting one published mark (FR-GRADE-012).
 *
 * One pupil at a time, deliberately. A bulk overwrite of published results would leave no record of
 * what changed for whom — and the server refuses it for that reason. The audit row it writes is not
 * shown to the pupil or their parents: they see the corrected mark, which is now simply the mark.
 */
export async function correctMarkAction(
  assessmentId: string,
  classId: string,
  studentAccountId: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get('score');
  const remark = formData.get('remark');
  const score = typeof raw === 'string' ? raw.trim() : '';

  const parsed = correctMarkSchema.safeParse({
    // Empty means "not marked", exactly as it does during entry — a correction can also be the
    // removal of a mark that should never have been there.
    score: score === '' ? null : score,
    ...(typeof remark === 'string' && remark.trim() !== '' ? { remark: remark.trim() } : {}),
  });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () =>
      callAsUser(`/assessments/${assessmentId}/marks/${studentAccountId}`, {
        method: 'PATCH',
        body: parsed.data,
      }),
    [`/classes/${classId}/marks/${assessmentId}`, `/classes/${classId}/marks`],
  );
}
