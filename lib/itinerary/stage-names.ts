/**
 * Stage identities and the copy shown for each.
 *
 * Deliberately free of imports so both the server pipeline and the browser
 * progress UI can use it without pulling `server-only` code into the client
 * bundle.
 */
export type Stage =
  | 'resolving_destination'
  | 'understanding_style'
  | 'finding_places'
  | 'choosing_places'
  | 'optimising_route'
  | 'timing_the_days'
  | 'balancing_budget'
  | 'writing'
  | 'finalising';

export const STAGE_COPY: Record<Stage, string> = {
  resolving_destination: 'Getting our bearings…',
  understanding_style: 'Working out how you like to travel…',
  finding_places: "Finding places you'll love…",
  choosing_places: 'Choosing the right spots for each day…',
  optimising_route: 'Optimising your route…',
  timing_the_days: 'Timing out each day…',
  balancing_budget: 'Balancing your budget…',
  writing: 'Writing it up…',
  finalising: 'Finishing touches…',
};

export const STAGE_PROGRESS: Record<Stage, number> = {
  resolving_destination: 0.05,
  understanding_style: 0.15,
  finding_places: 0.35,
  choosing_places: 0.6,
  optimising_route: 0.72,
  timing_the_days: 0.8,
  balancing_budget: 0.86,
  writing: 0.93,
  finalising: 0.98,
};
