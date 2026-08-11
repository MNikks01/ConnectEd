/**
 * `Cache-Control` on API responses — ASVS 8.1.1, found walking L2 on 2026-08-11.
 *
 * Helmet stopped setting cache headers at v4, so until this was added every authorized JSON
 * response — a register, a mark, a child's report card — went out with no directives at all. What
 * then decides whether a shared cache keeps a copy is *heuristic freshness*: a guess made by a
 * proxy nobody in this project configured, about data belonging to children.
 *
 * The test is deliberately about the header rather than about a cache, because there is no cache
 * in this suite to observe. That is the honest limit of it: this proves the instruction is sent,
 * not that every intermediary obeys.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
  app = createApp({ config, logger, db });
});

describe('Cache-Control', () => {
  it('tells every cache not to store an authorized response', async () => {
    const token = await tokens.signAccessToken({
      sub: fixture.studentAccountId,
      accountType: 'INDIVIDUAL',
      role: 'STUDENT',
    });

    const response = await request(app)
      .get('/api/v1/me/memberships')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // `no-store`, not `no-cache`: the latter permits storage and merely requires revalidation, and
    // "stored but revalidated" is still a copy of a child's data on a machine between us and the
    // reader.
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('covers a refusal too, because a 403 names a resource that exists', async () => {
    const response = await request(app).get('/api/v1/me/memberships');

    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('leaves the liveness probe alone, which carries nothing and is polled hard', async () => {
    const response = await request(app).get('/healthz').expect(200);

    expect(response.headers['cache-control']).toBeUndefined();
  });
});
