/**
 * Institution persistence. **The only file in this module that touches Prisma**
 * (`apps/api/CLAUDE.md` rule 1).
 */
import type { Db } from '../../shared/db/index.js';
import type { ClassLevel, Medium, Section } from '../../generated/prisma/client.js';

export interface SchoolProfileRow {
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
}

export interface ClassRow {
  id: string;
  schoolId: string;
  medium: Medium;
  level: ClassLevel;
  section: Section;
  active: boolean;
  subjectCount: number;
}

export interface SubjectRow {
  id: string;
  classId: string;
  name: string;
}

export interface InstitutionRepository {
  findSchoolProfile: (schoolId: string) => Promise<SchoolProfileRow | null>;
  updateSchoolProfile: (
    schoolId: string,
    data: Partial<Omit<SchoolProfileRow, 'accountId'>>,
  ) => Promise<SchoolProfileRow>;
  createClass: (input: {
    schoolId: string;
    medium: Medium;
    level: ClassLevel;
    section: Section;
  }) => Promise<ClassRow>;
  listClasses: (schoolId: string, options: { includeInactive: boolean }) => Promise<ClassRow[]>;
  findClass: (classId: string) => Promise<ClassRow | null>;
  setClassActive: (classId: string, active: boolean) => Promise<ClassRow>;
  createSubject: (classId: string, name: string) => Promise<SubjectRow>;
  listSubjects: (classId: string) => Promise<SubjectRow[]>;
}

const CLASS_SELECT = {
  id: true,
  schoolId: true,
  medium: true,
  level: true,
  section: true,
  active: true,
  _count: { select: { subjects: true } },
} as const;

interface ClassWithCount {
  id: string;
  schoolId: string;
  medium: Medium;
  level: ClassLevel;
  section: Section;
  active: boolean;
  _count: { subjects: number };
}

function toClassRow(row: ClassWithCount): ClassRow {
  return {
    id: row.id,
    schoolId: row.schoolId,
    medium: row.medium,
    level: row.level,
    section: row.section,
    active: row.active,
    subjectCount: row._count.subjects,
  };
}

export function createInstitutionRepository(db: Db): InstitutionRepository {
  return {
    findSchoolProfile: (schoolId: string) =>
      db.schoolProfile.findUnique({ where: { accountId: schoolId } }),

    updateSchoolProfile: (schoolId, data) =>
      db.schoolProfile.update({ where: { accountId: schoolId }, data }),

    createClass: async (input) => {
      const created = await db.class.create({ data: input, select: CLASS_SELECT });
      return toClassRow(created);
    },

    listClasses: async (schoolId, { includeInactive }) => {
      const rows = await db.class.findMany({
        where: { schoolId, ...(includeInactive ? {} : { active: true }) },
        select: CLASS_SELECT,
        // Enum order is the taxonomy order (Pre-Nursery → Class 12), so this sorts the way a
        // person reads a class list rather than alphabetically.
        orderBy: [{ level: 'asc' }, { section: 'asc' }, { medium: 'asc' }],
      });
      return rows.map(toClassRow);
    },

    findClass: async (classId) => {
      const row = await db.class.findUnique({ where: { id: classId }, select: CLASS_SELECT });
      return row ? toClassRow(row) : null;
    },

    setClassActive: async (classId, active) => {
      const row = await db.class.update({
        where: { id: classId },
        data: { active },
        select: CLASS_SELECT,
      });
      return toClassRow(row);
    },

    createSubject: (classId, name) =>
      db.subject.create({
        data: { classId, name },
        select: { id: true, classId: true, name: true },
      }),

    listSubjects: (classId) =>
      db.subject.findMany({
        where: { classId },
        select: { id: true, classId: true, name: true },
        orderBy: { name: 'asc' },
      }),
  };
}
