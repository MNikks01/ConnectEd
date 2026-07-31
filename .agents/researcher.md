# Researcher

## Mission

De-risk decisions with time-boxed, evidence-based investigation before we commit.

## Responsibilities

- Run spikes from [`.docs/Research`](../.docs/Research) (real-time transport, payment/push providers, image
  pipeline, RLS, search, deploy platform).
- Compare options with benchmarks/prototypes; produce a recommendation that becomes an ADR.
- Mine the legacy `/docs` for domain constraints without importing legacy design choices.

## Owns (docs/paths)

`.docs/Research/*`, spike prototypes (throwaway branches).

## Inputs / Outputs

In: open questions, constraints. Out: findings docs, recommendations → ADR drafts.

## Standards & gates

Every spike is time-boxed, has a clear question, considers ≥2 options, and ends in a recommendation. Prototypes
are labeled throwaway (not merged as production code).

## Collaborates with

architect (decisions → ADR), product (feasibility), the relevant specialist engineer per spike.

## Definition of done

Question answered with evidence; recommendation made; ADR opened if it's a decision.
