# 01 — Executive Summary

## What is ConnectEdApp?

ConnectEdApp (web brand: **GetConnected**) is a **school-centric community and e-schooling platform** for the K‑12 education market. It gives a school a single digital space where it can run day-to-day academic communication with families **and** where every member of the school community — students, parents, teachers, principals — has a social presence (profile, posts, followers, private messaging).

The ecosystem consists of two applications built on one shared Firebase backend:

- A **mobile app** (Android, built with Expo/React Native) used by individuals.
- A **website** (React, hosted on Firebase Hosting) used by school administrators and, optionally, by individuals on desktop.

Both talk **directly to Firebase** (Authentication, Firestore, Storage, Analytics) with **no custom backend API** in between. Push notifications are delivered through the **Expo push service**.

## What problem does it solve?

Schools typically communicate with families through a scattered mix of paper diaries, WhatsApp groups, notice boards, and phone calls. ConnectEdApp consolidates the recurring academic-communication needs of a school into one structured, role-aware system:

- **Homework, assignments and projects** reach the right class and are tracked as read/unread.
- **Notices and events** are broadcast to the whole school community.
- **Timetables and syllabus-coverage progress** are published per class and subject.
- **Leave applications** flow through a proper approval chain (student/parent → class teacher; teacher → principal).
- **Complaints and feedback** have a formal channel to the school.
- A **verification system** guarantees that only genuine, school-approved members can see a class's academic data.

On top of this academic backbone, it layers a **familiar social experience** — following schools, connecting with friends, posting to a timeline, liking and commenting, and private messaging — to keep the community engaged.

## Who uses it?

| Actor | Where they work | What they primarily do |
|---|---|---|
| **School** (institution admin) | Website only | Set up classes, verify members, publish notices/events, manage the academic system |
| **Principal** | Mobile + web | Oversee the school, approve teacher leave, view academics, handle complaints |
| **Teacher** | Mobile + web | Publish homework/projects, update syllabus, approve student leave (if class teacher) |
| **Parent** | Mobile + web | Track a child's homework, timetable, notices; apply for the child's leave |
| **Student** | Mobile + web | View homework, timetable, syllabus, notices; use social features |
| **General User** | Mobile + web | Use only the social layer (no school affiliation) |

## Why does it exist?

The product exists to **digitise and unify school–family communication in one branded app** while simultaneously building a **social graph around the school** (a school's followers, its members' friendships, and their posts). The commercial intent is visible in two signals in the code:

- A **Subscription** area on the website (currently a placeholder — see [Missing Features](./16-missing-features.md)), implying a paid/subscription model for schools.
- **AdMob banner advertising** wired into the mobile app, implying an ad-supported revenue stream for the consumer side.

**Assumption:** The business model is a hybrid of *school subscriptions* (institutional SaaS) and *advertising* (consumer app). This is inferred from the presence of a subscription route and Google Mobile Ads configuration; no pricing, billing, or entitlement logic exists in the code to confirm it.

## One-line positioning

> *"A single app where a school runs its daily academics and its whole community stays connected — homework, notices, timetables and leave on one side; profiles, posts, followers and messages on the other."*
