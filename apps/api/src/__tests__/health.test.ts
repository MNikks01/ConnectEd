import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { bodyAs, type ErrorBody, type HealthBody, type ReadyBody } from './support/body.js';
import { createApp } from '../app.js';
import { clearReadinessChecks, registerReadinessCheck } from '../shared/health/readiness.js';

const app = createApp();

afterEach(() => {
  clearReadinessChecks();
});

describe('GET /healthz', () => {
  it('reports liveness', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(bodyAs<HealthBody>(response).status).toBe('ok');
    expect(typeof bodyAs<HealthBody>(response).uptime).toBe('number');
  });

  it('stays up even when a dependency is down — liveness must not check dependencies', async () => {
    registerReadinessCheck({
      name: 'postgres',
      probe: () => Promise.reject(new Error('connection refused')),
    });

    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
  });
});

describe('GET /readyz', () => {
  it('is ready when no checks are registered', async () => {
    const response = await request(app).get('/readyz');

    expect(response.status).toBe(200);
    expect(bodyAs<ReadyBody>(response)).toEqual({ status: 'ready', checks: [] });
  });

  it('is ready when every check passes', async () => {
    registerReadinessCheck({ name: 'postgres', probe: () => Promise.resolve() });
    registerReadinessCheck({ name: 'redis', probe: () => Promise.resolve() });

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(200);
    expect(bodyAs<ReadyBody>(response).checks).toHaveLength(2);
  });

  it('fails closed with 503 and the error envelope when a check fails', async () => {
    registerReadinessCheck({ name: 'postgres', probe: () => Promise.resolve() });
    registerReadinessCheck({
      name: 'redis',
      probe: () => Promise.reject(new Error('connection refused')),
    });

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(503);
    expect(bodyAs<ErrorBody>(response).error).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 503,
    });
    expect(bodyAs<ErrorBody>(response).error.details).toEqual([
      { field: 'redis', issue: 'connection refused' },
    ]);
  });

  it('does not hang when a probe never settles', async () => {
    registerReadinessCheck({
      name: 'stuck',
      probe: () => new Promise<void>(() => {}),
      timeoutMs: 50,
    });

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(503);
    expect(bodyAs<ErrorBody>(response).error.details?.[0]?.issue).toContain('timed out');
  });
});

describe('GET /metrics', () => {
  it('exposes the Prometheus scrape target', async () => {
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('process_cpu_user_seconds_total');
  });

  it('records request duration labelled by route, not raw path', async () => {
    await request(app).get('/healthz');

    const response = await request(app).get('/metrics');

    expect(response.text).toContain('http_request_duration_seconds');
    expect(response.text).toContain('route="/healthz"');
  });

  it('collapses unmatched paths to one label so scanners cannot mint time series', async () => {
    await request(app).get(`/api/v1/${crypto.randomUUID()}`);
    const firstId = crypto.randomUUID();
    await request(app).get(`/api/v1/${firstId}`);

    const response = await request(app).get('/metrics');

    expect(response.text).toContain('route="unmatched"');
    // The UUID must never reach a label, or every scan creates a new time series.
    expect(response.text).not.toContain(firstId);
  });
});
