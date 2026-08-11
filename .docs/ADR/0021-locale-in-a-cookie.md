# ADR-0021 — The locale is a cookie, and the catalogue is TypeScript

`Status: Accepted` · `Date: 2026-08-11` · Supersedes: — · Superseded by: —

## Context

NFR-016 has asked for externalised copy in English and Hindi since Sprint 2. Nothing was built, and
`PRD/10-completeness.md` recorded it as ⛔ with the sharpest version of the finding: the product
already offers `HINDI` as a teaching medium on every class, so it has been **modelling a language it
cannot speak** for nine sprints.

Two decisions were needed before any string could move.

**Where the locale lives.** The Next.js convention is a route segment — `/hi/settings/privacy` —
which is what the framework's own docs assume and what search engines prefer. It also means every
one of 51 routes moves under a `[locale]` directory, every `redirect()` in the codebase grows a
prefix, every `href` becomes locale-aware, and all 145 end-to-end tests change path. That is a very
large diff whose risk is concentrated in exactly the places a mistake is silent: a redirect that
drops the prefix sends somebody to a page in the wrong language, and nothing errors.

**What a catalogue is.** The default answer is JSON files and a library. The failure mode of that
arrangement is well known and is the one worth engineering against: a key added to English and
forgotten in Hindi is discovered by a Hindi-speaking user, because nothing at build time knows the
two files are meant to agree.

## Decision

**The locale is a cookie, read on the server. The catalogue is a TypeScript object, and every other
locale is typed against English.**

```ts
const hi: Messages = {/* … */};
```

`Messages` is `typeof en`. A missing key does not compile. A key that is a string in English and an
object in Hindi does not compile. `MessageKey` is the union of every dotted path through the
catalogue, so `t('login.titel')` does not compile either. **The completeness of a translation is
checked by `tsc`, which is the property this whole shape exists to buy.**

- `lib/i18n/locales.ts` — the two locales, the cookie name, the labels (each written in its own
  language).
- `lib/i18n/messages/{en,hi}.ts` — the catalogues. English is the schema.
- `lib/i18n/server.ts` — `getTranslations()` for server components.
- `components/locale-provider.tsx` — the catalogue for client components, from the root layout.
- `app/actions.ts` — `setLocaleAction`, which writes the cookie for a year.

**No `Accept-Language` fallback**, and this is a product decision rather than a technical one. The
header is a guess about a browser, and this product's devices are shared — a family tablet, a
staffroom machine. An unasked-for language change on somebody else's session is a likelier outcome
than a helpful one. English until a person says otherwise, once.

**`<html lang>` follows the locale.** Not decoration: it is what tells a screen reader which voice
to use, and Hindi read aloud by an English synthesiser is not accented, it is unintelligible.

## Alternatives considered

**A route segment per locale (`/hi/…`).** The framework-blessed option, and the right one for a
content site. Rejected for the size and shape of the change described above — and specifically
because its risk lands on redirects, which are the part of this codebase that already carries the
session-refresh logic. It is not foreclosed: the cookie can become the fallback for a URL prefix
later without any catalogue or component changing, because nothing outside `lib/i18n` knows where
the locale comes from.

**`next-intl` or `react-i18next`.** Both are good, and both bring a message format this product does
not yet need — no plural categories, no gendered selects, no dates inside strings. What they do not
bring is the compile-time completeness above; that would still have to be added. The dependency
list for this app is six packages, and the whole of `translate.ts` is forty lines.

**JSON catalogues.** Would have to be loaded and typed at runtime, which is exactly the guarantee
being traded away.

## Consequences

**The whole catalogue crosses to the browser on every page.** It is served once from the root
layout, it is text, and it compresses; but it grows with the product, and the first thing to do when
it stops being small is to split it per route group. That is a change inside `LocaleProvider` and
nowhere else.

**No SEO benefit and no shareable localised URL.** A Hindi page and an English page have the same
address, so a crawler sees one language and a link sent to a friend opens in _their_ language rather
than the sender's. For the marketing page this is a real cost, and it is the strongest argument for
revisiting the route-segment option before any public launch.

**Every new string is now two edits.** English and Hindi, in the same pull request, or it does not
build. That is the intended friction: it is much cheaper than the alternative, where the second edit
is discovered by a user.

**The translation is not the same kind of artefact as the code.** `hi.ts` carries a warning at the
top saying it has not been reviewed by a native speaker, and `PRD/10-completeness.md` records
NFR-016 as ◐ rather than ✅ for that reason. Register and politeness level are what a school will
notice, and no amount of type checking has an opinion about them.
