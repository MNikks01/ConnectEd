/**
 * The token palette as data.
 *
 * `tokens.css` is what the browser uses; this is the same values in a form tests and tooling can
 * read. They are asserted to agree by `__tests__/tokens.test.ts` — a hex changed in one place and
 * not the other fails the build, which is the only thing that keeps a "source of truth" true.
 */

export interface ThemePalette {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
  accentText: string;
  danger: string;
  dangerSurface: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
}

export const lightPalette: ThemePalette = {
  bg: '#ffffff',
  surface: '#f6f7f9',
  text: '#16191d',
  textMuted: '#55606d',
  border: '#d4d9e0',
  borderStrong: '#767f8c',
  accent: '#1a5fb4',
  accentHover: '#164e94',
  accentText: '#ffffff',
  danger: '#b3261e',
  dangerSurface: '#fdecea',
  success: '#1a7f37',
  successSurface: '#e8f5ec',
  warning: '#7a4f00',
  warningSurface: '#fdf3e2',
};

export const darkPalette: ThemePalette = {
  bg: '#101418',
  surface: '#181d23',
  text: '#e9edf2',
  textMuted: '#a0abb8',
  border: '#2f3742',
  borderStrong: '#707c8a',
  accent: '#7fb4f0',
  accentHover: '#9cc6f5',
  accentText: '#0b1017',
  danger: '#f2b8b5',
  dangerSurface: '#2a1614',
  success: '#7ee2a8',
  successSurface: '#10241a',
  warning: '#e8c07d',
  warningSurface: '#2a2011',
};

export const palettes = { light: lightPalette, dark: darkPalette } as const;

export type ThemeName = keyof typeof palettes;

/** Relative luminance per WCAG 2.1. Exported so the contrast test and any audit share one impl. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channel = (offset: number): number => {
    const srgb = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/** WCAG contrast ratio between two hex colours, from 1 (identical) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}
