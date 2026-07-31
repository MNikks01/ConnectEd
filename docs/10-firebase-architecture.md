# 10 — Firebase Architecture (Business View)

Both applications talk **directly to Firebase** — there is **no custom backend/API server**. All reads and writes are performed client-side against a single Firebase project.

- **Firebase project:** `random-21953`
- **Auth domain:** `random-21953.firebaseapp.com`
- **Storage bucket:** `random-21953.appspot.com`
- **Shared by:** the mobile app (`ConnectEdApp`) and the website (`getconnected`) — both point at the same project, which is why data written on one platform appears instantly on the other.

This section describes **how each Firebase capability is used in business terms**, not implementation.

## 10.1 Firebase Authentication

- **Method:** Email + password only.
- **Account types:** Two — an **individual user** (has a `USERS` document) and a **school** (has a `SCHOOLS` document). The account's Firebase UID is the document ID in the corresponding collection.
- **Routing logic:** After login the app looks up the UID; if it is a school it opens the school portal (web) or is rejected (mobile); otherwise it opens the user experience.
- **Real-time session:** An auth-state listener keeps the app in sync with sign-in/out.
- **Observation:** Plaintext passwords are **also** stored in Firestore (`USER_PWD`, `SCHOOL_PASSWORD`) in addition to Firebase Auth — a security concern flagged in [Missing Features](./16-missing-features.md).

## 10.2 Cloud Firestore

- **Role:** The single source of truth for all product data — users, schools, the academic structure, social graph, posts, messages, notices, homework, leave, complaints, events.
- **Real-time:** The apps rely heavily on **live listeners** (`onSnapshot`) so feeds, badges, homework, notices, messages and approvals update instantly.
- **Structure philosophy:** Deeply **nested subcollections** keyed by human-readable names. Notably, each entity's own name is used as a path segment (e.g. `USERS/{uid}/{USER_NAME}/…` and `SCHOOLS/{uid}/{SCHOOL_NAME}/…`), and academic data is nested under a class key that encodes Medium+Class+Section.
- **Two root collections:** `USERS` and `SCHOOLS`. (See [Data Model](./11-firestore-data-model.md).)
- **Access control:** **No `firestore.rules` file exists in either repo.** Access is therefore governed entirely by how the client constructs queries and gates the UI. **Assumption:** either default/permissive rules are in effect or rules are managed outside these repos. This is a significant governance gap — see Missing Features.

## 10.3 Firebase Storage

- **Role:** Stores all binary media.
- **Business usage (from Storage paths):**
  - `USERS/{uid}/Profile` — user profile pictures.
  - `USERS/{uid}/Timeline` — user post images.
  - `USERS/{uid}/Homeworks` — images attached to homework/assignments/projects by teachers.
  - `SCHOOLS/{uid}/Profile` — school profile pictures.
  - `SCHOOLS/{uid}/Timeline` — school post images.
  - `SCHOOLS/{uid}/Timetable/{classKey}` — class timetable images.
- **Access control:** No `storage.rules` file present — same governance gap as Firestore.

## 10.4 Cloud Messaging / Push (via Expo)

- **Mechanism:** The mobile app uses **Expo Notifications**. Each user's Expo push token is saved on their `USERS` document as `PUSH_NOTIFICATION`.
- **Sending:** The app sends push messages by POSTing directly to the **Expo push API** (`https://exp.host/--/api/v2/push/send`) from the client — e.g. when a teacher publishes homework, the app collects the class parents' tokens and notifies them.
- **Not FCM directly:** Although `google-services.json` is present (required for the Android build), push delivery is orchestrated through Expo, not custom FCM code.
- **Handling:** Notifications show an alert; tapping a homework notification deep-links to Projects & Homeworks.

## 10.5 Firebase Analytics

- **Usage:** Firebase Analytics is initialised in both apps (`getAnalytics`). No custom events beyond default collection were found. **Inferred:** used for basic engagement/usage metrics only.

## 10.6 Cloud Functions

- **None found.** There is no `functions/` directory or callable-function usage in either repo. All business logic — including fan-out writes, verification state changes, and push sending — runs **client-side**. This has correctness/security implications (see Missing Features).

## 10.7 Firebase Hosting

- The **website** is deployed to Firebase Hosting (`firebase.json` → `public: build`, SPA rewrite to `/index.html`). The mobile app is distributed via Expo/EAS build (Android).

## 10.8 Architecture summary diagram

```
        ┌──────────────────────┐        ┌──────────────────────┐
        │  ConnectEdApp (M)    │        │  GetConnected (W)    │
        │  Expo / Android      │        │  React / Firebase    │
        │  Users only          │        │  Hosting             │
        └──────────┬───────────┘        └──────────┬───────────┘
                   │        both use the SAME       │
                   ▼        Firebase project        ▼
        ┌───────────────────────────────────────────────────────┐
        │                Firebase (random-21953)                 │
        │  Auth (email/pw)  ·  Firestore (USERS, SCHOOLS)        │
        │  Storage (Profile/Timeline/Homeworks/Timetable)       │
        │  Analytics                                             │
        └───────────────────────────────────────────────────────┘
                   │ (client POST)
                   ▼
        ┌───────────────────────────┐
        │  Expo Push API (exp.host) │  → device notifications
        └───────────────────────────┘
```
