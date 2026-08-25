'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { deleteComment, postComment } from '@/app/actions/social-actions';

export interface CommentRow {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly authorId: string;
  readonly username: string;
  readonly displayName: string | null;
}

/**
 * Comments on a public trip.
 *
 * New comments appear immediately for their author but are held for moderation
 * before anyone else sees them — this page can be indexed, and an unmoderated
 * text field on an indexable page is a liability rather than a feature. The
 * pending state is stated plainly rather than pretending the comment is live.
 */
export function Comments({
  tripId,
  tripSlug,
  comments,
  viewerId,
  canComment,
}: {
  tripId: string;
  tripSlug: string;
  comments: readonly CommentRow[];
  viewerId: string | null;
  canComment: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [optimistic, addOptimistic] = useOptimistic(
    comments,
    (current, next: CommentRow) => [...current, next],
  );

  function submit(formData: FormData) {
    const body = String(formData.get('body') ?? '').trim();
    if (body.length < 2) return;

    setError(null);
    setNotice(null);
    formRef.current?.reset();

    startTransition(async () => {
      addOptimistic({
        id: `optimistic-${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
        authorId: viewerId ?? 'me',
        username: 'you',
        displayName: 'You',
      });

      const result = await postComment(tripId, tripSlug, body);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.data.pending
          ? 'Posted — it will appear for everyone once it has been checked.'
          : 'Posted.',
      );
    });
  }

  return (
    <section className="mt-16 border-t border-line pt-10">
      <h2 className="font-display text-display-sm">
        {optimistic.length > 0 ? `${optimistic.length} ` : ''}
        {optimistic.length === 1 ? 'Comment' : 'Comments'}
      </h2>

      {canComment ? (
        <form ref={formRef} action={submit} className="mt-6">
          <label htmlFor="comment-body" className="sr-only">
            Add a comment
          </label>
          <Textarea
            id="comment-body"
            name="body"
            rows={3}
            maxLength={2000}
            placeholder="Been here? Add something the itinerary is missing."
          />
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" variant="primary" size="md" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Post
            </Button>
            {notice && <span className="text-sm text-ink-muted">{notice}</span>}
            {error && (
              <span role="alert" className="text-sm text-critical">
                {error}
              </span>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-card border border-line bg-paper-raised px-5 py-4 text-sm text-ink-muted">
          <Link href="/signin" className="underline underline-offset-4 hover:text-ink">
            Create an account
          </Link>{' '}
          to leave a comment.
        </p>
      )}

      {optimistic.length > 0 ? (
        <ul className="mt-8 space-y-6">
          {optimistic.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <span
                aria-hidden
                className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-paper-sunk text-sm text-ink-muted"
              >
                {(comment.displayName ?? comment.username).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  {comment.username === 'you' ? (
                    <span className="font-medium">You</span>
                  ) : (
                    <Link
                      href={`/u/${comment.username}`}
                      className="font-medium hover:underline"
                    >
                      {comment.displayName ?? `@${comment.username}`}
                    </Link>
                  )}
                  <time className="text-ink-faint" dateTime={comment.createdAt}>
                    {relativeTime(comment.createdAt)}
                  </time>
                </p>
                <p className="mt-1 text-[0.9375rem] leading-relaxed whitespace-pre-line">
                  {comment.body}
                </p>
                {viewerId !== null && comment.authorId === viewerId && !comment.id.startsWith('optimistic') && (
                  <form
                    action={async () => {
                      await deleteComment(comment.id, tripSlug);
                    }}
                  >
                    <button
                      type="submit"
                      className="mt-1.5 flex items-center gap-1 text-xs text-ink-faint hover:text-critical"
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-ink-faint">No comments yet.</p>
      )}
    </section>
  );
}

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit);
  }
  return 'just now';
}
