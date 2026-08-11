# Sprint 10 — The sprint that cannot be planned around code

`Status: Planned` · `Last updated: 2026-08-11` · Duration: 2 weeks

**This is a proposal, and it is a different shape from the nine before it.** Adjust before
committing — but the thing that makes it different is not adjustable, so read the first section
before the backlog.

## Sprint goal

> A school somewhere other than a laptop opens this product and uses it.
>
> **If B-1 is not answered, this sprint has no goal**, and the honest response is to say so rather
> than to invent one.

## The finding this sprint has to open with

**There is no unblocked engineering work left.** Not "little" — none.

Sprint 9 opened by claiming the same thing, and it was wrong: writing the non-functional half of
the completeness record found two unblocked commitments hiding in the product's own documents
(export and erasure, and Hindi), and both were built. Since then the ASVS walk and the
product-event table have taken the last two items with them.

So the claim is made again, and this time with the evidence of having gone looking twice:

| What is left                                         | Waiting on                               |
| ---------------------------------------------------- | ---------------------------------------- |
| NFR-001, and the deployed half of 002, 003, 008, 014 | **B-1 — where production runs**          |
| ASVS V9 (TLS, ciphers, certificates)                 | **B-1**                                  |
| FR-BILL-002, 004, 005, 006                           | B-2, deferred by product                 |
| FR-AUTH-010, FR-NOTIF-007                            | B-3, deferred by product                 |
| FR-NOTIF-004                                         | the mobile client — a phase, not an item |
| Retention                                            | B-4                                      |
| NFR-016 → ✅                                         | a native speaker reading `hi.ts`         |
| NFR-012 → ✅                                         | a human accessibility audit              |
| ASVS 2.1.7                                           | B-14                                     |

Nine of those ten rows are somebody else's answer. The tenth is a phase.

**The risk has changed shape, and this is the part worth arguing about at planning.** For nine
sprints the risk was "are we building the right thing". It is now "we have built ten sprints of a
thing that has never run anywhere, for anyone". Every additional feature added before a deployment
increases the amount of untested-in-reality software, and none of it reduces that risk. The product
does not need more code. It needs a school.

## Prerequisites — decisions, not work

| #    | Decision                       | Blocks                            | Note                                                                                                                                                                               |
| ---- | ------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-1  | **Where production runs**      | S10-1 … S10-6, five NFRs, ASVS V9 | **Fifth sprint of asking.** It is now the only thing between this product and a school using it                                                                                    |
| B-8  | **A second reviewer**          | nothing, and that is the problem  | Ten sprints. The last four merges were an irreversible destructive operation, every screen in the product, a security walk, and a new personal-data table — all read by one person |
| B-4  | **Retention**                  | S10-9                             | Sharper since S9-15: `product_event` grows with usage rather than content                                                                                                          |
| B-14 | **Breached-password checking** | one ASVS row                      | New. Three options and a recommendation are written down                                                                                                                           |
| B-2  | Stripe or Razorpay             | S8-10 … S8-13                     | Deferred 2026-08-08, scheduled after "everything else" — and everything else is now done                                                                                           |
| B-3  | A mail transport               | S8-14, S8-15                      | Same. FR-AUTH-009 remains built and undeliverable                                                                                                                                  |

**B-2 and B-3 deserve a specific note.** They were deferred on 2026-08-08 "until everything else is
complete". Everything else is now complete. That deferral has therefore expired on its own terms,
and Sprint 10 planning is where it should be honoured or explicitly re-taken.

## Committed backlog — if B-1 is answered

Every item is the deployment. Nothing else belongs in this sprint.

