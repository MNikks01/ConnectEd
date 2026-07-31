/**
 * Password hashing — argon2id (`.docs/Security/01-authentication.md`).
 *
 * The legacy system stored plaintext in `USER_PWD`/`SCHOOL_PASSWORD`. Reversing that is the whole
 * point of the rebuild, so plaintext never leaves this module: it arrives, it is hashed or
 * verified, and it is never returned, stored, or logged.
 */
import argon2 from 'argon2';

import type { Config } from '../config/index.js';

export interface PasswordHasher {
  hash: (plaintext: string) => Promise<string>;
  verify: (hash: string, plaintext: string) => Promise<boolean>;
  /** Algorithm identifier recorded alongside the hash, so hashes can be upgraded later. */
  readonly algo: string;
}

export function createPasswordHasher(config: Config): PasswordHasher {
  const options = {
    type: argon2.argon2id,
    memoryCost: config.ARGON_MEMORY_KIB,
    timeCost: config.ARGON_ITERATIONS,
    parallelism: config.ARGON_PARALLELISM,
  } as const;

  return {
    algo: 'argon2id',

    hash: (plaintext: string) => argon2.hash(plaintext, options),

    verify: async (hash: string, plaintext: string) => {
      try {
        return await argon2.verify(hash, plaintext);
      } catch {
        // A malformed or truncated hash must read as "wrong password", never as an error that
        // could be distinguished from a genuine mismatch by timing or status code.
        return false;
      }
    },
  };
}
