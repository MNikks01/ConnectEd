/**
 * The dashboards query metrics that exist — S5-10.
 *
 * This is the test the last four sprints needed. `Sprint/00-sprint-0.md` recorded that "4 of 5
 * documented dashboards await metrics no module emits yet", and nothing enforced the gap: a
 * dashboard whose panels query a series that was never registered renders as a flat green board,
 * which is worse than no dashboard at all because it is trusted.
 *
 * So: read every panel query out of the JSON on disk, pull the metric names out of it, and assert
 * that the API's own `/metrics` output registers each one. A panel added against a metric nobody
 * emits now fails here rather than in an incident.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { loadConfig } from '../shared/config/index.js';
import {
  createMetrics,
  registerDbPoolMetrics,
  registerQueueDepthMetrics,
} from '../shared/observability/metrics.js';

const DASHBOARDS = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../infrastructure/grafana/dashboards',
);

interface Panel {
  title: string;
  datasource?: { type?: string };
  targets?: { expr?: string }[];
}

interface Dashboard {
  title: string;
  panels: Panel[];
}

function dashboards(): { file: string; doc: Dashboard }[] {
  return readdirSync(DASHBOARDS)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      file,
      doc: JSON.parse(readFileSync(join(DASHBOARDS, file), 'utf8')) as Dashboard,
    }));
}

/**
 * Metric names out of a PromQL expression.
 *
 * Deliberately crude — a real parser would be a dependency on the one check that must not rot.
 * It takes bare identifiers, drops PromQL's own functions and keywords, and drops the histogram
 * suffixes Prometheus generates rather than the app registering them.
 */
const PROMQL_WORDS = new Set([
  'sum',
  'rate',
  'increase',
  'by',
  'le',
  'histogram_quantile',
  'clamp_min',
  'clamp_max',
  'vector',
  'or',
  'and',
  'unless',
  'deriv',
  'avg',
  'max',
  'min',
  'count',
  'topk',
  'irate',
  'delta',
  'without',
  'on',
  'ignoring',
  'group_left',
  'group_right',
  'absent',
  'time',
]);

function metricNames(expr: string): string[] {
  // Strip label matchers first, so a label *value* that looks like an identifier is not mistaken
  // for a metric name — `route="/auth/login"` would otherwise contribute `route` and `auth`.
  const withoutLabels = expr.replace(/\{[^}]*\}/g, '');

  return [...withoutLabels.matchAll(/\b[a-z_][a-z0-9_]*\b/g)]
    .map((match) => match[0])
    .filter((name) => !PROMQL_WORDS.has(name))
    .map((name) => name.replace(/_(bucket|count|sum)$/, ''))
    .filter((name) => name.includes('_'));
}

/** Every metric the API registers, exactly as a Prometheus scrape would see them. */
async function exportedMetrics(): Promise<Set<string>> {
  const config = loadConfig();
  const metrics = createMetrics();

  // The two families registered at the composition root rather than in the factory, because they
  // read from a pool and a queue that only the real process has. Registered here with stand-ins so
  // this test asserts the same surface a deployed scrape would return.
  registerDbPoolMetrics(metrics.registry, { totalCount: 0, idleCount: 0, waitingCount: 0 });
  registerQueueDepthMetrics(metrics.registry, {
    'domain-events': { getJobCounts: () => Promise.resolve({ waiting: 0 }) },
  });

  const app = createApp({ config, metrics });
  const response = await request(app).get('/metrics');

  expect(response.status, 'the metrics endpoint must be enabled in test config').toBe(200);

  return new Set(
    [...response.text.matchAll(/^# (?:HELP|TYPE) (\S+)/gm)].map((match) => match[1] ?? ''),
  );
}

describe('grafana dashboards', () => {
  it('every panel queries a metric the API actually exports', async () => {
    const exported = await exportedMetrics();
    const missing: string[] = [];

    for (const { file, doc } of dashboards()) {
      for (const panel of doc.panels) {
        // Loki panels query log streams, not metric names.
        if (panel.datasource?.type !== 'prometheus') continue;

        for (const target of panel.targets ?? []) {
          for (const name of metricNames(target.expr ?? '')) {
            if (!exported.has(name)) missing.push(`${file} › ${panel.title} › ${name}`);
          }
        }
      }
    }

    expect(
      missing,
      'panels querying series nothing emits render as a permanently healthy board',
    ).toEqual([]);
  });

  it('finds the metric names it claims to check', () => {
    // Guards the extractor itself. Without this the test above passes by finding nothing, which
    // is precisely the failure it exists to prevent.
    const names = metricNames(
      'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{route="/auth/login"}[5m])))',
    );

    expect(names).toEqual(['http_request_duration_seconds']);
  });

  it('covers every dashboard the SLO document names as built', () => {
    const uids = dashboards().map(({ doc }) => (doc as unknown as { uid: string }).uid);

    // Web RUM is deliberately absent — see `.docs/Monitoring/01-slos-and-alerts.md`. Nothing in
    // the browser reports Web Vitals or JS errors yet, and a dashboard over an empty pipeline is
    // the thing this suite exists to prevent.
    expect(uids.sort()).toEqual([
      'connected-business',
      'connected-database',
      'connected-queue',
      'connected-service-overview',
    ]);
  });
});
