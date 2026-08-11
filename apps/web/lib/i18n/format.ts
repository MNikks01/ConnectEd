/**
 * Dates and numbers, formatted for the reader's locale.
 *
 * These exist because the alternative was found in twenty places: `toLocaleDateString('en-GB')`,
 * hard-coded, on pages whose every other word now comes from a catalogue. A Hindi page with English
 * dates on it is not "mostly translated" — it is the half-translated state that makes a product feel
 * unfinished in exactly the way a school notices.
 *
 * `'en-GB'` was also never right on its own: it is one region's convention, chosen once, and the
 * product's first market is India. Passing the locale through means the choice follows the reader
 * rather than whoever wrote the line.
 *
 * **Not `undefined` either**, which is what most code reaches for. `undefined` means "whatever the
 * browser is set to", and on the shared devices this product runs on — a family tablet, a staffroom
 * machine — that is not the language the person chose here.
 */
import type { Locale } from './locales';

/**
 * The BCP-47 tag each UI locale formats with — **not** the same string as the locale itself.
 *
 * This distinction is easy to miss and the end-to-end suite caught it immediately: bare `'en'`
 * resolves to US conventions, so "Thursday 5 December" became "December 5" the moment dates started
 * following the locale. The product's English is British throughout its copy, and its first market
 * is India; both write the day before the month.
 *
 * Keeping the map here rather than widening `Locale` is deliberate. `Locale` is the *language a
 * person chose* — two values, in a cookie, in a switcher. A formatting tag is a regional
 * convention, and the day this product ships to a market whose English is American, that is a
 * change to one line in this file and to nothing else.
 */
const FORMAT_TAG: Record<Locale, string> = {
  en: 'en-GB',
  hi: 'hi-IN',
};

/** 14 August 2026. The default for anything a person reads rather than scans. */
export function formatDate(value: string | Date, locale: Locale): string {
  return new Date(value).toLocaleDateString(FORMAT_TAG[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** 14 Aug 2026 — for tables and lists, where the long form crowds the column. */
export function formatShortDate(value: string | Date, locale: Locale): string {
  return new Date(value).toLocaleDateString(FORMAT_TAG[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Friday 14 August, 18:30.
 *
 * The weekday is included deliberately: "Friday the 14th" is how a parent thinks about a school
 * event, and a date without it makes them count.
 */
export function formatDateTime(value: string | Date, locale: Locale): string {
  return new Date(value).toLocaleString(FORMAT_TAG[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 18:30 — when the date is already established by its surroundings. */
export function formatTime(value: string | Date, locale: Locale): string {
  return new Date(value).toLocaleTimeString(FORMAT_TAG[locale], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Digits, in the locale's numbering system.
 *
 * Worth having rather than interpolating a raw number: Hindi is written with Western digits in most
 * of India and with Devanagari digits in some contexts, and `Intl` knows which the locale asks for
 * where a template literal does not.
 */
export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return value.toLocaleString(FORMAT_TAG[locale], { maximumFractionDigits: digits });
}
