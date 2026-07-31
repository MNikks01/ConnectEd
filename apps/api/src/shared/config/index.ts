/**
 * Environment configuration — validated once at startup, then imported everywhere.
 *
 * The process refuses to boot on invalid config rather than failing later at the first request.
 * Only variables this slice actually consumes are declared; modules add their own as they land
 * (DATABASE_URL with S0-6, JWT_* with S0-7). See `.env.example` for the full catalogue.
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** `/metrics` is served only when enabled; network-level restriction is the infra's job. */
  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  OTEL_SERVICE_NAME: z.string().default('connected-api'),
  /** Traces are exported only when a collector endpoint is configured. */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type Config = z.infer<typeof envSchema> & {
  isProduction: boolean;
  isTest: boolean;
};

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // Predates the logger (which depends on this module), so stderr is the only channel.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === 'production',
    isTest: parsed.data.NODE_ENV === 'test',
  };
}

export const config = loadConfig();
