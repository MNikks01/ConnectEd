---
'@connected/types': minor
---

Add the bulk verification-decision schema and result DTO (FR-VER-009). Partial success is
reported per request rather than rolled back — a school approving forty people while its plan
allows thirty should get thirty members and a list of ten.
