/**
 * The translator itself. Deliberately about forty lines, and the reasoning is in ADR-0021.
 *
 * **Keys are typed, and that is the whole safety story.** `MessageKey` is a union of every dotted
 * path in the English catalogue, so `t('settings.privacy.titel')` does not compile. The Hindi
 * catalogue is declared `const hi: Messages`, so a missing translation does not compile either —
 * which means "every string has a Hindi version" is checked by `tsc` rather than by somebody
 * remembering to look. That is the property worth having: a half-translated interface is the
 * failure mode of every i18n effort, and it is invisible until a user meets it.
 */
import type { Messages } from './messages/en';

/** Every dotted path through a nested catalogue whose leaves are strings. */
export type MessageKey = Paths<Messages>;

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

export type Vars = Record<string, string | number>;

export type Translator = (key: MessageKey, vars?: Vars) => string;

function lookup(messages: Messages, key: string): string | undefined {
  let current: unknown = messages;

  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

export function createTranslator(messages: Messages): Translator {
  return (key, vars) => {
    // The types make a miss impossible at compile time; this is what happens if one gets through
    // anyway — a stale key in a catalogue loaded at runtime, say. The key is shown rather than an
    // empty string, because a blank label is a bug nobody can diagnose from a screenshot.
    const template = lookup(messages, key) ?? key;

    if (!vars) return template;

    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}
