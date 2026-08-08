/**
 * Test-account helpers.
 *
 * Every account is created through the **API**, not seeded into the database. Registering the way
 * a real user would means these tests exercise password hashing and account creation rather than
 * assuming a fixture the app never actually produces.
 *
 * Emails carry a timestamp so runs do not collide — the suite deliberately does not truncate the
 * database, because doing so from the test process while the servers hold connections is a source
 * of lock contention and flakes.
 */
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4810/api/v1';

export const PASSWORD = 'correct horse battery staple';

let counter = 0;

/**
 * A unique slug that is also a **legal handle**, which the previous version was not.
 *
 * The API caps a handle at 30 characters. `${prefix}-${Date.now()}-${counter}` spends 13 of them on
 * a millisecond timestamp, so the two longest prefixes — `liverecipient` and `platformadmin` —
 * crossed the limit exactly when the counter reached three digits. That happens partway through a
 * full suite run and never when a spec runs alone, so it read as a flake for as long as it existed:
 * whether it fired depended on how many accounts earlier tests had created, which changes every
 * time a test is added or reordered.
 *
 * Base 36 spends 8 characters instead of 13, leaving room for a four-digit counter and a longer
 * prefix than anyone has needed yet.
 */
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export interface Individual {
  email: string;
  handle: string;
  fullName: string;
  accessToken: string;
  accountId: string;
}

export interface School {
  email: string;
  name: string;
  accessToken: string;
  accountId: string;
}

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Mobile so the refresh token comes back in the body; these helpers hold no cookie jar.
      'X-Client-Type': 'mobile',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Client-Type': 'mobile' },
  });

  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function createIndividual(prefix = 'person'): Promise<Individual> {
  const slug = unique(prefix);
  const email = `${slug}@e2e.test`;
  const handle = slug.replace(/-/g, '.');

  const session = await apiPost<{ accessToken: string }>('/auth/register', {
    email,
    password: PASSWORD,
    fullName: `E2E ${prefix}`,
    handle,
  });

  const me = await apiGet<{ id: string }>('/me', session.accessToken);

  return {
    email,
    handle,
    fullName: `E2E ${prefix}`,
    accessToken: session.accessToken,
    accountId: me.id,
  };
}

export async function createSchool(prefix = 'school'): Promise<School> {
  const slug = unique(prefix);
  const email = `${slug}@e2e.test`;
  const name = `E2E ${slug}`;

  const session = await apiPost<{ accessToken: string }>('/auth/register/school', {
    email,
    password: PASSWORD,
    name,
  });

  const me = await apiGet<{ id: string }>('/me', session.accessToken);

  return { email, name, accessToken: session.accessToken, accountId: me.id };
}

export async function createClass(
  school: School,
  input: { medium: string; level: string; section: string },
): Promise<{ id: string; displayName: string }> {
  return apiPost(`/schools/${school.accountId}/classes`, input, school.accessToken);
}

export async function submitStudentVerification(
  student: Individual,
  schoolId: string,
  classId: string,
): Promise<{ id: string }> {
  return apiPost('/verifications', { role: 'STUDENT', schoolId, classId }, student.accessToken);
}

export async function createSubject(
  school: School,
  classId: string,
  name: string,
): Promise<{ id: string }> {
  return apiPost(`/classes/${classId}/subjects`, { name }, school.accessToken);
}

/** A teacher request must name at least one subject they teach (FR-VER-003). */
export async function submitTeacherVerification(
  teacher: Individual,
  schoolId: string,
  subjectIds: string[],
): Promise<{ id: string }> {
  return apiPost('/verifications', { role: 'TEACHER', schoolId, subjectIds }, teacher.accessToken);
}

/** Approves a pending request the way the portal does, so the E2E setup exercises the real path. */
export async function approveVerification(school: School, requestId: string): Promise<void> {
  await apiPost(
    `/verifications/${requestId}/decision`,
    { decision: 'APPROVE' },
    school.accessToken,
  );
}

/**
 * A teacher verified for one subject of one class — the only shape that may publish to it.
 * Returns the class and subject so the caller can assert against them.
 */
export async function verifiedTeacherFor(
  school: School,
  classId: string,
  subjectName: string,
): Promise<{ teacher: Individual; subjectId: string }> {
  const subject = await createSubject(school, classId, subjectName);
  const teacher = await createIndividual('teacher');

  const request = await submitTeacherVerification(teacher, school.accountId, [subject.id]);
  await approveVerification(school, request.id);

  return { teacher, subjectId: subject.id };
}

/** A student verified into a class — the reader side of the feed. */
export async function verifiedStudentIn(
  school: School,
  classId: string,
  prefix = 'student',
): Promise<Individual> {
  const student = await createIndividual(prefix);
  const request = await submitStudentVerification(student, school.accountId, classId);
  await approveVerification(school, request.id);
  return student;
}

/**
 * Makes a verified teacher the class teacher of a class (FR-INST-004).
 *
 * The school's action, and a prerequisite for anything the class teacher alone may do — taking a
 * register, for one. A subject teacher is not a class teacher, and the API is right to refuse them.
 */
export async function allocateClassTeacher(
  school: School,
  classId: string,
  teacher: Individual,
): Promise<void> {
  await apiPost(
    `/classes/${classId}/class-teacher`,
    { teacherAccountId: teacher.accountId },
    school.accessToken,
  );
}
