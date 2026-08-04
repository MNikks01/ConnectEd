import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { bodyAs, type ErrorBody } from './support/body.js';
import { createApp } from '../app.js';
import {
  AppError,
  ErrorCode,
  ForbiddenError,
  UnauthenticatedError,
  ValidationFailedError,
} from '../shared/errors/index.js';
import type { ErrorMapper } from '../shared/errors/mapping.js';
import type { ErrorLogger } from '../shared/logger/index.js';
import { CORRELATION_ID_HEADER, correlationId } from '../shared/middleware/correlation-id.js';
import { errorHandler } from '../shared/middleware/error-handler.js';

/**
 * The middleware depends on `Pick<Logger, 'warn' | 'error'>`, so a two-method object satisfies it
 * with no cast — which is the point of narrowing the dependency instead of taking all of pino.
 */
function fakeLogger(): ErrorLogger {
  return { warn: vi.fn(), error: vi.fn() };
}

/** Minimal app that pushes a chosen error through the real middleware chain. */
function appThatThrows(
  thrown: unknown,
  options: { logger?: ErrorLogger; mappers?: readonly ErrorMapper[] } = {},
) {
  const app = express();
  app.use(correlationId());
  app.get('/boom', () => {
    throw thrown;
  });
  app.use(errorHandler({ logger: options.logger ?? fakeLogger(), mappers: options.mappers }));
  return app;
}

describe('error envelope', () => {
  it('returns the documented envelope for unmatched routes', async () => {
    const response = await request(createApp()).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(bodyAs<ErrorBody>(response).error).toMatchObject({ code: 'NOT_FOUND', status: 404 });
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
    const parsed = z.object({ email: z.email() }).safeParse({ email: 'nope' });
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

describe('error mapping is open for extension', () => {
  /** Stands in for the Prisma mapper S0-6 will add, or the JWT mapper S0-7 will add. */
  class ForeignLibraryError extends Error {
    readonly foreignCode = 'P2002';
  }

  const foreignMapper: ErrorMapper = (error) =>
    error instanceof ForeignLibraryError
      ? new AppError(ErrorCode.CONFLICT, 409, 'That record already exists.')
      : undefined;

  it('maps a foreign error type without the middleware or normalizer changing', async () => {
    const response = await request(
      appThatThrows(new ForeignLibraryError('unique constraint violated'), {
        mappers: [foreignMapper],
      }),
    ).get('/boom');

    expect(response.status).toBe(409);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('CONFLICT');
  });

  it('still falls back to an opaque 500 for anything no mapper claims', async () => {
    const response = await request(
      appThatThrows(new Error('some driver internal'), { mappers: [foreignMapper] }),
    ).get('/boom');

    expect(response.status).toBe(500);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('INTERNAL');
  });
});

describe('error logging', () => {
  it('logs 5xx with the original error so the stack reaches the logs', async () => {
    const logger = fakeLogger();

    await request(appThatThrows(new Error('boom'), { logger })).get('/boom');

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    const [context] = vi.mocked(logger.error).mock.calls[0] ?? [];
    expect(context).toHaveProperty('err');
  });

  it('logs 4xx without a stack — expected client errors are high volume', async () => {
    const logger = fakeLogger();

    await request(appThatThrows(new ForbiddenError(), { logger })).get('/boom');

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
    const [context] = vi.mocked(logger.warn).mock.calls[0] ?? [];
    expect(context).not.toHaveProperty('err');
  });

  /**
   * S5-12. A 401 tells the caller one opaque thing on purpose — distinguishing "expired" from
   * "bad signature" tells an attacker which part of a forgery to fix. But it told the *operator*
   * the same one thing, and a burst of `JWTExpired` is a different incident from a burst of
   * `JWSSignatureVerificationFailed`. The reason now travels to the logs and only there.
   */
  it('logs why a token was refused', async () => {
    const logger = fakeLogger();

    await request(
      appThatThrows(
        new UnauthenticatedError('Your session is invalid or has expired.', 'JWTExpired'),
        {
          logger,
        },
      ),
    ).get('/boom');

    const [context] = vi.mocked(logger.warn).mock.calls[0] ?? [];
    expect(context).toMatchObject({ reason: 'JWTExpired' });
  });

  it('never puts that reason in the response', async () => {
    const response = await request(
      appThatThrows(
        new UnauthenticatedError('Your session is invalid or has expired.', 'JWTExpired'),
      ),
    ).get('/boom');

    expect(response.status).toBe(401);
    expect(response.text).not.toContain('JWTExpired');
  });

  it('logs no reason for a 401 that has none — an absent header is not a refusal', async () => {
    const logger = fakeLogger();

    await request(appThatThrows(new UnauthenticatedError(), { logger })).get('/boom');

    const [context] = vi.mocked(logger.warn).mock.calls[0] ?? [];
    expect(context).not.toHaveProperty('reason');
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
