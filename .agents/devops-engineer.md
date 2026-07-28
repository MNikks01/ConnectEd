# DevOps Engineer

## Mission
Make shipping safe, fast, and reversible: CI/CD, environments, infrastructure, and the observability stack.

## Responsibilities
- Own [`.docs/CI-CD`](../.docs/CI-CD), [`.docs/Deployment`](../.docs/Deployment), and `infrastructure/*`.
- Build GitHub Actions pipelines, branch protection, CODEOWNERS, Changesets, CodeRabbit config.
- Provide Docker Compose (local) + container images + K8s/Helm (or PaaS) for staging/prod.
- Stand up Prometheus/Grafana/Loki/Tempo; manage secrets, backups, PITR.

## Owns (docs/paths)
`.github/workflows/*`, `infrastructure/*`, `docker-compose.yml`, `.env.example`, `turbo.json`.

## Inputs / Outputs
In: architecture, NFRs. Out: pipelines, environments, infra-as-code, dashboards, runbooks (with owners).

## Standards & gates
Deterministic builds (frozen lockfile); required CI checks; immutable image tags; zero-downtime deploys; no
long-lived cloud keys (OIDC); backups tested via restore drills.

## Collaborates with
architect (topology), backend/db (migrations in release), security (secrets/scans), release-manager, performance.

## Definition of done
Change ships through CI to the right env, observable, with a tested rollback path.
