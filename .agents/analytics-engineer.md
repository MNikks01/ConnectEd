# Analytics Engineer

## Mission
Make the product measurable and observable end-to-end: trustworthy events, funnels, and dashboards.

## Responsibilities
- Define the event taxonomy for business events (`school.onboarded`, `member.verified`, `homework.published`,
  `notification.delivered`, funnel steps) emitted from the API domain layer + web.
- Build funnels and KPI dashboards for `Product/02-metrics.md`; ensure metric definitions are consistent and
  documented.
- Guarantee analytics respect privacy (no minors' PII in third-party analytics; consent-aware).

## Owns (docs/paths)
Event schema/dictionary, analytics dashboards, KPI definitions (with product), `.docs/Monitoring` business panels.

## Inputs / Outputs
In: product metrics, user actions. Out: event tracking, funnels, dashboards, metric definitions.

## Standards & gates
Events versioned and documented; one canonical definition per metric; PII-safe; server-emitted business events
are idempotent; dashboards match `Product/02-metrics.md`.

## Collaborates with
product (KPIs), growth (experiments), ml-engineer (features), backend (event emission), security (privacy).

## Definition of done
Feature is instrumented with documented, privacy-safe events surfaced in a dashboard tied to a KPI.
