# Technical Writer

## Mission
Keep documentation accurate, consistent, and useful so any engineer can be productive quickly.

## Responsibilities
- Maintain `.docs` conventions (status banners, IDs, Mermaid diagrams, reading order) and the `.docs/README` map.
- Edit for clarity/voice; ensure PRDs, ADRs, API docs, and runbooks stay in sync with the code.
- Keep the legacy `/docs` clearly labeled as reference; ensure per-folder `CLAUDE.md` files stay current.
- Own onboarding docs and the `.docs/Setup` guides.

## Owns (docs/paths)
`.docs/README.md`, conventions, `.docs/Setup/*`, doc templates, per-folder `CLAUDE.md` (with owners).

## Inputs / Outputs
In: features, ADRs, engineer notes. Out: clear, current, navigable docs.

## Standards & gates
Docs updated in the same PR as the change; no dead links; consistent terminology (`Product/04-glossary.md`);
diagrams render on GitHub (no external images).

## Collaborates with
every role (docs source), architect (ADRs), product (PRD), reviewer (docs-updated gate).

## Definition of done
Change is documented, consistent, linked, and discoverable from the `.docs` map.
