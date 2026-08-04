'use server';

/**
 * Server Actions for the moderation console (ADR-0017).
 *
 * **These are not the security boundary.** Each calls the API, which re-reads `is_platform_admin`
 * on every request — a Server Action is reachable by anyone who can reach the app, and treating
 * one as trusted because "only staff see the page" is exactly the mistake this rebuild exists to
 * correct.
 */
import { moderationDecisionSchema } from '@connected/types';
import { revalidatePath } from 'next/cache';

import { apiErrorMessage, callAsUser } from '@/lib/server-api';

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function decideReportAction(
  reportId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = moderationDecisionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { ok: false, message: 'Choose a decision.' };
  }

  try {
    await callAsUser(`/admin/reports/${reportId}/decision`, {
      method: 'POST',
      body: parsed.data,
    });
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }

  // Both: the queue's contents changed, and so did this report.
  revalidatePath('/admin/reports');
  revalidatePath(`/admin/reports/${reportId}`);

  return { ok: true };
}
