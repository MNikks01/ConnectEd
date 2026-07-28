# 17 — Future Enhancements

Recommended features that would naturally extend ConnectEdApp. **These are recommendations only and are NOT part of the current PRD** — they describe where the product could go, not what it does today.

## 17.1 Complete the started work (highest leverage)
1. **Ship the Subscription/billing system** — plans, payment gateway (e.g. Razorpay/Stripe), invoices, and school entitlements. This unlocks the intended SaaS revenue.
2. **Ship School Results / Report Cards** — the disabled `SchoolResults` implies demand: per-student marks, term report cards, grade analytics for parents.
3. **Add server-side security rules** for Firestore & Storage, and **remove plaintext passwords**. (Table-stakes before scaling.)
4. **Introduce Cloud Functions** for trusted workflow transitions (verification, leave decisions) and reliable notification fan-out.

## 17.2 Natural academic extensions
5. **Attendance management** — daily attendance by teachers, visible to parents (help text already references it).
6. **Exams & timetable-of-exams**, admit cards, and results integration.
7. **Fee management** — fee schedules, online payment, receipts (ties into billing infra).
8. **Assignment submission & grading** — let students submit work back and teachers grade it (today homework is one-directional).
9. **Academic calendar** — unify events, holidays, exams, deadlines.
10. **Report/analytics dashboards** for schools (engagement, unread rates, leave trends).

## 17.3 Communication & engagement
11. **Broader push notifications** — notices, messages, requests, leave decisions (infrastructure already exists).
12. **Group / class chat** and **teacher↔parent threads** (today messaging is generic 1:1).
13. **Announcement acknowledgements** — require parent read-receipt/confirmation on critical notices.
14. **Web push / PWA** so the website reaches desktop users with notifications.
15. **Email/SMS fallback** for critical communications.

## 17.4 Trust, safety & privacy
16. **Moderation tools** — block, report, mute; content moderation for posts/comments.
17. **Privacy controls** — who can follow/message/view; private vs public profiles.
18. **Role-based verified badges** and anti-impersonation safeguards.
19. **Account lifecycle** — deletion, data export, consent management (important for minors' data).

## 17.5 Platform & scale
20. **iOS release** (Expo already supports it; only Android is configured).
21. **Indexed search** (Algolia/Typesense) for people, schools, and content with ranking.
22. **Robust data model** — replace name-as-path-segment with stable IDs; make the class taxonomy data-driven rather than hard-coded.
23. **Localisation / multi-language** and support for other education boards/structures beyond the current India-centric taxonomy.
24. **Offline-first** experience for low-connectivity regions.

## 17.6 Growth & monetisation
25. **Alumni network** module (natural fit — connect past students to their school).
26. **Marketplace** (books, uniforms, tuition) around the school community.
27. **Analytics-driven recommendations** — suggested schools/people to follow.
28. **Referral / invite flows** for schools to onboard their whole community quickly.

> Prioritisation suggestion: **Security rules + remove plaintext passwords (17.1 #3)** should precede any growth work, as the platform handles minors' data with no server-side protection today.
