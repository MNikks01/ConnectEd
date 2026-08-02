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
import { ActionForm, useFieldError } from './action-form';

import type { CommentResponse, PostResponse } from '@connected/types';

function CommentField() {
  return (
    <Field
      name="body"
      label="Add a comment"
      as="textarea"
      rows={2}
      required
      maxLength={2000}
      error={useFieldError('body')}
    />
  );
}

function ReasonField() {
  return (
    <Field
      name="reason"
      label="What is wrong with this?"
      as="textarea"
      rows={3}
      required
      maxLength={2000}
      error={useFieldError('reason')}
      hint="Your school cannot see reports; they go to the platform."
    />
  );
}

export function PostCard({ post, comments }: { post: PostResponse; comments?: CommentResponse[] }) {
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
        {post.author.accountType === 'SCHOOL' ? <Badge tone="info">School</Badge> : null}
        <span className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
          {new Date(post.createdAt).toLocaleDateString('en-GB')}
          {/* Stated, because a post that changed after people read it is not the same post. */}
          {post.editedAt ? ' · edited' : ''}
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
          {post.liked ? 'Liked' : 'Like'}
          {post.likeCount > 0 ? `, ${post.likeCount}` : ''}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setShowComments((open) => !open);
          }}
          aria-expanded={showComments}
        >
          Comments{post.commentCount > 0 ? `, ${post.commentCount}` : ''}
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
            Delete
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
            Report
          </Button>
        )}
      </div>

      {reporting ? (
        <div style={{ marginTop: 'var(--ui-space-3)' }}>
          <ActionForm
            action={reportAction.bind(null, 'POST', post.id)}
            submitLabel="Send report"
            pendingLabel="Sending…"
            successMessage="Reported. Nobody at your school is told."
          >
            <ReasonField />
          </ActionForm>
        </div>
      ) : null}

      {showComments ? (
        <div style={{ marginTop: 'var(--ui-space-3)' }}>
          {comments && comments.length > 0 ? (
            <ul
              aria-label="Comments"
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
              No comments yet.
            </p>
          )}

          <div style={{ marginTop: 'var(--ui-space-3)' }}>
            <ActionForm
              action={commentAction.bind(null, post.id)}
              submitLabel="Comment"
              pendingLabel="Posting…"
              successMessage="Comment added."
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
