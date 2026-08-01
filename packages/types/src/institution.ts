/**
 * Institution request schemas and response DTOs (`.docs/PRD/02-institution.md`).
 *
 * The class taxonomy is a closed enumeration on purpose. The legacy app encoded a class as a
 * string key (`EngClass8SecA`) that had to be parsed to be understood and could not be validated;
 * here medium, level, and section are separate enum fields and the display key is derived.
 */
import { z } from 'zod';

import { ClassLevel, Medium, Section } from './enums.js';

/**
 * An HTML form submits every field it renders, and an untouched one arrives as `''`. Without this,
 * a blank optional field is not "absent" — it is an empty string, which `z.coerce.number()` turns
 * into `0`.
 *
 * That is not hypothetical: a freshly registered school has no establishment year, so saving the
 * profile failed `min(1800)` on a field the user had never touched, and the whole form was
 * rejected. Caught by the end-to-end suite; every unit test had passed a well-formed object.
 */
const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? null : value), schema);

/** Optional free text. Clearing a field stores null rather than an empty string. */
const optionalText = (max: number) => blankToNull(z.string().trim().max(max).nullish());

export const updateSchoolProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  adminName: optionalText(120),
  phone: optionalText(20),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(120),
  state: optionalText(120),
  postalCode: optionalText(20),
  country: optionalText(120),
  about: optionalText(4000),
  mission: optionalText(4000),
  vision: optionalText(4000),
  facilities: optionalText(4000),
  establishmentYear: blankToNull(
    z.coerce
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear() + 1)
      .nullish(),
  ),
  affiliation: optionalText(120),
});

export const createClassSchema = z.object({
  medium: z.enum(Medium),
  level: z.enum(ClassLevel),
  section: z.enum(Section),
});

export const updateClassSchema = z.object({
  /** Deactivating hides the class from publishing targets; existing data is retained (FR-INST-006). */
  active: z.boolean(),
});

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

/** FR-INST-004 — the allocatee must already be a verified teacher of the school. */
export const allocateClassTeacherSchema = z.object({
  teacherAccountId: z.uuid(),
});

export type UpdateSchoolProfileInput = z.infer<typeof updateSchoolProfileSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type AllocateClassTeacherInput = z.infer<typeof allocateClassTeacherSchema>;

export interface ClassTeacherResponse {
  classId: string;
  teacherAccountId: string;
  teacherName: string | null;
  allocatedAt: string;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface SchoolProfileResponse {
  id: string;
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

export interface ClassResponse {
  id: string;
  medium: Medium;
  level: ClassLevel;
  section: Section;
  active: boolean;
  /** Human-readable label derived from the enums — never stored, never a key. */
  displayName: string;
  subjectCount: number;
}

export interface SubjectResponse {
  id: string;
  classId: string;
  name: string;
}

const LEVEL_LABELS: Record<ClassLevel, string> = {
  PRE_NURSERY: 'Pre-Nursery',
  NURSERY: 'Nursery',
  KG1: 'KG-1',
  KG2: 'KG-2',
  CLASS_1: 'Class 1',
  CLASS_2: 'Class 2',
  CLASS_3: 'Class 3',
  CLASS_4: 'Class 4',
  CLASS_5: 'Class 5',
  CLASS_6: 'Class 6',
  CLASS_7: 'Class 7',
  CLASS_8: 'Class 8',
  CLASS_9: 'Class 9',
  CLASS_10: 'Class 10',
  CLASS_11: 'Class 11',
  CLASS_12: 'Class 12',
};

const MEDIUM_LABELS: Record<Medium, string> = {
  ENGLISH: 'English',
  HINDI: 'Hindi',
};

/**
 * Replaces the legacy `classKey`. Shared here so the API and the web app render a class the same
 * way — two independent format functions is how "Class 8-A" and "Class 8 A" end up in one product.
 */
export function classDisplayName(parts: {
  medium: Medium;
  level: ClassLevel;
  section: Section;
}): string {
  return `${LEVEL_LABELS[parts.level]}-${parts.section} (${MEDIUM_LABELS[parts.medium]})`;
}
