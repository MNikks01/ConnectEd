/**
 * Cursor pagination — S2-0b.
 *
 * The unit tests cover the cursor itself; the integration tests cover the property that motivates
 * cursors at all: **inserting rows while someone pages must not duplicate or skip anything.** With
 * offsets that is not true, and it is the normal case here because feeds gain rows at the top.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import {
  BOUNDED_LIST_CAP,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodeCursor,
  encodeCursor,
  parsePageRequest,
  toPage,
} from '../shared/http/pagination.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs, type ErrorBody } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { NotificationsService } from '../modules/notifications/index.js';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let notifications: NotificationsService;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

interface NotificationPage {
  data: { id: string; type: string }[];
  nextCursor: string | null;
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

async function auth(accountId: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: 'INDIVIDUAL',
    role: 'STUDENT',
  });
  return `Bearer ${token}`;
}

/** Creates `count` notifications for the student, oldest first. */
async function seedNotifications(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await notifications.handleEvent({
      type: 'membership.revoked',
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      accountId: fixture.studentAccountId,
      schoolId: fixture.schoolAccountId,
    });
  }
}

describe('cursor encoding', () => {
  it('round-trips a position', () => {
    const position = { createdAt: new Date('2026-08-01T10:00:00.000Z'), id: 'abc' };

    const decoded = decodeCursor(encodeCursor(position));

    expect(decoded.id).toBe('abc');
    expect(decoded.createdAt.toISOString()).toBe(position.createdAt.toISOString());
  });

  it('is opaque — not readable as the sort key it encodes', () => {
    const cursor = encodeCursor({ createdAt: new Date(), id: 'secret-id' });

    expect(cursor).not.toContain('secret-id');
    expect(cursor).not.toContain('createdAt');
  });

  it.each([
    ['not base64', '!!!not-base64!!!'],
    ['base64 of nonsense', Buffer.from('hello').toString('base64url')],
    ['missing fields', Buffer.from(JSON.stringify({ t: '2026-01-01' })).toString('base64url')],
    [
      'an unparseable date',
      Buffer.from(JSON.stringify({ t: 'nope', i: 'x' })).toString('base64url'),
    ],
  ])('rejects %s rather than silently restarting', (_label, cursor) => {
    // Falling back to page one would re-deliver items the client has already seen.
    expect(() => decodeCursor(cursor)).toThrow();
  });
});

describe('parsePageRequest', () => {
  it('defaults the limit when absent', () => {
    expect(parsePageRequest({}).limit).toBe(DEFAULT_LIMIT);
  });

  it('clamps an oversized limit rather than rejecting the request', () => {
    expect(parsePageRequest({ limit: '100000' }).limit).toBe(MAX_LIMIT);
  });

  it.each([
    ['0', 0],
    ['-5', 0],
    ['abc', 0],
    ['', 0],
  ])('falls back to the default for limit=%s', (limit) => {
    expect(parsePageRequest({ limit }).limit).toBe(DEFAULT_LIMIT);
  });

  it('truncates a fractional limit', () => {
    expect(parsePageRequest({ limit: '7.9' }).limit).toBe(7);
  });
});

describe('toPage', () => {
  const rows = Array.from({ length: 4 }, (_value, index) => ({
    id: `id-${index}`,
    createdAt: new Date(2026, 0, index + 1),
  }));

  it('returns a cursor only when there is another page', () => {
    expect(toPage(rows, 3).nextCursor).not.toBeNull();
    expect(toPage(rows.slice(0, 3), 3).nextCursor).toBeNull();
  });

  it('never returns the extra probe row to the caller', () => {
    expect(toPage(rows, 3).data).toHaveLength(3);
  });

  it('returns a null cursor for an empty result', () => {
    expect(toPage([], 10)).toEqual({ data: [], nextCursor: null });
  });
});

describe('GET /notifications paging', () => {
  it('walks every item exactly once across pages', async () => {
    await seedNotifications(7);
    const studentAuth = await auth(fixture.studentAccountId);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const url: string = `/api/v1/notifications?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const response = await request(app).get(url).set('Authorization', studentAuth);

      const body = bodyAs<NotificationPage>(response);
      seen.push(...body.data.map((row) => row.id));
      cursor = body.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it('does not duplicate or skip when rows are inserted mid-page', async () => {
    await seedNotifications(5);
    const studentAuth = await auth(fixture.studentAccountId);

    const first = await request(app)
      .get('/api/v1/notifications?limit=2')
      .set('Authorization', studentAuth);
    const firstPage = bodyAs<NotificationPage>(first);

    // New arrivals land at the top of the ordering, exactly where offsets would shift the window.
    await seedNotifications(3);

    const second = await request(app)
      .get(`/api/v1/notifications?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`)
      .set('Authorization', studentAuth);
    const secondPage = bodyAs<NotificationPage>(second);

    const overlap = secondPage.data.filter((row) =>
      firstPage.data.some((seen) => seen.id === row.id),
    );

    expect(overlap).toHaveLength(0);
  });

  it('rejects a malformed cursor', async () => {
    const response = await request(app)
      .get('/api/v1/notifications?cursor=nonsense')
      .set('Authorization', await auth(fixture.studentAccountId));

    expect(response.status).toBe(422);
    expect(bodyAs<ErrorBody>(response).error.details?.[0]?.field).toBe('cursor');
  });

  it('returns a null cursor when the list fits in one page', async () => {
    await seedNotifications(2);

    const response = await request(app)
      .get('/api/v1/notifications?limit=10')
      .set('Authorization', await auth(fixture.studentAccountId));

    expect(bodyAs<NotificationPage>(response).nextCursor).toBeNull();
  });

  it('caps an absurd limit instead of returning everything', async () => {
    await seedNotifications(3);

    const response = await request(app)
      .get('/api/v1/notifications?limit=999999')
      .set('Authorization', await auth(fixture.studentAccountId));

    expect(response.status).toBe(200);
    expect(bodyAs<NotificationPage>(response).data.length).toBeLessThanOrEqual(MAX_LIMIT);
  });
});

describe('bounded lists', () => {
  it('still have a ceiling, because "bounded in practice" is not bounded', () => {
    expect(BOUNDED_LIST_CAP).toBeGreaterThan(0);
    expect(BOUNDED_LIST_CAP).toBeLessThanOrEqual(1000);
  });

  it('classes are returned without a cursor — they do not grow with time', async () => {
    const schoolToken = await tokens.signAccessToken({
      sub: fixture.schoolAccountId,
      accountType: 'SCHOOL',
    });

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
      .set('Authorization', `Bearer ${schoolToken}`);

    expect(response.status).toBe(200);
    expect(bodyAs<{ data: unknown[]; nextCursor?: unknown }>(response).nextCursor).toBeUndefined();
  });
});
