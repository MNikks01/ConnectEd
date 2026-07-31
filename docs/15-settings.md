# 15 — Settings

This documents the configurable settings and account controls found in the product. The product is **light on explicit settings** — most configuration is implicit in the data a user provides.

## 15.1 Account / profile settings (user)

Editable through **Edit Profile** (`EditUserProfileScreen` / web profile):

- Display picture
- Bio (`USER_BIO`)
- Achievements (`USER_ACHIEVEMENTS`)
- Qualification details: degree, specialization, university, passout year
- Personal details captured at registration: full name, gender, DOB, mobile, email

## 15.2 E-Schooling status settings (academic users)

Managed in **E-Schooling Status**:

- Current status / role management
- **Parent:** add children; **select the current child** (`CURRENT_SELECTED_CHILD`) — effectively a context switch that reconfigures all academic views
- **Teacher:** manage subjects taught; school linkage
- Submit/track verification requests

## 15.3 School settings (school account)

Managed in the **School portal**:

- School profile (about, mission, vision, facilities, achievements, contact, address)
- **Academic structure**: mediums, classes, sections, and per-class subjects
- **Class teacher allocation**
- Member management (verify, add/remove)

## 15.4 App / device settings

- **Onboarding flag** — `ConnectEdAppLaunched` stored locally so onboarding shows only once. Not user-facing.
- **Theme** — fixed **light** mode with brand blue (`#2e81f4`); no user theme toggle.
- **Orientation** — locked to portrait (mobile).
- **Notification permission** — governed by the OS; the app requests push permission and stores a token. There is **no in-app notification-preferences screen**.

## 15.5 Security / session

- **Login / logout** — sign in with email+password; sign out via account area (**Assumption:** a sign-out control exists in the Account/drawer, standard for Firebase Auth apps; the exact control was not individually confirmed).
- **Password change / reset** — password visibility toggles exist; a dedicated change-password or forgot-password flow was **not confirmed** (see [Missing Features](./16-missing-features.md)).

## 15.6 Settings that are NOT present

- Notification preferences (mute/opt-out per category)
- Privacy controls (who can follow/message/see posts)
- Blocking / reporting users
- Language / localisation selection
- Account deletion / data export
- Theme selection

These are candidate additions — see [Future Enhancements](./17-future-enhancements.md).
