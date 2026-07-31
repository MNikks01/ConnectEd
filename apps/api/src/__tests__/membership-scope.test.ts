import { describe, expect, it } from 'vitest';

import { membershipScopeKey } from '../shared/db/membership-scope.js';

/**
 * These guard the fix for a real integrity hole: Postgres treats NULLs as distinct, so the unique
 * constraint described in `.docs/Database/03-rbac-data.md` would not have prevented duplicate
 * PRINCIPAL/TEACHER memberships. `scopeKey` is what makes that constraint enforceable.
 */
describe('membershipScopeKey', () => {
  it('collapses a school-wide scope (no class, no child) to a stable non-null value', () => {
    expect(membershipScopeKey(null, null)).toBe('-:-');
    expect(membershipScopeKey(undefined, undefined)).toBe('-:-');
  });

  it('produces the same key for the same scope, so duplicates collide', () => {
    const a = membershipScopeKey('11111111-1111-1111-1111-111111111111', null);
    const b = membershipScopeKey('11111111-1111-1111-1111-111111111111', null);

    expect(a).toBe(b);
  });

  it('distinguishes a class scope from a child scope with the same id', () => {
    const id = '11111111-1111-1111-1111-111111111111';

    expect(membershipScopeKey(id, null)).not.toBe(membershipScopeKey(null, id));
  });

  it('distinguishes different classes', () => {
    expect(membershipScopeKey('aaaaaaaa-0000-0000-0000-000000000000', null)).not.toBe(
      membershipScopeKey('bbbbbbbb-0000-0000-0000-000000000000', null),
    );
  });

  it('never returns an empty or null-ish key, which is the whole point', () => {
    const keys = [
      membershipScopeKey(null, null),
      membershipScopeKey('a', null),
      membershipScopeKey(null, 'b'),
      membershipScopeKey('a', 'b'),
    ];

    for (const key of keys) {
      expect(key.length).toBeGreaterThan(0);
      expect(key).not.toContain('null');
      expect(key).not.toContain('undefined');
    }
  });

  it('keeps all four scope shapes distinct from one another', () => {
    const keys = new Set([
      membershipScopeKey(null, null),
      membershipScopeKey('a', null),
      membershipScopeKey(null, 'b'),
      membershipScopeKey('a', 'b'),
    ]);

    expect(keys.size).toBe(4);
  });
});
