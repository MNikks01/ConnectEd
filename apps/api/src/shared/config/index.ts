/**
 * Environment configuration — parsed and validated once, at the composition root.
 *
 * `loadConfig()` is a function rather than a module-level constant on purpose: an exported constant
 * would validate at *import* time, so a bad env would blow up in whichever module happened to be
 * imported first, and tests could never construct an app with different settings.
 *
 * Only variables this slice consumes are declared; modules add their own as they land (DATABASE_URL
 * with S0-6, JWT_* with S0-7). See `.env.example` for the full catalogue.
 */
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** `/metrics` is served only when enabled; network-level restriction is the infra's job. */
  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  OTEL_SERVICE_NAME: z.string().default('connected-api'),
  /** Traces are exported only when a collector endpoint is configured. */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
});

export type Config = z.infer<typeof envSchema> & {
  isProduction: boolean;
  isTest: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // Runs before the logger exists (the logger needs this config), so throwing is the only channel.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === 'production',
    isTest: parsed.data.NODE_ENV === 'test',
  };
}
