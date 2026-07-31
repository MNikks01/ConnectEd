# Product Vision

`Status: Accepted` · `Last updated: 2026-07-28`

## One-liner

> **A single platform where a K-12 school runs its daily academics and its whole community stays connected** —
> homework, notices, timetables, syllabus and leave on one side; profiles, posts, followers and messaging on the
> other — with **server-enforced roles and verification** so only genuine, school-approved members see class data.

## The problem

Schools coordinate with families through a scattered mix of paper diaries, WhatsApp groups, physical notice
boards and phone calls. Information is lost, unverified, and impossible to audit. There is no single, role-aware
system that ties **academic communication** to a **verified identity** for each student, parent, teacher and
principal.

## The product

ConnectEd (web brand: **GetConnected**) combines two layers over one backend:

1. **E-schooling / academic management** — schools publish homework, assignments, projects, timetables, syllabus
   progress, notices and events; students and parents receive them (tracked read/unread); leave applications and
   complaints flow through proper approval chains.
2. **A social layer** — every participant has a profile and timeline, can follow schools, connect with friends,
   post, like, comment, and send private messages.

Delivered as:

- **Web app** (Next.js) — used by **school administrators** (school portal) and by individuals on desktop.
- **Mobile app** (future phase — React Native/Expo) — used by individuals.

> **Hard product rule (carried from legacy):** _school (institution) accounts are web-only._ Schools are
> administered from the website; individuals use web now and mobile later.

## Why it exists / business model

- **School subscriptions** (institutional SaaS) — the primary revenue line.
- **Advertising** on the consumer surface (mobile phase) — secondary.

Both were signalled in the legacy code (a subscription area; AdMob wiring) and are **first-class in the rebuild**:
entitlements and billing are real backend concerns, not placeholders.

## What changes vs. the legacy Firebase app

| Concern        | Legacy (Firebase)                              | ConnectEd rebuild                                        |
| -------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Backend        | Client talks straight to Firebase; no server   | Node/Express API server; clients never touch the DB      |
| Access control | **None** (no security rules; client-gated)     | **Server-enforced RBAC** + verification on every request |
| Passwords      | Plaintext in Firestore (`USER_PWD`)            | Hashed (argon2/bcrypt); never stored in plaintext        |
| Data store     | Firestore nested subcollections keyed by names | PostgreSQL relational schema, stable numeric/UUID keys   |
| Business logic | Client-side fan-out, no transactions           | Server-side, transactional, testable                     |
| Push           | Client POSTs Expo push API directly            | Server-owned notification service                        |

These reversals are individually justified in [`../ADR/`](../ADR/).

## Success looks like

- A school onboards, sets up classes, and verifies members without engineering help.
- A teacher publishes homework once and every verified parent in the class is notified within seconds.
- No member can read a class's academic data without server-verified membership — provable, not assumed.
- 99.9% API availability; p95 read latency < 300 ms.

## Non-goals (initial phase)

- Video conferencing / live classes.
- Grading, report cards, and gradebook (roadmap, not v1).
- Payment collection from parents (fees) — v1 is school subscriptions only.
- Native mobile app — web first; mobile is a later phase sharing the same API.
