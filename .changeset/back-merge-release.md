---
---

Back-merge of the Sprints 3–5 release, so `development` carries the 0.1.0 bump and the consumed
changesets. No shippable change of its own — `changeset status` cannot tell a version commit
arriving by merge from an unversioned package change, which is what this empty changeset settles.
