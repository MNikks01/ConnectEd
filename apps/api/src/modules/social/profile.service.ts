/**
 * Profiles (FR-SOC-001).
 *
 * **The first module in this product with no verification gate.** `PRD/06-social.md` opens with
 * "available to all account types… No verification required", and that is not an oversight here:
 * a General User who has never been near a school still has a profile, still follows people, and
 * still messages them. A reviewer used to three sprints of membership checks should read the
 * absence of them as the requirement, not as a missing policy.
 *
 * What replaces membership is **ownership** — you edit your own profile and nobody else's — and a
 * per-profile **visibility** setting for everything beyond the name-and-avatar card.
 */
import { assertOwnsResource } from '../../shared/authz/index.js';
import { NotFoundError } from '../../shared/errors/index.js';

import type { ProfileRepository, ProfileRow } from './profile.repository.js';
import type { Actor } from '../../shared/authz/actor.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { ProfileResponse, UpdateProfileInput } from '@connected/types';

export interface ProfileService {
  /** Anyone signed in may ask; what comes back depends on the subject's setting. */
  get: (actor: Actor, accountId: string) => Promise<ProfileResponse>;
  getMine: (actor: Actor) => Promise<ProfileResponse>;
  updateMine: (actor: Actor, input: UpdateProfileInput) => Promise<ProfileResponse>;
}

export interface ProfileServiceDeps {
  repository: ProfileRepository;
  storage?: Storage | undefined;
  logger: Logger;
  /** Told when an uploaded key becomes referenced, so the orphan sweep leaves it alone. */
  media?: { claim: (key: string) => Promise<void> } | undefined;
}

export function createProfileService({
  repository,
  storage,
  logger,
  media,
}: ProfileServiceDeps): ProfileService {
  /**
   * Decides how much of a profile the caller may see.
   *
   * Not a boolean on the whole profile: the card is always visible, because a profile nobody can
   * find is a profile nobody can ask to connect with, and hiding the name would break discovery
   * without protecting anything a directory does not already reveal.
   */
  async function maySeeFullProfile(actor: Actor, profile: ProfileRow): Promise<boolean> {
    if (actor.accountId === profile.accountId) return true;
    if (profile.visibility === 'PUBLIC') return true;

    return repository.areConnected(actor.accountId, profile.accountId);
  }

  async function toResponse(profile: ProfileRow, full: boolean): Promise<ProfileResponse> {
    const card = {
      accountId: profile.accountId,
      accountType: profile.accountType,
      displayName: profile.displayName,
      handle: profile.handle,
      // Signed after the decision above, like every other signed URL in this codebase.
      displayPicUrl:
        profile.displayPicKey && storage ? await storage.signedUrl(profile.displayPicKey) : null,
    };

    if (!full) return { ...card, restricted: true };

    return {
      ...card,
      restricted: false,
      bio: profile.bio,
      achievements: profile.achievements,
      role: profile.role,
      city: profile.city,
      about: profile.about,
    };
  }

  return {
    get: async (actor, accountId) => {
      const profile = await repository.find(accountId);
      if (!profile) throw new NotFoundError();

      const response = await toResponse(profile, await maySeeFullProfile(actor, profile));

      // The setting itself is nobody else's business — knowing someone is "connections only" is a
      // fact about them, and the card already says everything a stranger needs.
      return actor.accountId === accountId
        ? { ...response, visibility: profile.visibility }
        : response;
    },

    getMine: async (actor) => {
      const profile = await repository.find(actor.accountId);
      if (!profile) throw new NotFoundError();

      return { ...(await toResponse(profile, true)), visibility: profile.visibility };
    },

    updateMine: async (actor, input) => {
      const profile = await repository.find(actor.accountId);
      if (!profile) throw new NotFoundError();

      // Ownership is the whole check here, and it is trivially satisfied — the id comes from the
      // token, not the request. Stated anyway, so a later refactor that takes an id from the path
      // has something to fail.
      assertOwnsResource(actor, profile.accountId);

      if (profile.accountType === 'SCHOOL') {
        // A school edits itself through the portal (`PATCH /schools/:id`), which knows about
        // addresses, affiliation, and the rest. Two writers for one row is how they diverge.
        throw new NotFoundError('Schools edit their profile through the school portal.');
      }

      if (input.displayPicKey) await media?.claim(input.displayPicKey);

      const updated = await repository.updateUserProfile(actor.accountId, {
        ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
        ...(input.bio === undefined ? {} : { bio: input.bio ?? null }),
        ...(input.achievements === undefined ? {} : { achievements: input.achievements ?? null }),
        ...(input.displayPicKey === undefined
          ? {}
          : { displayPicKey: input.displayPicKey ?? null }),
        ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
      });

      logger.info({ accountId: actor.accountId }, 'Profile updated');

      return { ...(await toResponse(updated, true)), visibility: updated.visibility };
    },
  };
}
