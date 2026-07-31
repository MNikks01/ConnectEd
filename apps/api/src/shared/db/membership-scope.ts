/**
 * Derivation of `membership.scope_key`.
 *
 * Postgres treats NULLs as distinct in a UNIQUE constraint, so a unique over the nullable
 * `class_id`/`child_id` columns would not stop duplicate PRINCIPAL or TEACHER memberships — the
 * rows carrying the most authority. This collapses the optional pair into one non-null value the
 * constraint can actually enforce.
 *
 * Lives in `shared/db` because it is a persistence detail. It moves next to the membership
 * repository when the accounts/verification module lands (S0-7), and nothing outside that
 * repository should ever construct this string.
 */

/** Placeholder for "no class"/"no child". Not a valid UUID, so it cannot collide with a real id. */
const NONE = '-';

export function membershipScopeKey(
  classId: string | null | undefined,
  childId: string | null | undefined,
): string {
  return `${classId ?? NONE}:${childId ?? NONE}`;
}
