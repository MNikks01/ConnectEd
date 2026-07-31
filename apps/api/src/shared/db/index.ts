/**
 * Prisma client for the API.
 *
 * Prisma 7 connects through a driver adapter rather than an embedded engine (ADR-0013), so the
 * connection string is supplied here at construction instead of being read from the schema.
 *
 * **Prisma is used only in repositories** (`apps/api/CLAUDE.md` rule 1). Services depend on
 * repository interfaces, never on this client directly.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';

import type { ReadinessRegistry } from '../health/readiness.js';

export type Db = PrismaClient;

export interface CreateDbOptions {
  connectionString: string;
  /** Query logging is useful locally and far too noisy (and PII-adjacent) in production. */
  logQueries?: boolean;
}

export function createDb({ connectionString, logQueries = false }: CreateDbOptions): Db {
  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

/**
 * Registers the Postgres readiness probe. `SELECT 1` is deliberately trivial — readiness asks
 * "can we reach the database", not "is every query fast".
 */
export function registerDbReadiness(readiness: ReadinessRegistry, db: Db): void {
  readiness.register({
    name: 'postgres',
    probe: async () => {
      try {
        await db.$queryRaw`SELECT 1`;
      } catch (error) {
        // Prisma's message is a multi-line block quoting the invocation, which renders as
        // "\nInvalid `prisma.$queryRaw()` invocation:\n\n\n" in the probe result. Reduce it to
        // something an on-call engineer can read at a glance.
        throw new Error(`database unreachable: ${firstMeaningfulLine(error)}`);
      }
    },
  });
}

/**
 * Prisma's `message` for a connection failure is a multi-line block quoting the invocation, with no
 * useful prose. Its `code` is the part worth surfacing — P1001 (unreachable), P1002 (timed out),
 * P1017 (connection closed) — so prefer that and fall back to the first real line.
 */
function firstMeaningfulLine(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  const line = error.message
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !part.startsWith('Invalid `'));

  return line ?? error.name;
}
