# Runbook — PostgreSQL Failure & Restore

`Status: Accepted` · `Last updated: 2026-07-28`

Targets: **RTO ≤ 1h, RPO ≤ 15 min** (NFR-014).

## Symptoms
- DB unreachable, `/readyz` failing on DB, replication broken, or data corruption suspected.

## Diagnose
1. Is it connectivity (network/credentials/pool exhaustion) vs. the instance being down vs. data corruption?
2. Managed DB console: instance health, CPU/IO, connections, failover status.
3. Replication lag on the read replica.

## Mitigate
- **Connectivity/pool:** restart API pods to reset pools; raise pool limits if saturated; check for a runaway
  query and terminate it.
- **Primary down (managed):** trigger/confirm **failover** to standby; update connection string if not automatic.
- **Suspected corruption / bad migration / data loss:** stop writes (maintenance mode / flag), then **PITR**.

## PITR / restore procedure
1. Identify the target timestamp (just before the incident).
2. Provision a restore from the latest base backup + WAL to that timestamp.
3. Validate the restored data (row counts, spot-check critical tables: `account`, `membership`,
   `verification_request`, `academic_item`).
4. Repoint the app at the restored instance (or promote it).
5. Bring the app out of maintenance; monitor.

## After a bad migration specifically
- Prefer **forward-fix** (a new corrective migration) over restore when data is intact.
- Restore only if data integrity is compromised. Never edit an applied migration.

## Follow-up
- Verify backups/WAL archiving are healthy; run a **restore drill** cadence; postmortem; tighten migration gates.
