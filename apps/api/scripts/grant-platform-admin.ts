/**
 * Grants or revokes platform-admin (ADR-0017).
 *
 * **There is deliberately no endpoint for this.** The highest-privilege capability in the product
 * would otherwise be reachable by any bug that reaches that endpoint; requiring a database
 * connection and a deploy-time credential is a much smaller attack surface than requiring an HTTP
 * request. Staff onboarding is an ops task, and that is the trade.
 *
 *   pnpm --filter @connected/api admin:grant  someone@connected.example
 *   pnpm --filter @connected/api admin:revoke someone@connected.example
 *   pnpm --filter @connected/api admin:list
 *
 * Every change writes an `AuditLog` row, because a privilege granted with no record of who granted
 * it is not reviewable.
 */
import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const [command, email] = process.argv.slice(2);

async function list(): Promise<void> {
  const admins = await prisma.account.findMany({
    where: { isPlatformAdmin: true },
    select: { email: true, status: true },
    orderBy: { email: 'asc' },
  });

  if (admins.length === 0) {
    console.warn('No platform admins.');
    return;
  }

  console.warn(`${String(admins.length)} platform admin(s):`);
  for (const admin of admins) console.warn(`  ${admin.email}  (${admin.status})`);
}

async function set(target: string, value: boolean): Promise<void> {
  const account = await prisma.account.findUnique({
    where: { email: target },
    select: { id: true, type: true, isPlatformAdmin: true },
  });

  if (!account) throw new Error(`No account with email ${target}.`);

  // A school account is an institution, not a person. Staff act as themselves.
  if (account.type !== 'INDIVIDUAL') {
    throw new Error(`${target} is a ${account.type} account; platform admins are individuals.`);
  }

  if (account.isPlatformAdmin === value) {
    console.warn(`${target} is already ${value ? 'a platform admin' : 'not a platform admin'}.`);
    return;
  }

  await prisma.$transaction([
    prisma.account.update({ where: { id: account.id }, data: { isPlatformAdmin: value } }),
    prisma.auditLog.create({
      data: {
        // No actor: whoever ran this had a database credential, and recording a user id we did not
        // authenticate would be a fiction. The operator is identifiable from the deploy logs.
        action: value ? 'platform_admin.granted' : 'platform_admin.revoked',
        entity: 'account',
        entityId: account.id,
        metadata: { email: target },
      },
    }),
  ]);

  console.warn(`${target} is now ${value ? 'a platform admin' : 'not a platform admin'}.`);
}

try {
  if (command === 'list') {
    await list();
  } else if ((command === 'grant' || command === 'revoke') && email) {
    await set(email, command === 'grant');
  } else {
    console.error('Usage: grant <email> | revoke <email> | list');
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
