/**
 * Notifications — S1-11 (FR-NOTIF-001, 003, 005, 006).
 *
 * The event handler is exercised directly rather than through Redis. What is worth testing is the
 * *behaviour* — who gets notified, what happens on redelivery, whether preferences are honoured —
 * and a real queue would add wall-clock time and flakiness without changing any of those answers.
 * The queue itself is BullMQ's to get right.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { recordingPublisher } from '../shared/events/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { NotificationsService } from '../modules/notifications/index.js';
import type { Db } from '../shared/db/index.js';
import type { DomainEvent } from '../shared/events/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let notifications: NotificationsService;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

interface ListBody {
  data: { id: string; type: string; read: boolean; payload: unknown }[];
  unreadCount: number;
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config });
  notifications = createNotificationsModule(db, logger).service;
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

async function auth(accountId: string, kind: 'SCHOOL' | 'INDIVIDUAL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

function decidedEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    type: 'verification.decided',
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    requestId: crypto.randomUUID(),
    requesterAccountId: fixture.studentAccountId,
    schoolId: fixture.schoolAccountId,
    role: 'STUDENT',
    status: 'VERIFIED',
    ...overrides,
  } as DomainEvent;
}

describe('event fan-out', () => {
  it('notifies the school when a request is submitted', async () => {
    await notifications.handleEvent({
      type: 'verification.submitted',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      requestId: crypto.randomUUID(),
      requesterAccountId: fixture.studentAccountId,
      schoolId: fixture.schoolAccountId,
      role: 'STUDENT',
    });

    const rows = await db.notification.findMany({
      where: { recipientAccountId: fixture.schoolAccountId },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('verification.submitted');
  });

  it('notifies the requester when a decision is made', async () => {
    await notifications.handleEvent(decidedEvent());

    const rows = await db.notification.findMany({
      where: { recipientAccountId: fixture.studentAccountId },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('verification.decided');
  });

  it('notifies the member when their membership is revoked', async () => {
    await notifications.handleEvent({
      type: 'membership.revoked',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      accountId: fixture.studentAccountId,
      schoolId: fixture.schoolAccountId,
    });

    const rows = await db.notification.findMany({
      where: { recipientAccountId: fixture.studentAccountId },
    });

    expect(rows).toHaveLength(1);
  });

  it('ignores an event type it does not handle rather than throwing', async () => {
    // A handler that threw here would retry forever and eventually dead-letter the job.
    await expect(
      notifications.handleEvent({ type: 'something.else', eventId: 'x' } as unknown as DomainEvent),
    ).resolves.toBeUndefined();
  });
});

describe('idempotency (at-least-once delivery)', () => {
  it('creates one notification when the same event is delivered twice', async () => {
    const event = decidedEvent();

    await notifications.handleEvent(event);
    await notifications.handleEvent(event);

    const rows = await db.notification.findMany({
      where: { recipientAccountId: fixture.studentAccountId },
    });

    expect(rows).toHaveLength(1);
  });

  it('still notifies each recipient separately for one event id', async () => {
    // The constraint is (event_id, recipient) — a single event fanning out to a class must not
    // have the first recipient's row block everyone else's.
    const eventId = crypto.randomUUID();

    await notifications.handleEvent(decidedEvent({ eventId }));
    await notifications.handleEvent(
      decidedEvent({ eventId, requesterAccountId: fixture.parentAccountId }),
    );

    const rows = await db.notification.findMany({ where: { eventId } });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.recipientAccountId).sort()).toEqual(
      [fixture.studentAccountId, fixture.parentAccountId].sort(),
    );
  });
});

describe('preferences (FR-NOTIF-006)', () => {
  it('delivers when no preference has been set — opt-out, not opt-in', async () => {
    await notifications.handleEvent(decidedEvent());

    expect(await db.notification.count()).toBe(1);
  });

  it('does not deliver a category the recipient has disabled', async () => {
    await db.notificationPref.create({
      data: { accountId: fixture.studentAccountId, category: 'VERIFICATION', enabled: false },
    });

    await notifications.handleEvent(decidedEvent());

    expect(await db.notification.count()).toBe(0);
  });

  it('is per category — disabling one does not silence another', async () => {
    await db.notificationPref.create({
      data: { accountId: fixture.studentAccountId, category: 'SOCIAL', enabled: false },
    });

    await notifications.handleEvent(decidedEvent());

    expect(await db.notification.count()).toBe(1);
  });
});

describe('GET /notifications', () => {
  beforeEach(async () => {
    await notifications.handleEvent(decidedEvent());
  });

  it('returns the caller’s own notifications with an unread count', async () => {
    const response = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    expect(response.status).toBe(200);
    expect(bodyAs<ListBody>(response).data).toHaveLength(1);
    expect(bodyAs<ListBody>(response).unreadCount).toBe(1);
  });

  it('never returns someone else’s notifications', async () => {
    const response = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'));

    expect(bodyAs<ListBody>(response).data).toHaveLength(0);
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/api/v1/notifications');

    expect(response.status).toBe(401);
  });

  it('filters to unread when asked', async () => {
    const studentAuth = await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
    const listed = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', studentAuth);
    const id = bodyAs<ListBody>(listed).data[0]?.id ?? '';

    await request(app).post(`/api/v1/notifications/${id}/read`).set('Authorization', studentAuth);

    const unread = await request(app)
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', studentAuth);

    expect(bodyAs<ListBody>(unread).data).toHaveLength(0);
    expect(bodyAs<ListBody>(unread).unreadCount).toBe(0);
  });
});

describe('POST /notifications/:id/read', () => {
  it('marks the caller’s notification read', async () => {
    await notifications.handleEvent(decidedEvent());
    const studentAuth = await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');

    const listed = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', studentAuth);
    const id = bodyAs<ListBody>(listed).data[0]?.id ?? '';

    const response = await request(app)
      .post(`/api/v1/notifications/${id}/read`)
      .set('Authorization', studentAuth);

    expect(response.status).toBe(204);
    const row = await db.notification.findUnique({ where: { id } });
    expect(row?.readAt).not.toBeNull();
  });

  it('refuses to mark someone else’s notification read, with 404', async () => {
    await notifications.handleEvent(decidedEvent());
    const row = await db.notification.findFirst();

    const response = await request(app)
      .post(`/api/v1/notifications/${row?.id ?? ''}/read`)
      .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'));

    // 404 rather than 403: the id must not be confirmed to exist.
    expect(response.status).toBe(404);
    const unchanged = await db.notification.findUnique({ where: { id: row?.id ?? '' } });
    expect(unchanged?.readAt).toBeNull();
  });
});

describe('verification emits the events', () => {
  it('publishes verification.decided when a school approves', async () => {
    const events = recordingPublisher();
    const { createVerificationModule } = await import('../modules/verification/index.js');
    const verification = createVerificationModule(db, logger, events);

    const student = await db.account.create({
      data: {
        email: `emit-${Date.now()}@fixture.test`,
        type: 'INDIVIDUAL',
        userProfile: { create: { fullName: 'Emit', handle: `emit${Date.now()}`, role: 'STUDENT' } },
      },
      select: { id: true },
    });

    const actor = {
      accountId: student.id,
      accountType: 'INDIVIDUAL' as const,
      role: 'STUDENT' as const,
    };
    const created = await verification.service.submit(actor, {
      role: 'STUDENT',
      schoolId: fixture.schoolAccountId,
      classId: fixture.classAId,
    });

    await verification.service.decide(
      { accountId: fixture.schoolAccountId, accountType: 'SCHOOL' },
      created.id,
      { decision: 'APPROVE' },
    );

    const types = events.published.map((event) => event.type);
    expect(types).toContain('verification.submitted');
    expect(types).toContain('verification.decided');
  });
});
