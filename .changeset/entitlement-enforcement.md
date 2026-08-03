---
'@connected/types': patch
---

Add `PLAN_LIMIT_EXCEEDED` to the shared error catalogue (402), so a client can branch on "this
school needs a bigger plan" without parsing prose. Enforcement itself is in `@connected/api`
(S5-3), which is private and ignored by changesets.
