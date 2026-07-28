# Table of Contents

| # | Document | Covers |
|---|----------|--------|
| — | [README](./README.md) | One-page product summary and reading guide |
| — | [Glossary](./GLOSSARY.md) | Definitions of all product & domain terminology |
| 01 | [Executive Summary](./01-executive-summary.md) | What the product is, the problem it solves, who uses it, why it exists |
| 02 | [Product Overview](./02-product-overview.md) | Product vision, business/user/platform goals, target users |
| 03 | [User Personas](./03-user-personas.md) | Realistic personas per role |
| 04 | [Feature Catalog](./04-feature-catalog.md) | Full feature list grouped by module (purpose, users, dependencies) |
| 05 | [Website Features](./05-website-features.md) | Functionality exclusive to the GetConnected website |
| 06 | [Mobile App Features](./06-mobile-app-features.md) | Functionality exclusive to the ConnectEdApp mobile app |
| 07 | [Screen Documentation](./07-screen-documentation.md) | Every screen/page: purpose, actions, data, navigation |
| 08 | [User Journeys](./08-user-journeys.md) | End-to-end workflows per role |
| 09 | [Functional Requirements](./09-functional-requirements.md) | Numbered functional requirements (FR-xxx) per module |
| 10 | [Firebase Architecture](./10-firebase-architecture.md) | Business usage of Auth, Firestore, Storage, Messaging, Analytics |
| 11 | [Firestore Data Model](./11-firestore-data-model.md) | Collections, subcollections, relationships, ownership |
| 12 | [Permissions & Roles](./12-permissions-and-roles.md) | Who can do what; access restrictions; capability matrix |
| 13 | [Notifications](./13-notifications.md) | Push and in-app notifications supported |
| 14 | [Search & Media](./14-search-and-media.md) | Search capabilities + file/media management |
| 15 | [Settings](./15-settings.md) | Configurable settings and account controls |
| 16 | [Missing Features](./16-missing-features.md) | Incomplete / partially implemented / planned functionality |
| 17 | [Future Enhancements](./17-future-enhancements.md) | Recommended extensions (not part of current PRD) |
| 18 | [Complete Product Flow](./18-complete-product-flow.md) | Narrative: discovery → sign-up → daily use |

## Conventions used in this documentation

- **Assumption** — a stated inference that could not be fully proven from the code, with the reasoning behind it.
- **Inferred** — a lighter-weight guess based on naming/structure; likely but unverified.
- `MONOSPACE_CAPS` — an actual Firestore field, collection, or document identifier taken verbatim from the code.
- "Class" in the academic sense = a specific **Medium + Class + Section** combination (e.g. *English Medium · Class 5 · Section A*), which the code encodes as a single key such as `EngClass5SecA`.
