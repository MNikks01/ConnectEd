# User Flows

`Status: Accepted` · `Last updated: 2026-07-28`

End-to-end flows per role. Each references the PRD module and the API endpoints involved.

## School onboarding

```mermaid
flowchart TD
  A[Register school - web] --> B[Verify email]
  B --> C[Complete school profile]
  C --> D[Create classes: Medium+Level+Section]
  D --> E[Add subjects per class]
  E --> F[Invite members / receive verification requests]
  F --> G[Approve members]
  G --> H[Allocate class teachers]
  H --> I[Publish first notice / event]
```

Endpoints: `/auth/register/school`, `/schools/:id`, `/schools/:id/classes`, `/classes/:id/subjects`,
`/schools/:id/verifications`, `/classes/:id/class-teacher`, `/schools/:id/notices`.

## Member verification (student/parent/teacher/principal)

```mermaid
flowchart TD
  A[Register individual] --> B[Declare academic role]
  B --> C[Pick school + class/child/subjects]
  C --> D[Submit verification request PENDING]
  D --> E{School decision}
  E -->|approve| F[VERIFIED -> academics unlock]
  E -->|reject| G[REJECTED -> may re-apply]
```

Endpoints: `/me/role`, `/verifications`, `/verifications/:id/decision`, `/me/verifications`.

## Teacher publishes homework

```mermaid
flowchart TD
  A[Teacher opens class+subject] --> B[Compose homework/assignment/project]
  B --> C[Attach image optional, set due date]
  C --> D[Publish]
  D --> E[Server authorizes allocation+verification]
  E --> F[Item stored + event enqueued]
  F --> G[Verified parents/students notified]
  G --> H[Members open -> marked read]
```

Endpoints: `/classes/:id/homework`, `/homework/:id`, `/notifications`.

## Parent daily use

```mermaid
flowchart TD
  A[Login] --> B[Select child]
  B --> C[Academics feed: homework/notices/events]
  C --> D[Open items -> read]
  B --> E[Apply for child leave]
  E --> F[Class-teacher decision -> notified]
  B --> G[Timetable / syllabus]
  A --> H[Social: feed, follow school, message]
```

## Leave approval (class teacher)

```mermaid
flowchart TD
  A[Class teacher opens leave queue RECEIVED] --> B[Review application]
  B --> C{Decision}
  C -->|accept| D[ACCEPTED]
  C -->|reject| E[REJECTED]
  D & E --> F[Applicant notified]
```

## Social onboarding (general user)

```mermaid
flowchart TD
  A[Register] --> B[Set up profile]
  B --> C[Follow schools / find friends]
  C --> D[Post / like / comment]
  C --> E[Send connection requests]
  E --> F[Message connections]
```
