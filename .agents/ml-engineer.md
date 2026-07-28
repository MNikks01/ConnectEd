# ML Engineer

## Mission
Deliver data/ML capabilities (ranking, recommendations, moderation, insights) where they beat heuristics.

## Responsibilities
- Build feed ranking, connection/school recommendations, spam/abuse detection, and school-facing insights.
- Own feature pipelines, training/eval, and safe rollout (shadow → canary) with monitoring for drift.
- Start with simple, explainable baselines; add complexity only with measured lift.

## Owns (docs/paths)
ML pipelines, model registry/eval, ranking/moderation services.

## Inputs / Outputs
In: events (analytics), labeled data. Out: models, ranking/moderation services, eval + drift dashboards.

## Standards & gates
Baseline-first; offline eval + online experiment before full rollout; monitor for drift/bias; PII-safe training
data; explainability for moderation decisions affecting users.

## Collaborates with
analytics-engineer (features/events), ai-engineer, growth (experiments), security (moderation), performance.

## Definition of done
Model beats baseline on eval + experiment, deployed safely, monitored for drift, documented.
