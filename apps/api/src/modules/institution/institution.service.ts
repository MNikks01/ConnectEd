/**
 * Institution domain logic and **authorization** (`apps/api/CLAUDE.md` rule 2:
 * services own domain logic and authorization; controllers own neither).
 *
 * The rule running through every method: a school writes only its own structure
 * (`PRD/09-permissions-matrix.md`). Reads are wider, because a prospective member has to be able
 * to see a school's classes in order to request verification into one — the verification workflow
 * would otherwise be a chicken-and-egg.
 */
import { classDisplayName } from '@connected/types';

import { assertIsSchool } from '../../shared/authz/index.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';

import type { InstitutionRepository, ClassRow } from './institution.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type {
  AllocateClassTeacherInput,
  ClassLevel,
  ClassResponse,
  ClassTeacherResponse,
  CreateClassInput,
  CreateSubjectInput,
  Medium,
  MyClassTeacherResponse,
  Section,
  SchoolProfileResponse,
  SubjectResponse,
  UpdateClassInput,
  UpdateSchoolProfileInput,
} from '@connected/types';

export interface InstitutionService {
  getSchoolProfile: (actor: Actor, schoolId: string) => Promise<SchoolProfileResponse>;
  updateSchoolProfile: (
    actor: Actor,
    schoolId: string,
    input: UpdateSchoolProfileInput,
  ) => Promise<SchoolProfileResponse>;
  createClass: (actor: Actor, schoolId: string, input: CreateClassInput) => Promise<ClassResponse>;
  listClasses: (
    actor: Actor,
    schoolId: string,
    options: { includeInactive: boolean },
  ) => Promise<ClassResponse[]>;
  updateClass: (actor: Actor, classId: string, input: UpdateClassInput) => Promise<ClassResponse>;
  createSubject: (
    actor: Actor,
    classId: string,
    input: CreateSubjectInput,
  ) => Promise<SubjectResponse>;
  listSubjects: (actor: Actor, classId: string) => Promise<SubjectResponse[]>;
  allocateClassTeacher: (
    actor: Actor,
    classId: string,
    input: AllocateClassTeacherInput,
  ) => Promise<ClassTeacherResponse>;
  getClassTeacher: (actor: Actor, classId: string) => Promise<ClassTeacherResponse>;
  /** The caller's own class-teacher allocations. Scoped to them by construction. */
  listMyClassTeacherAllocations: (actor: Actor) => Promise<MyClassTeacherResponse[]>;
}

/**
 * The slice of the verification module this one needs.
 *
 * A narrow port rather than the whole `VerificationService`: institution only ever asks one
 * question of it, and depending on the full interface would let that quietly grow. `membership`
 * belongs to verification, so this module must not query it directly
 * (`.docs/Architecture/01-modules.md` rule 1).
 */
export interface MembershipDirectory {
  isVerifiedMember: (input: {
    accountId: string;
    schoolId: string;
    role: 'TEACHER';
  }) => Promise<boolean>;
}

export interface InstitutionServiceDeps {
  repository: InstitutionRepository;
  membership: MembershipDirectory;
}

