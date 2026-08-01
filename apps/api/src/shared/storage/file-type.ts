/**
 * Image type detection from the file's own bytes.
 *
 * **The declared `Content-Type` is attacker-controlled and must never be trusted.** A caller can
 * label anything `image/png`; if that is all we check, an HTML file with a script in it lands in
 * the bucket and is later served from our domain. Reading the magic bytes is what makes the
 * accepted set real.
 *
 * Deliberately a small hand-written check rather than a dependency: three formats, a few bytes
 * each, and no appetite for a parser in the upload path.
 */

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const EXTENSIONS: Record<AllowedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function extensionFor(type: AllowedImageType): string {
  return EXTENSIONS[type];
}

/** Returns the detected type, or `undefined` when the bytes are not an image we accept. */
export function detectImageType(buffer: Buffer): AllowedImageType | undefined {
  if (buffer.length < 12) return undefined;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (PNG.every((byte, index) => buffer[index] === byte)) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP" — the size field sits between the two markers.
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return undefined;
}
