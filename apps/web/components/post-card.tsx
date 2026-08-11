'use client';

/**
 * A post, with the things you can do to it.
 *
 * The client is told what it may offer — `mine` decides whether delete appears, `liked` which way
 * the like button reads. Neither is trusted: the API decides again on every call, and this only
 * saves the user from being shown a control that would fail.
 */
import { Badge, Button, Card, Field } from '@connected/ui';
import Link from 'next/link';
import { useState, useTransition } from 'react';

import {
  commentAction,
  deletePostAction,
  reportAction,
  toggleLikeAction,
} from '@/app/(app)/(member)/actions';
import { formatShortDate } from '@/lib/i18n/format';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

import type { CommentResponse, PostResponse } from '@connected/types';

function CommentField() {
  const { t } = useTranslations();

  return (
    <Field
      name="body"
      label={t('post.addComment')}
      as="textarea"
      rows={2}
      required
      maxLength={2000}
      error={useFieldError('body')}
    />
  );
}

function ReasonField() {
  const { t } = useTranslations();

  return (
    <Field
      name="reason"
      label={t('post.reportLabel')}
      as="textarea"
      rows={3}
      required
      maxLength={2000}
      error={useFieldError('reason')}
      hint={t('post.reportHint')}
    />
  );
}

export function PostCard({ post, comments }: { post: PostResponse; comments?: CommentResponse[] }) {
  const { t, locale } = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [reporting, setReporting] = useState(false);
  const [showComments, setShowComments] = useState(false);

  function act(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(undefined);

    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <Card as="article">
      {error ? (
        <p className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: 'var(--ui-space-2)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Link href={`/accounts/${post.author.accountId}`}>{post.author.displayName}</Link>
        {post.author.accountType === 'SCHOOL' ? (
          <Badge tone="info">{t('post.schoolBadge')}</Badge>
        ) : null}
        <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
          {formatShortDate(post.createdAt, locale)}
          {/* Stated, because a post that changed after people read it is not the same post. */}
          {post.editedAt ? t('post.edited') : ''}
        </span>
      </div>

      <p style={{ margin: 'var(--ui-space-2) 0', whiteSpace: 'pre-wrap' }}>{post.body}</p>

      {post.imageUrl ? (
        <p style={{ margin: '0 0 var(--ui-space-2)' }}>
          {/* A signed URL that expires — `next/image` would proxy and cache it. */}
          <img
            src={post.imageUrl}
            alt=""
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--ui-radius)' }}
          />
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--ui-space-3)', flexWrap: 'wrap' }}>
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          onClick={() => {
            act(() => toggleLikeAction(post.id));
          }}
        >
          {/* The count is in the label, so a screen reader hears "Liked, 3" rather than an icon. */}
          {post.liked ? t('post.liked') : t('post.like')}
          {post.likeCount > 0 ? t('post.countSuffix', { count: post.likeCount }) : ''}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setShowComments((open) => !open);
          }}
          aria-expanded={showComments}
        >
          {t('post.comments')}
          {post.commentCount > 0 ? t('post.countSuffix', { count: post.commentCount }) : ''}
        </Button>

        {post.mine ? (
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() => {
              act(() => deletePostAction(post.id));
            }}
          >
            {t('post.delete')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setReporting((open) => !open);
            }}
            aria-expanded={reporting}
          >
            {t('post.report')}
          </Button>
        )}
      </div>

      {reporting ? (
        <div style={{ marginTop: 'var(--ui-space-3)' }}>
          <ActionForm
            action={reportAction.bind(null, 'POST', post.id)}
            submitLabel={t('post.sendReport')}
            pendingLabel={t('post.sendingReport')}
            successMessage={t('post.reported')}
          >
            <ReasonField />
          </ActionForm>
        </div>
      ) : null}

      {showComments ? (
        <div style={{ marginTop: 'var(--ui-space-3)' }}>
          {comments && comments.length > 0 ? (
            <ul
              aria-label={t('post.commentsList')}
              style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-2)' }}
            >
              {comments.map((comment) => (
                <li key={comment.id}>
                  <Link href={`/accounts/${comment.author.accountId}`}>
                    {comment.author.displayName}
                  </Link>
                  <span> — {comment.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {t('post.noComments')}
            </p>
          )}

          <div style={{ marginTop: 'var(--ui-space-3)' }}>
            <ActionForm
              action={commentAction.bind(null, post.id)}
              submitLabel={t('post.comment')}
              pendingLabel={t('post.posting')}
              successMessage={t('post.commentAdded')}
              resetOnSuccess
            >
              <CommentField />
            </ActionForm>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
