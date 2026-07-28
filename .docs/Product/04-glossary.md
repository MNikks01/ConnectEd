# Glossary

`Status: Accepted` · `Last updated: 2026-07-28`

Canonical terminology for ConnectEd. Supersedes `/docs/GLOSSARY.md` where they differ (new stack).

| Term | Definition |
|---|---|
| **Account** | A single authenticated identity. Either an **individual user** or a **school (institution)**. |
| **Individual user** | A person account. Carries a **role/status**: Student, Parent, Teacher, Principal, or General User. |
| **School / Institution** | An organization account. Web-only. Owns academic + admin data; is the verifier. |
| **Role / Status** | An individual's academic role. Legacy field `USER_CURRENT_STATUS`; empty = General User. |
| **General User** | An individual with no academic role — social features only. |
| **Class** | A specific **Medium + Class-level + Section** combination, e.g. *English · Class 8 · Section A*. The unit of academic grouping. |
| **Class key** | Legacy encoding of a Class as a single string (e.g. `EngClass8SecA`). In the rebuild this is a relational `class` row; the key survives only as a human label. |
| **Medium** | Language of instruction. Supported: English, Hindi. |
| **Section** | Subdivision of a class level: A–E. |
| **Subject** | A taught subject within a class (e.g. Science). |
| **Verification** | The workflow by which a school confirms a member's declared role, unlocking that class's academic data. States: `PENDING` → `VERIFIED` / `REJECTED`. |
| **Class Teacher** | A teacher allocated as the responsible teacher for one class; approves student/parent leave for it. |
| **Homework / Assignment / Project** | Academic items published by a teacher to a subject within a class; tracked read/unread per member. |
| **Notice** | A school-wide announcement from the school/principal. |
| **Event** | A dated school event. |
| **Timetable** | Per-class schedule (uploaded by the school). |
| **Syllabus coverage** | Teacher-maintained progress through a subject's syllabus. |
| **Leave application** | A request for absence. Chains: student/parent → class teacher; teacher → principal. States: `RECEIVED` → `ACCEPTED`/`REJECTED`. |
| **Complaint / Suggestion** | Formal feedback from a member to the school. |
| **Timeline / Post** | Social content on a profile; supports likes and comments. |
| **Follow** | Directional social relationship (user→user or user→school). |
| **Connection / Friend** | Mutual social relationship between users (request → accept). |
| **Entitlement** | What a school's subscription plan permits (feature flags/limits). |
| **RBAC** | Role-Based Access Control — server-enforced permission model. See [`../Security/`](../Security/). |
| **Read-tracking** | Per-member record of whether an academic item/notice was seen (legacy `VIEWED_BY[]`; relational join table in rebuild). |
