/**
 * Domain events — the preferred way modules integrate side effects
 * (`.docs/Architecture/01-modules.md` rule 5).
 *
 * The publisher is deliberately trivial and the *contract* is the interesting part:
 *
 * - **Every event carries an `eventId`.** Delivery is at-least-once, so a consumer will sometimes
 *   see the same event twice; the id is what lets it be idempotent
 *   (`.docs/PRD/07-notifications.md`).
 * - **An event is written in the transaction that produced it** (ADR-0019). There is no publisher
 *   any more: a service does not hand an event to a queue, it records one alongside its write and
 *   a relay does the handing over. What a test asserts on is therefore the row, not a fake.
 *
 *   The interface that used to live here — `publish`, which never threw and dropped the event on
 *   failure — was the right shape for the wrong problem. It protected the caller from Redis by
 *   sacrificing the notification, because by the time it ran the transaction had already closed.
 */
import { randomUUID } from 'node:crypto';

import type {
  FeedbackStatus,
  LeaveKind,
  LeaveStatus,
  UserRole,
  VerificationStatus,
} from '../../generated/prisma/client.js';

export interface DomainEventBase {
  /** Idempotency key for consumers. Generated once, at publication. */
  eventId: string;
  occurredAt: string;
}

export interface VerificationSubmittedEvent extends DomainEventBase {
  type: 'verification.submitted';
  requestId: string;
  requesterAccountId: string;
  schoolId: string;
  role: UserRole;
}

export interface VerificationDecidedEvent extends DomainEventBase {
  type: 'verification.decided';
  requestId: string;
  requesterAccountId: string;
  schoolId: string;
  role: UserRole;
  status: VerificationStatus;
}

export interface MembershipRevokedEvent extends DomainEventBase {
  type: 'membership.revoked';
  accountId: string;
  schoolId: string;
}

export interface AcademicPublishedEvent extends DomainEventBase {
  type: 'academic.published';
  itemId: string;
  classId: string;
  itemType: string;
  title: string;
  authorAccountId: string;
}

export interface NoticePublishedEvent extends DomainEventBase {
  type: 'notice.published';
  noticeId: string;
  schoolId: string;
  title: string;
  authorAccountId: string;
}

export interface EventPublishedEvent extends DomainEventBase {
  type: 'event.published';
  /** Not `eventId` — that name is taken by the envelope's idempotency key. */
  eventEntityId: string;
  schoolId: string;
  title: string;
  eventAt: string;
}

export interface LeaveDecidedEvent extends DomainEventBase {
  type: 'leave.decided';
  leaveId: string;
  applicantAccountId: string;
  schoolId: string;
  kind: LeaveKind;
  /** `ACCEPTED` or `REJECTED` — `RECEIVED` never produces this event. */
  status: LeaveStatus;
}

export interface FeedbackReviewedEvent extends DomainEventBase {
  type: 'feedback.reviewed';
  feedbackId: string;
  authorAccountId: string;
  schoolId: string;
  status: FeedbackStatus;
}

export type DomainEvent =
  | VerificationSubmittedEvent
  | VerificationDecidedEvent
  | MembershipRevokedEvent
  | AcademicPublishedEvent
  | NoticePublishedEvent
  | EventPublishedEvent
  | LeaveDecidedEvent
  | FeedbackReviewedEvent;

/**
 * What a module publishes: any event minus the envelope fields, which are filled in here.
 *
 * Distributed on purpose. A plain `Omit<DomainEvent, ...>` over a union collapses to the keys the
 * members share, so `requestId` would not typecheck — the compiler would accept an event missing
 * half its data.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type PublishableEvent = DistributiveOmit<DomainEvent, 'eventId' | 'occurredAt'>;

/** Adds the envelope fields every event needs. */
export function envelope(event: PublishableEvent): DomainEvent {
  return {
    ...event,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
  };
}
