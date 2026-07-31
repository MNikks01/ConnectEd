# Runbook — Incident Response

`Status: Accepted` · `Last updated: 2026-07-28`

## Severity

| Sev      | Definition                                                       | Response                                                             |
| -------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Sev1** | Full outage / data loss / security breach / minors' PII exposure | Page immediately; all-hands; exec + legal (if breach); status comms. |
| **Sev2** | Major feature broken / severe degradation for many users         | Page on-call; dedicated responder; comms.                            |
| **Sev3** | Minor/partial impact, workaround exists                          | Ticket; next business day.                                           |

## Process

1. **Detect & declare** — anyone can declare; set Sev; open incident channel.
2. **Roles** — Incident Commander (coordinates), Comms (updates stakeholders), Ops (hands-on-keyboard).
3. **Mitigate first** — rollback / flag off / scale; restore service before deep root-cause.
4. **Communicate** — regular updates (impact, actions, ETA) to the channel/status page.
5. **Resolve** — confirm metrics back to SLO; close incident.
6. **Postmortem** — blameless, within 3 business days for Sev1/Sev2: timeline, root cause, contributing factors,
   action items with owners + due dates, prevention (alert/guardrail).

## Security incidents / data breach

- Engage security-engineer + legal immediately.
- Preserve evidence (logs/audit trail); rotate compromised secrets/keys; revoke sessions if credentials involved.
- Follow regulatory notification timelines (DPDP/GDPR/etc. per `Security/04-compliance.md`).

## Escalation

On-call → team lead → engineering manager → CTO. Payment/PII/minor-safety incidents escalate on the fast path.
