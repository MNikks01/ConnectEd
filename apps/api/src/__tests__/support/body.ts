/**
 * Supertest types `response.body` as `any`, which trips the no-unsafe-* rules and hides typos in
 * assertions. Tests state the shape they expect instead.
 */
export function bodyAs<T>(response: { body: unknown }): T {
  return response.body as T;
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    status: number;
    correlationId: string;
    details?: { field: string; issue: string }[];
  };
}

export interface HealthBody {
  status: string;
  uptime: number;
}

export interface ReadyBody {
  status: string;
  checks: { name: string; status: 'up' | 'down'; error?: string }[];
}
