/**
 * Request schemas for the auth module. These are the only shapes the module accepts.
 *
 * Note what is *absent*: neither registration schema accepts `role`, `status`, or `accountType`.
 * Those are decided by the server. A client that sends them has them stripped by `.parse()`.
 */
import { z } from 'zod';

/**
 * `.docs/Security/01-authentication.md`: length over composition rules, which harm usability
 * without meaningfully improving strength. 12 is the floor; the breach-list check is FR-AUTH-011.
 */
const password = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(256, 'Password must be at most 256 characters.');

const email = z.email('Enter a valid email address.').toLowerCase().trim();

export const registerIndividualSchema = z.object({
  email,
  password,
  fullName: z.string().trim().min(1).max(120),
  handle: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(
      /^[a-z0-9._]+$/,
      'Handle may contain lowercase letters, numbers, dots, and underscores.',
    ),
  mobile: z.string().trim().max(20).optional(),
  gender: z.string().trim().max(40).optional(),
  dob: z.iso.date().optional(),
});

export const registerSchoolSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(200),
  adminName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email,
  // No length constraint on login: rejecting a short password here would leak the policy and
  // turn the endpoint into an oracle for which accounts predate a policy change.
  password: z.string().min(1),
});

/** Mobile clients send the refresh token in the body; web sends it as an httpOnly cookie. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type RegisterIndividualInput = z.infer<typeof registerIndividualSchema>;
export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
