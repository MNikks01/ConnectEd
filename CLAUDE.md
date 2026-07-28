# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This repo contains **documentation only** — there is no application source code here. It is a
reverse-engineered Product Requirements Documentation (PRD) set for the **ConnectEdApp / GetConnected**
ecosystem, reconstructed from source-code analysis of two *external* repos (`ConnectEdApp/` mobile and
`getconnected/` web) that are **not present in this working directory**. All 21 documents live under `docs/`.

There is no build, lint, test, or run step. Work here is reading and editing Markdown. Preview rendering
with any Markdown viewer if needed.

## The product being documented

ConnectEdApp (web brand **GetConnected**) is a K-12 school-community platform combining an e-schooling
academic system with a social network layer. Two front-ends share **one Firebase backend** (project
`random-21953`) with **no custom API server** — all reads/writes are client-side:

- **ConnectEdApp** — React Native / Expo (Android), for individual users.
- **GetConnected** — React web app on Firebase Hosting, for school admins (school portal) and desktop users.

Hard rule: **school accounts are web-only** (mobile login is rejected). Six actors: Student, Parent,
Teacher, Principal, General User (`USER_CURRENT_STATUS` on a `USERS` doc), and School (separate `SCHOOLS`
collection). Academic actors must be **school-verified** (`VERIFIED_*` flags) before class data unlocks —
this verification workflow is the product's spine.

## Documentation structure

- `docs/README.md` — one-page product summary and reading guide (start here for product context).
- `docs/TABLE_OF_CONTENTS.md` — index of all docs and the writing conventions (read before editing).
- `docs/01`–`docs/18` — numbered docs, ordered narrative → features → screens → journeys → technical layer
  (Firebase/Firestore/permissions) → notifications/search/settings → gaps/future/full-flow.
- `docs/GLOSSARY.md` — domain terminology.

When adding or restructuring docs, keep `README.md`, `TABLE_OF_CONTENTS.md`, and the numbered filename
scheme in sync — they cross-link each other with relative paths.

## Writing conventions (enforced across all docs — match them when editing)

- Every claim is **grounded in observed source code** (query paths, field names, navigation stacks,
  constants). Do not add product behavior that isn't evidenced.
- **Assumption** — a stated inference not fully provable from code, always with its reasoning.
- **Inferred** — a lighter guess from naming/structure; likely but unverified.
- `MONOSPACE_CAPS` — a verbatim Firestore field / collection / document identifier from the code
  (e.g. `USER_CURRENT_STATUS`, `VERIFIED_TEACHER`, `PROJECTS_&_HOMEWORKS`). Preserve exact casing.
- "Class" always means a **Medium + Class + Section** combination encoded as one key, e.g. `EngClass5SecA`.

## Domain facts that span multiple docs

These recur throughout and are easy to get wrong; they require reading several files to reconstruct:

- **Two root collections only:** `USERS` and `SCHOOLS`. The Firebase UID is the document ID in each.
- **Name-as-path-segment:** an entity's own display name is a path segment
  (`USERS/{uid}/{USER_NAME}/…`, `SCHOOLS/{uid}/{SCHOOL_NAME}/…`, stored as `USER_PATH_COLLECTION` /
  `SCHOOL_PATH_COLLECTION`). Renaming would orphan the subtree.
- **Class academic data** nests under `SCHOOLS/{uid}/{name}/CLASSES_DETAILS/CLASSES/{classKey}/…`.
- **Real-time everywhere:** the apps rely on `onSnapshot` listeners for feeds, badges, homework, notices,
  messages, and approvals.
- **No security rules exist** in either source repo — access control is described as *intended* and is
  enforced only by client-side UI gating and query construction, not by the backend. Flag this whenever
  discussing permissions or data access ([`docs/12`](docs/12-permissions-and-roles.md),
  [`docs/16`](docs/16-missing-features.md)).
- **No Cloud Functions:** all business logic (fan-out writes, verification, push) runs client-side with no
  transactional guarantee.
- **Push** is via **Expo** (client POSTs to `https://exp.host/--/api/v2/push/send`), not direct FCM; tokens
  live in `PUSH_NOTIFICATION` on the user doc.
- Known documented security concern: plaintext passwords stored in Firestore (`USER_PWD`, `SCHOOL_PASSWORD`)
  alongside Firebase Auth.
