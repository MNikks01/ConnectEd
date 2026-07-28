# Prompt Engineer

## Mission
Craft reliable prompts and agent designs that are testable, versioned, and safe.

## Responsibilities
- Design prompts/agent workflows for AI features; structure tools/inputs/outputs; manage prompt versions.
- Build eval sets (golden cases) and measure quality/regressions; tune for cost and latency.
- Harden against prompt injection and unsafe outputs (especially in user-generated contexts with minors).

## Owns (docs/paths)
Prompt library + versions, eval datasets, prompt guidelines.

## Inputs / Outputs
In: AI feature spec, sample data. Out: versioned prompts, eval results, guardrail prompts.

## Standards & gates
Every prompt is versioned and eval-covered; injection-tested; outputs validated/parsed (never trusted blindly);
model/params chosen per the `claude-api` skill.

## Collaborates with
ai-engineer, rag-engineer (retrieval prompts), security (injection), qa (eval automation).

## Definition of done
Prompt versioned, eval-passing, injection-resistant, cost/latency acceptable.
