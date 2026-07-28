# Architecture — Key Sequence Flows

`Status: Accepted` · `Last updated: 2026-07-28`

## Member verification → academic unlock

```mermaid
sequenceDiagram
  participant Member
  participant API
  participant DB
  participant School
  Member->>API: POST /verifications {schoolId, classId, role}
  API->>DB: insert verification(status=PENDING)
  API-->>School: notification: new request
  School->>API: POST /verifications/:id/decision {approve}
  API->>DB: tx: set VERIFIED, create membership(class, role)
  API-->>Member: notification: verified
  Member->>API: GET /classes/:id/academics
  API->>API: authorize: membership VERIFIED?  yes
  API->>DB: read class academics
  API-->>Member: academic feed
```

## Teacher publishes homework → parents notified

```mermaid
sequenceDiagram
  participant Teacher
  participant API
  participant DB
  participant Queue
  participant Worker
  participant Parent
  Teacher->>API: POST /classes/:id/homework
  API->>API: authorize: teacher allocated to class+subject & VERIFIED
  API->>DB: tx: insert homework item
  API->>Queue: enqueue homework.published(itemId, classId)
  API-->>Teacher: 201 created
  Worker->>DB: resolve verified parents/students of class + prefs
  Worker->>DB: insert notifications
  Worker-->>Parent: in-app (and push in mobile phase)
  Parent->>API: GET /homework/:id
  API->>DB: mark read for parent
```

## Auth: login with refresh rotation

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant DB
  Client->>API: POST /auth/login {email,password, clientType}
  API->>DB: load account by email
  API->>API: verify argon2id hash; reject SCHOOL on mobile clientType
  API->>DB: create refresh-token family (hashed)
  API-->>Client: access JWT (15m) + refresh (httpOnly cookie)
  Note over Client,API: later...
  Client->>API: POST /auth/refresh (cookie)
  API->>DB: validate refresh; detect reuse
  alt reuse detected
    API->>DB: revoke family
    API-->>Client: 401 (re-login)
  else valid
    API->>DB: rotate refresh
    API-->>Client: new access + new refresh
  end
```

## Leave application (parent → class teacher)

```mermaid
sequenceDiagram
  participant Parent
  participant API
  participant DB
  participant ClassTeacher
  Parent->>API: POST /children/:childId/leave {dates,reason}
  API->>API: authorize: parent of VERIFIED child
  API->>DB: insert leave(status=RECEIVED, classId)
  API-->>ClassTeacher: notification: leave in queue
  ClassTeacher->>API: POST /leave/:id/decision {accept}
  API->>API: authorize: class teacher of that class
  API->>DB: set ACCEPTED + decider + timestamp (audit)
  API-->>Parent: notification: decision
```
