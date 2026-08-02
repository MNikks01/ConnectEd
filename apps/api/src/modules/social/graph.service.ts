/**
 * Follows and connections (FR-SOC-010, 011).
 *
 * Two different relationships, deliberately not merged:
 *
 * - A **follow** is directional and needs no consent — how you keep up with a school.
 * - A **connection** is mutual and needs both parties — how two people agree to be linked.
 *
 * Blocking refuses both, in either direction. The refusal is a `NotFoundError` rather than a
 * forbidden: telling someone "you are blocked" hands them information the block exists to withhold.
 */
import { ConflictError, NotFoundError, ValidationFailedError } from '../../shared/errors/index.js';

import type { CardRow, ConnectionRow, GraphRepository } from './graph.repository.js';
import { orderPair } from './graph.repository.js';

import type { Actor } from '../../shared/authz/actor.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { ConnectionStatus } from '../../generated/prisma/client.js';
import type { ConnectionResponse, FollowStateResponse } from '@connected/types';

export interface GraphService {
  follow: (actor: Actor, accountId: string) => Promise<FollowStateResponse>;
  unfollow: (actor: Actor, accountId: string) => Promise<FollowStateResponse>;
  followState: (actor: Actor, accountId: string) => Promise<FollowStateResponse>;

  requestConnection: (actor: Actor, accountId: string) => Promise<ConnectionResponse>;
  acceptConnection: (actor: Actor, connectionId: string) => Promise<ConnectionResponse>;
  /** Reject as the recipient, or cancel as the requester — the same row, removed. */
  removeConnection: (actor: Actor, connectionId: string) => Promise<void>;
  listConnections: (
    actor: Actor,
    status: ConnectionStatus | undefined,
  ) => Promise<{ data: ConnectionResponse[] }>;
}

export interface GraphServiceDeps {
  repository: GraphRepository;
  storage?: Storage | undefined;
  logger: Logger;
}

export function createGraphService({
  repository,
  storage,
  logger,
}: GraphServiceDeps): GraphService {
  async function toCard(card: CardRow) {
    return {
      accountId: card.accountId,
      accountType: card.accountType,
      displayName: card.displayName,
      handle: card.handle,
      displayPicUrl:
        card.displayPicKey && storage ? await storage.signedUrl(card.displayPicKey) : null,
    };
  }

  async function toResponse(row: ConnectionRow, actor: Actor): Promise<ConnectionResponse> {
    return {
      id: row.id,
      status: row.status,
      other: await toCard(row.other),
      requestedByMe: row.requestedBy === actor.accountId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * A block hides the other account entirely, in both directions.
   *
   * `NotFoundError`, not forbidden: "you are blocked" is itself information, and the account the
   * caller is asking about should look absent rather than protected.
   */
  async function assertReachable(actor: Actor, accountId: string): Promise<void> {
    if (await repository.isBlockedEitherWay(actor.accountId, accountId)) {
      throw new NotFoundError();
    }
  }

  async function state(actor: Actor, accountId: string): Promise<FollowStateResponse> {
    const counts = await repository.followCounts(accountId);

    return {
      accountId,
      following: await repository.isFollowing(actor.accountId, accountId),
      followerCount: counts.followers,
      followingCount: counts.following,
    };
  }

  return {
    follow: async (actor, accountId) => {
      if (accountId === actor.accountId) {
        throw new ValidationFailedError([
          { field: 'accountId', issue: 'You cannot follow yourself.' },
        ]);
      }

      await assertReachable(actor, accountId);
      await repository.follow(actor.accountId, accountId);

      return state(actor, accountId);
    },

    unfollow: async (actor, accountId) => {
      // No block check: unfollowing must keep working after a block, or a blocked account stays
      // in your following list with no way to remove it.
      await repository.unfollow(actor.accountId, accountId);

      return state(actor, accountId);
    },

    followState: async (actor, accountId) => {
      await assertReachable(actor, accountId);
      return state(actor, accountId);
    },

    requestConnection: async (actor, accountId) => {
      if (accountId === actor.accountId) {
        throw new ValidationFailedError([
          { field: 'accountId', issue: 'You cannot connect with yourself.' },
        ]);
      }

      await assertReachable(actor, accountId);

      const existing = await repository.findConnection(actor.accountId, accountId);

      if (existing) {
        // Including the case where *they* asked first: the answer is "there is already a request",
        // not a second row. Accepting is the next step, and it is a different endpoint.
        throw new ConflictError(
          existing.status === 'ACCEPTED'
            ? 'You are already connected.'
            : 'A request between you two is already open.',
        );
      }

      const { a, b } = orderPair(actor.accountId, accountId);
      const created = await repository.createConnection({ a, b, requestedBy: actor.accountId });

      logger.info({ connectionId: created.id }, 'Connection requested');

      return toResponse(created, actor);
    },

    acceptConnection: async (actor, connectionId) => {
      const connection = await repository.findConnectionById(connectionId, actor.accountId);
      if (!connection) throw new NotFoundError();

      const isParty =
        connection.aAccountId === actor.accountId || connection.bAccountId === actor.accountId;
      if (!isParty) throw new NotFoundError();

      if (connection.requestedBy === actor.accountId) {
        // Accepting your own request would make a connection out of one person's decision.
        throw new ConflictError('The other person has to accept this.');
      }

      if (connection.status === 'ACCEPTED') {
        throw new ConflictError('You are already connected.');
      }

      const accepted = await repository.acceptConnection(connectionId);
      logger.info({ connectionId }, 'Connection accepted');

      return toResponse(accepted, actor);
    },

    removeConnection: async (actor, connectionId) => {
      const connection = await repository.findConnectionById(connectionId, actor.accountId);
      if (!connection) throw new NotFoundError();

      const isParty =
        connection.aAccountId === actor.accountId || connection.bAccountId === actor.accountId;
      if (!isParty) throw new NotFoundError();

      // One endpoint for three things — reject, cancel, disconnect — because they are the same
      // operation from different sides, and naming them apart would invite three code paths that
      // must stay in step.
      await repository.deleteConnection(connectionId);
      logger.info({ connectionId, accountId: actor.accountId }, 'Connection removed');
    },

    listConnections: async (actor, status) => {
      const rows = await repository.listConnections(actor.accountId, status);

      return { data: await Promise.all(rows.map((row) => toResponse(row, actor))) };
    },
  };
}
