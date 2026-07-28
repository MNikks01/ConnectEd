# ADR-0012 — Modular monolith over microservices (initially)

Status: Accepted
Date: 2026-07-28

## Context

The backend checklist covers both modular-monolith and microservice architectures. For a pre-scale product with
a small team, premature microservices add distributed-systems complexity (network failures, eventual consistency,
deployment/versioning overhead) without payoff.

## Decision

Ship a **modular monolith**: one deployable API with strict internal module boundaries (see
`Architecture/01-modules.md`) and clear service interfaces + domain events between modules. Extract a module into
its own service **only** when it demonstrably needs independent scaling or isolation (candidate first-movers:
`notifications` worker, later `social`/messaging).

## Consequences

- **Positive:** simple deploy/debug/transactions; fast iteration; boundaries already drawn so extraction is
  cheap when justified; a single DB keeps academic/verification writes transactional.
- **Negative:** everything scales together until extracted; discipline required so modules don't leak into each
  other (enforced via boundary rules + lint import restrictions).
- **Follow-ups:** keep modules independently testable; the notification worker already runs as a separate process
  (queue consumer) making it the natural first extraction.

## Alternatives

- **Microservices from day one** — rejected: complexity/cost unjustified at current scale.
- **Single unstructured app** — rejected: becomes a big ball of mud; boundaries are the point.
