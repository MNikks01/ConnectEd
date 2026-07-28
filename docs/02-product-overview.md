# 02 — Product Overview

## 2.1 Product Vision

> **Make a school the centre of its own connected digital community — running academics and relationships in one place.**

ConnectEdApp envisions every school as a hub. Around that hub orbit its students, their parents, its teachers and its principal, plus a wider circle of followers and friends. The platform's vision is to replace fragmented school–home communication (paper diaries, informal chat groups, phone trees) with a **single, structured, role-aware system**, and to make that system engaging by wrapping it in a **social-network experience** people already understand.

The dual nature is deliberate:
- The **e-schooling side** provides the *utility* that gets a school to adopt the app (homework, notices, timetable, leave, syllabus).
- The **social side** provides the *stickiness* that keeps individuals returning daily (feed, follows, friends, messaging).

## 2.2 Product Goals

### Business goals
- **B‑1** Become the default digital communication channel between a school and its families.
- **B‑2** Onboard schools as institutional accounts and grow each school's verified member base (students, parents, teachers).
- **B‑3** Monetise through school subscriptions (**Assumption** — subscription route present but unimplemented) and consumer advertising (AdMob configured in mobile app).
- **B‑4** Build a defensible social graph (a school's followers + members' friendships) that increases switching cost.

### User goals
- **U‑1 (Parents)** Never miss a child's homework, notice, event, or timetable change; apply for leave without paperwork.
- **U‑2 (Students)** See what is due, what's been taught, and when; stay socially connected to friends and school.
- **U‑3 (Teachers)** Publish work to the exact right class in seconds and notify families automatically.
- **U‑4 (Principals)** Oversee academic communication and approve staff leave from one place.
- **U‑5 (Everyone)** Have a profile, post updates, follow schools/people, and message privately.

### Platform goals
- **P‑1** Serve individuals on mobile and institutions on desktop from **one shared data model** so both experiences stay in sync in real time.
- **P‑2** Guarantee data integrity through a **verification gate** — only school-approved members see class-level academic data.
- **P‑3** Deliver academic events in real time via live Firestore listeners and push notifications.
- **P‑4** Keep the system self-serve: schools create their own class structure; users self-declare and request verification.

## 2.3 Target Users

Exactly the following actor types exist in the product (proven by `USER_CURRENT_STATUS` values, the separate `SCHOOLS` collection, and role-specific components):

1. **Student** — verified against one class of one school.
2. **Parent** — has one or more children (`CHILDS_INFO`), each verified into a class; operates in the context of a "currently selected child."
3. **Teacher** — teaches one or more subjects; may additionally be a **class teacher** for one class (`CLASS_TEACHER_DATA`).
4. **Principal** — school-level oversight role.
5. **General User** ("Just a User") — has a profile and full social features but **no** e-schooling status and therefore no academic modules.
6. **School** — an institutional account in the `SCHOOLS` collection; the administrative owner of all class/academic data; **web login only**.

> There is **no separate "Administrator", "Alumni", "Institute", or "Guest" role** in the code. Guest-like access does not exist — the app requires authentication before any content is shown. Do not document roles the product does not have.

### Platform access matrix

| Actor | Mobile app | Website |
|---|:---:|:---:|
| Student | ✅ primary | ✅ |
| Parent | ✅ primary | ✅ |
| Teacher | ✅ primary | ✅ |
| Principal | ✅ primary | ✅ |
| General User | ✅ | ✅ |
| School | ❌ blocked | ✅ only |

*(Mobile blocks school accounts explicitly; see `Screens/MainScreen.js`.)*

## 2.4 Geographic / market signals

The class taxonomy encodes an **Indian K‑12 structure**: Pre-Nursery, Nursery, KG‑1, KG‑2, Class 1–12, with **English/Hindi mediums** and Sections A–E. School address fields include `SCHOOL_TEHSIL`, `SCHOOL_DISTRICT`, `SCHOOL_VILLAGE`, `SCHOOL_PINCODE`, and `SCHOOL_AFFILIATION`.

**Assumption:** The primary target market is **Indian schools** (CBSE/State-board style structure), based on the medium/class/section taxonomy and address vocabulary. The market is not stated anywhere in copy, so this is inferred from the data model.
