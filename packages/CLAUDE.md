# CLAUDE.md — `packages`

Shared workspace packages consumed by `apps/web` and `apps/api`.

| Package  | Purpose                                                                                                                                             | Notes                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `types`  | Shared DTOs, enums, and the permission-matrix types. **Derived from the API's zod schemas** so client and server can't drift.                       | The single source for request/response shapes. Import here instead of redefining. |
| `ui`     | Design system: tokens (color/typography/spacing/elevation) + primitives (button/form/modal/table/notification). Theme-aware + responsive + WCAG AA. | Owned by the ui-designer charter; consumed by `apps/web` (and mobile later).      |
| `config` | Shared `tsconfig` base, ESLint config (incl. import-boundary rules), Prettier config.                                                               | Every app/package extends these — one source for tooling.                         |

## Rules

- Packages must stay **framework-agnostic where possible** (`types`, `config` have no React/Express deps).
- No circular deps between packages; apps depend on packages, never the reverse.
- Changes to `types` that affect the API contract are **breaking** — coordinate API + web in the same PR
  (the monorepo exists for exactly this) and add a changeset.
- `ui` components are tokenized (no magic values), accessible, and theme-aware in light/dark.

Each package has (or will have) its own `package.json`; add a package-level `CLAUDE.md` if its rules grow.
