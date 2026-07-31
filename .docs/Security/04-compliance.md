# Security — Privacy & Compliance

`Status: Draft` · `Last updated: 2026-07-28`

ConnectEd handles **minors' data**, raising the compliance bar. Finalize with legal counsel per launch region
(India = DPDP Act; EU = GDPR; US schools = FERPA/COPPA considerations).

## Data governance

| Concern                   | Policy                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Data minimization**     | Collect only what a feature needs; no unnecessary PII.                                                               |
| **Encryption in transit** | TLS 1.2+ everywhere.                                                                                                 |
| **Encryption at rest**    | DB volume encryption; sensitive columns/app-level encryption where warranted.                                        |
| **Retention**             | User content soft-deleted; hard-purge on retention expiry or erasure request. Audit logs retained longer per policy. |
| **Access to PII**         | Least privilege; internal access audited; no prod PII in dev/test (use anonymized seed).                             |
| **Subject rights**        | Export (data portability) and delete (erasure) flows; guardian consent for minors.                                   |
| **Consent**               | Parental/guardian consent recorded for student accounts.                                                             |
| **Breach response**       | Incident runbook + notification obligations (`Runbooks/`).                                                           |

## Regulatory mapping (indicative — confirm with counsel)

- **India DPDP Act 2023** — verifiable parental consent for children, purpose limitation, data-principal rights.
- **GDPR** (if EU users) — lawful basis, DPO/records, DSAR handling, child-data protections.
- **FERPA/COPPA** (if US K-12) — school-official exception, under-13 consent.

## Engineering obligations

- No prod PII in logs; scrub/deny-list sensitive fields in the logger.
- Right-to-be-forgotten implemented as a real, tested workflow (not manual DB edits).
- Data-processing records for third parties (payment/push/email providers) maintained.
- Privacy review is part of the definition-of-done for features touching PII.
