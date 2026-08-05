/**
 * Random text from a chosen alphabet, without the modulo bias.
 *
 * `randomBytes(n)[i] % alphabet.length` is the obvious way to do this and it is wrong whenever the
 * alphabet's length does not divide 256. With 31 characters — a base32 alphabet minus the ones
 * people misread — 256 = 8×31 + 8, so **the first eight characters come up ⅛ more often than the
 * rest**. CodeQL flagged exactly that in the two-factor recovery codes (`js/biased-cryptographic-random`,
 * high severity), and it was right: those codes stand in for a second factor, so any measurable
 * reduction in entropy is a real defect rather than a lint nit.
 *
 * Rejection sampling fixes it: bytes at or above the largest multiple of the alphabet length are
 * thrown away, so every character maps to exactly the same number of byte values. The cost is a
 * few extra bytes of entropy — 8/256 of draws are rejected for a 31-character alphabet — which is
 * nothing next to a credential that is slightly guessable.
 */
import { randomBytes } from 'node:crypto';

export function randomFromAlphabet(length: number, alphabet: string): string {
  if (alphabet.length === 0 || alphabet.length > 256) {
    throw new Error('An alphabet must have between 1 and 256 characters.');
  }

  // The largest multiple of the alphabet length that fits in a byte. Everything at or above it is
  // rejected, because those values would map onto the start of the alphabet a second time.
  const ceiling = 256 - (256 % alphabet.length);
  const out: string[] = [];

  while (out.length < length) {
    // A batch at a time rather than a byte at a time: a syscall per character is a lot of syscalls
    // for something that runs ten times per enrolment, and the rejection rate is known and small.
    for (const byte of randomBytes(length)) {
      if (byte >= ceiling) continue;

      out.push(alphabet[byte % alphabet.length] ?? '');
      if (out.length === length) break;
    }
  }

  return out.join('');
}
