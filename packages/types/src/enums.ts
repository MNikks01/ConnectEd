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

export const Medium = {
  ENGLISH: 'ENGLISH',
  HINDI: 'HINDI',
} as const;
export type Medium = (typeof Medium)[keyof typeof Medium];

/** The canonical taxonomy from `.docs/PRD/02-institution.md`. Order is display order. */
export const ClassLevel = {
  PRE_NURSERY: 'PRE_NURSERY',
  NURSERY: 'NURSERY',
  KG1: 'KG1',
  KG2: 'KG2',
  CLASS_1: 'CLASS_1',
  CLASS_2: 'CLASS_2',
  CLASS_3: 'CLASS_3',
  CLASS_4: 'CLASS_4',
  CLASS_5: 'CLASS_5',
  CLASS_6: 'CLASS_6',
  CLASS_7: 'CLASS_7',
  CLASS_8: 'CLASS_8',
  CLASS_9: 'CLASS_9',
  CLASS_10: 'CLASS_10',
  CLASS_11: 'CLASS_11',
  CLASS_12: 'CLASS_12',
} as const;
export type ClassLevel = (typeof ClassLevel)[keyof typeof ClassLevel];

export const Section = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
} as const;
export type Section = (typeof Section)[keyof typeof Section];

export const VerificationStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];
