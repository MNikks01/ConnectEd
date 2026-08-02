/**
 * Public surface of the social module — profiles today; posts, follows, and messages next.
 */
import { Router } from 'express';

import { createGraphRepository } from './graph.repository.js';
import { graphRoutes } from './graph.routes.js';
import { createGraphService } from './graph.service.js';
import { createInteractionRepository } from './interaction.repository.js';
import { interactionRoutes } from './interaction.routes.js';
import { createInteractionService } from './interaction.service.js';
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
import type { GraphService } from './graph.service.js';
import type { InteractionService } from './interaction.service.js';
import type { PostService } from './post.service.js';
import type { ProfileService } from './profile.service.js';

export type { GraphService } from './graph.service.js';
export type { InteractionService } from './interaction.service.js';
export type { PostService } from './post.service.js';
export type { ProfileService } from './profile.service.js';

export interface SocialModule {
  routes: Router;
  profiles: ProfileService;
  posts: PostService;
  interactions: InteractionService;
  graph: GraphService;
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

  const postRepository = createPostRepository(deps.db);

  const posts = createPostService({
    repository: postRepository,
    storage: deps.storage,
    logger: deps.logger,
    media: deps.media,
  });

  const interactions = createInteractionService({
    repository: createInteractionRepository(deps.db),
    posts: postRepository,
    storage: deps.storage,
    logger: deps.logger,
  });

  const graph = createGraphService({
    repository: createGraphRepository(deps.db),
    storage: deps.storage,
    logger: deps.logger,
  });

  const routes = Router();
  routes.use(profileRoutes(profiles));
  routes.use(graphRoutes(graph));
  routes.use(postRoutes(posts, deps.config));
  routes.use(interactionRoutes(interactions));

  return { profiles, posts, interactions, graph, routes };
}
