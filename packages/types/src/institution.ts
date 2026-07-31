/**
 * Institution request schemas and response DTOs (`.docs/PRD/02-institution.md`).
 *
 * The class taxonomy is a closed enumeration on purpose. The legacy app encoded a class as a
 * string key (`EngClass8SecA`) that had to be parsed to be understood and could not be validated;
 * here medium, level, and section are separate enum fields and the display key is derived.
 */
import { z } from 'zod';

import { ClassLevel, Medium, Section } from './enums.js';

export const updateSchoolProfileSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  adminName: z.string().trim().max(120).nullish(),
  phone: z.string().trim().max(20).nullish(),
  addressLine1: z.string().trim().max(200).nullish(),
  addressLine2: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(120).nullish(),
  state: z.string().trim().max(120).nullish(),
  postalCode: z.string().trim().max(20).nullish(),
  country: z.string().trim().max(120).nullish(),
  about: z.string().trim().max(4000).nullish(),
  mission: z.string().trim().max(4000).nullish(),
  vision: z.string().trim().max(4000).nullish(),
  facilities: z.string().trim().max(4000).nullish(),
  establishmentYear: z.coerce
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear() + 1)
    .nullish(),
  affiliation: z.string().trim().max(120).nullish(),
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

export type UpdateSchoolProfileInput = z.infer<typeof updateSchoolProfileSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

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
