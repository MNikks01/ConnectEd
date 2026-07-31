/**
 * Readiness check registry.
 *
 * Liveness ("is the process up") and readiness ("can it serve traffic") are deliberately different:
 * a failing dependency should pull the instance out of the load balancer, not restart it.
 *
 * This is an instance rather than module-level state so each app owns its own registry. The earlier
 * shared-Map version needed a `clearReadinessChecks()` export that existed only to stop tests
 * leaking into each other — a test-only function on a production module.
 *
 * Modules register their own checks at the composition root as they land — Postgres with S0-6,
 * Redis with the queue — so this file never needs to know about them.
 */
export interface ReadinessCheck {
  name: string;
  /** Resolves when healthy, throws or rejects when not. */
  probe: () => Promise<void>;
  /** Individual probe timeout; a hung dependency must not hang `/readyz`. */
  timeoutMs?: number;
}

export interface ReadinessResult {
  name: string;
  status: 'up' | 'down';
  error?: string;
}

export interface ReadinessReport {
  ready: boolean;
  results: ReadinessResult[];
}

const DEFAULT_PROBE_TIMEOUT_MS = 2000;

async function withTimeout(probe: () => Promise<void>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`probe timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ReadinessRegistry {
  readonly #checks = new Map<string, ReadinessCheck>();

  register(check: ReadinessCheck): this {
    this.#checks.set(check.name, check);
    return this;
  }

  async run(): Promise<ReadinessReport> {
    const results = await Promise.all(
      [...this.#checks.values()].map(async (check): Promise<ReadinessResult> => {
        try {
          await withTimeout(check.probe, check.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
          return { name: check.name, status: 'up' };
        } catch (error) {
          return {
            name: check.name,
            status: 'down',
            // Surfaced on an internal endpoint only; still a message, never a stack.
            error: error instanceof Error ? error.message : 'unknown error',
          };
        }
      }),
    );

    return { ready: results.every((result) => result.status === 'up'), results };
  }
}