| #     | Item                                                              | Owner   | Est. | DoD                                                                                                                  |
| ----- | ----------------------------------------------------------------- | ------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| S10-1 | **Terraform for the chosen target** (was S9-8)                    | devops  | L    | Database, Redis, bucket, networking, secrets manager. Applied from a clean state, twice, to prove it is repeatable   |
| S10-2 | **A staging environment the release reaches** (was S9-4)          | devops  | L    | Migrations as their own gated step; the worker as a second process, since that is the arrangement every test uses    |
| S10-3 | **The smoke test becomes a gate** (was S9-5)                      | devops  | M    | It is S9-5 proper only when a deploy runs it _and fails on it_. Sabotage-checked by breaking a deploy on purpose     |
| S10-4 | **An alert on `outbox_events_unpublished`**                       | devops  | S    | A stopped relay produces an empty queue, which looks exactly like a quiet afternoon. This is the only place it shows |
| S10-5 | **Scheduled backups, and the drill against real data** (was S9-7) | devops  | M    | Continuous archiving so RPO stops being unbounded. `restore-drill.mjs` runs against a real dump, not a seeded one    |
| S10-6 | **Latency and throughput, measured where they mean something**    | backend | M    | S9-10's numbers again, over a network, against a dataset with a term of history in it. NFR-002/003 move ◐ → ✅       |
| S10-7 | **ASVS V9** — TLS version, ciphers, certificate handling          | devops  | S    | The one chapter the walk could not finish. `Security/07-asvs-l2.md` gains its V9 row                                 |
| S10-8 | **A production deploy, gated, with a rollback proven**            | devops  | M    | Not "it deployed" — a rollback executed on purpose and the product still working afterwards                          |

## If B-1 is not answered

**Do not fill the sprint.** The honest options, in the order I would argue for them:

1. **Stop and wait.** Uncomfortable, and correct. There is no engineering work that reduces the
   project's actual risk, and inventing some increases it.
2. **Answer the people-shaped items instead** — find a Hindi reader (B-10), a second collaborator
   (B-8), an accessibility auditor (B-13). None is engineering; all three are blocking a ✅ and two
   are blocking trust rather than a checkbox.
3. **Start the mobile client** (B-11) as an explicit phase with its own planning, not as sprint
   filler. It is the only substantial buildable thing left, and it deserves a decision rather than
   a default.

**What not to do:** more features on a product that has never been deployed. That is the option
that feels like progress and is not.

## Stretch (only if committed done)

| #      | Item                                                    | Note                                                                                     |
| ------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| S10-9  | Retention implemented, once B-4 is answered             | The machinery exists — it is the erasure disposition on a schedule rather than a request |
| S10-10 | The analytics sink, now that there is somewhere to ship | `product_event` → the warehouse B-1 implies                                              |
| S10-11 | Breached-password check, once B-14 is answered          | One place: the shared password schema                                                    |

## Dependencies / risks

- **The first deploy is where configuration lies.** S7-17 is the precedent —
  `RUN_WORKER_IN_PROCESS` defaulted to `true` everywhere, so the split deployment had never started
  and its first run found a shipped defect where class fan-out reached nobody. Expect more of that
  shape, and budget for it rather than treating each as a surprise.

- **This sprint spends money**, and it is the first that does. A managed platform, a database, a
  registry and a staging environment are a recurring bill whose size depends on B-1.

- **The three outstanding retros were written on 2026-08-12**, from the record and labelled as
  such. **A4 is closed as failed rather than done**, and the reason is the finding: a retro held in
  the room needs a room, and this repository has one collaborator. An action assigned to a "whole
  team" could not be completed by the one person it landed on, and carrying it three times produced
  a missing ceremony _and_ a missing document. A1 replaces it with something achievable by that
  person; the ceremony version is worth reinstating the day B-8 is answered.

- **Still no second reviewer.** Ten sprints. This sprint's work is infrastructure, which is where a
  second pair of eyes is worth most: a wrong security group, an over-permissive bucket policy or a
  publicly-reachable database is not caught by a type checker, and none of the four merges that
  landed today were read by anybody but their author.

## Ceremonies

Planning · daily async standup · backlog refinement · review · **retro written from the record at
close** (Sprint 9's A1). The three owed were written on 2026-08-12; A4 is closed as failed.

## Definition of Done (item-level)

Unchanged, plus the one this sprint adds: **an infrastructure item is done when it has been
destroyed and recreated from scratch.** A Terraform state that only works forwards is a description
of one machine, not a definition of an environment — and the first time anyone finds out is during
an incident.

## Review notes

_Filled at review._

## Retro

_Written from the record at sprint close, in the PR that closes the sprint, labelled as a
reconstruction — see Sprint 9's action A1, which replaced A4 after it failed three times._
