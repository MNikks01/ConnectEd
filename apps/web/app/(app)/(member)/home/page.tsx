/**
 * The member home. A Server Component: it calls the API during SSR using the access token from the
 * httpOnly cookie, so the token never reaches the browser.
 *
 * The classes list is the product's front door — until it existed, a verified student had no way
 * to reach their own class feed at all.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CurrentAccountResponse, MyMembershipResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Home · GetConnected' };

// Personalized and session-dependent — never prerendered or cached.
export const dynamic = 'force-dynamic';

/** How a membership reads in a sentence, since the role alone is ambiguous for a parent. */
function membershipLabel(membership: MyMembershipResponse): string {
  if (membership.role === 'PARENT') {
    return membership.childName ? `Parent of ${membership.childName}` : 'Parent';
  }
  return membership.role.charAt(0) + membership.role.slice(1).toLowerCase();
}

export default async function AppHomePage() {
  let account: CurrentAccountResponse;
  let memberships: MyMembershipResponse[] = [];

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships')).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/home');
    throw error;
  }

  // A school has no memberships of its own; it reaches its classes through the portal.
  const isSchool = account.accountType === 'SCHOOL';
  const classes = memberships.filter((membership) => membership.classId !== null);

  return (
    <main>
      <PageHeader
        title={`Hello, ${account.fullName ?? account.schoolName ?? account.email}`}
        description={
          isSchool
            ? 'You are signed in as an institution.'
            : classes.length > 0
              ? 'Your classes, and everything published to them.'
              : 'You are signed in. Ask your school to verify you to see your classes.'
        }
      />

      {isSchool ? (
        <Card>
          <p style={{ margin: 0 }}>
            Classes, members, and verification requests live in your{' '}
            <Link href="/school">school portal</Link>.
          </p>
        </Card>
      ) : (
        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Your classes</h2>

          {classes.length === 0 ? (
            <Card>
              <p style={{ margin: 0 }}>
                You are not a verified member of any class yet. A class appears here once your
                school approves your request.
              </p>
            </Card>
          ) : (
            <ul
              style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}
            >
              {classes.map((membership) => (
                <li key={`${membership.classId}-${membership.childId ?? membership.role}`}>
                  <Card>
                    <h3 style={{ margin: 0, fontSize: 'var(--ui-text-base)' }}>
                      <Link href={`/classes/${membership.classId}`}>
                        {membership.className ?? 'Class'}
                      </Link>
                    </h3>

                    <p className="muted" style={{ margin: '0.25rem 0 0.5rem' }}>
                      {membership.schoolName ?? 'School'}
                    </p>

                    <Badge tone="info">{membershipLabel(membership)}</Badge>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div style={{ marginTop: 'var(--ui-space-5)' }}>
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Your account</h2>

          <dl className="summary">
            <dt>Name</dt>
            <dd>{account.fullName ?? account.schoolName ?? '—'}</dd>

            <dt>Account type</dt>
            <dd>{account.accountType}</dd>

            <dt>Email</dt>
            <dd>{account.email}</dd>

            <dt>Role</dt>
            <dd>{account.role ?? 'Not applicable'}</dd>

            <dt>Handle</dt>
            <dd>{account.handle ?? '—'}</dd>

            <dt>Email verified</dt>
            <dd>
              <Badge tone={account.emailVerified ? 'success' : 'warning'}>
                {account.emailVerified ? 'Verified' : 'Not yet verified'}
              </Badge>
            </dd>
          </dl>
        </Card>
      </div>
    </main>
  );
}
