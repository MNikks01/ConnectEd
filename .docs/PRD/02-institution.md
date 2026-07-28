# PRD — Institution & Classes

`Status: Accepted` · `Last updated: 2026-07-28`

Actors: School (write), Principal (view). The school sets up the academic structure everything else hangs off.

## Requirements

| ID | Priority | Requirement | Acceptance criteria |
|---|:--:|---|---|
| FR-INST-001 | P0 | A school maintains its profile (name, admin, contact, full address, about/mission/vision, facilities, achievements, establishment year, affiliation). | All fields editable; profile visible to members/followers. |
| FR-INST-002 | P0 | A school creates classes as **Medium + Class-level + Section**. | Medium ∈ {English, Hindi}; level ∈ {Pre-Nursery, Nursery, KG-1, KG-2, Class 1–12}; section ∈ {A–E}. Uniqueness enforced per school. |
| FR-INST-003 | P0 | A school defines the **subjects** of each class. | Subjects list per class; editable; used to scope teacher allocation and academic publishing. |
| FR-INST-004 | P0 | A school allocates a **class teacher** to a class. | Exactly one active class teacher per class; must be a verified teacher of the school. |
| FR-INST-005 | P1 | A school manages its member roster (view verified students/parents/teachers/principal; remove a member). | Removal revokes that member's academic access to the school immediately. |
| FR-INST-006 | P1 | A school can deactivate/reactivate a class. | Deactivated class hides from publishing targets; existing data retained. |
| FR-INST-007 | P2 | A school can have multiple principals? (default: one). | **Assumption:** single principal per school in v1; multi supported later. |

## Class taxonomy (canonical enumeration)

- **Mediums:** English, Hindi.
- **Levels:** Pre-Nursery, Nursery, KG-1, KG-2, Class 1, …, Class 12.
- **Sections:** A, B, C, D, E.

A class is a relational row `(school_id, medium, level, section)` with a unique constraint. The legacy string key
(`EngClass8SecA`) is derived for display only.

## Relationships

```mermaid
erDiagram
  SCHOOL ||--o{ CLASS : "has"
  CLASS ||--o{ SUBJECT : "offers"
  CLASS ||--|| CLASS_TEACHER : "allocated"
  TEACHER ||--o{ SUBJECT_ALLOCATION : "teaches"
  CLASS ||--o{ MEMBERSHIP : "verified members"
```
