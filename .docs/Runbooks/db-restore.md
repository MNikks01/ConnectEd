# Runbook — PostgreSQL Failure & Restore

`Status: Accepted` · `Last updated: 2026-08-08`

Targets: **RTO ≤ 1h, RPO ≤ 15 min** (NFR-014).

## What is true today, before anything below

This runbook was written in Sprint 2 against a managed database with continuous archiving. **There
is no database to run it against yet** — no environment exists (S9-0a, S9-4), so there is no managed
instance, no standby to fail over to, and no WAL archive to recover from. Read the sections below as
the procedure for the day there is one, and this section as what is actually in place.

**What exists and has been run** (S9-7, 2026-08-08): a restore drill,
[`scripts/restore-drill.mjs`](../../scripts/restore-drill.mjs). It takes a real `pg_dump`, restores
it into a scratch database, and compares the row count of every table in both.

```bash
docker compose -f infrastructure/docker/compose.yml up -d
node scripts/restore-drill.mjs
```

Measured on a developer machine against 400,027 rows across 50 tables (185 MB, a 21 MB compressed
dump): **restored and verified in 5.3 seconds**. Sabotage-checked by excluding one table from the
dump, which the drill catches and fails on — that failure mode, a backup that is quietly incomplete,
is the one that turns a backup into a file nobody can use.

**What that number is and is not.** It is the restore half of RTO on a small dataset on one machine.
It is not RTO: noticing, deciding, provisioning an instance and repointing the app are all outside
it, and all of them dominate on a bad morning. Treat 5.3 seconds as evidence that the mechanism
works and the dump is complete, not as a claim about the hour.

**RPO today is unbounded**, because nothing takes a backup on a schedule — the drill takes one when
you run it. The 15-minute target needs continuous archiving, and continuous archiving needs a
provider. Until S9-0a is answered, NFR-014 is **half met**: restore is proven, retention is not.

**The client runs in a `postgres:16` container**, not from the host. A client older than the server
refuses the dump outright, and pinning the client to the server's image removes the most common way
a restore fails at the worst possible moment.

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

**Requires continuous archiving, which does not exist yet.** With only a dump, steps 1 and 2 collapse
into "restore the most recent one", and everything written since it was taken is gone.

1. Identify the target timestamp (just before the incident).
2. Provision a restore from the latest base backup + WAL to that timestamp.
3. Validate the restored data (row counts, spot-check critical tables: `account`, `membership`,
   `verification_request`, `academic_item`).
4. Repoint the app at the restored instance (or promote it).
5. Bring the app out of maintenance; monitor.

Step 3 is what the drill automates, and it is the step most likely to be skipped under pressure —
a restore that ran without error and a restore that brought everything back are different claims.

## After a bad migration specifically

- Prefer **forward-fix** (a new corrective migration) over restore when data is intact.
- Restore only if data integrity is compromised. Never edit an applied migration.

## Follow-up

- Verify backups/WAL archiving are healthy; run a **restore drill** cadence; postmortem; tighten migration gates.

**The cadence needs somewhere to run.** The drill is a script and a CI job today, which proves it
still works; a drill against a database with real data in it is what proves the backups do, and that
waits on S9-4.
