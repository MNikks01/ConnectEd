/**
 * Domain enums, mirroring the database enums in `apps/api/prisma/schema.prisma`
 * (`.docs/Database/00-overview.md`: "Enums in the DB for closed sets … mirrored in
 * `packages/types`").
 *
 * Declared by hand rather than imported from the generated Prisma client, because this package
 * must stay framework- and ORM-agnostic — the web app imports it and has no business pulling in
 * a database client. They are plain string unions, so they compare and assign cleanly against the
 * Prisma-generated types on the server.
 */

export const AccountType = {
  INDIVIDUAL: 'INDIVIDUAL',
  SCHOOL: 'SCHOOL',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const UserRole = {
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
  TEACHER: 'TEACHER',
  PRINCIPAL: 'PRINCIPAL',
  USER: 'USER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const VerificationStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];
