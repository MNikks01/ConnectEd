/**
 * Encrypting a secret at rest — FR-AUTH-012.
 *
 * A TOTP secret is the whole of the second factor. Stored in the clear, a database dump turns
 * two-factor authentication back into one, silently, for everybody enrolled. So it is encrypted
 * with a key that lives in configuration and never in the same table.
 *
 * **Without a key, enrolment is unavailable rather than unprotected.** A feature that quietly
 * degrades to storing second factors in plaintext is worse than one that says it is switched off.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export interface SecretBox {
  seal: (plaintext: string) => string;
  open: (sealed: string) => string;
}

/**
 * The configured key, hashed to exactly 32 bytes.
 *
 * Hashing rather than requiring a 32-byte input: an operator setting this will paste a passphrase,
 * and a length check that rejects it invites them to pad it with spaces.
 */
function keyFrom(material: string): Buffer {
  return createHash('sha256').update(material).digest();
}

export function createSecretBox(keyMaterial: string): SecretBox {
  const key = keyFrom(keyMaterial);

  return {
    seal: (plaintext) => {
      // A fresh IV per encryption. Reusing one under GCM is catastrophic rather than merely
      // untidy — it leaks the XOR of the plaintexts and forges the authentication tag.
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

      return [
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        ciphertext.toString('base64url'),
      ].join(':');
    },

    open: (sealed) => {
      const [iv, tag, ciphertext] = sealed.split(':');
      if (!iv || !tag || !ciphertext) throw new Error('Malformed sealed value.');

      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));

      // Throws on a tampered ciphertext, which is the point of GCM over CBC: a row somebody has
      // edited fails loudly rather than decrypting to rubbish that then gets compared.
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}
