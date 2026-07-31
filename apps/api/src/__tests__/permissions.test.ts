/**
 * Permission-matrix tests (`.docs/Security/02-authorization.md`).
 *
 * Every policy gets a **positive** case (the role that should pass, passes) and **negative** cases
 * (every role that should not, does not). Negative coverage is the point: a policy that returns
 * early, or queries the wrong column, still passes every positive test ever written.
 *
 * Run against a real database — see `support/db.ts` for why.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  assertClassTeacherOf,
  assertIsSchool,
  assertOwnsResource,
  assertParentOfVerifiedChild,
  assertPrincipalOfSchool,
  assertTeacherAllocatedToSubject,
  assertVerifiedMemberOfClass,
  requireAccountType,
  requireRole,
  type Actor,
} from '../shared/authz/index.js';
import {
  assertDbReachable,
  closeTestDb,
  resetDb,
  seedSchool,
  setMembershipStatus,
  testDb,
  type SchoolFixture,
} from './support/db.js';

import type { Db } from '../shared/db/index.js';

let db: Db;
let fixture: SchoolFixture;

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

const individual = (accountId: string, role: Actor['role']): Actor => ({
  accountId,
  accountType: 'INDIVIDUAL',
  ...(role ? { role } : {}),
});

const school = (accountId: string): Actor => ({ accountId, accountType: 'SCHOOL' });

/** Asserts the promise rejects with the given error `code` from the catalogue. */
async function expectDenied(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('requireRole', () => {
  it('allows a permitted role', () => {
    expect(() => {
      requireRole(individual(fixture.teacherAccountId, 'TEACHER'), ['TEACHER']);
    }).not.toThrow();
  });

  it('denies a role not in the list', () => {
    expect(() => {
      requireRole(individual(fixture.studentAccountId, 'STUDENT'), ['TEACHER']);
    }).toThrow();
  });

  it('denies an actor with no role at all — a SCHOOL account must not pass a role gate', () => {
    expect(() => {
      requireRole(school(fixture.schoolAccountId), ['TEACHER']);
    }).toThrow();
  });
});

describe('requireAccountType', () => {
  it('allows the matching type', () => {
    expect(() => {
      requireAccountType(school(fixture.schoolAccountId), 'SCHOOL');
    }).not.toThrow();
  });

  it('denies an individual posing as a school', () => {
    expect(() => {
      requireAccountType(individual(fixture.principalAccountId, 'PRINCIPAL'), 'SCHOOL');
    }).toThrow();
  });
});

describe('assertIsSchool', () => {
  it('allows a school acting on its own record', () => {
    expect(() => {
      assertIsSchool(school(fixture.schoolAccountId), fixture.schoolAccountId);
    }).not.toThrow();
  });

  it('denies a school acting on another school, and hides existence with 404', () => {
    expect(() => {
      assertIsSchool(school(fixture.schoolAccountId), fixture.studentAccountId);
    }).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }) as Error);
  });

  it('denies a principal — the highest individual role is still not the institution', () => {
    expect(() => {
      assertIsSchool(individual(fixture.principalAccountId, 'PRINCIPAL'), fixture.schoolAccountId);
    }).toThrow();
  });
});

