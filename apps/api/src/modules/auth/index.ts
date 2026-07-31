/**
 * Public surface of the auth module.
 *
 * Other modules use `AuthService` or a domain event — never this module's repository or Prisma
 * models (`.docs/Architecture/01-modules.md`).
 */
import { createAuthRepository } from './auth.repository.js';
import { authRoutes } from './auth.routes.js';
import { createAuthService } from './auth.service.js';

import type { Router } from 'express';
import type { Config } from '../../shared/config/index.js';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { PasswordHasher } from '../../shared/auth/password.js';
import type { TokenService } from '../../shared/auth/tokens.js';

export type { AuthService, AuthSession, ClientType, CurrentAccount } from './auth.service.js';

export interface AuthModuleDeps {
  db: Db;
  config: Config;
  logger: Logger;
  passwords: PasswordHasher;
  tokens: TokenService;
}

export interface AuthModule {
  routes: Router;
  service: ReturnType<typeof createAuthService>;
}

export function createAuthModule({
  db,
  config,
  logger,
  passwords,
  tokens,
}: AuthModuleDeps): AuthModule {
  const repository = createAuthRepository(db);
  const service = createAuthService({ repository, passwords, tokens, logger });

  return {
    service,
    routes: authRoutes({ service, config, tokens }),
  };
}
