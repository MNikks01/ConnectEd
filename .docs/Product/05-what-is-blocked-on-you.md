# Product — What is blocked on you

`Status: Accepted` · `Last updated: 2026-08-09`

Everything engineering cannot do without an answer, an account, or a person. Each item says what to
decide, **how to actually do it**, and what happens the moment it lands.

Written because "blocked on product" had been a phrase in sprint plans for five sprints without a
list anybody could act on. This is that list.

## If you read one line

**Answer [B-1](#b-1--where-production-runs) — where production runs.** It is the only item that
unblocks more than itself: two sprint items, four half-met non-functional requirements, and the
difference between a repository and a product a school can open.

---

## The state of things, honestly

**Every P0 requirement is built.** A school can be created and verified, run classes and subjects,
publish homework and notices, take a register, mark work, issue report cards, handle leave, and
moderate its community — all with server-enforced authorization, ~1,150 API tests and 141
end-to-end tests behind it.

**What the product cannot do**, and why:

| Cannot                    | Because                                      | Item                                    |
| ------------------------- | -------------------------------------------- | --------------------------------------- |
| Run anywhere but a laptop | No environment has ever existed              | [B-1](#b-1--where-production-runs)      |
| Take money                | No payment provider chosen                   | [B-2](#b-2--a-payment-provider)         |
| Send an email             | No mail transport chosen                     | [B-3](#b-3--a-mail-transport)           |
| Speak Hindi               | No internationalisation, and nobody asked    | [B-10](#things-that-are-mine-not-yours) |
| Honour an erasure request | Export and deletion were promised, not built | [B-9](#things-that-are-mine-not-yours)  |

Four of those five are waiting on a decision below.

---

## Decisions

### B-1 — Where production runs

**Blocks:** a staging environment, Terraform, and the deployed half of four NFRs (latency,
throughput, tracing, backup retention). It is the largest single unblock in the project.

**Why it is yours.** It follows the pilot schools — the legacy product was India-first — and it
carries a recurring bill. Neither is an engineering call.

**What to decide.** Three questions, in order:

1. **Managed platform or Kubernetes?** A managed platform (Render, Railway, Fly.io, App Runner)
   takes days and costs more per unit. Kubernetes (GKE, EKS, AKS) takes weeks and pays off at a
   scale this product is nowhere near. **Recommendation: managed, and revisit at real load.**
2. **Which region?** Put it where the schools are. If the pilot is Indian, an Indian region halves
   round-trip latency against a European one, and data residency is a question schools ask.
3. **Managed Postgres, or self-hosted?** **Recommendation: managed** — it is what makes point-in-time
   recovery possible, which is half of NFR-014 and cannot be built by hand for a reasonable price.

**How to do it.**

- Open an account with the chosen provider and add billing.
- Create the project/organisation and invite me — or, if you would rather not give access, create
  the resources yourself and hand over the connection strings.
- Put the credentials in **GitHub → Settings → Secrets and variables → Actions** as repository
  secrets. Never in the repository — `.gitleaks.toml` scans every commit, and a secret in git is a
  secret published.

**What I do the moment it lands.** Terraform for the resources (S9-8), a staging environment the
release actually reaches (S9-4), the smoke test wired to fail a deploy (S9-5), a scheduled backup
with the restore drill run against real data (S9-7), and the latency numbers taken again where they
mean something (S9-10).

**Rough cost.** A managed platform plus a small managed Postgres and Redis, for staging and
production, is the first recurring cost this project has. Check current pricing when you choose;
it is not a number I can honestly quote.

---

### B-2 — A payment provider

**Blocks:** FR-BILL-002 (checkout), FR-BILL-004 (webhooks), FR-BILL-005 (dunning), FR-BILL-006
(invoices). Asked for five sprints; **deferred by you on 2026-08-08** until everything else is
complete, which is a legitimate answer and is why it is not marked urgent here.

**What to decide.** **Stripe or Razorpay.** Follow the money, not the API:

- **Razorpay** if the pilot is Indian. It handles UPI, and UPI is how Indian schools are paid.
- **Stripe** if you expect to be outside India within a year. Better docs, wider reach, no UPI.

Both are supported equally well by what exists — the plan catalogue, subscription states including
`PAST_DUE`, trial creation, and limit enforcement are all built and provider-agnostic.

**How to do it.**

1. Open a business account with the chosen provider. This needs company registration details and a
   bank account, and **verification takes days to weeks** — start it before you need it.
2. Get the test-mode API keys.
3. Add them as GitHub Actions secrets, and to the secrets manager once B-1 exists.
4. Tell me the choice; I write ADR-0015 recording it and why.

**What I do.** A provider port with a fake for tests, then checkout, webhook reconciliation and
dunning behind it (S8-10 … S8-13). The port comes first so the provider can be changed later
without touching the business rules.

**Related and also yours: [B-5](#b-5--what-a-plan-actually-costs).**

---

### B-3 — A mail transport

**Blocks:** FR-AUTH-010 (email verification gate), FR-NOTIF-007 (daily digest). Also **deferred on
2026-08-08**. Password reset (FR-AUTH-009) is built and **undeliverable** without this — the token,
expiry, single-use and session revocation all work; nothing can send the link.

**What to decide.** Any of Amazon SES, Postmark, Resend, SendGrid, or plain SMTP.

- **Postmark or Resend** if you want it working this week — minutes to integrate, higher per-email
  cost, excellent deliverability.
- **Amazon SES** if you are already on AWS from B-1 and expect volume — cheapest at scale, and it
  starts in a sandbox that only sends to addresses you have verified until you request production
  access, which takes a day or two.

**How to do it.**

1. Open the account and verify a sending domain — this means adding **SPF, DKIM and DMARC** DNS
   records to whatever domain the product will send from. Mail without them lands in spam.
2. Get an API key.
3. Add it as a secret, as above.

**One ordering constraint, and it is not a preference.** FR-AUTH-010 gates unverified accounts. If
it ships before the transport works, **every new user is locked out on the day it deploys**. The
transport ships first and is proven to deliver; the gate follows.

---

### B-4 — Retention

**Blocks:** nothing today, and it gets more expensive every term. Asked in **three** PRDs —
gradebook, attendance, report cards — and unanswered in all three.

**Why it matters more than it sounds.** Attendance is a legal record in many jurisdictions, with a
statutory minimum retention. Marks are the longest-lived data the product holds. A report card is
the artefact a family is most likely to ask for years later. Every term of real data makes the
eventual migration larger, and the wrong answer is discovered by a regulator rather than by us.

**What to decide.** Three questions:

1. **How long after a pupil leaves** are their marks, registers and report cards kept?
2. **What does a leaving pupil's record become** — retained in full, anonymised, or deleted?
3. **Does a school get to choose**, or is there one policy for everybody?

**How to do it.** This one needs an answer from outside engineering _and_ outside product: whoever
advises you on Indian education-sector data rules, or the equivalent where the pilot is. Bring back
a number of years per record type. **A defensible default while you ask: keep everything, delete
nothing, and say so** — that is what the product does today, and it is at least honest.

**What I do.** A retention policy in the schema and a scheduled purge, plus the erasure half of
B-9 below, which is the same machinery.

---

### B-5 — What a plan actually costs

**Blocks:** nothing structural — the enforcement is built and working — but the numbers in the
catalogue are **provisional and marked as such in the code**.

Today: trial 5 classes / 200 members, standard 40 / 1,500, premium unlimited, with advanced
analytics on premium. Schools are enforced against these right now.

**What to decide.** The limits, the prices, and the currency. **How to do it:** change the numbers
in [`apps/api/src/modules/billing/plan-catalogue.ts`](../../apps/api/src/modules/billing/plan-catalogue.ts)
— it is a one-line edit per value and a restart, deliberately, because the catalogue lives in code
rather than in a migration. Tell me the numbers, or edit them yourself; the file says which values
are yours to set.

---

### B-6 — Four product questions with no engineering blocked behind them

Answer when convenient. Each is recorded in its PRD as an open question.

| #     | Question                                                                             | Where                 | Why it will come up                                                                            |
| ----- | ------------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| B-6.1 | **May a family download or keep a report card?**                                     | `PRD/13-report-cards` | Decides whether "a card is a screen for now" holds, or whether PDF work starts                 |
| B-6.2 | **When does an absence notification go out** — immediately, or after a grace period? | `PRD/12-attendance`   | A parent told at 09:05 that a teenager is absent is a different product from one told at 16:00 |
| B-6.3 | **May a parent explain an absence from the app**, turning `ABSENT` into `EXCUSED`?   | `PRD/12-attendance`   | It moves a register entry out of the school's sole control                                     |
| B-6.4 | **What does a mid-term joiner's card say?**                                          | `PRD/13-report-cards` | Their card is honest and thin, and reads as underperformance                                   |

---

## Accounts and access only you can create

None of these are decisions; they are things with your name on the bill.

| #     | What                                     | Needed for           | Notes                                                                                                                                                                            |
| ----- | ---------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-7.1 | **A domain name**                        | Anything public      | Also where the mail records in B-3 go. Buy it before the deploy, not during                                                                                                      |
| B-7.2 | **TLS certificate**                      | Session cookies      | Usually free and automatic on a managed platform. Worth naming because the `Secure` cookie flag is real: over plain HTTP, **Safari drops the session entirely** — found in S9-17 |
| B-7.3 | **Cloud account + billing**              | B-1                  | See above                                                                                                                                                                        |
| B-7.4 | **Payment account**                      | B-2                  | Verification takes days to weeks — start early                                                                                                                                   |
| B-7.5 | **Mail account + DNS records**           | B-3                  | SPF, DKIM, DMARC                                                                                                                                                                 |
| B-7.6 | **An error-tracking account** (optional) | Production diagnosis | Sentry or similar. The observability stack is built; nothing is collecting from a deployed app                                                                                   |

---

## The one process item

### B-8 — A second pair of eyes

**Ten sprints, no code has been reviewed by another person.** Branch protection requires five
passing checks and **zero approving reviews**, deliberately: GitHub does not let anyone approve
their own pull request, and with one collaborator a review requirement would route every merge
through the admin override — which is worse than no requirement, because it looks like a rule.

**How to fix it.** Add a collaborator (**Settings → Collaborators**), then set **required approving
reviews to 1** on `main` and `development`. Until then the guarantee simply does not exist, and no
amount of automation substitutes for it — a wrong security group or a mistaken permission boundary
is not caught by a type checker.

Worth doing before B-1, not after: infrastructure is where a second reader is worth most.

---

## Things that are mine, not yours

Listed so the boundary is clear. None of these need you.

| #    | What                                              | State                                                                                                                          |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| B-9  | **Export and erasure** (NFR-006)                  | Not built. `Security/04-compliance.md` promises both as subject rights. **The highest-priority unblocked work in the project** |
| B-10 | **Internationalisation** (NFR-016)                | Not started. `Class.medium` already offers Hindi; the product models the language and cannot speak it                          |
| B-11 | **The mobile client**                             | A phase, not a task. FR-NOTIF-004 (push tokens) waits on it                                                                    |
| B-12 | **OWASP ASVS L2 walked as a checklist** (NFR-005) | A security review exists and found real defects; the standard has never been walked formally                                   |
| B-13 | **A human accessibility audit** (NFR-012)         | Automated scanning is clean across every screen; that is the mechanical third only                                             |

---

## Summary

| Item | What                   | Urgency                                                 |
| ---- | ---------------------- | ------------------------------------------------------- |
| B-1  | Where production runs  | **Highest.** Unblocks two sprint items and four NFRs    |
| B-8  | A second reviewer      | **High**, and higher still before B-1 lands             |
| B-4  | Retention              | **Rising.** Costs more every term, has a legal edge     |
| B-3  | Mail transport         | Deferred by you; FR-AUTH-009 is built and undeliverable |
| B-2  | Payment provider       | Deferred by you                                         |
| B-5  | Plan limits and prices | Whenever — provisional numbers are enforced today       |
| B-6  | Four product questions | Whenever                                                |
| B-7  | Accounts and DNS       | As each of B-1 … B-3 is answered                        |

The engineering position is straightforward: **there is no unblocked feature work left that anybody
asked for.** What remains is a deployment, two integrations behind your deferrals, and two
commitments the product made in its own documents (export/erasure, Hindi) that nobody has been
asked to schedule.
