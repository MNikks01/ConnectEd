/**
 * The authenticated actor.
 *
 * Deliberately thin: id, account type, role. Verified memberships are **not** cached here, because
 * `.docs/Security/01-authentication.md` requires sensitive operations to re-check against the
 * database rather than trust stale token claims. A membership revoked thirty seconds ago must not
 * still authorize a write.
 */
import type { AccountType, UserRole } from '../../generated/prisma/client.js';

export interface Actor {
  accountId: string;
  accountType: AccountType;
  /** Absent for SCHOOL accounts, which have no role. */
  role?: UserRole;
}
