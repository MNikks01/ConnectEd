'use server';

/**
 * Server Actions for the school portal.
 *
 * Every one of these returns a result object rather than throwing. A thrown Server Action shows
 * the user a generic error boundary and loses what they typed; returning `{ ok: false, message }`
 * lets the form re-render with the message next to the control that caused it.
 *
 * **These are not the security boundary.** Each calls the API, which authorizes independently —
 * a Server Action is reachable by anyone who can reach the app, so treating one as trusted because
 * "only the portal calls it" is exactly the mistake this rebuild exists to correct.
 */
import {
  allocateClassTeacherSchema,
  reviewFeedbackSchema,
  createClassSchema,
  createEventSchema,
  createNoticeSchema,
  createSubjectSchema,
  updateSchoolProfileSchema,
  verificationDecisionSchema,
} from '@connected/types';
import { revalidatePath } from 'next/cache';

import { apiErrorMessage, apiFieldErrors, callAsUser } from '@/lib/server-api';

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const OK: ActionResult = { ok: true };

/** Runs a mutation, mapping both zod and API failures onto the form-friendly result shape. */
async function run(mutate: () => Promise<unknown>, revalidate: string[]): Promise<ActionResult> {
  try {
    await mutate();
    for (const path of revalidate) revalidatePath(path);
    return OK;
  } catch (error) {
    return {
      ok: false,
      message: apiErrorMessage(error),
      fieldErrors: apiFieldErrors(error),
    };
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

export async function updateSchoolProfileAction(
  schoolId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateSchoolProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/schools/${schoolId}`, { method: 'PATCH', body: parsed.data }),
    ['/school'],
  );
}

export async function createClassAction(
  schoolId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createClassSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/schools/${schoolId}/classes`, { method: 'POST', body: parsed.data }),
    ['/school/classes'],
  );
}

export async function setClassActiveAction(
  classId: string,
  active: boolean,
): Promise<ActionResult> {
  return run(
    () => callAsUser(`/classes/${classId}`, { method: 'PATCH', body: { active } }),
    ['/school/classes'],
  );
}

export async function createSubjectAction(
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createSubjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/classes/${classId}/subjects`, { method: 'POST', body: parsed.data }),
    [`/school/classes/${classId}`],
  );
}

export async function allocateClassTeacherAction(
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = allocateClassTeacherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/classes/${classId}/class-teacher`, { method: 'POST', body: parsed.data }),
    [`/school/classes/${classId}`],
  );
}

export async function revokeMemberAction(
  schoolId: string,
  accountId: string,
): Promise<ActionResult> {
  return run(
    () => callAsUser(`/schools/${schoolId}/members/${accountId}`, { method: 'DELETE' }),
    ['/school/members'],
  );
}

export async function decideVerificationAction(
  requestId: string,
  decision: 'APPROVE' | 'REJECT',
): Promise<ActionResult> {
  const parsed = verificationDecisionSchema.safeParse({ decision });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/verifications/${requestId}/decision`, { method: 'POST', body: parsed.data }),
    ['/school/verifications'],
  );
}

export async function publishNoticeAction(
  schoolId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createNoticeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/schools/${schoolId}/notices`, { method: 'POST', body: parsed.data }),
    ['/school/notices'],
  );
}

export async function deleteNoticeAction(noticeId: string): Promise<ActionResult> {
  return run(() => callAsUser(`/notices/${noticeId}`, { method: 'DELETE' }), ['/school/notices']);
}

