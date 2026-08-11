'use client';

/**
 * Choosing a language.
 *
 * A `<select>` with a real label rather than a row of flags. Flags name countries, not languages —
 * Hindi is not a flag — and a two-letter code is not a name. Each option is written in its own
 * language, because somebody looking for Hindi is not reading the English word for it.
 *
 * It submits on change, with no Save button: there is one field, the effect is immediate and
 * visible, and a two-step language switch is a step performed in a language you cannot read.
 */
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { setLocaleAction } from '@/app/actions';
import { useTranslations } from '@/components/locale-provider';
import { isLocale, LOCALES, LOCALE_LABELS } from '@/lib/i18n/locales';

export function LocaleSwitcher() {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="locale-switcher">
      <span className="ui-visually-hidden">{t('locale.change')}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          if (!isLocale(next)) return;

          startTransition(async () => {
            await setLocaleAction(next);
            // The server rendered this page in the old language; every string on it comes from the
            // server, so nothing changes until it is asked again.
            router.refresh();
          });
        }}
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
