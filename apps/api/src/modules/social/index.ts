/**
 * Public surface of the social module — profiles today; posts, follows, and messages next.
 */
import { Router } from 'express';

import { createPostRepository } from './post.repository.js';
import { postRoutes } from './post.routes.js';
import { createPostService } from './post.service.js';
import { createProfileRepository } from './profile.repository.js';
import { profileRoutes } from './profile.routes.js';
import { createProfileService } from './profile.service.js';

import type { Config } from '../../shared/config/index.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { PostService } from './post.service.js';
import type { ProfileService } from './profile.service.js';

export type { PostService } from './post.service.js';
export type { ProfileService } from './profile.service.js';

export interface SocialModule {
  routes: Router;
  profiles: ProfileService;
  posts: PostService;
}

export function createSocialModule(deps: {
  db: Db;
  config: Config;
  storage?: Storage | undefined;
  logger: Logger;
  media?: { claim: (key: string) => Promise<void> } | undefined;
}): SocialModule {
  const profiles = createProfileService({
    repository: createProfileRepository(deps.db),
    storage: deps.storage,
    logger: deps.logger,
    media: deps.media,
  });

  const posts = createPostService({
    repository: createPostRepository(deps.db),
    storage: deps.storage,
    logger: deps.logger,
    media: deps.media,
  });

  const routes = Router();
  routes.use(profileRoutes(profiles));
  routes.use(postRoutes(posts, deps.config));

  return { profiles, posts, routes };
}
