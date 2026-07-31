/**
 * OpenTelemetry tracing → Tempo (ADR-0011).
 *
 * Must start before the instrumented libraries are imported, so `src/index.ts` imports this module
 * first. Auto-instrumentation covers HTTP, Express, and later Prisma and Redis; domain modules add
 * custom spans around their own operations.
 *
 * Tracing stays off unless OTEL_EXPORTER_OTLP_ENDPOINT is set — a local dev run without a collector
 * should not spew export failures.
 */
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

import type { Config } from '../config/index.js';

/** Returned so the caller owns the handle, rather than this module keeping process-wide state. */
export interface Tracing {
  /** Flushes pending spans; called from the shutdown path so in-flight traces are not lost. */
  stop: () => Promise<void>;
}

const NOOP_TRACING: Tracing = { stop: () => Promise.resolve() };

export function startTracing(config: Config): Tracing {
  if (!config.OTEL_EXPORTER_OTLP_ENDPOINT || config.isTest) return NOOP_TRACING;

  const sdk = new NodeSDK({
    serviceName: config.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({
      url: `${config.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Noisy and low value: every file read the process makes would become a span.
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  return { stop: () => sdk.shutdown() };
}