describe('assertVerifiedMemberOfClass', () => {
  it('allows a verified student of that class', async () => {
    await expect(
      assertVerifiedMemberOfClass(
        db,
        individual(fixture.studentAccountId, 'STUDENT'),
        fixture.classAId,
      ),
    ).resolves.toBeUndefined();
  });

  it('allows a school-wide teacher, whose membership carries no class', async () => {
    await expect(
      assertVerifiedMemberOfClass(
        db,
        individual(fixture.teacherAccountId, 'TEACHER'),
        fixture.classAId,
      ),
    ).resolves.toBeUndefined();
  });

  it('allows the owning school account', async () => {
    await expect(
      assertVerifiedMemberOfClass(db, school(fixture.schoolAccountId), fixture.classAId),
    ).resolves.toBeUndefined();
  });

  it('denies a student of a different class', async () => {
    await expectDenied(
      assertVerifiedMemberOfClass(
        db,
        individual(fixture.studentAccountId, 'STUDENT'),
        fixture.classBId,
      ),
      'VERIFICATION_REQUIRED',
    );
  });

  it('denies an outsider with no membership', async () => {
    await expectDenied(
      assertVerifiedMemberOfClass(
        db,
        individual(fixture.outsiderAccountId, 'USER'),
        fixture.classAId,
      ),
      'VERIFICATION_REQUIRED',
    );
  });

  it('denies a member whose verification is still PENDING — this is the whole gate', async () => {
    await setMembershipStatus(db, fixture.studentAccountId, 'PENDING');

    await expectDenied(
      assertVerifiedMemberOfClass(
        db,
        individual(fixture.studentAccountId, 'STUDENT'),
        fixture.classAId,
      ),
      'VERIFICATION_REQUIRED',
    );
  });

  it('denies a member whose verification was REVOKED', async () => {
    await setMembershipStatus(db, fixture.studentAccountId, 'REVOKED');

    await expectDenied(
      assertVerifiedMemberOfClass(
        db,
        individual(fixture.studentAccountId, 'STUDENT'),
        fixture.classAId,
      ),
      'VERIFICATION_REQUIRED',
    );
  });

  it('returns 404 for an unknown class, so ids cannot be probed for existence', async () => {
    await expectDenied(
      assertVerifiedMemberOfClass(
        db,
        individual(fixture.studentAccountId, 'STUDENT'),
        '11111111-1111-1111-1111-111111111111',
      ),
      'NOT_FOUND',
    );
  });

  it('returns 404 when another school asks about this class', async () => {
    const other = await db.account.create({
      data: {
        email: 'other-school@fixture.test',
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Other' } },
      },
      select: { id: true },
    });

    await expectDenied(
      assertVerifiedMemberOfClass(db, school(other.id), fixture.classAId),
      'NOT_FOUND',
    );
  });
});

describe('assertTeacherAllocatedToSubject', () => {
  it('allows the allocated teacher', async () => {
    await expect(
      assertTeacherAllocatedToSubject(
        db,
        individual(fixture.teacherAccountId, 'TEACHER'),
        fixture.mathsSubjectId,
      ),
    ).resolves.toBeUndefined();
  });

  it('denies the same teacher on a subject they are not allocated to', async () => {
    await expectDenied(
      assertTeacherAllocatedToSubject(
        db,
        individual(fixture.teacherAccountId, 'TEACHER'),
        fixture.scienceSubjectId,
      ),
      'FORBIDDEN',
    );
  });

  it('denies a different teacher at the same school', async () => {
    await expectDenied(
      assertTeacherAllocatedToSubject(
        db,
        individual(fixture.otherTeacherAccountId, 'TEACHER'),
        fixture.mathsSubjectId,
      ),
      'FORBIDDEN',
    );
  });

  it('denies a principal — viewing academics is not publishing to them', async () => {
    await expectDenied(
      assertTeacherAllocatedToSubject(
        db,
        individual(fixture.principalAccountId, 'PRINCIPAL'),
        fixture.mathsSubjectId,
      ),
      'FORBIDDEN',
    );
  });

  it('denies a student', async () => {
    await expectDenied(
      assertTeacherAllocatedToSubject(
        db,
        individual(fixture.studentAccountId, 'STUDENT'),
        fixture.mathsSubjectId,
      ),
      'FORBIDDEN',
    );
  });

  it('allows the owning school account', async () => {
    await expect(
      assertTeacherAllocatedToSubject(db, school(fixture.schoolAccountId), fixture.mathsSubjectId),
    ).resolves.toBeUndefined();
  });

  it('denies an allocated teacher whose membership is no longer verified', async () => {
    await setMembershipStatus(db, fixture.teacherAccountId, 'REVOKED');

    await expectDenied(
      assertTeacherAllocatedToSubject(
        db,
        individual(fixture.teacherAccountId, 'TEACHER'),
        fixture.mathsSubjectId,
      ),
      'VERIFICATION_REQUIRED',
    );
  });
});

