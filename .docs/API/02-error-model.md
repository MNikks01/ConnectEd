# API — Error Model

`Status: Accepted` · `Last updated: 2026-08-03`

## Envelope

All errors share one shape:

```json
{
  "error": {
    "code": "VERIFICATION_REQUIRED",
    "message": "You must be a verified member of this class.",
    "status": 403,
    "correlationId": "b1f2...",
    "details": [{ "field": "startDate", "issue": "must be before endDate" }]
  }
}
```

- `code` — stable machine-readable string (clients branch on this, never on `message`).
- `message` — human-readable, safe to display; never leaks internals/stack traces.
- `details` — per-field issues. Populated for validation (422), and for `PLAN_LIMIT_EXCEEDED`
  (402), where `field` is the limit's name and `issue` states the cap and the current usage.
- `correlationId` — ties the response to logs/traces.

## Error catalogue (representative)

| code                     | HTTP | Meaning                                                   |
| ------------------------ | ---- | --------------------------------------------------------- |
| `VALIDATION_FAILED`      | 422  | Request failed schema validation (`details` populated).   |
| `UNAUTHENTICATED`        | 401  | Missing/invalid/expired access token.                     |
| `TOKEN_REUSE_DETECTED`   | 401  | Refresh reuse; session family revoked.                    |
| `FORBIDDEN`              | 403  | Authenticated but not permitted.                          |
| `VERIFICATION_REQUIRED`  | 403  | Actor not a verified member for this context.             |
| `SCHOOL_WEB_ONLY`        | 403  | School account attempted mobile login.                    |
| `NOT_FOUND`              | 404  | Resource missing or out of scope.                         |
| `CONFLICT`               | 409  | Duplicate or illegal state transition.                    |
| `PLAN_LIMIT_EXCEEDED`    | 402  | The school's plan has no room left (`details` populated). |
| `FEATURE_NOT_IN_PLAN`    | 402  | The school's plan does not include this feature at all.   |
| `RATE_LIMITED`           | 429  | Too many requests.                                        |
| `DEPENDENCY_UNAVAILABLE` | 503  | DB/Redis/storage/provider down.                           |
| `INTERNAL`               | 500  | Unexpected; correlationId for support.                    |

## `PLAN_LIMIT_EXCEEDED` and `FEATURE_NOT_IN_PLAN` are not authorization failures

Every other refusal in this API means the caller tried to do something they were not permitted to
do. This one means they were entirely entitled to try, and their **school** has run out of room
(FR-BILL-003).

So it breaks the house style deliberately:

- **It explains itself.** Scoped refusals return 404 so ids cannot be probed; this one names the
  limit, the current usage, and that upgrading lifts it. A school that cannot tell why it was
  stopped cannot decide to pay, and hiding a commercial cap protects nothing.
- **It reassures.** The message says nothing you already have is affected, because the limit is
  enforced only at the write that would exceed it — never retroactively.
- **402, not 403**, so a client can branch on "needs a bigger plan" without parsing prose.

The two are separate codes on purpose. _"You have used all five of your classes"_ and _"your plan
has never included this"_ lead to the same remedy but are different sentences, and a client that
cannot tell them apart writes one that is wrong for the other. Both are 402, so a client that only
cares about "needs a bigger plan" can branch once.

**Authorization always runs first.** A school hitting this endpoint for _another_ school gets the
404 it would have got anyway — a 402 there would confirm the other school exists and volunteer what
plan it is on.

## Handling rules

- A single **global error middleware** maps thrown domain errors → envelope. Domain code throws typed errors
  (`AppError` subclasses); it never writes HTTP directly.
- 5xx bodies **never** include stack traces or SQL; those go to logs keyed by `correlationId`.
- 422 always lists field-level `details`.
- Errors are logged with severity + correlationId; 5xx also increments error-rate metrics and may alert.
