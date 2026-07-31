# CLAUDE.md — `.docs`

Engineering documentation. **Source of truth** for the ConnectEd rebuild (the root `docs/` is legacy reference
only).

## Editing rules

- Every doc opens with a status banner: `Status: Draft | In Review | Accepted | Superseded` + `Last updated`.
- Filenames: `NN-kebab-title.md`; `00-` is the folder index. ADRs: `NNNN-title.md`.
- IDs: functional `FR-<MODULE>-NNN`, non-functional `NFR-NNN`, decisions `ADR-NNNN`.
- Diagrams: Mermaid fenced blocks only (must render on GitHub; no external images).
- Keep terminology aligned with [`Product/04-glossary.md`](Product/04-glossary.md).
- **ADRs are immutable once Accepted** — supersede with a new ADR, don't rewrite history.
- Update docs in the **same PR** as the code they describe; no dead links.

## Map

Start at [`README.md`](README.md). Folders: Product, PRD, TRD, Architecture, ADR, API, Database, Security,
Deployment, CI-CD, Monitoring, UserFlows, Wireframes, Runbooks, Research, Sprint, MeetingNotes, Checklists, Setup.

## When you change behaviour

- New/changed endpoint → update [`API/03-endpoints.md`](API/03-endpoints.md) and, if scoped, the
  [permission matrix](PRD/09-permissions-matrix.md).
- Schema change → [`Database/`](Database/).
- Significant decision → a new [`ADR/`](ADR/).
- Owner for consistency: the `technical-writer` charter ([`../.agents/technical-writer.md`](../.agents/technical-writer.md)).
