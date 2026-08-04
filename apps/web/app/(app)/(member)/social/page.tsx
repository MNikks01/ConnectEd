/**
 * The feed (FR-SOC-012), and where you write a post.
 *
 * Comments are fetched per post shown, which is a request each — acceptable for a page of twenty
 * and the reason the composer page does not try to be an entire timeline. If the feed grows a
 * comment preview, that becomes a batched endpoint rather than twenty more requests.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type { CommentResponse, Paginated, PostResponse } from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Social · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { cursor } = await searchParams;

  let feed: Paginated<PostResponse>;
  let comments: Record<string, CommentResponse[]> = {};

  try {
    feed = await readAsUser<Paginated<PostResponse>>(
      `/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    );

    const withComments = feed.data.filter((post) => post.commentCount > 0);
    const lists = await Promise.all(
      withComments.map((post) =>
        readAsUser<{ data: CommentResponse[] }>(`/posts/${post.id}/comments`),
      ),
    );

    comments = Object.fromEntries(
      withComments.map((post, index) => [post.id, lists[index]?.data ?? []]),
    );
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/social');
    throw error;
  }

  return (
    <main>
      <PageHeader
        title="Social"
        description="From the people and schools you follow."
        actions={<Link href="/connections">Connections</Link>}
      />

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>New post</h2>
        <PostComposer />
      </Card>

      <section style={{ marginTop: 'var(--ui-space-5)' }}>
        <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Feed</h2>

        {feed.data.length === 0 ? (
          <Card>
            <p style={{ margin: 0 }}>
              Nothing here yet. Follow a school or connect with someone and their posts appear in
              this feed.
            </p>
          </Card>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
            {feed.data.map((post) => (
              <li key={post.id}>
                <PostCard post={post} comments={comments[post.id]} />
              </li>
            ))}
          </ul>
        )}

        {feed.nextCursor ? (
          <p style={{ marginTop: 'var(--ui-space-4)' }}>
            <Link href={`/social?cursor=${encodeURIComponent(feed.nextCursor)}`}>Older posts</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
