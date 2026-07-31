# CLAUDE.md — `apps/api`

The ConnectEd API. **Node.js + Express + Prisma (PostgreSQL).** This is the _only_ authority for data and business
logic — clients never touch the DB and never make authorization decisions.

> Status: scaffold. Structure below is the target from [`../../.docs/Architecture/01-modules.md`](../../.docs/Architecture/01-modules.md).

## Module layout

`src/modules/<name>/` each with: `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts`,
plus `*.schema.ts` (zod), `*.types.ts`, `*.events.ts`, `__tests__/`, and `index.ts` (public surface).
Shared cross-cutting code (errors, logger, auth middleware, db client, queue, authz helpers, config) lives in
`src/shared/`.

Modules: `auth · accounts · institution · verification · academics · workflows · social · notifications · billing`.

## Hard rules

1. **Prisma is used only in repositories.** Services depend on repository interfaces.
2. **No business logic in controllers.** Services own domain logic **and authorization**.
3. **Authorize every scoped operation** via the `src/shared/authz` policy helpers (role + verification +
   ownership). Enforce the [permission matrix](../../.docs/PRD/09-permissions-matrix.md).
4. **Validate all input** with zod; map thrown domain errors to the envelope via one global error middleware
   ([`../../.docs/API/02-error-model.md`](../../.docs/API/02-error-model.md)).
5. **Multi-write = transaction.** External side effects (notifications, webhooks) are **idempotent** and go
   through the BullMQ queue, not inline.
6. **Cross-module** calls use the other module's `index.ts` service interface or a domain event — never its
   repository/Prisma models.
7. **Never** store or log plaintext passwords/secrets/PII. argon2id for passwords.

## Commands (after setup)

```bash
pnpm --filter api dev
pnpm --filter api test                 # unit + integration (incl. permission matrix)
pnpm --filter api prisma migrate dev --name <change>
pnpm --filter api prisma studio
```

## Testing gate

Every scoped endpoint ships **positive + negative** permission tests. See the backend checklist
([`../../.docs/Checklists/backend-checklist.md`](../../.docs/Checklists/backend-checklist.md)).
