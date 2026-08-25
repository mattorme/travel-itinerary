'use client';

import { useState, useTransition } from 'react';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleSaveTrip } from '@/app/actions/social-actions';
import { cn } from '@/lib/utils/cn';

/**
 * Bookmarking.
 *
 * Works without an account, unlike following or commenting: saving is part of
 * planning — someone comparing five Japan itineraries should not hit a sign-up
 * wall — and an anonymous save follows the account when they eventually create
 * one.
 */
export function SaveButton({
  tripId,
  initiallySaved,
  size = 'lg',
}: {
  tripId: string;
  initiallySaved: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size={size}
      aria-pressed={saved}
      disabled={pending}
      aria-label={saved ? 'Remove from saved' : 'Save this trip'}
      onClick={() => {
        const next = !saved;
        setSaved(next);
        startTransition(async () => {
          const result = await toggleSaveTrip(tripId);
          if (!result.ok) setSaved(!next);
        });
      }}
    >
      <Bookmark className={cn('size-4', saved && 'fill-ink text-ink')} />
      {saved ? 'Saved' : 'Save'}
    </Button>
  );
}
