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
  ClassResponse,
  CreateClassInput,
  CreateSubjectInput,
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
}

export function createInstitutionService(repository: InstitutionRepository): InstitutionService {
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
