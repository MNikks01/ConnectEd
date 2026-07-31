# ConnectEdApp Ecosystem — Product Documentation

> **Reverse-engineered Product Requirements Documentation (PRD).**
> This documentation set was reconstructed entirely from source-code analysis of two
> code repositories. Where behaviour could not be proven from code, it is explicitly
> flagged as an **Assumption**.

---

## What is ConnectEdApp?

**ConnectEdApp** (marketed on the web as **GetConnected**) is a **school-community platform for the K‑12 education sector**. It combines two things most schools juggle separately:

1. **An e-schooling / academic management system** — schools publish homework, projects, timetables, syllabus progress, notices and events; students and parents receive them; leave applications and complaints flow between families and staff.
2. **A social network layer** — every participant has a profile, can post to a timeline, follow schools, connect with friends, and send private messages.

The product is delivered as **two front-end applications that share a single Firebase backend** (Firebase project `random-21953`):

| Application      | Repo            | Platform                         | Primary audience                                                          |
| ---------------- | --------------- | -------------------------------- | ------------------------------------------------------------------------- |
| **ConnectEdApp** | `ConnectEdApp/` | React Native / Expo (Android)    | Individual users — students, parents, teachers, principals, general users |
| **GetConnected** | `getconnected/` | React web app (Firebase Hosting) | School administrators (school portal) **and** individual users on desktop |

A hard rule enforced in code: **school accounts cannot log in on mobile** — they are redirected with _"Please login from desktop computer or laptop."_ Schools are administered from the website; individuals primarily use the mobile app but can also use the website.

---

## Who uses it?

Six actor types were identified in the code (`USER_CURRENT_STATUS` plus the separate `SCHOOLS` collection):

- **Student**
- **Parent** (manages one or more children)
- **Teacher** (teaches subjects; may be a class teacher)
- **Principal**
- **General User** ("Just a User" — social features only)
- **School** (institutional admin account, web-only)

Every academic actor (student/parent/teacher/principal) must be **verified by a school** before they can access that school's academic data — this verification workflow is central to the product.

---

## Documentation map

Start with the [Table of Contents](./TABLE_OF_CONTENTS.md). Recommended reading order:

1. [Executive Summary](./01-executive-summary.md)
2. [Product Overview](./02-product-overview.md) — vision, goals, target users
3. [User Personas](./03-user-personas.md)
4. [Feature Catalog](./04-feature-catalog.md)
5. Platform split — [Website](./05-website-features.md) · [Mobile](./06-mobile-app-features.md)
6. [Screen Documentation](./07-screen-documentation.md)
7. [User Journeys](./08-user-journeys.md)
8. [Functional Requirements](./09-functional-requirements.md)
9. Technical business layer — [Firebase Architecture](./10-firebase-architecture.md) · [Firestore Data Model](./11-firestore-data-model.md) · [Permissions & Roles](./12-permissions-and-roles.md)
10. [Notifications](./13-notifications.md) · [Search & Media](./14-search-and-media.md) · [Settings](./15-settings.md)
11. [Missing Features](./16-missing-features.md) · [Future Enhancements](./17-future-enhancements.md)
12. [Complete Product Flow](./18-complete-product-flow.md)
13. [Glossary](./GLOSSARY.md)

---

## Evidence & confidence

All conclusions are grounded in the source code (navigation stacks, screen components, Firestore query paths, Storage references, and constants). Firestore has no security-rules file in either repo, so **access control is inferred from client-side query construction and UI gating**, not from server rules. This is called out wherever it matters.

_Documentation reconstructed on 2026-07-03 from repository snapshots._
