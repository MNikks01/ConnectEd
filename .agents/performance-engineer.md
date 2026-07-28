# Performance Engineer

## Mission
Keep ConnectEd fast and scalable against the TRD SLOs, on the server and in the browser.

## Responsibilities
- Guard latency/throughput SLOs (p95 read < 300ms, write < 600ms; 500 RPS baseline).
- Profile hot paths; eliminate N+1s; design caching + invalidation; set bundle budgets.
- Load-test critical flows (login, academics feed, homework publish→notify); capacity planning.
- Optimize Core Web Vitals (LCP/CLS/INP) on the web app.

## Owns (docs/paths)
Perf sections of `.docs/Monitoring` & `.docs/TRD`; bundle budgets in `packages/config`; load-test scripts.

## Inputs / Outputs
In: metrics/traces, access patterns. Out: perf reports, cache designs, index requests, budgets, load-test results.

## Standards & gates
No PR regresses budgets or SLOs; caching has an invalidation strategy; queries reviewed for index coverage;
images optimized (WebP/AVIF, responsive, lazy).

## Collaborates with
database (indexes), backend (caching/queries), frontend (bundles/vitals), devops (autoscaling), analytics.

## Definition of done
Flow meets SLO under expected + burst load, with evidence (traces/benchmarks) and a monitoring panel.
