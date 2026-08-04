/**
 * Real-user-monitoring payloads (`.docs/Monitoring/00-observability.md`).
 *
 * The browser is an untrusted reporter, so this schema is narrow on purpose: a closed set of
 * metric names, bounded numbers, and a path that the server re-derives a label from rather than
 * trusting. Nothing here is free text that could reach a metric label.
 */
import { z } from 'zod';

/**
 * The metrics collected. A closed enum rather than a string, because every distinct value becomes
 * a Prometheus label and an open one is an unbounded time-series count.
 */
export const WebVitalName = {
  LCP: 'LCP',
  CLS: 'CLS',
  INP: 'INP',
  TTFB: 'TTFB',
  FCP: 'FCP',
} as const;
export type WebVitalName = (typeof WebVitalName)[keyof typeof WebVitalName];

export const webVitalSchema = z.object({
  name: z.enum(['LCP', 'CLS', 'INP', 'TTFB', 'FCP']),
  /**
   * Milliseconds for the timing metrics; a unitless score for CLS. Capped at ten minutes — a
   * larger value is a broken clock or a hostile client, and either way it would drag every
   * percentile with it.
   */
  value: z.number().min(0).max(600_000),
  /** The page it was measured on. The server derives the label; this is never used as one. */
  path: z.string().max(500),
});

export const webErrorSchema = z.object({
  path: z.string().max(500),
  /**
   * Kept for the log line, never for a label. An error message is attacker-controlled and
   * unbounded, which is the exact shape that makes a metrics bill run away.
   */
  message: z.string().max(500),
});

export const rumBatchSchema = z.object({
  vitals: z.array(webVitalSchema).max(10).optional(),
  errors: z.array(webErrorSchema).max(5).optional(),
});

export type WebVitalInput = z.infer<typeof webVitalSchema>;
export type WebErrorInput = z.infer<typeof webErrorSchema>;
export type RumBatchInput = z.infer<typeof rumBatchSchema>;
