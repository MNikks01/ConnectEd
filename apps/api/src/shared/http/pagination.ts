/**
 * Cursor pagination (`.docs/API/01-conventions.md`).
 *
 * **Why cursors rather than offsets.** With `OFFSET`, inserting a row while someone pages shifts
 * everything down: they see an item twice, or never see one at all. These are feeds where new rows
 * arrive constantly at the top, so that is the normal case, not an edge case. A cursor names a
 * *position in the ordering* instead of a count, so pages stay stable no matter what is inserted.
 *
 * **Why the sort key is `(createdAt, id)` and not `createdAt`.** Two items published in the same
 * millisecond are not ordered by `createdAt` alone, so the page boundary between them is
 * arbitrary — and an arbitrary boundary is exactly where an item gets duplicated or skipped. The
 * id breaks the tie and is unique, which makes the ordering total.
 *
 * **Why the cursor is opaque.** It encodes an internal sort key. Clients that parse it start
 * depending on it, and then the ordering cannot change without breaking them.
 */
import { ValidationFailedError } from '../errors/index.js';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Ceiling for lists the conventions allow to stay unpaginated — classes, subjects, a school's
 * roster. They are bounded by how a school is organised rather than by time, so a cursor would be
 * ceremony. They still need a limit: "bounded in practice" is not the same as bounded, and one
 * unusual school should not be able to return everything.
 */
export const BOUNDED_LIST_CAP = 500;

export interface CursorPosition {
  createdAt: Date;
  id: string;
}

export interface PageRequest {
  limit: number;
  after?: CursorPosition | undefined;
}

export interface Page<T> {
  data: T[];
  /** `null` when there is nothing more — the client stops rather than guessing. */
  nextCursor: string | null;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(
    JSON.stringify({ t: position.createdAt.toISOString(), i: position.id }),
    'utf8',
  ).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPosition {
  const invalid = (): never => {
    // A cursor the client did not get from us is a client bug, not a server error — and a
    // malformed one must not fall back to "start from the beginning", which would silently
    // re-deliver a page they have already seen.
    throw new ValidationFailedError([{ field: 'cursor', issue: 'That cursor is not valid.' }]);
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return invalid();
  }

  if (typeof parsed !== 'object' || parsed === null) return invalid();

  const { t, i } = parsed as { t?: unknown; i?: unknown };
  if (typeof t !== 'string' || typeof i !== 'string') return invalid();

  const createdAt = new Date(t);
  if (Number.isNaN(createdAt.getTime())) return invalid();

  return { createdAt, id: i };
}

/** Reads `?limit=&cursor=` from a query object, clamping the limit rather than rejecting it. */
export function parsePageRequest(query: { limit?: unknown; cursor?: unknown }): PageRequest {
  const rawLimit = Number(query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

  return {
    limit: Math.floor(limit),
    after:
      typeof query.cursor === 'string' && query.cursor.length > 0
        ? decodeCursor(query.cursor)
        : undefined,
  };
}

/**
 * The Prisma `where` fragment for "strictly after this position" in `createdAt desc, id desc`.
 *
 * Expressed as an OR because Prisma has no row-value comparison; `(createdAt, id) < (t, i)` in SQL
 * becomes "older, or same instant with a smaller id".
 */
export function cursorFilter(after: CursorPosition | undefined): object {
  if (!after) return {};

  return {
    OR: [
      { createdAt: { lt: after.createdAt } },
      { createdAt: after.createdAt, id: { lt: after.id } },
    ],
  };
}

/** Newest first, with the id as the tiebreaker that makes the ordering total. */
export const CURSOR_ORDER = [{ createdAt: 'desc' }, { id: 'desc' }] as const;

/**
 * Turns `limit + 1` rows into a page. Fetching one extra is how "is there more?" is answered
 * without a second `COUNT` query, which on a large feed costs more than the page itself.
 */
export function toPage<T extends CursorPosition>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data.at(-1);

  return {
    data,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

/** `take` for a page: one more than asked, to detect whether another page exists. */
export function takeFor(limit: number): number {
  return limit + 1;
}
