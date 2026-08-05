/**
 * The suite refuses to point at a database it is not allowed to empty.
 *
 * Every case in this suite starts by TRUNCATEing every table. Which database that lands on is
 * decided by one environment variable, and both test configurations read it the same way:
 * `process.env.DATABASE_URL ?? <their own default>`. So a single `export DATABASE_URL=…` in a
 * shell — the sort of thing left over from running a migration by hand — silently collapses
 * `connected_test`, `connected_e2e` and `connected` into whichever one was exported.
 *
 * Two of those outcomes are a confusing afternoon. The third is a developer's own data, gone
 * between one `beforeEach` and the next.
 *
 * Nothing has been lost to this, and the guard is not evidence that anything was. It is here
 * because the cost of the mistake is unbounded, the cost of catching it is a regular expression,
 * and "we would have noticed" is not a property anybody can check.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { isDbInUse, testDb } from './support/db.js';

const REAL_URL = process.env.DATABASE_URL;

afterEach(() => {
  if (REAL_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = REAL_URL;
});

/** Swapped in only for the length of one expectation; nothing here ever connects. */
function pointAt(database: string): void {
  process.env.DATABASE_URL = `postgresql://connected:connected@localhost:5432/${database}?schema=public`;
}

describe('which database the integration suite will accept', () => {
  it('refuses the development database, before opening anything', () => {
    pointAt('connected');

    expect(() => testDb()).toThrow(/Refusing to run integration tests against "connected"/);
    // The order is the point. A refusal that arrives after the client exists is a refusal that
    // arrives after something could already have run against it.
    expect(isDbInUse()).toBe(false);
  });

  it('refuses the end-to-end database, which belongs to the other suite', () => {
    // Not destructive in the same way — the E2E suite does not truncate — but the two suites
    // deleting each other's fixtures is the exact shape of the flake this repo has been chasing.
    pointAt('connected_e2e');

    expect(() => testDb()).toThrow(/ends in "_test"/);
  });

  it('refuses a name that merely contains the word', () => {
    pointAt('test_production_replica');

    expect(() => testDb()).toThrow(/Refusing/);
  });

  it('accepts a database named for the job', () => {
    pointAt('connected_test');

    expect(() => testDb()).not.toThrow();
  });

  it('says nothing at all when the variable is missing', () => {
    delete process.env.DATABASE_URL;

    // A different failure, and it already had a clear message. The guard must not shadow it.
    expect(() => testDb()).toThrow(/DATABASE_URL must be set/);
  });
});
