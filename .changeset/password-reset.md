---
'@connected/types': minor
---

Add the password-reset schemas (FR-AUTH-009). Somebody who forgot their password had no way back
into their account at all; now there is one, with a 30-minute single-use token that revokes every
session when it is spent.
