# API — Error Model

`Status: Accepted` · `Last updated: 2026-07-28`

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
- `details` — present for validation (422) with per-field issues.
- `correlationId` — ties the response to logs/traces.

## Error catalogue (representative)

| code                     | HTTP | Meaning                                                 |
| ------------------------ | ---- | ------------------------------------------------------- |
| `VALIDATION_FAILED`      | 422  | Request failed schema validation (`details` populated). |
| `UNAUTHENTICATED`        | 401  | Missing/invalid/expired access token.                   |
| `TOKEN_REUSE_DETECTED`   | 401  | Refresh reuse; session family revoked.                  |
| `FORBIDDEN`              | 403  | Authenticated but not permitted.                        |
| `VERIFICATION_REQUIRED`  | 403  | Actor not a verified member for this context.           |
| `SCHOOL_WEB_ONLY`        | 403  | School account attempted mobile login.                  |
| `NOT_FOUND`              | 404  | Resource missing or out of scope.                       |
| `CONFLICT`               | 409  | Duplicate or illegal state transition.                  |
| `RATE_LIMITED`           | 429  | Too many requests.                                      |
| `DEPENDENCY_UNAVAILABLE` | 503  | DB/Redis/storage/provider down.                         |
| `INTERNAL`               | 500  | Unexpected; correlationId for support.                  |

## Handling rules

- A single **global error middleware** maps thrown domain errors → envelope. Domain code throws typed errors
  (`AppError` subclasses); it never writes HTTP directly.
- 5xx bodies **never** include stack traces or SQL; those go to logs keyed by `correlationId`.
- 422 always lists field-level `details`.
- Errors are logged with severity + correlationId; 5xx also increments error-rate metrics and may alert.
