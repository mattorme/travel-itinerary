import { Footprints, Star } from 'lucide-react';
import { BAND_DOT } from '@/components/trip/day-arc';
import { bandOf } from '@/domain/schedule/time-of-day';
import { formatMinute } from '@/domain/sequencing/schedule';

/**
 * One stop, pulled apart.
 *
 * This replaces the three-feature grid that every product page has. The claims
 * are the same claims, but none of them is asserted in the abstract: each one
 * is a footnote on the part of a real stop that makes it true, so the reader
 * checks it against the thing itself instead of taking our word for it. Every
 * note points at something visible — if a claim has nothing on the card to
 * point at, it does not belong in this section.
 *
 * The card is styled the way the trip page styles a stop, deliberately: someone
 * who reads this and then opens a trip should recognise what they are seeing.
 */

const NOTES = [
  {
    heading: 'The walk is measured, not guessed',
    body: 'Twelve minutes is what the routing API returned for this leg. Whole days are ordered to keep those numbers small, which is why a day stays in one part of a city instead of crossing it four times.',
  },
  {
    heading: 'The time is a decision',
    body: 'Half nine because the gate opens at nine, it is worth an hour, and you said you did not want to rush. Every stop is placed against real opening hours and how long it takes to reach.',
  },
  {
    heading: 'The listing is Google’s, not the model’s',
    body: 'Rating, review count and today’s hours come from the live record of the place. The model only ever picks between places that already exist — it is never asked to write one, so it cannot invent a restaurant that closed in 2019.',
  },
];

const START = 570;

/** A footnote marker, tying a line on the card to a note beside it. */
function Pin({ n }: { n: number }) {
  return (
    <sup className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-signal-wash align-super text-[0.625rem] font-bold text-signal-deep">
      {n}
    </sup>
  );
}

export function Anatomy() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <h2 className="type-display type-title">One stop, pulled apart</h2>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-steel">
          Three things are true of every stop in every trip here. Rather than list them, here is one
          stop with the parts that make them true marked.
        </p>
      </div>

      <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,25rem)] lg:items-center">
        {/* The stop, as the trip page draws it. */}
        <div>
          <p className="type-data flex items-center gap-2 pb-3 pl-5 text-[0.8125rem] text-steel-2">
            <Footprints className="size-3.5 shrink-0" aria-hidden />
            <span>
              12 min walk · 0.9 km
              <Pin n={1} />
            </span>
          </p>

          <article className="rounded-panel bg-surface p-5 shadow-(--shadow-card)">
            <p className="type-data flex flex-wrap items-baseline gap-x-3 text-[0.8125rem] text-steel-2">
              <span className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className={`size-2 shrink-0 self-center rounded-full ${BAND_DOT[bandOf(START)]}`}
                />
                <time className="text-[1.0625rem] font-semibold text-ink" dateTime={String(START)}>
                  {formatMinute(START)}
                </time>
              </span>
              <span>
                1 hr
                <Pin n={2} />
              </span>
              <span>Free</span>
            </p>

            <h3 className="type-display mt-1.5 text-[1.375rem]">Yanaka Cemetery walk</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed">
              Quiet, free, and the best possible first hour in Tokyo before anything is open.
            </p>
            <p className="mt-3 flex items-center gap-1 text-[0.8125rem] text-steel-2">
              <Star className="size-3.5 fill-current" aria-hidden />
              <span className="type-data">4.1 (3,422)</span>
              <span className="mx-1" aria-hidden>
                ·
              </span>
              <span>
                Open until 5 pm
                <Pin n={3} />
              </span>
            </p>
          </article>
        </div>

        {/* Numbered because they are footnotes on the card, not a ranking. */}
        <ol className="flex flex-col gap-8">
          {NOTES.map((note, i) => (
            <li key={note.heading} className="flex gap-4">
              <span
                aria-hidden
                className="type-data mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-signal-wash text-[0.8125rem] font-bold text-signal-deep"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-[1.0625rem] font-bold tracking-[-0.01em]">{note.heading}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-steel">{note.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
