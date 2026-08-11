'use client';

/**
 * The catalogue, made available to client components.
 *
 * **The whole catalogue crosses to the browser, once, in the root layout.** That is a real cost and
 * a deliberate one: the alternative is per-route message splitting, which means every client
 * component declares which namespaces it needs and a forgotten declaration is a missing string at
 * runtime — the exact failure the typed keys were chosen to make impossible. The catalogue is text,
 * it compresses well, and it is served from the same response as the page. If it ever stops being
 * small this is the first thing to split, and the ADR says so.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createTranslator, type Translator } from '@/lib/i18n/translate';

import type { Messages } from '@/lib/i18n/messages/en';
import type { Locale } from '@/lib/i18n/locales';

interface LocaleContextValue {
  locale: Locale;
  messages: Messages;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({
  locale,
  messages,
  children,
}: LocaleContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Throws rather than falling back to English when the provider is missing.
 *
 * A silent fallback would mean a component rendered outside the provider works perfectly in
 * development, where the default locale is English anyway, and shows the wrong language in
 * production to exactly the users the feature is for.
 */
export function useTranslations(): { t: Translator; locale: Locale } {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useTranslations must be used inside <LocaleProvider>.');
  }

  const { locale, messages } = context;

  // Memoised on the catalogue, which changes only when the locale does. Rebuilding the translator
  // on every render would be cheap but would also break referential equality for anything that
  // takes `t` as a dependency.
  const t = useMemo(() => createTranslator(messages), [messages]);

  return { t, locale };
}
