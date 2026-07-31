import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { bodyAs, type ErrorBody } from './support/body.js';
import { createApp } from '../app.js';
import { ForbiddenError, ValidationFailedError } from '../shared/errors/index.js';
import { CORRELATION_ID_HEADER, correlationId } from '../shared/middleware/correlation-id.js';
import { errorHandler } from '../shared/middleware/error-handler.js';

/** Minimal app that pushes a chosen error through the real middleware chain. */
function appThatThrows(thrown: unknown) {
  const app = express();
  app.use(correlationId());
  app.get('/boom', () => {
    throw thrown;
  });
  app.use(errorHandler());
  return app;
}

describe('error envelope', () => {
  it('returns the documented envelope for unmatched routes', async () => {
    const response = await request(createApp()).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(bodyAs<ErrorBody>(response).error).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(typeof bodyAs<ErrorBody>(response).error.correlationId).toBe('string');
  });

  it('maps a domain error to its code and status', async () => {
    const response = await request(appThatThrows(new ForbiddenError())).get('/boom');

    expect(response.status).toBe(403);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('FORBIDDEN');
  });

  it('includes field details on validation failures', async () => {
    const error = new ValidationFailedError([
      { field: 'startDate', issue: 'must be before endDate' },
    ]);

    const response = await request(appThatThrows(error)).get('/boom');

    expect(response.status).toBe(422);
    expect(bodyAs<ErrorBody>(response).error.details).toEqual([
      { field: 'startDate', issue: 'must be before endDate' },
    ]);
  });

  it('converts an escaped ZodError into a 422 with per-field details', async () => {
    const schema = z.object({ email: z.email() });
    const parsed = schema.safeParse({ email: 'nope' });
    expect(parsed.success).toBe(false);

    const response = await request(appThatThrows(parsed.error)).get('/boom');

    expect(response.status).toBe(422);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('VALIDATION_FAILED');
    expect(bodyAs<ErrorBody>(response).error.details?.[0]?.field).toBe('email');
  });

  it('never leaks internals for an unexpected error', async () => {
    const leaky = new Error('select * from accounts where password_hash = $1 failed');

    const response = await request(appThatThrows(leaky)).get('/boom');

    expect(response.status).toBe(500);
    expect(bodyAs<ErrorBody>(response).error).toMatchObject({
      code: 'INTERNAL',
      message: 'An unexpected error occurred.',
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('stack');
  });

  it('rejects malformed JSON as a validation error, not a 500', async () => {
    const response = await request(createApp())
      .post('/api/v1/anything')
      .set('Content-Type', 'application/json')
      .send('{"unclosed":');

    expect(response.status).toBe(400);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('VALIDATION_FAILED');
  });
});

describe('correlation id', () => {
  it('generates one and echoes it in the response header', async () => {
    const response = await request(createApp()).get('/healthz');

    expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('propagates a caller-supplied id so a request can be followed across services', async () => {
    const response = await request(createApp())
      .get('/api/v1/does-not-exist')
      .set(CORRELATION_ID_HEADER, 'web-abc-123');

    expect(response.headers[CORRELATION_ID_HEADER]).toBe('web-abc-123');
    expect(bodyAs<ErrorBody>(response).error.correlationId).toBe('web-abc-123');
  });

  it('replaces a hostile inbound id rather than reflecting it', async () => {
    const response = await request(createApp())
      .get('/api/v1/does-not-exist')
      .set(CORRELATION_ID_HEADER, '<script>alert(1)</script>');

    expect(response.headers[CORRELATION_ID_HEADER]).not.toContain('<script>');
    expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects an over-long inbound id rather than logging it', async () => {
    const response = await request(createApp())
      .get('/api/v1/does-not-exist')
      .set(CORRELATION_ID_HEADER, 'a'.repeat(500));

    expect(response.headers[CORRELATION_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
