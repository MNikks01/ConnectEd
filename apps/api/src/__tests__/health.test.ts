import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bodyAs, type ErrorBody, type HealthBody, type ReadyBody } from './support/body.js';
import { createApp } from '../app.js';
import { loadConfig } from '../shared/config/index.js';
import { ReadinessRegistry, type ReadinessCheck } from '../shared/health/readiness.js';

/** Each app gets its own registry, so tests cannot leak checks into one another. */
function appWithChecks(...checks: ReadinessCheck[]) {
  const readiness = new ReadinessRegistry();
  for (const check of checks) readiness.register(check);
  return createApp({ readiness });
}

describe('GET /healthz', () => {
  it('reports liveness', async () => {
    const response = await request(createApp()).get('/healthz');

    expect(response.status).toBe(200);
    expect(bodyAs<HealthBody>(response).status).toBe('ok');
    expect(typeof bodyAs<HealthBody>(response).uptime).toBe('number');
  });

  it('stays up even when a dependency is down — liveness must not check dependencies', async () => {
    const app = appWithChecks({
      name: 'postgres',
      probe: () => Promise.reject(new Error('connection refused')),
    });

    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
  });
});

describe('GET /readyz', () => {
  it('is ready when no checks are registered', async () => {
    const response = await request(createApp()).get('/readyz');

    expect(response.status).toBe(200);
    expect(bodyAs<ReadyBody>(response)).toEqual({ status: 'ready', checks: [] });
  });

  it('is ready when every check passes', async () => {
    const app = appWithChecks(
      { name: 'postgres', probe: () => Promise.resolve() },
      { name: 'redis', probe: () => Promise.resolve() },
    );

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(200);
    expect(bodyAs<ReadyBody>(response).checks).toHaveLength(2);
  });

  it('fails closed with 503 and the error envelope when a check fails', async () => {
    const app = appWithChecks(
      { name: 'postgres', probe: () => Promise.resolve() },
      { name: 'redis', probe: () => Promise.reject(new Error('connection refused')) },
    );

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
    const app = appWithChecks({
      name: 'stuck',
      probe: () => new Promise<void>(() => {}),
      timeoutMs: 50,
    });

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(503);
    expect(bodyAs<ErrorBody>(response).error.details?.[0]?.issue).toContain('timed out');
  });

  it('lets a later module add its own check without this file changing', async () => {
    // Stands in for S0-6 registering Postgres at the composition root.
    const readiness = new ReadinessRegistry().register({
      name: 'a-module-that-does-not-exist-yet',
      probe: () => Promise.resolve(),
    });

    const response = await request(createApp({ readiness })).get('/readyz');

    expect(response.status).toBe(200);
    expect(bodyAs<ReadyBody>(response).checks[0]?.name).toBe('a-module-that-does-not-exist-yet');
  });
});

describe('GET /metrics', () => {
  it('exposes the Prometheus scrape target', async () => {
    const response = await request(createApp()).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('process_cpu_user_seconds_total');
  });

  it('records request duration labelled by route, not raw path', async () => {
    const app = createApp();
    await request(app).get('/healthz');

    const response = await request(app).get('/metrics');

    expect(response.text).toContain('http_request_duration_seconds');
    expect(response.text).toContain('route="/healthz"');
  });

  it('collapses unmatched paths to one label so scanners cannot mint time series', async () => {
    const app = createApp();
    const scannedId = crypto.randomUUID();
    await request(app).get(`/api/v1/${scannedId}`);

    const response = await request(app).get('/metrics');

    expect(response.text).toContain('route="unmatched"');
    // The UUID must never reach a label, or every scan creates a new time series.
    expect(response.text).not.toContain(scannedId);
  });

  it('404s when metrics are disabled', async () => {
    const app = createApp({ config: { ...loadConfig(), METRICS_ENABLED: false } });

    const response = await request(app).get('/metrics');

    expect(response.status).toBe(404);
  });

  it('gives each app its own registry so counts do not bleed between them', async () => {
    const first = createApp();
    await request(first).get('/healthz');
    await request(first).get('/healthz');

    const second = createApp();
    const response = await request(second).get('/metrics');

    // The second app has served no /healthz requests of its own.
    expect(response.text).not.toContain('route="/healthz"');
  });
});
