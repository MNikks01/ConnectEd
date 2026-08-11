---
---

The web app speaks Hindi (S9-18, NFR-016, ADR-0021).

`Class.medium` has offered `HINDI` as a teaching medium since Sprint 2, so the product has been
**modelling a language it could not speak** for nine sprints. It can now: a locale cookie, a typed
message catalogue, `<html lang>` following the choice, and a switcher that is reachable both before
signing in and from settings afterwards.

**The catalogue is TypeScript, not JSON, and that is the decision worth knowing.** `Messages` is
`typeof en`, and `const hi: Messages` means a key missing from Hindi does not compile. The
completeness of a translation is checked by `tsc` rather than discovered by a Hindi-speaking user,
which is the failure mode of every i18n effort that keeps its catalogues in JSON.

**Two limits, both recorded rather than glossed.** 15 of 99 page and component files are
externalised so far — the mechanism is proven and the rest is mechanical. And the Hindi has had no
native-speaker review; register and politeness level are what a school will notice, and no amount of
type checking has an opinion about them. `PRD/10-completeness.md` keeps NFR-016 at ◐ for both
reasons.

Writing the browser test found a gap in the feature itself: the language switcher existed only on
the pages you see _before_ signing in, so anybody who chose wrongly had no way back. It is now in
settings too.