export function createInstitutionService({
  repository,
  membership,
}: InstitutionServiceDeps): InstitutionService {
  /**
   * Loads a class and proves the caller may administer it. Every write below goes through here,
   * so there is one place where "is this your class?" is decided rather than one per handler.
   */
  async function loadClassForSchoolWrite(actor: Actor, classId: string): Promise<ClassRow> {
    const klass = await repository.findClass(classId);

    // Unknown id and someone else's class must be indistinguishable, or ids become probeable.
    if (!klass) throw new NotFoundError();

    assertIsSchool(actor, klass.schoolId);

    return klass;
  }

  return {
    /**
     * Readable by any authenticated account. FR-INST-001 says the profile is visible to members
     * and followers; neither relationship exists yet, and a school profile is closer to public
     * than private, so this is deliberately permissive for now rather than guessing a rule that
     * the verification and social modules will actually define.
     */
    getSchoolProfile: async (_actor: Actor, schoolId: string) => {
      const profile = await repository.findSchoolProfile(schoolId);
      if (!profile) throw new NotFoundError();

      return toSchoolProfileResponse(profile);
    },

    updateSchoolProfile: async (actor, schoolId, input) => {
      assertIsSchool(actor, schoolId);

      const existing = await repository.findSchoolProfile(schoolId);
      if (!existing) throw new NotFoundError();

      const updated = await repository.updateSchoolProfile(schoolId, input);
      return toSchoolProfileResponse(updated);
    },

    createClass: async (actor, schoolId, input) => {
      assertIsSchool(actor, schoolId);

      try {
        return toClassResponse(await repository.createClass({ schoolId, ...input }));
      } catch (error) {
        if (isUniqueViolation(error)) {
          // The (school, medium, level, section) unique constraint — FR-INST-002.
          throw new ConflictError('That class already exists for this school.');
        }
        throw error;
      }
    },

    listClasses: async (actor, schoolId, { includeInactive }) => {
      // A prospective member needs this list to pick a class when requesting verification, so it
      // is not school-only. Inactive classes are administrative detail and stay school-only.
      const canSeeInactive = actor.accountType === 'SCHOOL' && actor.accountId === schoolId;

      const rows = await repository.listClasses(schoolId, {
        includeInactive: includeInactive && canSeeInactive,
      });

      return rows.map(toClassResponse);
    },

    updateClass: async (actor, classId, input) => {
      await loadClassForSchoolWrite(actor, classId);

      return toClassResponse(await repository.setClassActive(classId, input.active));
    },

    createSubject: async (actor, classId, input) => {
      await loadClassForSchoolWrite(actor, classId);

      try {
        return await repository.createSubject(classId, input.name);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError('That subject already exists for this class.');
        }
        throw error;
      }
    },

    listSubjects: async (_actor, classId) => {
      const klass = await repository.findClass(classId);
      if (!klass) throw new NotFoundError();

      // Same reasoning as listClasses: a teacher declaring which subjects they teach needs to see
      // them before they have any verified membership.
      return repository.listSubjects(classId);
    },

    /**
     * FR-INST-004. The allocatee must be a **verified** teacher of this school — a self-declared
     * TEACHER role is not enough, or a school could be tricked into handing class-teacher powers
     * (leave approval for the whole class) to someone it never approved.
     */
    allocateClassTeacher: async (actor, classId, input) => {
      const klass = await loadClassForSchoolWrite(actor, classId);

      // Two separate questions: is this a teacher the school approved (verification's), and does
      // a teacher profile exist to allocate (this module's).
      const verified = await membership.isVerifiedMember({
        accountId: input.teacherAccountId,
        schoolId: klass.schoolId,
        role: 'TEACHER',
      });

      const teacher = verified
        ? await repository.findTeacherProfile(input.teacherAccountId, klass.schoolId)
        : null;

      if (!teacher) {
        throw new ConflictError('That account is not a verified teacher of this school.');
      }

      const { allocatedAt } = await repository.allocateClassTeacher({
        classId,
        teacherId: teacher.id,
        actorAccountId: actor.accountId,
      });

      return {
        classId,
        teacherAccountId: input.teacherAccountId,
        teacherName: teacher.fullName,
        allocatedAt: allocatedAt.toISOString(),
      };
    },

    listMyClassTeacherAllocations: async (actor) => {
      const rows = await repository.listClassTeacherAllocationsFor(actor.accountId);

      return rows.map((row) => ({
        classId: row.classId,
        className: classDisplayName({
          medium: row.medium as Medium,
          level: row.level as ClassLevel,
          section: row.section as Section,
        }),
        schoolId: row.schoolId,
        schoolName: row.schoolName,
      }));
    },

    getClassTeacher: async (_actor, classId) => {
      const klass = await repository.findClass(classId);
      if (!klass) throw new NotFoundError();

      const allocation = await repository.findClassTeacher(classId);
      if (!allocation) throw new NotFoundError('This class has no class teacher yet.');

      return {
        classId: allocation.classId,
        teacherAccountId: allocation.teacherAccountId,
        teacherName: allocation.teacherName,
        allocatedAt: allocation.allocatedAt.toISOString(),
      };
    },
  };
}

function toSchoolProfileResponse(row: {
  accountId: string;
  name: string;
  adminName: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  about: string | null;
  mission: string | null;
  vision: string | null;
  facilities: string | null;
  establishmentYear: number | null;
  affiliation: string | null;
}): SchoolProfileResponse {
  const { accountId, ...rest } = row;
  return { id: accountId, ...rest };
}

function toClassResponse(row: ClassRow): ClassResponse {
  return {
    id: row.id,
    medium: row.medium,
    level: row.level,
    section: row.section,
    active: row.active,
    displayName: classDisplayName(row),
    subjectCount: row.subjectCount,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
