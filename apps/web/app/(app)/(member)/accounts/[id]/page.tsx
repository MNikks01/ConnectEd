/**
 * Someone's profile and timeline (FR-SOC-001, 002).
 *
 * What is shown depends on their visibility setting, which the API decides — the page renders
 * `restricted` as a sentence rather than an empty section, so "private" reads as a choice rather
 * than a bug.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PostCard } from '@/components/post-card';
import { ProfileActions } from '@/components/profile-actions';
import { ApiError } from '@/lib/api-client';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  BlockListResponse,
  ConnectionResponse,
  CurrentAccountResponse,
  FollowStateResponse,
  Paginated,
  PostResponse,
  ProfileResponse,
} from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('publicProfile.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getTranslations();

  let profile: ProfileResponse;
  let me: CurrentAccountResponse;
  let follow: FollowStateResponse | undefined;
  let timeline: Paginated<PostResponse> = { data: [], nextCursor: null };
  let connections: ConnectionResponse[] = [];
  let blocked: string[] = [];

  try {
    [profile, me] = await Promise.all([
      readAsUser<ProfileResponse>(`/accounts/${id}/profile`),
      readAsUser<CurrentAccountResponse>('/me'),
    ]);

    if (me.id !== id) {
      [follow, connections, blocked] = await Promise.all([
        readAsUser<FollowStateResponse>(`/accounts/${id}/follow`).catch(() => undefined),
        readAsUser<{ data: ConnectionResponse[] }>('/me/connections').then((r) => r.data),
        readAsUser<BlockListResponse>('/me/blocks').then((r) =>
          r.data.map((card) => card.accountId),
        ),
      ]);
    }

    timeline = await readAsUser<Paginated<PostResponse>>(`/accounts/${id}/posts`);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=/accounts/${id}`);
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const isMe = me.id === id;
  const connection = connections.find((row) => row.other.accountId === id);
  const connectionState =
    connection?.status === 'ACCEPTED' ? 'connected' : connection ? 'pending' : 'none';

  return (
    <main>
      <PageHeader
        title={profile.displayName}
        {...(profile.handle ? { description: `@${profile.handle}` } : {})}
        actions={
          isMe ? <Link href="/settings/profile">{t('publicProfile.editYours')}</Link> : undefined
        }
      />

      <Card as="section">
        <div
          style={{
            display: 'flex',
            gap: 'var(--ui-space-2)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {profile.accountType === 'SCHOOL' ? (
            <Badge tone="info">{t('publicProfile.schoolBadge')}</Badge>
          ) : null}
          {follow ? (
            <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
              {t('publicProfile.followCounts', {
                followers: follow.followerCount,
                following: follow.followingCount,
              })}
            </span>
          ) : null}
        </div>

        {profile.restricted ? (
          <p style={{ margin: 'var(--ui-space-3) 0 0' }}>{t('publicProfile.restricted')}</p>
        ) : (
          <>
            {profile.bio ? (
              <p style={{ margin: 'var(--ui-space-3) 0 0', whiteSpace: 'pre-wrap' }}>
                {profile.bio}
              </p>
            ) : null}
            {profile.achievements ? (
              <p className="muted" style={{ margin: 'var(--ui-space-2) 0 0' }}>
                {profile.achievements}
              </p>
            ) : null}
          </>
        )}

        {isMe ? null : (
          <div style={{ marginTop: 'var(--ui-space-4)' }}>
            <ProfileActions
              accountId={id}
              following={follow?.following ?? false}
              connectionState={connectionState}
              blocked={blocked.includes(id)}
            />
          </div>
        )}
      </Card>

      <section style={{ marginTop: 'var(--ui-space-5)' }}>
        <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('publicProfile.posts')}</h2>

        {timeline.data.length === 0 ? (
          <Card>
            <p style={{ margin: 0 }}>{t('publicProfile.noPosts')}</p>
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
            {timeline.data.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
