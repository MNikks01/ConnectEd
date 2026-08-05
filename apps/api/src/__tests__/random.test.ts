/**
 * Random text from an alphabet, without the modulo bias.
 *
 * Raised by CodeQL against the two-factor recovery codes — `js/biased-cryptographic-random`, high
 * severity — and it was right. `byte % 31` over 256 byte values gives the first eight characters
 * nine byte values each and the other twenty-three only eight, so **those eight come up an eighth
 * more often**. In a credential that stands in for a second factor when somebody has lost their
 * phone, that is a real reduction in entropy rather than a lint nit.
 *
 * The test that matters is the distribution one. A test that only checked "the output is eight
 * characters from the alphabet" passes just as happily on the biased version, which is exactly how
 * this got written in the first place.
 */
import { describe, expect, it } from 'vitest';

import { randomFromAlphabet } from '../shared/auth/random.js';

/** The recovery-code alphabet: base32 without the characters people misread on paper. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Pearson's chi-square against a flat distribution.
 *
 * With 31 categories there are 30 degrees of freedom. A fair generator lands near 30; the biased
 * one this replaces lands near 280 at this sample size. The threshold below sits far above the
 * first and far below the second, so the test is neither flaky nor toothless.
 */
function chiSquare(counts: number[], total: number): number {
  const expected = total / counts.length;
  return counts.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
}

describe('randomFromAlphabet', () => {
  it('returns the requested length from the requested alphabet', () => {
    const value = randomFromAlphabet(8, ALPHABET);

    expect(value).toHaveLength(8);
    expect([...value].every((character) => ALPHABET.includes(character))).toBe(true);
  });

  it('is flat across the alphabet', () => {
    const SAMPLES = 100_000;
    const counts = new Array<number>(ALPHABET.length).fill(0);

    for (let drawn = 0; drawn < SAMPLES; drawn += 8) {
      for (const character of randomFromAlphabet(8, ALPHABET)) {
        const index = ALPHABET.indexOf(character);
        counts[index] = (counts[index] ?? 0) + 1;
      }
    }

    const statistic = chiSquare(
      counts,
      counts.reduce((sum, count) => sum + count, 0),
    );

    // 30 degrees of freedom: a fair generator averages 30 and exceeds 90 about once in ten
    // million runs. `byte % 31` scores roughly 280 here, which is what this exists to catch.
    expect(statistic).toBeLessThan(90);
  });

  it('handles an alphabet that does divide 256 without rejecting anything', () => {
    // A power-of-two alphabet has no bias to remove; the guard must not break it.
    const binary = '01';
    const value = randomFromAlphabet(64, binary);

    expect(value).toHaveLength(64);
    expect(/^[01]{64}$/.test(value)).toBe(true);
  });

  it('produces a different value each time', () => {
    const values = new Set(Array.from({ length: 100 }, () => randomFromAlphabet(8, ALPHABET)));

    // 31^8 is about 850 billion, so a collision in a hundred draws means something is very wrong.
    expect(values.size).toBe(100);
  });

  it('refuses an alphabet it cannot sample fairly', () => {
    expect(() => randomFromAlphabet(4, '')).toThrow(/between 1 and 256/);
    expect(() => randomFromAlphabet(4, 'a'.repeat(257))).toThrow(/between 1 and 256/);
  });

  it('handles a single-character alphabet rather than looping forever', () => {
    // Degenerate, and the ceiling arithmetic has to survive it: 256 - (256 % 1) is 256, so nothing
    // is ever rejected.
    expect(randomFromAlphabet(5, 'x')).toBe('xxxxx');
  });
});
