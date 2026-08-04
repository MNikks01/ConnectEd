---
---

Billing in the school portal (S5-7): plan, status, usage against each limit, and what happens at
the end of a trial.

Empty frontmatter rather than `'@connected/web': patch`, which is what it said before. `web` is in
the changesets **ignore** list, and an ignored package's changeset is never consumed — so it
survives every `changeset version` and makes the release workflow believe there is something left
to publish, forever. Every other private-package changeset in this repo uses empty frontmatter for
exactly that reason; this one was the exception and it is why the `release` job on `main` tried to
open a Version PR after a release that had already versioned everything.
