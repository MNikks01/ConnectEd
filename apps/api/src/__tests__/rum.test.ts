/**
 * Real-user-monitoring ingest — S5-13.
 *
 * This is the only unauthenticated write in the API, so most of what is worth testing is what it
 * refuses to do. **The label set must be bounded**: a `route` taken from the URL would be one time
 * series per URL, and a stranger who can mint labels can run up a metrics bill without ever
 * touching the product. And it must answer the same way whatever it is sent, because a monitoring
 * endpoint that reports its own failures teaches every visitor's browser to retry.
 */
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { loadConfig } from '../shared/config/index.js';
import { createMetrics, type Metrics } from '../shared/observability/metrics.js';
import { routeLabelFor } from '../routes/rum.routes.js';

import type { Express } from 'express';

const config = loadConfig();

let metrics: Metrics;
let app: Express;

beforeEach(() => {
  // A fresh registry per test: counters accumulate, and a shared one would let an earlier case
  // satisfy a later assertion.
  metrics = createMetrics();
  app = createApp({ config, metrics });
});

async function scrape(): Promise<string> {
  const response = await request(app).get('/metrics');
  return response.text;
}

const beacon = (body: string | object) => request(app).post('/api/v1/rum').send(body);

describe('the route label', () => {
  it('keeps a known page as itself', () => {
    expect(routeLabelFor('/school/billing')).toBe('/school/billing');
  });

  it('templates an id out of a known pattern', () => {
    expect(routeLabelFor('/accounts/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('/accounts/:id');
    expect(routeLabelFor('/messages/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('/messages/:id');
  });

  it('collapses anything it does not recognise', () => {
    // The whole point. Every one of these would otherwise be its own time series, forever.
    expect(routeLabelFor('/not-a-page')).toBe('other');
    expect(routeLabelFor('/wp-admin.php')).toBe('other');
    expect(routeLabelFor('/' + 'a'.repeat(400))).toBe('other');
  });

  it('ignores the query string and the fragment', () => {
    expect(routeLabelFor('/social?after=abc#top')).toBe('/social');
  });

  it('treats a trailing slash as the same page', () => {
    expect(routeLabelFor('/school/classes/')).toBe('/school/classes');
    expect(routeLabelFor('/')).toBe('/');
  });
});

describe('ingest', () => {
  it('records a timing vital in seconds', async () => {
    const response = await beacon({
      vitals: [{ name: 'LCP', value: 2500, path: '/home' }],
    });

    expect(response.status).toBe(204);

    const body = await scrape();
    // Reported in milliseconds, stored in seconds, so it sits beside the server-side histograms.
    expect(body).toMatch(/web_vital_seconds_sum\{metric="LCP",route="\/home"\} 2\.5/);
  });

  it('keeps CLS out of the seconds histogram', async () => {
    await beacon({ vitals: [{ name: 'CLS', value: 0.08, path: '/home' }] });

    const body = await scrape();

    // A unitless layout-shift score in a metric named `_seconds` would make every dashboard and
    // alert over it quietly wrong.
    expect(body).toMatch(/web_vital_cls_sum\{route="\/home"\} 0\.08/);
    expect(body).not.toContain('metric="CLS"');
  });

  it('counts a browser error against its route', async () => {
    await beacon({ errors: [{ path: '/social', message: 'TypeError: x is not a function' }] });

    expect(await scrape()).toContain('web_errors_total{route="/social"} 1');
  });

  it('never puts the error message in a label', async () => {
    await beacon({
      errors: [{ path: '/social', message: 'unbounded-attacker-controlled-string' }],
    });

    // The message is logged; a label built from it is one time series per distinct message.
    expect(await scrape()).not.toContain('unbounded-attacker-controlled-string');
  });

  it('mints no label for a path it does not know', async () => {
    await beacon({ vitals: [{ name: 'LCP', value: 100, path: '/some/made/up/path' }] });

    const body = await scrape();

    expect(body).toContain('route="other"');
    expect(body).not.toContain('made/up/path');
  });

  it('takes a batch in one request', async () => {
    await beacon({
      vitals: [
        { name: 'LCP', value: 1000, path: '/home' },
        { name: 'TTFB', value: 200, path: '/home' },
        { name: 'CLS', value: 0.02, path: '/home' },
      ],
      errors: [{ path: '/home', message: 'boom' }],
    });

    const body = await scrape();

    // One beacon per page load rather than five: the measurement must not cost more than what it
    // measures.
    expect(body).toContain('metric="LCP"');
    expect(body).toContain('metric="TTFB"');
    expect(body).toContain('web_vital_cls_count{route="/home"} 1');
  });
});

describe('what it refuses', () => {
  it('answers 204 to a malformed body rather than 422', async () => {
    const response = await beacon({ vitals: [{ name: 'NOT_A_VITAL', value: 1, path: '/home' }] });

    // A monitoring endpoint that reports its own failures teaches the browser to retry, and a
    // retry storm from every visitor is worse than a lost measurement.
    expect(response.status).toBe(204);
  });

  it('answers 204 to nonsense', async () => {
    expect((await beacon('not even an object')).status).toBe(204);
    expect((await beacon({})).status).toBe(204);
  });

  it('records nothing from a malformed body', async () => {
    await beacon({ vitals: [{ name: 'LCP', value: -5, path: '/home' }] });

    expect(await scrape()).not.toContain('web_vital_seconds_count');
  });

  it('refuses a value large enough to drag every percentile', async () => {
    await beacon({ vitals: [{ name: 'LCP', value: 99_999_999, path: '/home' }] });

    // A broken clock or a hostile client. Either way one observation of eleven days would make
    // the p75 panel useless.
    expect(await scrape()).not.toContain('web_vital_seconds_count');
  });

  it('caps how much one beacon may carry', async () => {
    const response = await beacon({
      vitals: Array.from({ length: 50 }, () => ({ name: 'LCP', value: 100, path: '/home' })),
    });

    expect(response.status).toBe(204);
    expect(await scrape()).not.toContain('web_vital_seconds_count');
  });

  it('stores nothing — there is no way to read any of it back', async () => {
    await beacon({ vitals: [{ name: 'LCP', value: 100, path: '/home' }] });

    const response = await request(app).get('/api/v1/rum');

    expect(response.status).toBe(404);
  });
});