export async function createEventAction(
  schoolId: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);

  // `datetime-local` gives `2026-08-01T09:00`, which `z.iso.datetime()` rejects for want of
  // seconds and a zone. Converting here keeps the error the school sees about *their* input.
  const eventAt =
    typeof raw.eventAt === 'string' && raw.eventAt.trim() !== ''
      ? new Date(raw.eventAt).toISOString()
      : '';

  const parsed = createEventSchema.safeParse({ ...raw, eventAt });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/schools/${schoolId}/events`, { method: 'POST', body: parsed.data }),
    ['/school/events'],
  );
}

export async function deleteEventAction(eventId: string): Promise<ActionResult> {
  return run(() => callAsUser(`/events/${eventId}`, { method: 'DELETE' }), ['/school/events']);
}

/**
 * Uploading a class timetable (FR-ACAD-020).
 *
 * Two calls, in order: the file goes to the media endpoint, which validates the bytes and returns
 * an opaque key, and only then is the key attached to the class. Doing it the other way round
 * would leave a timetable row pointing at an object that failed validation.
 *
 * The orphan case is the reverse and is accepted for now: an upload that succeeds followed by an
 * attach that fails leaves an unreferenced object in the bucket. Collecting those is a known gap
 * carried from S2-0a rather than something this action can fix alone.
 */
/**
 * Publishing a structured week (FR-ACAD-021).
 *
 * The draft arrives as JSON in one field rather than as indexed form fields, because a week is a
 * list of objects and reassembling `periods[3][startsAt]` on this side is more code and more ways
 * to be wrong than one `JSON.parse`.
 *
 * Nothing here validates the week beyond it being a non-empty array. Overlaps, unknown subjects,
 * backwards periods and everything else are the API's to refuse — this is a browser, and a check
 * here would be a second opinion that can be skipped by anyone who wants to.
 */
export async function publishTimetableAction(
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get('periods');

  let periods: unknown;
  try {
    periods = JSON.parse(typeof raw === 'string' ? raw : '[]');
  } catch {
    return {
      ok: false,
      message: 'That timetable could not be read. Try adding the periods again.',
    };
  }

  if (!Array.isArray(periods) || periods.length === 0) {
    return { ok: false, message: 'Add at least one period before publishing.' };
  }

  return run(async () => {
    await callAsUser(`/classes/${classId}/timetable`, {
      method: 'POST',
      body: { periods },
    });
  }, [`/school/classes/${classId}`, `/classes/${classId}`, `/classes/${classId}/timetable`]);
}

export async function uploadTimetableAction(
  classId: string,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Choose an image to upload.', fieldErrors: { file: 'Required.' } };
  }

  return run(async () => {
    const media = new FormData();
    media.set('file', file);

    const stored = await callAsUser<{ key: string }>('/media/timetables', {
      method: 'POST',
      body: media,
    });

    await callAsUser(`/classes/${classId}/timetable`, {
      method: 'POST',
      body: { imageKey: stored.key },
    });
  }, [`/school/classes/${classId}`, `/classes/${classId}`]);
}

/** The school moves a complaint forward (FR-WF-011). */
export async function reviewFeedbackAction(
  feedbackId: string,
  status: 'UNDER_REVIEW' | 'RESOLVED',
): Promise<ActionResult> {
  const parsed = reviewFeedbackSchema.safeParse({ status });
  if (!parsed.success) return invalid(parsed.error);

  return run(
    () => callAsUser(`/feedback/${feedbackId}/review`, { method: 'POST', body: parsed.data }),
    ['/school/complaints'],
  );
}

export interface BulkDecisionResult extends ActionResult {
  decided?: number;
  failed?: { requestId: string; reason: string }[];
}

/**
 * Deciding several verification requests at once (FR-VER-009).
 *
 * Returns the counts rather than `ok` alone, because the interesting outcome is partial: a school
 * that approved thirty of forty needs to see the ten, and a plain success would say the opposite
 * of what happened.
 */
export async function decideVerificationsAction(
  requestIds: string[],
  decision: 'APPROVE' | 'REJECT',
): Promise<BulkDecisionResult> {
  try {
    const result = await callAsUser<{
      decided: string[];
      failed: { requestId: string; reason: string }[];
    }>('/verifications/decisions', { method: 'POST', body: { requestIds, decision } });

    revalidatePath('/school/verifications');
    revalidatePath('/school/members');

    return { ok: true, decided: result.decided.length, failed: result.failed };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}
