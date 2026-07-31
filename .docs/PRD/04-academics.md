# PRD — Academics

`Status: Accepted` · `Last updated: 2026-07-28`

Homework/assignments/projects, notices, events, timetable, syllabus coverage. All gated by verification.

## Homework / Assignments / Projects

| ID          | Priority | Requirement                                                                                                 | Acceptance criteria                                                                                                         |
| ----------- | :------: | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| FR-ACAD-001 |    P0    | A verified teacher publishes homework/assignment/project to a subject within a class they are allocated to. | Item created with type, subject, class, title, description, optional image, due date. Only allocated teacher/class allowed. |
| FR-ACAD-002 |    P0    | Verified students & their parents see items for their class.                                                | Item appears in the class feed for verified members; not visible to others.                                                 |
| FR-ACAD-003 |    P0    | Per-member **read tracking** on each item.                                                                  | Opening an item marks it read for that member; teacher sees read/unread counts.                                             |
| FR-ACAD-004 |    P1    | Publishing notifies verified parents/students of the class.                                                 | Notification dispatched within SLO (< 10 s median).                                                                         |
| FR-ACAD-005 |    P1    | Teacher can edit/delete their own item.                                                                     | Edit/delete restricted to author (or school); soft-delete.                                                                  |
| FR-ACAD-006 |    P1    | Items support an image attachment.                                                                          | Image uploaded to object storage; served via signed URL; size/type validated.                                               |

## Notices & Events

| ID          | Priority | Requirement                                                      | Acceptance criteria                                  |
| ----------- | :------: | ---------------------------------------------------------------- | ---------------------------------------------------- |
| FR-ACAD-010 |    P0    | School/principal publishes a **notice** to the school community. | Notice visible to members/followers; read-tracked.   |
| FR-ACAD-011 |    P0    | School creates **events** (title, description, date).            | Events listed chronologically; visible to community. |
| FR-ACAD-012 |    P1    | Notices/events notify recipients.                                | In-app notification on publish.                      |

## Timetable

| ID          | Priority | Requirement                                       | Acceptance criteria                                                       |
| ----------- | :------: | ------------------------------------------------- | ------------------------------------------------------------------------- |
| FR-ACAD-020 |    P0    | School uploads a **timetable** per class.         | Timetable (image/structured) stored per class; verified members can view. |
| FR-ACAD-021 |    P2    | Structured timetable (periods) rather than image. | **Roadmap** — v1 accepts image upload; structured later.                  |

## Syllabus coverage

| ID          | Priority | Requirement                                             | Acceptance criteria                                           |
| ----------- | :------: | ------------------------------------------------------- | ------------------------------------------------------------- |
| FR-ACAD-030 |    P0    | Teacher updates syllabus coverage progress per subject. | Progress recorded (topics/percent); visible to class members. |
| FR-ACAD-031 |    P1    | Members view coverage progress.                         | Read-only view for students/parents/principal.                |

## Feed model

A class member's "academics" view aggregates homework, notices and events relevant to their class, newest first,
with read/unread badges. See [`../UserFlows/`](../UserFlows/).
