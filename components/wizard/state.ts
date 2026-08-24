import type { TripRequestInput } from '@/domain/schemas/trip-request';
import type {
  AccommodationKind,
  FoodPref,
  Interest,
  Pace,
  TransportMode,
  TravelStyle,
} from '@/domain/types/taxonomy';

/**
 * Wizard state.
 *
 * Deliberately a plain object with a reducer rather than a form library: the
 * shape is small, every field maps to the domain request, and the step
 * validation comes from the same Zod schemas the server uses.
 */

export interface WizardState {
  destinationQuery: string;
  destinationPlaceId: string | null;
  dateMode: 'exact' | 'flexible';
  startDate: string;
  endDate: string;
  durationDays: number;
  adults: number;
  children: number[];
  currency: string;
  budgetMode: 'total' | 'daily';
  budgetAmount: number | null;
  travelStyle: TravelStyle;
  pace: Pace;
  interests: Interest[];
  transportModes: TransportMode[];
  foodPrefs: FoodPref[];
  accommodation: AccommodationKind | null;
  notes: string;
}

export const INITIAL_STATE: WizardState = {
  destinationQuery: '',
  destinationPlaceId: null,
  dateMode: 'flexible',
  startDate: '',
  endDate: '',
  durationDays: 5,
  adults: 2,
  children: [],
  currency: 'AUD',
  budgetMode: 'total',
  budgetAmount: null,
  travelStyle: 'balanced',
  pace: 'balanced',
  interests: [],
  transportModes: ['mixed'],
  foodPrefs: [],
  accommodation: null,
  notes: '',
};

export const STEPS = [
  'destination',
  'dates',
  'travellers',
  'budget',
  'style',
  'interests',
  'notes',
] as const;

export type Step = (typeof STEPS)[number];

export const STEP_TITLES: Record<Step, string> = {
  destination: 'Where are you going?',
  dates: 'When, and for how long?',
  travellers: "Who's going?",
  budget: "What's your budget?",
  style: 'How do you like to travel?',
  interests: "What are you into?",
  notes: 'Anything else we should know?',
};

/** Whether a step has enough to move on. Cheap checks only — the server revalidates. */
export function canAdvance(step: Step, state: WizardState): boolean {
  switch (step) {
    case 'destination':
      return state.destinationQuery.trim().length >= 2;
    case 'dates':
      return state.dateMode === 'flexible'
        ? state.durationDays >= 1 && state.durationDays <= 60
        : state.startDate !== '' && state.endDate !== '' && state.endDate >= state.startDate;
    case 'travellers':
      return state.adults >= 1;
    case 'budget':
      return true; // budget is genuinely optional
    case 'style':
      return true;
    case 'interests':
      return state.interests.length >= 1;
    case 'notes':
      return true;
  }
}

export function toTripRequest(state: WizardState): TripRequestInput {
  const days =
    state.dateMode === 'exact' && state.startDate && state.endDate
      ? inclusiveDays(state.startDate, state.endDate)
      : state.durationDays;

  return {
    destinationQuery: state.destinationQuery.trim(),
    destinationId: null,
    dates:
      state.dateMode === 'exact'
        ? { mode: 'exact', start: state.startDate, end: state.endDate }
        : { mode: 'flexible', durationDays: state.durationDays },
    party: { adults: state.adults, children: state.children },
    currency: state.currency,
    budgetTotal:
      state.budgetAmount !== null && state.budgetMode === 'total' ? state.budgetAmount : null,
    budgetDaily:
      state.budgetAmount !== null && state.budgetMode === 'daily' ? state.budgetAmount : null,
    travelStyle: state.travelStyle,
    pace: state.pace,
    interests: state.interests,
    transportModes: state.transportModes,
    foodPrefs: state.foodPrefs,
    accommodation: state.accommodation,
    notes: state.notes.trim() || null,
  } satisfies TripRequestInput & { dates: unknown } as TripRequestInput;
}

function inclusiveDays(start: string, end: string): number {
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  ) + 1;
}
