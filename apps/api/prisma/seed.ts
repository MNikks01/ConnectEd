/**
 * Demo world for local dev and E2E (`.docs/Database/02-migrations.md`).
 *
 * **Idempotent**: every write is an upsert keyed on a natural key, so re-running is safe and does
 * not accumulate duplicates. That matters because `migrate dev` re-seeds on reset.
 *
 * Passwords here are hashed with argon2id exactly as the app does — the legacy system stored
 * plaintext, and seed data is not an excuse to reintroduce that habit. Every demo account shares
 * one obviously-fake local password.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';

import {
  AcademicItemType,
  AccountType,
  ClassLevel,
  FeedbackKind,
  LeaveKind,
  LeaveStatus,
  Medium,
  PrismaClient,
  Section,
  SubscriptionStatus,
  UserRole,
  VerificationStatus,
} from '../src/generated/prisma/client.js';
import { membershipScopeKey } from '../src/shared/db/membership-scope.js';

const DEMO_PASSWORD = 'DemoPassw0rd!';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Creates (or updates) an account plus its credential and profile, keyed on email. */
async function upsertIndividual(params: {
  email: string;
  fullName: string;
  handle: string;
  role: UserRole;
  passwordHash: string;
}) {
  const account = await prisma.account.upsert({
    where: { email: params.email },
    update: { type: AccountType.INDIVIDUAL, emailVerifiedAt: new Date() },
    create: {
      email: params.email,
      type: AccountType.INDIVIDUAL,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.credential.upsert({
    where: { accountId: account.id },
    update: { passwordHash: params.passwordHash, algo: 'argon2id' },
    create: { accountId: account.id, passwordHash: params.passwordHash, algo: 'argon2id' },
  });

  await prisma.userProfile.upsert({
    where: { accountId: account.id },
    update: { fullName: params.fullName, handle: params.handle, role: params.role },
    create: {
      accountId: account.id,
      fullName: params.fullName,
      handle: params.handle,
      role: params.role,
    },
  });

  return account;
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  // ---- School -------------------------------------------------------------
  const schoolAccount = await prisma.account.upsert({
    where: { email: 'admin@greenwood.test' },
    update: { type: AccountType.SCHOOL, emailVerifiedAt: new Date() },
    create: {
      email: 'admin@greenwood.test',
      type: AccountType.SCHOOL,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.credential.upsert({
    where: { accountId: schoolAccount.id },
    update: { passwordHash, algo: 'argon2id' },
    create: { accountId: schoolAccount.id, passwordHash, algo: 'argon2id' },
  });

  const school = await prisma.schoolProfile.upsert({
    where: { accountId: schoolAccount.id },
    update: { name: 'Greenwood Public School' },
    create: {
      accountId: schoolAccount.id,
      name: 'Greenwood Public School',
      adminName: 'Asha Menon',
      phone: '+91-99999-00000',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      about: 'A demo school used by local development and E2E runs.',
      establishmentYear: 1998,
      affiliation: 'CBSE',
    },
  });

  // ---- Classes & subjects -------------------------------------------------
  const classes = await Promise.all(
    [Section.A, Section.B].map((section) =>
      prisma.class.upsert({
        where: {
          schoolId_medium_level_section: {
            schoolId: school.accountId,
            medium: Medium.ENGLISH,
            level: ClassLevel.CLASS_8,
            section,
          },
        },
        update: { active: true },
        create: {
          schoolId: school.accountId,
          medium: Medium.ENGLISH,
          level: ClassLevel.CLASS_8,
          section,
        },
      }),
    ),
  );

  const [class8a, class8b] = classes;
  if (!class8a || !class8b) throw new Error('Failed to provision demo classes.');

  const subjectNames = ['Mathematics', 'Science', 'English'];
  const subjectsByClass = new Map<string, { id: string; name: string }[]>();

  for (const klass of classes) {
    const subjects = await Promise.all(
      subjectNames.map((name) =>
        prisma.subject.upsert({
          where: { classId_name: { classId: klass.id, name } },
          update: {},
          create: { classId: klass.id, name },
        }),
      ),
    );
    subjectsByClass.set(klass.id, subjects);
  }

  // ---- People -------------------------------------------------------------
  const principal = await upsertIndividual({
    email: 'principal@greenwood.test',
    fullName: 'Ravi Deshpande',
    handle: 'ravi.principal',
    role: UserRole.PRINCIPAL,
    passwordHash,
  });

  const teacher = await upsertIndividual({
    email: 'teacher@greenwood.test',
    fullName: 'Meera Iyer',
    handle: 'meera.teaches',
    role: UserRole.TEACHER,
    passwordHash,
  });

  const student = await upsertIndividual({
    email: 'student@greenwood.test',
    fullName: 'Aarav Sharma',
    handle: 'aarav',
    role: UserRole.STUDENT,
    passwordHash,
  });

  const parent = await upsertIndividual({
    email: 'parent@greenwood.test',
    fullName: 'Sunita Sharma',
    handle: 'sunita.s',
    role: UserRole.PARENT,
    passwordHash,
  });

  // A general user: social access only, no school affiliation.
  await upsertIndividual({
    email: 'user@example.test',
    fullName: 'Kabir Nair',
    handle: 'kabir',
    role: UserRole.USER,
    passwordHash,
  });

  // ---- Teaching allocations ----------------------------------------------
  const teacherProfile = await prisma.teacherProfile.upsert({
    where: { accountId_schoolId: { accountId: teacher.id, schoolId: school.accountId } },
    update: {},
    create: { accountId: teacher.id, schoolId: school.accountId },
  });

  const class8aSubjects = subjectsByClass.get(class8a.id) ?? [];
  for (const subject of class8aSubjects) {
    await prisma.subjectAllocation.upsert({
      where: {
        teacherId_subjectId: { teacherId: teacherProfile.id, subjectId: subject.id },
      },
      update: {},
      create: { teacherId: teacherProfile.id, subjectId: subject.id },
    });
  }

  // Class teacher of 8-A — this is what authorizes leave approval for that class.
  await prisma.classTeacher.upsert({
    where: { classId: class8a.id },
    update: { teacherId: teacherProfile.id },
    create: { classId: class8a.id, teacherId: teacherProfile.id },
  });

  // ---- Child & memberships ------------------------------------------------
  const existingChild = await prisma.child.findFirst({
    where: { parentAccountId: parent.id, fullName: 'Ananya Sharma' },
  });

  const child =
    existingChild ??
    (await prisma.child.create({
      data: {
        parentAccountId: parent.id,
        fullName: 'Ananya Sharma',
        schoolId: school.accountId,
        classId: class8b.id,
      },
    }));

  /** Membership is the row every academic authorization check reads. */
  async function upsertMembership(params: {
    accountId: string;
    role: UserRole;
    classId: string | null;
    childId: string | null;
    status: VerificationStatus;
  }) {
    return prisma.membership.upsert({
      where: {
        accountId_schoolId_role_scopeKey: {
          accountId: params.accountId,
          schoolId: school.accountId,
          role: params.role,
          scopeKey: membershipScopeKey(params.classId, params.childId),
        },
      },
      update: { status: params.status },
      create: {
        accountId: params.accountId,
        schoolId: school.accountId,
        role: params.role,
        classId: params.classId,
        childId: params.childId,
        scopeKey: membershipScopeKey(params.classId, params.childId),
        status: params.status,
      },
    });
  }

  await upsertMembership({
    accountId: principal.id,
    role: UserRole.PRINCIPAL,
    classId: null,
    childId: null,
    status: VerificationStatus.VERIFIED,
  });
  await upsertMembership({
    accountId: teacher.id,
    role: UserRole.TEACHER,
    classId: null,
    childId: null,
    status: VerificationStatus.VERIFIED,
  });
  await upsertMembership({
    accountId: student.id,
    role: UserRole.STUDENT,
    classId: class8a.id,
    childId: null,
    status: VerificationStatus.VERIFIED,
  });
  await upsertMembership({
    accountId: parent.id,
    role: UserRole.PARENT,
    classId: class8b.id,
    childId: child.id,
    status: VerificationStatus.VERIFIED,
  });

  // A pending request, so the verification queue is not empty in the demo world.
  const pendingRequest = await prisma.verificationRequest.findFirst({
    where: { requesterAccountId: student.id, schoolId: school.accountId, classId: class8b.id },
  });
  if (!pendingRequest) {
    await prisma.verificationRequest.create({
      data: {
        requesterAccountId: student.id,
        schoolId: school.accountId,
        role: UserRole.STUDENT,
        classId: class8b.id,
        status: VerificationStatus.PENDING,
      },
    });
  }

  // ---- Academic content ---------------------------------------------------
  const maths = class8aSubjects.find((subject) => subject.name === 'Mathematics');
  if (maths) {
    for (const [index, type] of [
      AcademicItemType.HOMEWORK,
      AcademicItemType.ASSIGNMENT,
      AcademicItemType.PROJECT,
    ].entries()) {
      const title = `Demo ${type.toLowerCase()} ${index + 1}`;
      const existing = await prisma.academicItem.findFirst({
        where: { classId: class8a.id, subjectId: maths.id, title },
      });
      if (!existing) {
        await prisma.academicItem.create({
          data: {
            type,
            classId: class8a.id,
            subjectId: maths.id,
            authorAccountId: teacher.id,
            title,
            body: 'Seeded content for local development.',
            dueAt: new Date(Date.now() + (index + 1) * 86_400_000),
          },
        });
      }
    }
  }

  const noticeTitle = 'Annual Day rehearsals begin Monday';
  const existingNotice = await prisma.notice.findFirst({
    where: { schoolId: school.accountId, title: noticeTitle },
  });
  if (!existingNotice) {
    await prisma.notice.create({
      data: {
        schoolId: school.accountId,
        authorAccountId: principal.id,
        title: noticeTitle,
        body: 'All classes report to the auditorium at 9am.',
      },
    });
  }

  const eventTitle = 'Annual Day';
  const existingEvent = await prisma.event.findFirst({
    where: { schoolId: school.accountId, title: eventTitle },
  });
  if (!existingEvent) {
    await prisma.event.create({
      data: {
        schoolId: school.accountId,
        title: eventTitle,
        body: 'Performances by every class.',
        eventAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
  }

  // ---- Workflows: one leave application in each state ---------------------
  for (const status of [LeaveStatus.RECEIVED, LeaveStatus.ACCEPTED, LeaveStatus.REJECTED]) {
    const reason = `Demo leave (${status.toLowerCase()})`;
    const existing = await prisma.leaveApplication.findFirst({
      where: { applicantAccountId: parent.id, reason },
    });
    if (!existing) {
      await prisma.leaveApplication.create({
        data: {
          kind: LeaveKind.STUDENT,
          applicantAccountId: parent.id,
          childId: child.id,
          classId: class8b.id,
          schoolId: school.accountId,
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-05'),
          reason,
          status,
          ...(status === LeaveStatus.RECEIVED
            ? {}
            : { decidedBy: teacher.id, decidedAt: new Date() }),
        },
      });
    }
  }

  const feedbackBody = 'The bus route timing could be improved.';
  const existingFeedback = await prisma.feedback.findFirst({
    where: { authorAccountId: parent.id, body: feedbackBody },
  });
  if (!existingFeedback) {
    await prisma.feedback.create({
      data: {
        kind: FeedbackKind.SUGGESTION,
        authorAccountId: parent.id,
        schoolId: school.accountId,
        body: feedbackBody,
      },
    });
  }

  // ---- Social -------------------------------------------------------------
  const postBody = 'Excited for Annual Day!';
  const existingPost = await prisma.post.findFirst({
    where: { authorAccountId: student.id, body: postBody },
  });
  const post =
    existingPost ??
    (await prisma.post.create({ data: { authorAccountId: student.id, body: postBody } }));

  await prisma.postLike.upsert({
    where: { postId_accountId: { postId: post.id, accountId: parent.id } },
    update: {},
    create: { postId: post.id, accountId: parent.id },
  });

  await prisma.follow.upsert({
    where: {
      followerAccountId_followeeAccountId: {
        followerAccountId: parent.id,
        followeeAccountId: teacher.id,
      },
    },
    update: {},
    create: { followerAccountId: parent.id, followeeAccountId: teacher.id },
  });

  // Thread participants are ordered so the unique pair constraint cannot be bypassed by swapping.
  const [participantA, participantB] = [parent.id, teacher.id].sort();
  if (participantA && participantB) {
    const thread = await prisma.messageThread.upsert({
      where: { participantA_participantB: { participantA, participantB } },
      update: {},
      create: { participantA, participantB },
    });

    const messageBody = 'Could we discuss Ananya’s progress this week?';
    const existingMessage = await prisma.message.findFirst({
      where: { threadId: thread.id, body: messageBody },
    });
    if (!existingMessage) {
      await prisma.message.create({
        data: { threadId: thread.id, senderAccountId: parent.id, body: messageBody },
      });
    }
  }

  // ---- Billing ------------------------------------------------------------
  const plan = await prisma.plan.upsert({
    where: { code: 'demo-standard' },
    update: { name: 'Standard (demo)' },
    create: {
      code: 'demo-standard',
      name: 'Standard (demo)',
      limits: { classes: 50, members: 2000 },
      features: { academics: true, social: true, billing: true },
    },
  });

  await prisma.subscription.upsert({
    where: { schoolId: school.accountId },
    update: { planId: plan.id, status: SubscriptionStatus.ACTIVE },
    create: {
      schoolId: school.accountId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      periodStart: new Date('2026-07-01'),
      periodEnd: new Date('2027-07-01'),
    },
  });

  console.warn(
    [
      'Seed complete.',
      `  school:    admin@greenwood.test`,
      `  principal: principal@greenwood.test`,
      `  teacher:   teacher@greenwood.test (class teacher of 8-A)`,
      `  student:   student@greenwood.test (verified in 8-A)`,
      `  parent:    parent@greenwood.test (child Ananya in 8-B)`,
      `  user:      user@example.test (social only)`,
      `  password:  ${DEMO_PASSWORD}  (local demo data only)`,
    ].join('\n'),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
