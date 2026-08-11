/**
 * Reading the locale on the server (ADR-0021).
 *
 * The cookie is the only input. There is deliberately no `Accept-Language` fallback: a header is a
 * guess about a browser, and this product's users share devices — a family tablet, a staffroom
 * machine — so an unasked-for language change on somebody else's session is a likelier outcome
 * than a helpful one. The default is English until a person says otherwise, once.
 */
import { cookies } from 'next/headers';

import en from './messages/en';
import hi from './messages/hi';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './locales';
import { createTranslator, type Translator } from './translate';

import type { Messages } from './messages/en';

const CATALOGUES: Record<Locale, Messages> = { en, hi };

export function messagesFor(locale: Locale): Messages {
  return CATALOGUES[locale];
}

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The server-side translator. Every page and layout that renders copy calls this.
 *
 * Returns the locale alongside the translator because callers that format a date or a number need
 * it too, and reaching for `getLocale()` a second line later is two cookie reads for one fact.
 */
export async function getTranslations(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await getLocale();
  return { t: createTranslator(messagesFor(locale)), locale };
}
