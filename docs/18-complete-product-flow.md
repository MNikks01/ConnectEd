# 18 — Complete Product Flow

An end-to-end narrative of how the ConnectEdApp ecosystem is discovered, adopted, and used day-to-day. This ties together everything in the preceding documents.

---

## Act 1 — A school comes on board

A school hears about **GetConnected** and visits the website on a desktop. An administrator clicks **Create School Account** and completes the wizard:

1. Enters the school's identity — full name, address (down to village/tehsil/district/state/pincode), affiliation, establishment year, contact details, and its mission, vision, facilities, and achievements.
2. Builds the school's **academic structure** — selects the mediums it offers (English/Hindi), the classes it runs (Pre-Nursery through Class 12), the sections within each (A–E), and the **subjects** for each class.

The school now has a public profile and an empty but structured academic system. It lands on its **portal**, where it will spend most of its time **verifying members** and **publishing content**. (Schools work **only** from the website — the mobile app turns them away.)

---

## Act 2 — Families and staff discover and join

A parent downloads **ConnectEdApp** on Android. On first launch they see an **onboarding** walkthrough, then **register**: personal details, then choosing their **status**. Say they pick **Parent** and add their child's school, medium, class, and section. A teacher at the same school registers as **Teacher** and lists the subjects they teach. A student registers as **Student**. Someone with no school ties registers as a **User** and gets only the social experience.

Each academic registrant automatically **submits a verification request** to the school and sees their status as **Pending**. Until the school approves, they can use all the **social** features but **cannot** see any class academic data.

Back on the website, the school opens **Verification Requests**, reviews each pending student, parent, teacher, and principal, and **approves** them. Approved members appear under **Verified Members**. The school **allocates a class teacher** to each class — this teacher will later approve that class's leave applications. Teachers get their subjects confirmed.

The moment a member is verified, their app unlocks the academic modules scoped to their exact class.

---

## Act 3 — The daily academic loop

Now the system does its real job:

- A **teacher** opens **Projects & Homeworks**, picks a subject, chooses **Daily Homework / Assignment / Project**, writes it, optionally attaches an image, sets a due date, and publishes. Instantly the work appears in the class's students' and parents' apps as an **unread badge**, and the class's **parents receive a push notification**: _"New Homework by Priya for the subject of Science | for Class 7 A."_ When a parent opens it, it's marked as read.
- The **school/principal** posts **notices** and creates **upcoming events**; these fan out to every member's notice board and badge as unread.
- The **school** uploads each class's **timetable** image; teachers keep **Syllabus Covered** up to date so parents can see how much curriculum has been taught.
- A **parent** whose child is unwell files a **Leave Application**; it lands in the **class teacher's** received queue (badged), and the class teacher **accepts or rejects** it. A **teacher** needing leave applies too — but their application routes to the **principal**.
- Anyone with a grievance files a **Complaint** or a **Suggestion**, which the school and principal review.

A parent of two children simply **switches the selected child** to flip their entire academic view to the other child's class.

---

## Act 4 — The social loop keeps everyone engaged

Around the academics runs a full **social network**, shared by every role:

- Users **find and follow schools** and **find friends**, sending **connection requests** that the recipient **accepts**.
- Everyone **posts** to their timeline (text + images); followers see it in their **feed**, and **like** and **comment**.
- Users **message** each other privately, with unread badges keeping conversations visible.
- Schools post too — announcements, event photos, achievements — building their **follower base**.

This social layer is what turns a utilitarian school tool into something people open every day.

---

## Act 5 — The business behind it

The product is positioned to monetise two ways:

- **Schools** are meant to pay via a **Subscription** (the route exists but is unbuilt today).
- The **consumer app** shows **banner ads** (AdMob) to individual users.

Everything runs on a single **Firebase** backend shared by both apps, with **real-time listeners** keeping mobile and web perfectly in sync and **Expo push** reaching phones.

---

## The whole ecosystem at a glance

```
 SCHOOL (web) ──creates──▶ classes/subjects
      │
      ├─verifies──▶ Students · Parents · Teachers · Principal (mobile)
      │
      ├─publishes─▶ Homework · Notices · Events · Timetable · Syllabus
      │                 │
      │                 ▼  (real-time + push)
      │            Students & Parents consume, mark read
      │
      ├─receives──▶ Leave applications  ──▶ class teacher / principal decide
      └─receives──▶ Complaints & feedback

 EVERYONE (any role) ──▶ Social: follow · post · like · comment · connect · message

 Backend: one Firebase project (Auth · Firestore · Storage · Analytics) + Expo push
 Money:   school subscriptions (planned) + mobile banner ads (live)
```

For terminology, see the [Glossary](./GLOSSARY.md).
