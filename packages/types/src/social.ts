/**
 * The social layer (`.docs/PRD/06-social.md`).
 *
 * Open to every account type, verified or not — the first module in this product that is not gated
 * by a school's approval.
 */
import { z } from 'zod';

export const ProfileVisibility = {
  PUBLIC: 'PUBLIC',
  CONNECTIONS: 'CONNECTIONS',
} as const;
export type ProfileVisibility = (typeof ProfileVisibility)[keyof typeof ProfileVisibility];

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  bio: z.string().trim().max(1000).nullish(),
  achievements: z.string().trim().max(2000).nullish(),
  displayPicKey: z.string().trim().max(300).nullish(),
  visibility: z.enum(ProfileVisibility).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * What anyone signed in may see: enough to recognise someone and ask to connect, and no more.
 * Returned for every profile regardless of its visibility setting.
 */
export interface ProfileCardResponse {
  accountId: string;
  accountType: 'INDIVIDUAL' | 'SCHOOL';
  displayName: string;
  handle: string | null;
  /** Short-lived signed URL, or null when there is no picture. */
  displayPicUrl: string | null;
}

/**
 * The full profile. `restricted` is true when the caller was shown the card only — stated in the
 * response rather than left as an absence, so a client can say "this profile is private" instead
 * of rendering an empty page.
 */
export interface ProfileResponse extends ProfileCardResponse {
  restricted: boolean;
  bio?: string | null;
  achievements?: string | null;
  /** Only ever present on your own profile. */
  visibility?: ProfileVisibility;
  /** Individuals only; a school has none of these. */
  role?: string | null;
  /** Schools only. */
  city?: string | null;
  about?: string | null;
}
