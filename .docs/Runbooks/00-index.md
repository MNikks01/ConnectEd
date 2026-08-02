# Runbooks — Index

`Status: Accepted` · `Last updated: 2026-08-02`

Operational playbooks for on-call. Every alert links here. Each runbook: **symptoms → diagnosis → mitigation →
resolution → follow-up**.

| Runbook                                          | Covers                                |
| ------------------------------------------------ | ------------------------------------- |
| [`api-outage.md`](./api-outage.md)               | API 5xx / down / high latency         |
| [`db-restore.md`](./db-restore.md)               | Postgres failure, restore, PITR       |
| [`redis-outage.md`](./redis-outage.md)           | Cache/queue down                      |
| [`jwt-key-rotation.md`](./jwt-key-rotation.md)   | Rotating the token signing key        |
| [`queue-backlog.md`](./queue-backlog.md)         | Notification/job backlog & DLQ        |
| [`incident-response.md`](./incident-response.md) | Sev classification, comms, postmortem |

## On-call basics

- Ack the page; open the linked dashboard; establish a `correlationId`/trace to anchor investigation.
- Communicate early in the incident channel (status, impact, ETA).
- Prefer **mitigate first** (rollback/scale/flag off), diagnose after.
- Every Sev1/Sev2 gets a blameless **postmortem** within 3 business days.
