/**
 * Domain events — the preferred way modules integrate side effects
 * (`.docs/Architecture/01-modules.md` rule 5).
 *
 * The publisher is deliberately trivial and the *contract* is the interesting part:
 *
 * - **Every event carries an `eventId`.** Delivery is at-least-once, so a consumer will sometimes
 *   see the same event twice; the id is what lets it be idempotent
 *   (`.docs/PRD/07-notifications.md`).
 * - **Publishing never throws into the caller.** A verification decision must not fail because
 *   Redis is unreachable — the decision is the transaction, the notification is a consequence of
 *   it. A failure here is logged and the event is dropped.
 * - **The publisher is an interface**, so a service can be tested with a recording fake and does
 *   not need Redis to assert "this emitted the right event".
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

export interface EventPublisher {
  publish: (event: PublishableEvent) => Promise<void>;
}

/** Adds the envelope fields every event needs. */
export function envelope(event: PublishableEvent): DomainEvent {
  return {
    ...event,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
  };
}

/** Used where events are irrelevant — unit tests of unrelated logic, and apps built without Redis. */
export const noopPublisher: EventPublisher = {
  publish: () => Promise.resolve(),
};

/** Records what was published, for tests that assert on emissions without a queue. */
export function recordingPublisher(): EventPublisher & { published: DomainEvent[] } {
  const published: DomainEvent[] = [];

  return {
    published,
    publish: (event) => {
      published.push(envelope(event));
      return Promise.resolve();
    },
  };
}
