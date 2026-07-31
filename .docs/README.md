# ConnectEd — Engineering Documentation (`.docs`)

This directory is the **single source of truth for how ConnectEd is built**. It is the forward-looking
engineering counterpart to `/docs` at the repo root, which holds the **legacy reverse-engineered PRD** of the
original Firebase implementation. Where the two disagree, **`.docs` wins** — the product is being rebuilt on a
new stack (Node.js + Express + Prisma + PostgreSQL backend, Next.js frontend, pnpm + Turborepo monorepo).

> **Legacy vs. new.** `/docs/*` describes the _old_ Firebase app (client-only, no server rules, plaintext
> passwords). It is retained as **domain/product reference only**. Every architectural decision that reverses a
> legacy behaviour is recorded as an ADR under [`ADR/`](./ADR/).

## Layout

| Folder                             | Contains                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| [`PRD/`](./PRD/)                   | Product Requirements — what we are building and why, per module.                  |
| [`Product/`](./Product/)           | Vision, personas, metrics, roadmap, glossary.                                     |
| [`TRD/`](./TRD/)                   | Technical Requirements — how the system must behave (non-functional + technical). |
| [`Architecture/`](./Architecture/) | System architecture, C4 views, module boundaries, sequence flows.                 |
| [`ADR/`](./ADR/)                   | Architecture Decision Records (numbered, immutable once accepted).                |
| [`API/`](./API/)                   | REST API contract: resources, endpoints, error model, versioning, auth.           |
| [`Database/`](./Database/)         | Data model, ERD, Prisma schema notes, migrations & RBAC data strategy.            |
| [`Security/`](./Security/)         | Threat model, authN/authZ, secrets, OWASP posture, compliance.                    |
| [`Deployment/`](./Deployment/)     | Environments, infra topology, release process, rollback.                          |
| [`CI-CD/`](./CI-CD/)               | Branching/git flow, pipelines, changesets, code review (CodeRabbit).              |
| [`Monitoring/`](./Monitoring/)     | Observability stack (Prometheus/Grafana/Loki/Tempo), SLOs, alerting.              |
| [`UserFlows/`](./UserFlows/)       | End-to-end flows per role.                                                        |
| [`Wireframes/`](./Wireframes/)     | Low-fidelity screen specs (textual).                                              |
| [`Runbooks/`](./Runbooks/)         | Operational playbooks for incidents.                                              |
| [`Research/`](./Research/)         | Spikes, comparisons, and background research.                                     |
| [`Sprint/`](./Sprint/)             | Sprint plans and ceremonies (Sprint 0 onward).                                    |
| [`MeetingNotes/`](./MeetingNotes/) | Dated meeting notes (template provided).                                          |
| [`Checklists/`](./Checklists/)     | Frontend & backend engineering master checklists (gates).                         |
| [`Setup/`](./Setup/)               | Environment setup, Claude skills/plugins catalogue, onboarding.                   |

## Conventions

- **Filenames**: `NN-kebab-title.md` where `NN` orders reading. `00-` is always the folder's index/overview.
- **Status banner** at the top of every doc: `Status: Draft | In Review | Accepted | Superseded` + `Last updated`.
- **IDs**: Requirements are `FR-<module>-NNN` (functional) / `NFR-NNN` (non-functional). ADRs are `ADR-NNNN`.
- **Diagrams**: Mermaid fenced blocks (renders on GitHub). No external image dependencies.
- **Assumption / Inferred** tags carry the same meaning as in `/docs` when we reference legacy behaviour.

## Reading order for a new engineer

1. [`Product/00-vision.md`](./Product/00-vision.md) → [`Product/01-personas.md`](./Product/01-personas.md)
2. [`PRD/00-overview.md`](./PRD/00-overview.md)
3. [`Architecture/00-overview.md`](./Architecture/00-overview.md) → [`ADR/`](./ADR/) (read all accepted ADRs)
4. [`Database/00-overview.md`](./Database/00-overview.md) → [`API/00-overview.md`](./API/00-overview.md)
5. [`CI-CD/00-git-flow.md`](./CI-CD/00-git-flow.md) → [`Setup/00-getting-started.md`](./Setup/00-getting-started.md)
6. The relevant [`Checklists/`](./Checklists/) before opening your first PR.
