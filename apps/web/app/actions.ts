'use server';

/**
 * Actions that belong to the shell rather than to any one area of the product.
 */
import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n/locales';

/**
 * Remember a language choice (NFR-016, ADR-0021).
 *
 * A year, because a language is not a session — somebody who chose Hindi in September should not
 * be asked again in October. Not `httpOnly`: the switcher reads it to show which option is
 * current, and there is nothing here worth protecting.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
  // Validated even though the parameter is typed. A Server Action is a public endpoint — the type
  // is a note to the caller, not a check on the request.
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