describe('assertClassTeacherOf', () => {
  it('allows the class teacher of that class', async () => {
    await expect(
      assertClassTeacherOf(db, individual(fixture.teacherAccountId, 'TEACHER'), fixture.classAId),
    ).resolves.toBeUndefined();
  });

  it('denies the same teacher for a class they do not lead', async () => {
    await expectDenied(
      assertClassTeacherOf(db, individual(fixture.teacherAccountId, 'TEACHER'), fixture.classBId),
      'FORBIDDEN',
    );
  });

  it('denies another teacher', async () => {
    await expectDenied(
      assertClassTeacherOf(
        db,
        individual(fixture.otherTeacherAccountId, 'TEACHER'),
        fixture.classAId,
      ),
      'FORBIDDEN',
    );
  });

  it('denies the principal — teacher leave is theirs, student leave is not', async () => {
    await expectDenied(
      assertClassTeacherOf(
        db,
        individual(fixture.principalAccountId, 'PRINCIPAL'),
        fixture.classAId,
      ),
      'FORBIDDEN',
    );
  });
});

describe('assertPrincipalOfSchool', () => {
  it('allows the verified principal', async () => {
    await expect(
      assertPrincipalOfSchool(
        db,
        individual(fixture.principalAccountId, 'PRINCIPAL'),
        fixture.schoolAccountId,
      ),
    ).resolves.toBeUndefined();
  });

  it('denies a teacher', async () => {
    await expectDenied(
      assertPrincipalOfSchool(
        db,
        individual(fixture.teacherAccountId, 'TEACHER'),
        fixture.schoolAccountId,
      ),
      'FORBIDDEN',
    );
  });

  it('denies a principal of a different school', async () => {
    const other = await db.account.create({
      data: {
        email: 'other-school-2@fixture.test',
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Other 2' } },
      },
      select: { id: true },
    });

    await expectDenied(
      assertPrincipalOfSchool(db, individual(fixture.principalAccountId, 'PRINCIPAL'), other.id),
      'VERIFICATION_REQUIRED',
    );
  });

  it('denies an unverified principal', async () => {
    await setMembershipStatus(db, fixture.principalAccountId, 'PENDING');

    await expectDenied(
      assertPrincipalOfSchool(
        db,
        individual(fixture.principalAccountId, 'PRINCIPAL'),
        fixture.schoolAccountId,
      ),
      'VERIFICATION_REQUIRED',
    );
  });
});

describe('assertParentOfVerifiedChild', () => {
  it('allows the parent of a verified child', async () => {
    await expect(
      assertParentOfVerifiedChild(
        db,
        individual(fixture.parentAccountId, 'PARENT'),
        fixture.childId,
      ),
    ).resolves.toBeUndefined();
  });

  it('denies another parent, with 404 rather than 403', async () => {
    const stranger = await db.account.create({
      data: {
        email: 'stranger-parent@fixture.test',
        type: 'INDIVIDUAL',
        userProfile: { create: { fullName: 'Stranger', handle: 'strangerp', role: 'PARENT' } },
      },
      select: { id: true },
    });

    await expectDenied(
      assertParentOfVerifiedChild(db, individual(stranger.id, 'PARENT'), fixture.childId),
      'NOT_FOUND',
    );
  });

  it('denies the parent while the child link is unverified', async () => {
    await setMembershipStatus(db, fixture.parentAccountId, 'PENDING');

    await expectDenied(
      assertParentOfVerifiedChild(
        db,
        individual(fixture.parentAccountId, 'PARENT'),
        fixture.childId,
      ),
      'VERIFICATION_REQUIRED',
    );
  });

  it('returns 404 for an unknown child', async () => {
    await expectDenied(
      assertParentOfVerifiedChild(
        db,
        individual(fixture.parentAccountId, 'PARENT'),
        '22222222-2222-2222-2222-222222222222',
      ),
      'NOT_FOUND',
    );
  });
});

describe('assertOwnsResource', () => {
  it('allows the author', () => {
    expect(() => {
      assertOwnsResource(individual(fixture.studentAccountId, 'STUDENT'), fixture.studentAccountId);
    }).not.toThrow();
  });

  it('denies a different account', () => {
    expect(() => {
      assertOwnsResource(individual(fixture.studentAccountId, 'STUDENT'), fixture.teacherAccountId);
    }).toThrow();
  });

  it('denies even the school for another account content', () => {
    expect(() => {
      assertOwnsResource(school(fixture.schoolAccountId), fixture.studentAccountId);
    }).toThrow();
  });
});
