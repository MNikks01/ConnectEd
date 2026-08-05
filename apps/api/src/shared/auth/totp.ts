/**
 * TOTP (RFC 6238) and the base32 it travels in (RFC 4648) — FR-AUTH-012.
 *
 * **Written rather than depended on**, which is the less usual choice and worth defending. TOTP is
 * HMAC-SHA1 over a counter with a documented truncation: about forty lines, entirely from Node's
 * own crypto, and — the deciding point — **the RFC publishes test vectors**. So this is verified
 * against the specification itself rather than against the behaviour of whichever version of a
 * package happened to be installed. A second factor is a poor place to add supply-chain surface
 * for forty lines.
 *
 * SHA-1 is not a mistake here. RFC 6238 specifies it, every authenticator app implements it, and
 * the property TOTP needs from HMAC-SHA1 is unaffected by SHA-1's collision weaknesses.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Thirty seconds, as every authenticator assumes. */
export const TOTP_STEP_SECONDS = 30;

/**
 * How many steps either side of now are accepted.
 *
 * One, meaning a ninety-second window. Zero would reject a code typed four seconds too late,
 * which is most of them; more than one widens the guessing surface for no usability gain.
 */
export const TOTP_WINDOW = 1;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

  // No padding. Authenticator apps accept it either way, and an unpadded secret is one less thing
  // for somebody to mistype when they are keying it in by hand because the camera will not focus.
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error('Not valid base32.');

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** A fresh 160-bit secret, which is what RFC 4226 recommends and what authenticators expect. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for a given counter step. Exported for the RFC's test vectors. */
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buffer = Buffer.alloc(8);
  // A 64-bit counter written as two 32-bit halves: JavaScript numbers cannot hold the top bits
  // exactly, and writeBigUInt64BE would need a BigInt for a value that never exceeds 2^53 here.
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac('sha1', secret).update(buffer).digest();

  // Dynamic truncation, RFC 4226 §5.4.
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    (((digest[offset + 1] ?? 0) & 0xff) << 16) |
    (((digest[offset + 2] ?? 0) & 0xff) << 8) |
    ((digest[offset + 3] ?? 0) & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function totp(secret: string, at: Date = new Date(), digits = 6): string {
  const counter = Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
  return hotp(base32Decode(secret), counter, digits);
}

/**
 * Whether a code is right for now, or for a step either side of it.
 *
 * Compared in constant time. The comparison is over six digits from an attacker who is already
 * guessing, so the timing channel is not the weak part — but a credential comparison that leaks
 * its progress is a habit worth not having.
 */
export function verifyTotp(secret: string, code: string, at: Date = new Date()): boolean {
  const candidate = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(candidate)) return false;

  const counter = Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
  const key = base32Decode(secret);

  let matched = false;
  for (let drift = -TOTP_WINDOW; drift <= TOTP_WINDOW; drift += 1) {
    const expected = Buffer.from(hotp(key, counter + drift));
    const given = Buffer.from(candidate);

    // No early exit: every step is checked whatever the outcome, so the time taken says nothing
    // about which one matched.
    if (expected.length === given.length && timingSafeEqual(expected, given)) matched = true;
  }

  return matched;
}

/** The URI an authenticator app scans. The secret is in it; it is never logged. */
export function otpauthUri(params: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: String(TOTP_STEP_SECONDS),
  });

  return `otpauth://totp/${label}?${query.toString()}`;
}
