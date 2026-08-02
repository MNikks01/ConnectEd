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

  /** Object storage (ADR-0009). MinIO locally, S3-compatible anywhere else. */
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  /** MinIO addresses buckets by path; real S3 uses a subdomain. */
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /**
   * Upload ceiling in bytes. Enforced before anything is read into memory, because the cheapest
   * request to reject is the one you never buffer.
   */
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
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
   * Access-token signing key for HS256. 32 chars minimum so a weak dev secret cannot reach an
   * environment that matters.
   *
   * Still required, and still the default: it is the only setting a developer needs to run the
   * API. Production supplies the Ed25519 pair below instead, and then this is unused
   * (`ADR-0014`).
   */
  JWT_ACCESS_SECRET: z.string().min(32),

  /**
   * Ed25519 signing key, PKCS#8 PEM. When present, access tokens are signed with **EdDSA** and the
   * public half is published at `/.well-known/jwks.json` — no verifier ever needs the signing key.
   *
   * Ed25519 rather than RSA: 64-byte signatures against RSA-2048's 256, no parameter choices to
   * get wrong, and no risk of the RSA algorithm-confusion family. Ed25519 support is required by
   * FIPS 186-5 and available in every runtime this project targets.
   */
  JWT_PRIVATE_KEY: z.string().optional(),
  /** The matching SPKI PEM. Both or neither — a private key alone cannot serve JWKS. */
  JWT_PUBLIC_KEY: z.string().optional(),
  /**
   * Key id published in JWKS and set in every token header, so a verifier can pick the right key
   * during a rotation instead of trying all of them.
   */
  JWT_KEY_ID: z.string().default('connected-access-1'),
  /**
   * The previous public key, kept verifiable through the overlap window of a rotation. Tokens
   * already issued stay valid until they expire; nothing new is signed with it.
   */
  JWT_PREVIOUS_PUBLIC_KEY: z.string().optional(),
  /** The id of that previous key, so JWKS can publish both and a header can select one. */
  JWT_PREVIOUS_KEY_ID: z.string().optional(),
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
  /** True when an Ed25519 pair was supplied; false means HS256 and no JWKS endpoint. */
  jwtAsymmetric: boolean;
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

  // Both or neither. A private key with no public half cannot serve JWKS, and a public key with no
  // private half signs nothing — either alone means someone half-finished a rotation.
  const hasPrivate = Boolean(parsed.data.JWT_PRIVATE_KEY);
  const hasPublic = Boolean(parsed.data.JWT_PUBLIC_KEY);

  if (hasPrivate !== hasPublic) {
    throw new Error(
      'Invalid environment configuration:\n  - JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set together.',
    );
  }

  if (parsed.data.JWT_PREVIOUS_PUBLIC_KEY && !parsed.data.JWT_PREVIOUS_KEY_ID) {
    throw new Error(
      'Invalid environment configuration:\n  - JWT_PREVIOUS_PUBLIC_KEY needs JWT_PREVIOUS_KEY_ID, or a verifier cannot select it.',
    );
  }

  return {
    ...parsed.data,
    isProduction,
    isTest: parsed.data.NODE_ENV === 'test',
    // Production cannot opt out: an unencrypted refresh cookie is a session-theft vector, and a
    // misconfigured env var must not be able to turn that off.
    cookieSecure: isProduction ? true : (parsed.data.COOKIE_SECURE ?? false),
    jwtAsymmetric: hasPrivate,
  };
}
