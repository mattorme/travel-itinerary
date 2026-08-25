'use client';

import { useState, useTransition } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleFollow } from '@/app/actions/social-actions';

/**
 * Following requires a real account — an anonymous session is right for
 * planning and cloning, but a social graph attached to a throwaway identity is
 * not worth having. The database enforces it; this is the readable error.
 */
export function FollowButton({
  username,
  initiallyFollowing,
  isSelf,
}: {
  username: string;
  initiallyFollowing: boolean;
  isSelf: boolean;
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isSelf) return null;

  return (
    <div>
      <Button
        variant={following ? 'outline' : 'primary'}
        size="md"
        disabled={pending}
        aria-pressed={following}
        onClick={() => {
          const next = !following;
          setFollowing(next);
          setError(null);
          startTransition(async () => {
            const result = await toggleFollow(username);
            if (!result.ok) {
              setFollowing(!next);
              setError(result.error);
            }
          });
        }}
      >
        {following ? <Check className="size-4" /> : <UserPlus className="size-4" />}
        {following ? 'Following' : 'Follow'}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
