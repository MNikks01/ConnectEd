# CLAUDE.md — `infrastructure`

Infrastructure-as-code and ops configuration. Owned by the `devops-engineer` charter. Design docs:
[`../.docs/Deployment/`](../.docs/Deployment/) and [`../.docs/Monitoring/`](../.docs/Monitoring/).

| Dir               | Contents                                                                         |
| ----------------- | -------------------------------------------------------------------------------- |
| `docker/`         | Multi-stage Dockerfiles for api, web, worker (minimal base, non-root, scanned).  |
| `kubernetes/`     | K8s manifests (deployments, services, HPA, probes) — staging/prod.               |
| `helm/`           | Helm charts packaging the above.                                                 |
| `terraform/`      | Cloud resources (DB, Redis, buckets, networking, secrets).                       |
| `nginx/`          | Reverse-proxy / ingress config.                                                  |
| `prometheus/`     | Scrape configs + alert rules.                                                    |
| `grafana/`        | Dashboards (service, DB, queue, business, RUM) + alerting.                       |
| `loki/`           | Log aggregation config.                                                          |
| `tempo/`          | Distributed-tracing config.                                                      |
| `github-actions/` | Reusable composite actions/workflow fragments referenced by `.github/workflows`. |

## Rules

- **No secrets in this tree.** Secrets come from a secrets manager / CI OIDC at runtime; only references live here.
- Everything is **version-controlled and reviewed** (CODEOWNERS → devops/architect).
- Images: immutable tags, scanned in CI; deploys are zero-downtime (rolling/canary) with a tested rollback.
- Dashboards/alerts are code here — every alert must link to a runbook ([`../.docs/Runbooks/`](../.docs/Runbooks/)).
- Local dev uses `docker-compose.yml` at the repo root (postgres, redis, minio, + observability); this tree is
  for staging/prod topology.
