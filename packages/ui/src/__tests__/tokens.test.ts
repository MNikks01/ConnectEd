/**
 * Contrast and token-parity tests.
 *
 * The design system claims WCAG 2.1 AA. A claim nothing checks decays the first time someone
 * nudges a colour to "look a bit softer", and the regression is invisible in review — a hex diff
 * looks harmless. These tests make the claim executable:
 *
 * - every foreground/background pair that can occur meets its AA threshold, in **both** themes
 * - `tokens.ts` and `tokens.css` hold the same values, so "single source of truth" stays true
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { contrastRatio, darkPalette, lightPalette, palettes, type ThemePalette } from '../tokens';

/** 4.5:1 for normal text (1.4.3); 3:1 for non-text UI boundaries (1.4.11). */
const TEXT = 4.5;
const NON_TEXT = 3;

interface Pair {
  label: string;
  foreground: keyof ThemePalette;
  background: keyof ThemePalette;
  minimum: number;
}

const PAIRS: Pair[] = [
  { label: 'body text on page', foreground: 'text', background: 'bg', minimum: TEXT },
  { label: 'body text on card', foreground: 'text', background: 'surface', minimum: TEXT },
  { label: 'muted text on page', foreground: 'textMuted', background: 'bg', minimum: TEXT },
  { label: 'muted text on card', foreground: 'textMuted', background: 'surface', minimum: TEXT },
  { label: 'primary button label', foreground: 'accentText', background: 'accent', minimum: TEXT },
  { label: 'link on page', foreground: 'accent', background: 'bg', minimum: TEXT },
  { label: 'link on card', foreground: 'accent', background: 'surface', minimum: TEXT },
  { label: 'error text on page', foreground: 'danger', background: 'bg', minimum: TEXT },
  { label: 'error text on card', foreground: 'danger', background: 'surface', minimum: TEXT },
  { label: 'danger alert text', foreground: 'danger', background: 'dangerSurface', minimum: TEXT },
  {
    label: 'success alert text',
    foreground: 'success',
    background: 'successSurface',
    minimum: TEXT,
  },
  {
    label: 'warning alert text',
    foreground: 'warning',
    background: 'warningSurface',
    minimum: TEXT,
  },
  // The control boundary, not the decorative one — this is the pair that caught a real failure.
  {
    label: 'input border on page',
    foreground: 'borderStrong',
    background: 'bg',
    minimum: NON_TEXT,
  },
  {
    label: 'input border on card',
    foreground: 'borderStrong',
    background: 'surface',
    minimum: NON_TEXT,
  },
  { label: 'focus ring on page', foreground: 'accent', background: 'bg', minimum: NON_TEXT },
  { label: 'focus ring on card', foreground: 'accent', background: 'surface', minimum: NON_TEXT },
];

describe.each(Object.entries(palettes))('%s theme meets WCAG AA', (themeName, palette) => {
  it.each(PAIRS)('$label', ({ foreground, background, minimum, label }) => {
    const ratio = contrastRatio(palette[foreground], palette[background]);

    expect(
      ratio,
      `${themeName}: ${label} — ${palette[foreground]} on ${palette[background]} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
    ).toBeGreaterThanOrEqual(minimum);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('returns 1 for a colour against itself', () => {
    expect(contrastRatio('#1a5fb4', '#1a5fb4')).toBeCloseTo(1, 5);
  });

  it('is symmetric — order of arguments must not matter', () => {
    expect(contrastRatio('#16191d', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#16191d'),
      10,
    );
  });
});

describe('tokens.ts and tokens.css agree', () => {
  const css = readFileSync(fileURLToPath(new URL('../tokens.css', import.meta.url)), 'utf8');

  /** Reads a custom property out of a specific block, since light and dark both declare them. */
  function cssValue(block: string, property: string): string | undefined {
    const start = css.indexOf(block);
    if (start === -1) return undefined;

    const section = css.slice(start, css.indexOf('}', start));
    return new RegExp(`--ui-${property}:\\s*([^;]+);`).exec(section)?.[1]?.trim();
  }

  const PROPERTIES: [keyof ThemePalette, string][] = [
    ['bg', 'bg'],
    ['surface', 'surface'],
    ['text', 'text'],
    ['textMuted', 'text-muted'],
    ['border', 'border'],
    ['borderStrong', 'border-strong'],
    ['accent', 'accent'],
    ['accentText', 'accent-text'],
    ['danger', 'danger'],
    ['success', 'success'],
    ['warning', 'warning'],
  ];

  it.each(PROPERTIES)('light: %s', (key, property) => {
    expect(cssValue(':root {', property)).toBe(lightPalette[key]);
  });

  it.each(PROPERTIES)('dark: %s', (key, property) => {
    expect(cssValue(":root[data-theme='dark'] {", property)).toBe(darkPalette[key]);
  });
});
