'use client';

import { CalendarPlus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OfflineButton } from './offline-button';
import type { Itinerary } from '@/domain/types/itinerary';

/**
 * The three ways to take a trip away from the app.
 *
 * Grouped deliberately: they answer the same question — "what happens when I am
 * standing in the street and this tab is closed?" Offline is app-only, calendar
 * needs dates, print is always there.
 */
export function TakeWithYou({ itinerary }: { itinerary: Itinerary }) {
  const hasDates = itinerary.request.dates.start !== null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-print-hide>
      <OfflineButton itinerary={itinerary} />

      {hasDates && (
        <a href={`/t/${itinerary.slug}/calendar`} download>
          <Button variant="ghost" size="lg">
            <CalendarPlus className="size-4" />
            Add to calendar
          </Button>
        </a>
      )}

      <Button variant="ghost" size="lg" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print
      </Button>
    </div>
  );
}
