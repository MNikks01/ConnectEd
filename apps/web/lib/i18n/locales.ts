/**
 * The locales this product speaks (NFR-016).
 *
 * Two, and the second one is not a hypothetical: `Class.medium` has offered `HINDI` as a teaching
 * medium since Sprint 2, so the product has been modelling a language it could not speak for nine
 * sprints. That is the gap `PRD/10-completeness.md` recorded and this closes.
 */
export const LOCALES = ['en', 'hi'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Where the choice lives (ADR-0021).
 *
 * Not `httpOnly`: the switcher is a client component and reads it to show which language is
 * current. There is nothing to protect — it is a display preference, and an attacker who can set
 * it has achieved changing somebody's language.
 */
export const LOCALE_COOKIE = 'connected_locale';

/** In the language itself. A menu that says "Hindi" in English is for somebody who reads English. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
