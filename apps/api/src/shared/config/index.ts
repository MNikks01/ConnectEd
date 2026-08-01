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

  /** Required: the API is useless without its database, so fail at boot rather than at first query. */
  DATABASE_URL: z.string().min(1),
  /** Required: domain events and the notification fan-out both run through Redis (ADR-0008). */
  REDIS_URL: z.string().min(1),
  /**
   * Runs the queue worker inside the API process. Convenient locally and correct for a small
   * deployment; a busy one runs `pnpm --filter api worker` separately so a slow fan-out cannot
   * compete with request handling for the event loop.
   */
  RUN_WORKER_IN_PROCESS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /** Logs every SQL statement. Local debugging only — query text is PII-adjacent. */
  DB_LOG_QUERIES: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /**
   * Access-token signing key. 32 chars minimum so a weak dev secret cannot reach an environment
   * that matters. See ADR-0007; asymmetric signing + JWKS is the documented target.
   */
  JWT_ACCESS_SECRET: z.string().min(32),
  /** Short by design — the refresh token, not the access token, carries session lifetime. */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),

  /** argon2id tuning. Defaults follow OWASP guidance; raise memory before iterations. */
  ARGON_MEMORY_KIB: z.coerce.number().int().positive().default(19456),
  ARGON_ITERATIONS: z.coerce.number().int().positive().default(2),
  ARGON_PARALLELISM: z.coerce.number().int().positive().default(1),

  /**
   * Rate limiting on credential endpoints (FR-AUTH-011). On by default and expected to stay on
   * everywhere real.
   *
   * It is a separate switch rather than being inferred from NODE_ENV because automated suites need
   * it off while otherwise running a production-shaped server: the end-to-end suite registers far
   * more than ten accounts, and keying this to "am I a unit test" made that impossible to express.
   */
  RATE_LIMIT_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  /** Refresh cookies must be Secure outside local development. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),

  /** `/metrics` is served only when enabled; network-level restriction is the infra's job. */
  METRICS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  OTEL_SERVICE_NAME: z.string().default('connected-api'),
  /** Traces are exported only when a collector endpoint is configured. */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  /**
   * Ships logs to Loki when set. Deployed environments collect container stdout instead and leave
   * this empty; locally the API runs on the host, so nothing would collect it otherwise.
   */
  LOKI_URL: z.url().optional(),
});

export type Config = z.infer<typeof envSchema> & {
  isProduction: boolean;
  isTest: boolean;
  /** Resolved rather than read directly: Secure cookies are mandatory in production. */
  cookieSecure: boolean;
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

  const isProduction = parsed.data.NODE_ENV === 'production';

  return {
    ...parsed.data,
    isProduction,
    isTest: parsed.data.NODE_ENV === 'test',
    // Production cannot opt out: an unencrypted refresh cookie is a session-theft vector, and a
    // misconfigured env var must not be able to turn that off.
    cookieSecure: isProduction ? true : (parsed.data.COOKIE_SECURE ?? false),
  };
}
