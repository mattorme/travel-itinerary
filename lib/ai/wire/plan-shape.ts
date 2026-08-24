import { z } from 'zod';
import type { JsonSchema } from '../client';
import { EXPERIENCE_TAGS, type ExperienceTag } from '@/domain/types/taxonomy';

/**
 * Stage 1 output: the shape of the trip.
 *
 * Day themes and ordered experience SLOTS. Critically, no place names — the
 * model is describing what kind of afternoon this should be, and the server
 * resolves that to real venues. This is what makes hallucinated restaurants
 * structurally impossible rather than something validation has to catch.
 */

export const planShapeWire = z.object({
  trip_title: z.string().min(3).max(80),
  trip_subtitle: z.string().max(140),
  days: z.array(
    z.object({
      day_index: z.number().int().min(1),
      theme: z.string().min(3).max(70),
      narrative: z.string().min(20).max(400),
      /** Which of the trip's destinations this day is based in. */
      destination_index: z.number().int().min(0),
      slots: z.array(
        z.object({
          slot_id: z.string().min(1).max(40),
          tag: z.enum(EXPERIENCE_TAGS),
          /** Rough target start, minutes since midnight. Sequencing may move it. */
          target_minute: z.number().int().min(300).max(1400),
          duration_minutes: z.number().int().min(20).max(600),
          /** Why this belongs in this trip, for this traveller. Shown in the UI. */
          intent: z.string().min(10).max(200),
        }),
      ).min(2).max(9),
    }),
  ).min(1).max(60),
});

export type PlanShapeWire = z.infer<typeof planShapeWire>;

export interface PlannedSlot {
  readonly slotId: string;
  readonly tag: ExperienceTag;
  readonly targetMinute: number;
  readonly durationMinutes: number;
  readonly intent: string;
}

export interface PlannedDay {
  readonly dayIndex: number;
  readonly theme: string;
  readonly narrative: string;
  readonly destinationIndex: number;
  readonly slots: readonly PlannedSlot[];
}

export interface PlanShape {
  readonly title: string;
  readonly subtitle: string;
  readonly days: readonly PlannedDay[];
}

export function planShapeFromWire(wire: PlanShapeWire): PlanShape {
  return {
    title: wire.trip_title,
    subtitle: wire.trip_subtitle,
    days: [...wire.days]
      .sort((a, b) => a.day_index - b.day_index)
      .map((d) => ({
        dayIndex: d.day_index,
        theme: d.theme,
        narrative: d.narrative,
        destinationIndex: d.destination_index,
        slots: d.slots.map((s) => ({
          slotId: s.slot_id,
          tag: s.tag,
          targetMinute: s.target_minute,
          durationMinutes: s.duration_minutes,
          intent: s.intent,
        })),
      })),
  };
}

export const planShapeJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['trip_title', 'trip_subtitle', 'days'],
  properties: {
    trip_title: { type: 'string', description: 'Editorial title, e.g. "Twelve days across Honshu"' },
    trip_subtitle: { type: 'string', description: 'One line under the title. May be empty.' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day_index', 'theme', 'narrative', 'destination_index', 'slots'],
        properties: {
          day_index: { type: 'integer', description: '1-based' },
          theme: { type: 'string', description: 'Short title for the day' },
          narrative: { type: 'string', description: 'Two or three sentences on the arc of the day' },
          destination_index: { type: 'integer', description: 'Index into the destinations list provided' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['slot_id', 'tag', 'target_minute', 'duration_minutes', 'intent'],
              properties: {
                slot_id: { type: 'string', description: 'Unique within the trip, e.g. "d1-s2"' },
                tag: { type: 'string', enum: [...EXPERIENCE_TAGS] },
                target_minute: { type: 'integer', description: 'Minutes after local midnight' },
                duration_minutes: { type: 'integer' },
                intent: { type: 'string', description: 'Why this slot suits this traveller' },
              },
            },
          },
        },
      },
    },
  },
};
