import { z } from 'zod';
import {
  ACCOMMODATION_KINDS,
  FOOD_PREFS,
  INTERESTS,
  PACES,
  TRANSPORT_MODES,
  TRAVEL_STYLES,
} from '../types/taxonomy';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = z
  .string()
  .regex(ISO_DATE, 'Expected yyyy-mm-dd')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Not a real date');

/** Days between two ISO dates, inclusive of both endpoints. */
export function inclusiveDays(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export const partySchema = z.object({
  adults: z.number().int().min(1).max(12),
  children: z.array(z.number().int().min(0).max(17)).max(8).default([]),
});

export const tripDatesSchema = z
  .discriminatedUnion('mode', [
    z.object({
      mode: z.literal('exact'),
      start: isoDate,
      end: isoDate,
    }),
    z.object({
      mode: z.literal('flexible'),
      durationDays: z.number().int().min(1).max(60),
    }),
  ])
  .transform((v) =>
    v.mode === 'exact'
      ? { mode: 'exact' as const, start: v.start, end: v.end, durationDays: inclusiveDays(v.start, v.end) }
      : { mode: 'flexible' as const, start: null, end: null, durationDays: v.durationDays },
  )
  .refine((v) => v.durationDays >= 1 && v.durationDays <= 60, {
    message: 'Trips must be between 1 and 60 days',
  });

export const tripRequestSchema = z
  .object({
    destinationQuery: z.string().trim().min(2).max(120),
    destinationId: z.string().uuid().nullable().default(null),
    dates: tripDatesSchema,
    party: partySchema,
    currency: z
      .string()
      .length(3)
      .transform((v) => v.toUpperCase()),
    budgetTotal: z.number().positive().max(1_000_000).nullable().default(null),
    budgetDaily: z.number().positive().max(100_000).nullable().default(null),
    travelStyle: z.enum(TRAVEL_STYLES),
    pace: z.enum(PACES),
    interests: z.array(z.enum(INTERESTS)).min(1).max(8),
    transportModes: z.array(z.enum(TRANSPORT_MODES)).min(1).default(['mixed']),
    foodPrefs: z.array(z.enum(FOOD_PREFS)).max(6).default([]),
    accommodation: z.enum(ACCOMMODATION_KINDS).nullable().default(null),
    // Free-form and therefore untrusted. Length-capped here; treated as data,
    // never as instruction, by lib/ai/prompts.
    notes: z.string().trim().max(2000).nullable().default(null),
  })
  .transform((v) => {
    // Exactly one of total/daily is authoritative; derive the other so the rest
    // of the pipeline never has to ask which one the user filled in.
    const days = v.dates.durationDays;
    const budgetTotal = v.budgetTotal ?? (v.budgetDaily !== null ? v.budgetDaily * days : null);
    const budgetDaily = v.budgetDaily ?? (v.budgetTotal !== null ? v.budgetTotal / days : null);
    return { ...v, budgetTotal, budgetDaily };
  });

export type TripRequestInput = z.input<typeof tripRequestSchema>;
export type TripRequestParsed = z.output<typeof tripRequestSchema>;

/** Per-step schemas so the wizard can validate incrementally without a full object. */
export const wizardStepSchemas = {
  destination: tripRequestSchema.innerType().pick({ destinationQuery: true, destinationId: true }),
  dates: z.object({ dates: tripDatesSchema }),
  party: z.object({ party: partySchema }),
  budget: tripRequestSchema.innerType().pick({ currency: true, budgetTotal: true, budgetDaily: true }),
  style: tripRequestSchema.innerType().pick({ travelStyle: true, pace: true }),
  interests: tripRequestSchema.innerType().pick({ interests: true }),
  logistics: tripRequestSchema.innerType().pick({
    transportModes: true,
    foodPrefs: true,
    accommodation: true,
  }),
  notes: tripRequestSchema.innerType().pick({ notes: true }),
} as const;
