/**
 * Readiness check registry.
 *
 * Liveness ("is the process up") and readiness ("can it serve traffic") are deliberately different:
 * a failing dependency should pull the instance out of the load balancer, not restart it.
 *
 * Modules register their own checks as they land — Postgres with S0-6, Redis with the queue — so
 * this file never needs to know about them.
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

const checks = new Map<string, ReadinessCheck>();

export function registerReadinessCheck(check: ReadinessCheck): void {
  checks.set(check.name, check);
}

/** Exported for tests, which must not leak registrations into each other. */
export function clearReadinessChecks(): void {
  checks.clear();
}

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

export async function runReadinessChecks(): Promise<{
  ready: boolean;
  results: ReadinessResult[];
}> {
  const results = await Promise.all(
    [...checks.values()].map(async (check): Promise<ReadinessResult> => {
      try {
        await withTimeout(check.probe, check.timeoutMs ?? 2000);
        return { name: check.name, status: 'up' };
      } catch (error) {
        return {
          name: check.name,
          status: 'down',
          // Surfaced on an internal endpoint only; still keep it to a message, never a stack.
          error: error instanceof Error ? error.message : 'unknown error',
        };
      }
    }),
  );

  return { ready: results.every((result) => result.status === 'up'), results };
}
