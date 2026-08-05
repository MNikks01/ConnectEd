/**
 * Auth request schemas and response DTOs — the single definition both sides use.
 *
 * These live here rather than in `apps/api` so the client cannot drift from the server: the web
 * app's forms validate against the *same* zod schemas the API validates against, and a change to
 * one is a change to both. Apps depend on packages, never the reverse
 * (`packages/CLAUDE.md`), so this file must stay free of Express, React, and Prisma imports.
 */
import { z } from 'zod';

import type { AccountType, UserRole } from './enums.js';

/**
 * `.docs/Security/01-authentication.md`: length over composition rules, which harm usability
 * without meaningfully improving strength. 12 is the floor.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(256, 'Password must be at most 256 characters.');

export const emailSchema = z.email('Enter a valid email address.').toLowerCase().trim();

export const handleSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9._]+$/, 'Handle may contain lowercase letters, numbers, dots, and underscores.');

/**
 * A six-digit authenticator code, or an eight-character recovery code (FR-AUTH-012).
 *
 * Both accepted at the same field. Somebody whose phone is in a river should not have to find a
 * different form, and the server can tell them apart by shape.
 */
export const twoFactorCodeSchema = z
  .string()
  .trim()
  .min(6, 'Enter the code from your authenticator.')
  .max(16);

export const confirmTwoFactorSchema = z.object({ code: twoFactorCodeSchema });

export const twoFactorLoginSchema = z.object({
  challengeToken: z.string().min(1),
  code: twoFactorCodeSchema,
});

export interface TwoFactorEnrolmentResponse {
  /** What the authenticator scans. Contains the secret; never log it. */
  otpauthUri: string;
  /** The same secret, for keying in by hand when a camera will not focus. */
  secret: string;
}

export interface TwoFactorConfirmedResponse {
  /** Shown once, never again. Stored hashed the moment they leave here. */
  recoveryCodes: string[];
}

/** What a login returns when the password was right and a code is still owed. */
export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  challengeToken: string;
  expiresInSeconds: number;
}

export type ConfirmTwoFactorInput = z.infer<typeof confirmTwoFactorSchema>;
export type TwoFactorLoginInput = z.infer<typeof twoFactorLoginSchema>;

/**
 * Asking for a reset link (FR-AUTH-009).
 *
 * An address and nothing else. The response is the same whether or not it is registered, so there
 * is nothing else the server could usefully be told here.
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

/**
 * Spending a reset token.
 *
 * The new password goes through the same strength rules as registration. A reset flow with weaker
 * requirements than sign-up is a documented way to end up with weak passwords, since it is the
 * path somebody takes when they are frustrated and in a hurry.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'That reset link is not valid.'),
  password: passwordSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Note what is absent: no `role`, `status`, or `accountType`. Those are the server's to decide,
 * and `.parse()` strips them, so a client cannot self-assign privilege.
 */
export const registerIndividualSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(120),
  handle: handleSchema,
  mobile: z.string().trim().max(20).optional(),
  gender: z.string().trim().max(40).optional(),
  dob: z.iso.date().optional(),
});

export const registerSchoolSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(200),
  adminName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // No length constraint here: rejecting a short password would leak the policy and turn login
  // into an oracle for which accounts predate a policy change.
  password: z.string().min(1, 'Enter your password.'),
});

/** Mobile clients send the refresh token in the body; web uses an httpOnly cookie. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type RegisterIndividualInput = z.infer<typeof registerIndividualSchema>;
export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  /** Present for mobile clients only; web receives an httpOnly cookie instead. */
  refreshToken?: string;
}

export interface CurrentAccountResponse {
  id: string;
  email: string;
  accountType: AccountType;
  status: string;
  emailVerified: boolean;
  /** ConnectEd staff (ADR-0017). Navigation only — the API authorizes every call independently. */
  isPlatformAdmin: boolean;
  role: UserRole | null;
  fullName: string | null;
  handle: string | null;
  schoolName: string | null;
}
