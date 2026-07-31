# 13 — Notifications

## 13.1 Push notifications (mobile)

- **Channel:** Expo Notifications → **Expo push service** (`https://exp.host/--/api/v2/push/send`), called directly from the client.
- **Token capture:** On login and at account creation, the app fetches the device's Expo push token (`Notifications.getExpoPushTokenAsync()`) and stores it on the user's `USERS` document as `PUSH_NOTIFICATION`.
- **Targeting:** The sender collects the push tokens of the intended recipients (e.g. all parents of a class) and posts a single batched message.
- **Handling:** A foreground handler shows the alert; a response handler deep-links the user (a homework notification opens **Projects & Homeworks**).

### Confirmed push notification

| Event                 | Trigger                                                   | Recipients                  | Message (observed)                                                                                        |
| --------------------- | --------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| **New academic work** | Teacher publishes a Daily Homework / Assignment / Project | Parents of the target class | Title: `ConnectEdApp` · Body: *"New Homework/Assignment/Project by {teacher} for the subject of {subject} | for {class} {section}"* · data: `{ type: 'Projects & Homeworks', subject }` |

### Inferred / likely-intended push notifications

The token infrastructure exists app-wide, so the following are plausible extensions but **were not confirmed** as implemented push sends:

- New notice posted (**Assumption** — not confirmed).
- New message received (**Assumption** — handled as in-app badge; push not confirmed).
- Connection request received (**Assumption** — badge only confirmed).
- Leave application received/decided (**Assumption** — badge only confirmed).

## 13.2 In-app notifications (badges) — mobile & web

The apps compute **live unread counts** from Firestore listeners and render them as badges:

| Badge                                      | Source                                                                                   | Shown to                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------- |
| Unread **messages**                        | `MESSAGES_RECIEVED` where `IS_VIEWED = false`                                            | All users                  |
| Pending **connection requests**            | `REQUESTS_RECIEVED` count                                                                | All users                  |
| Unviewed **notices**                       | `NOTICE_BOARD` notices whose `VIEWED_BY` excludes the user                               | Verified members           |
| Unviewed **homework/assignments/projects** | class work whose `VIEWED_BY` excludes the user                                           | Students, parents          |
| Received **leave applications**            | class `LEAVE_APPLICATION/RECIEVED` (teachers) / `ALL_TEACHERS/.../RECIEVED` (principals) | Class teachers, principals |

Read state is cleared by writing the user's id into the item's `VIEWED_BY` (or setting `IS_VIEWED`) when they open it.

## 13.3 Email / SMS notifications

- **None implemented.** No email- or SMS-sending code exists in either repo (aside from Firebase Auth's own transactional emails, which are not custom-configured here).
- **Assumption:** Email/SMS are out of scope for the current product; only push + in-app badges are the notification surface.

## 13.4 Notification settings

- No user-facing notification preference screen was found. Push is effectively **all-or-nothing** based on OS permission and token presence. See [Settings](./15-settings.md) and [Missing Features](./16-missing-features.md).
