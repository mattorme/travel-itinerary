import { z } from 'zod';
import type { JsonSchema } from '../client';

/**
 * Stage 10 output: the editorial layer.
 *
 * Runs in parallel with routing and costing because it depends on the plan's
 * shape, not on its timings.
 */
export const narrativeWire = z.object({
  summary: z.string().min(40).max(600),
  highlights: z.array(z.string().min(4).max(90)).min(3).max(6),
  day_titles: z.array(
    z.object({
      day_index: z.number().int().min(1),
      title: z.string().min(3).max(60),
      summary: z.string().min(20).max(320),
    }),
  ),
});

export type NarrativeWire = z.infer<typeof narrativeWire>;

export interface Narrative {
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly dayTitles: ReadonlyMap<number, { title: string; summary: string }>;
}

export function narrativeFromWire(wire: NarrativeWire): Narrative {
  return {
    summary: wire.summary,
    highlights: wire.highlights,
    dayTitles: new Map(
      wire.day_titles.map((d) => [d.day_index, { title: d.title, summary: d.summary }]),
    ),
  };
}

export const narrativeJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'day_titles'],
  properties: {
    summary: { type: 'string', description: 'A paragraph describing the trip as a whole' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
      description: '3-6 short phrases, each naming something specific about this trip',
    },
    day_titles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day_index', 'title', 'summary'],
        properties: {
          day_index: { type: 'integer' },
          title: { type: 'string' },
          summary: { type: 'string' },
        },
      },
    },
  },
};
