# 16 — Missing / Incomplete Features

Functionality that appears **incomplete, partially implemented, planned, or absent**. These are clearly distinguished from the implemented features documented elsewhere.

## 16.1 Explicitly stubbed / unfinished

### Subscription (Website)

- A `/subscription` route and page exist, but the page renders only a header and the literal text **"Subscription"**. No plans, pricing, billing, payment gateway, or entitlement logic.
- **Implication:** The intended **monetisation for schools** is unbuilt. Payments are not integrated anywhere in either app.
- **Status:** Placeholder / planned.

### School Results (Website)

- `App.js` contains **commented-out** imports/routes for `SchoolResults`.
- **Implication:** A **results / marks / report-card** feature was scaffolded and then disabled — planned but not shipped.
- **Status:** Planned, removed from active routes.

## 16.2 Governance & security gaps (implemented insecurely)

### No Firestore / Storage security rules

- Neither repo contains `firestore.rules` or `storage.rules`.
- **Implication:** All access control is client-side only; the backend does not enforce ownership or role restrictions. A significant risk for a system holding student/parent data.
- **Status:** Missing (critical).

### Plaintext passwords in Firestore

- `USERS` documents carry `USER_PWD` and `SCHOOLS` carry `SCHOOL_PASSWORD` — plaintext passwords stored alongside profile data, in addition to Firebase Auth.
- **Implication:** Serious security/compliance issue; passwords should never be stored in the database.
- **Status:** Implemented incorrectly; should be removed.

### Exposed configuration

- Firebase config (incl. API key) is committed. This is normal for Firebase web/mobile clients, but combined with the absence of security rules it means the database is effectively open.
- **Status:** Needs rules, not config hiding.

## 16.3 No server-side business logic

### No Cloud Functions

- Verification state changes, fan-out writes, and push sending all run **client-side**.
- **Implication:** No transactional integrity (e.g. a homework write and its notification can partially fail); no trusted enforcement of workflow transitions; no server validation.
- **Status:** Missing.

## 16.4 Feature gaps (present in concept, thin in execution)

| Area                         | Gap                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| **Password management**      | No confirmed forgot-password / change-password flow (only visibility toggles).               |
| **Notification preferences** | No per-category opt-out; push confirmed only for homework.                                   |
| **Notifications breadth**    | Notices, messages, requests, and leave decisions are badge-only; no confirmed push for them. |
| **Search**                   | Manual browsing only; no indexed/full-text search, ranking, or recommendations.              |
| **Media**                    | Images only — no video, PDFs/documents, or file-type validation.                             |
| **Attendance**               | Referenced only in help text; **no attendance feature** exists.                              |
| **Fees / payments**          | None (beyond the empty subscription stub).                                                   |
| **Exams / grades**           | None (see disabled SchoolResults).                                                           |
| **Moderation**               | No block/report/mute; no content moderation.                                                 |
| **Privacy controls**         | No control over who can follow/message/see content.                                          |
| **Account lifecycle**        | No account deletion / data export / GDPR-style controls.                                     |
| **Localisation**             | English-only, no i18n; class taxonomy hard-coded.                                            |
| **Web push / PWA**           | Website has no push (mobile-only).                                                           |
| **Offline support**          | No explicit offline handling beyond Firestore defaults.                                      |

## 16.5 Robustness observations (implemented but fragile)

- **Name-as-path-segment:** using `USER_NAME`/`SCHOOL_NAME` as Firestore path segments makes renames destructive and paths brittle.
- **Hard-coded taxonomy:** every medium/class/section combination is enumerated in a large constant file; adding a class requires code changes.
- **Client-side fan-out for notifications:** collecting tokens and posting to Expo from the client is unreliable at scale and exposes tokens.
- **Alert-based error handling:** many flows surface raw errors via `alert()`.

> These robustness items are **not** "missing features" per se; they are noted so a new team understands the current implementation's limits.
