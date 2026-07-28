# Backend Engineering Master Checklist

`Status: Accepted` · `Last updated: 2026-07-28`

Intermediate → Senior → Architect. ConnectEd uses this as a PR/feature gate (see [`00-index.md`](./00-index.md)).

## Level 1 — Intermediate Backend Engineer

### 1. Requirements & Feature Understanding
- [ ] Understand feature/business problem; acceptance criteria; edge & failure cases; success criteria.
- [ ] User journey, expected inputs/outputs, permissions & access rules.

### 2. API Design
- [ ] Proper HTTP methods; consistent naming; clear request/response structures; response consistency; versioning.
- [ ] Pagination, filtering, sorting, search, idempotency where applicable.
- [ ] Status codes: 200/201/204/400/401/403/404/409/422/500 used correctly.

### 3. Database Design
- [ ] Schema, relationships, indexes, constraints; normalization/denormalization considered.
- [ ] Data integrity: consistency, transactions, concurrency, optimistic locking where needed.
- [ ] Query optimization: no N+1, select only needed fields, optimize aggregations/joins.

### 4. Code Quality
- [ ] Meaningful naming; small functions; SRP; DRY; consistent style; no deep nesting.
- [ ] Clean structure: controllers/services/repositories separated; business logic out of controllers; modular.

### 5. Validation
- [ ] Validate body/query/params/headers/uploaded files; sanitize input.
- [ ] Validate responses; remove sensitive data; prevent leakage.

### 6. Authentication & Authorization
- [ ] Password hashing; secure JWT; token expiration; refresh flow + rotation.
- [ ] RBAC; resource-ownership validation; permission checks; admin-only protection.

### 7. Security
- [ ] SQL/NoSQL injection prevention; XSS; CSRF; brute-force protection; rate limiting.
- [ ] Secrets in env; no hardcoded secrets; secure key storage.

### 8. Error Handling
- [ ] Global exception handler; custom error classes; consistent error responses; DB & third-party error
  handling.
- [ ] Retry where appropriate; timeouts; graceful degradation.

### 9. Logging
- [ ] Log requests/failures/warnings/business-critical events. **Never** log passwords/tokens/keys/PII.

### 10. Testing
- [ ] Unit (services/utils/business logic); integration (routes/DB/auth).
- [ ] Edge cases: invalid/missing input, unauthorized, not found, third-party failures.
- [ ] **ConnectEd gate:** positive + negative **permission-matrix** tests for every scoped endpoint.

### 11. Performance
- [ ] Pagination; compression; optimized queries; minimized payloads; no blocking ops.
- [ ] Cache frequently-accessed/expensive data; invalidation strategy.

### 12. Monitoring & Observability
- [ ] Health/readiness/liveness endpoints; metrics (response time, error rate, throughput, DB perf); alerts.

### 13. Documentation
- [ ] Endpoints/requests/responses/auth documented (OpenAPI); setup guide; env vars; deploy instructions;
  architecture overview.

### 14. Git & Deployment (before merge)
- [ ] Tests passing; no debug code/console logs; no secrets; code reviewed.
- [ ] HTTPS; CI/CD; Dockerized; backup strategy.

## Level 2 — Architect / Staff

- [ ] **15. Domain Modeling (DDD):** bounded contexts, aggregates, entities, value objects, domain events; avoid
  anemic models.
- [ ] **16. System Architecture:** monolith vs modular-monolith vs microservices; event-driven eval; service
  boundaries & data ownership; ADRs + diagrams (arch/sequence/data-flow/interaction).
- [ ] **17. Scalability:** capacity planning (DAU/MAU/RPS/storage); stateless services; externalized sessions;
  auto-scaling; DB read replicas/sharding/partitioning eval.
- [ ] **18. Distributed Systems:** event contracts + versioning; DLQ/retry queues; idempotent consumers;
  backpressure; duplicate handling.
- [ ] **19. Reliability:** SLA/SLO/error budget; RTO/RPO; failover/recovery tested; circuit breaker/retry/
  timeout/bulkhead/fallback.
- [ ] **20. Infrastructure:** multi-stage minimal images + scanning; K8s resource limits/requests/autoscale;
  multi-AZ HA + DR.
- [ ] **21. Observability Platform:** centralized logging, correlation/trace IDs; app/DB/infra monitoring;
  distributed tracing + propagation.
- [ ] **22. Security Architecture:** OAuth2/JWT/session strategy; secret rotation/vault/KMS; vuln/dependency
  scans, audits.
- [ ] **23. Data Governance:** retention/archival/deletion/backup; GDPR/DPDP/SOC2/ISO27001/PCI/HIPAA as
  applicable.
- [ ] **24. Release Engineering:** blue-green/canary; feature flags; kill switches; rollback (app + DB) documented
  & tested.
- [ ] **25. Operational Excellence:** runbooks (DB/Redis/queue/API outage); incident response, escalation,
  postmortems.
- [ ] **26. Cost Optimization:** monitor compute/storage/DB/CDN/queue; utilization; cost-per-user/request.

## Final Production Review
- [ ] Architecture decisions/boundaries/ownership documented.
- [ ] Survives service/DB/cache/queue/region failure.
- [ ] Handles 10x/100x traffic; capacity plan exists.
- [ ] Fully observable/monitorable/recoverable; docs & runbooks current; new engineer onboards quickly.
- [ ] Secure · Reliable · Scalable · Observable · Maintainable · Cost-efficient · **Production-ready**.
