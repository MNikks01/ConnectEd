/**
 * Syllabus coverage (FR-ACAD-030, 031).
 *
 * Writing reuses the same policy as publishing homework — `assertTeacherAllocatedToSubject` — so
 * the rule is identical and cannot drift: a teacher records progress for *their* subject, and the
 * school may record it for any of its own. Reading is every verified member of the class the
 * subject belongs to, which is what makes coverage answerable by a parent (FR-ACAD-031).
 */
import {
  assertTeacherAllocatedToSubject,
  assertVerifiedMemberOfClass,
} from '../../shared/authz/index.js';
import { NotFoundError } from '../../shared/errors/index.js';

import type { SyllabusRepository, SyllabusTopicRow } from './syllabus.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type {
  SyllabusCoverageResponse,
  SyllabusTopicResponse,
  UpsertSyllabusTopicInput,
} from '@connected/types';

export interface SyllabusService {
  record: (
    actor: Actor,
    subjectId: string,
    input: UpsertSyllabusTopicInput,
  ) => Promise<SyllabusTopicResponse>;
  coverage: (actor: Actor, subjectId: string) => Promise<SyllabusCoverageResponse>;
  /**
   * Coverage for every subject of a class, authorized once against the class.
   *
   * The per-subject endpoint would answer the same question in six requests, and — worse — a
   * class with no subjects would never reach a policy at all, so a stranger could tell an empty
   * class from one that does not exist.
   */
  classCoverage: (actor: Actor, classId: string) => Promise<{ data: SyllabusCoverageResponse[] }>;
  removeTopic: (actor: Actor, topicId: string) => Promise<void>;
}

export interface SyllabusServiceDeps {
  repository: SyllabusRepository;
  db: Db;
  logger: Logger;
}

export function createSyllabusService({
  repository,
  db,
  logger,
}: SyllabusServiceDeps): SyllabusService {
  function toResponse(row: SyllabusTopicRow): SyllabusTopicResponse {
    return {
      id: row.id,
      subjectId: row.subjectId,
      topic: row.topic,
      percent: row.percent,
      updatedByAccountId: row.updatedByAccountId,
      updatedByName: row.updatedByName,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** The subject, and the class it belongs to. Unknown subject and out-of-scope must look alike. */
  async function loadSubject(subjectId: string): Promise<{ classId: string; name: string }> {
    const subject = await repository.findSubject(subjectId);
    if (!subject) throw new NotFoundError();

    return subject;
  }

  /**
   * The mean across topics, not a weighted one: the schema has no notion of how long a chapter
   * takes, and inventing weights here would put a number on screen that nothing can justify.
   */
  function overall(topics: SyllabusTopicRow[]): number {
    if (topics.length === 0) return 0;

    const total = topics.reduce((sum, topic) => sum + topic.percent, 0);
    return Math.round(total / topics.length);
  }

  return {
    record: async (actor, subjectId, input) => {
      // Proves the subject exists before the policy speaks about it.
      await loadSubject(subjectId);
      await assertTeacherAllocatedToSubject(db, actor, subjectId);

      const row = await repository.upsertTopic({
        subjectId,
        topic: input.topic,
        percent: input.percent,
        updatedBy: actor.accountId,
      });

      logger.info(
        { subjectId, topic: row.topic, percent: row.percent, accountId: actor.accountId },
        'Syllabus coverage recorded',
      );

      return toResponse(row);
    },

    coverage: async (actor, subjectId) => {
      const subject = await loadSubject(subjectId);

      // Read access follows the class, so a parent of a child in it can see how far the syllabus
      // has got without being able to touch it.
      await assertVerifiedMemberOfClass(db, actor, subject.classId);

      const topics = await repository.listForSubject(subjectId);

      return {
        subjectId,
        subjectName: subject.name,
        overallPercent: overall(topics),
        topics: topics.map(toResponse),
      };
    },

    classCoverage: async (actor, classId) => {
      await assertVerifiedMemberOfClass(db, actor, classId);

      const subjects = await repository.listSubjectsOfClass(classId);
      const topics = await repository.listForSubjects(subjects.map((subject) => subject.id));

      return {
        data: subjects.map((subject) => {
          const mine = topics.filter((topic) => topic.subjectId === subject.id);

          return {
            subjectId: subject.id,
            subjectName: subject.name,
            overallPercent: overall(mine),
            topics: mine.map(toResponse),
          };
        }),
      };
    },

    removeTopic: async (actor, topicId) => {
      const topic = await repository.findTopic(topicId);
      if (!topic) throw new NotFoundError();

      // Same write policy as recording: whoever may record for this subject may correct it.
      await assertTeacherAllocatedToSubject(db, actor, topic.subjectId);

      await repository.remove(topicId);
      logger.info({ topicId, accountId: actor.accountId }, 'Syllabus topic removed');
    },
  };
}
