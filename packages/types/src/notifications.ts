import { z } from 'zod';

/**
 * Notification DTOs (`.docs/PRD/07-notifications.md`).
 *
 * `payload` is deliberately `unknown` on the wire type: its shape depends on `type`, and the
 * narrowing belongs at the render site where a specific type is being handled. Typing it as `any`
 * would let a renderer read a field that event never carries and print `undefined` to a parent.
 */
export interface NotificationResponse {
  id: string;
  /** The domain event that produced it, e.g. `academic.published`. */
  type: string;
  payload: unknown;
  read: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationResponse[];
  nextCursor: string | null;
  /** Across the whole account, not just this page — it drives the bell. */
  unreadCount: number;
}

/** The payload of an `academic.published` notification, once narrowed. */
export interface AcademicPublishedPayload {
  itemId: string;
  classId: string;
  itemType: string;
  title: string;
}

/**
 * Narrows an unknown payload for rendering. Returns `undefined` rather than throwing — a
 * notification whose payload has drifted should render as a plain line, not break the list.
 */
export function academicPublishedPayload(payload: unknown): AcademicPublishedPayload | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.itemId !== 'string' || typeof candidate.title !== 'string') {
    return undefined;
  }

  return {
    itemId: candidate.itemId,
    classId: typeof candidate.classId === 'string' ? candidate.classId : '',
    itemType: typeof candidate.itemType === 'string' ? candidate.itemType : 'Item',
    title: candidate.title,
  };
}

/**
 * Which categories a person may switch off (FR-NOTIF-006).
 *
 * **Verification and billing are absent, deliberately.** A student who asked to join a school has
 * to be told the answer, and the in-app notification is the only channel that exists — an opt-out
 * there is not a preference, it is a way to never hear back. Billing is the school's contract with
 * us. Everything else is genuinely optional.
 */
export const OPTIONAL_NOTIFICATION_CATEGORIES = [
  'ACADEMIC',
  'NOTICE',
  'EVENT',
  'LEAVE',
  'SOCIAL',
  'MESSAGE',
] as const;

export type OptionalNotificationCategory = (typeof OPTIONAL_NOTIFICATION_CATEGORIES)[number];

export const updateNotificationPrefsSchema = z.object({
  preferences: z
    .array(
      z.object({
        category: z.enum(OPTIONAL_NOTIFICATION_CATEGORIES),
        enabled: z.boolean(),
      }),
    )
    .min(1)
    .max(OPTIONAL_NOTIFICATION_CATEGORIES.length),
});

export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;

export interface NotificationPrefResponse {
  category: OptionalNotificationCategory;
  enabled: boolean;
}
