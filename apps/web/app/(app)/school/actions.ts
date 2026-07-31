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
  createClassSchema,
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
