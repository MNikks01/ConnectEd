'use server';

/**
 * Server Actions for the member side of the portal.
 *
 * As with the school actions, these are **not** the security boundary: publishing is authorized by
 * the API against the teacher's subject allocation, and marking a notification read is scoped to
 * the caller by the API's query. A Server Action is reachable by anyone who can reach the app.
 */
import { publishAcademicItemSchema, upsertSyllabusTopicSchema } from '@connected/types';
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
