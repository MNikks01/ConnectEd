# Wireframes (Low-Fidelity, Textual)

`Status: Draft` · `Last updated: 2026-07-28`

Textual low-fi specs — layout intent, key elements, and states. High-fi visuals are produced by the UI/UX agents
in the design tool; these specs are the source of truth for content and behaviour. Every screen must ship
Loading / Error / Empty / Success / Responsive / Accessible states.

## Global shell (authenticated)

```
┌───────────────────────────────────────────────┐
│ Logo    Search           🔔(badge)  ✉(badge)  ▾me │  top bar
├───────┬───────────────────────────────────────┤
│ Nav   │  <route content>                        │
│ (role │                                         │
│ aware)│                                         │
└───────┴───────────────────────────────────────┘
```
Nav items vary by role (see permission matrix). Students: no Leave/Complaints. General user: social only.

## School portal — dashboard

- Cards: pending verifications (count → queue), classes, members, recent notices.
- Primary actions: Create class, Add subject, New notice/event, Review verifications.
- States: empty (no classes yet → guided setup), loading skeletons, error retry.

## Verification queue (school)

- List of PENDING requests: requester, declared role, class/child/subjects, submitted-at.
- Row actions: Approve / Reject (with reason). Bulk select.
- Empty: "No pending requests."

## Class academics feed (student/parent)

- Filter chips: All / Homework / Assignments / Projects / Notices / Events.
- Item card: type badge, subject, title, due date, unread dot, author, timestamp.
- Open → detail (marks read), image if present.
- Parent: child switcher in header.

## Homework composer (teacher)

- Select class → subject; type toggle (Homework/Assignment/Project); title; description; due date; image upload.
- Publish (disabled while submitting; success toast; validation messages inline).
- Post-publish: read/unread counts.

## Leave (parent apply / class-teacher review)

- Apply: child (parent), date range, reason → submit.
- Review queue: RECEIVED list, Accept/Reject; tabs for ACCEPTED/REJECTED.

## Social

- **Feed**: composer + post cards (like/comment counts), infinite scroll (cursor).
- **Profile**: header (pic, bio, follow), tabs (posts, about).
- **Messages**: thread list + conversation pane; unread badges; send box.

## Auth

- Login (email/password, client-type aware), Register (individual/school tabs — school note "web only"),
  Forgot/reset password, Email verification.

## Responsive

- Mobile-first; nav collapses to bottom bar / drawer < 768px; no horizontal scroll; images scale.
