import { z } from 'zod';
import type { JsonSchema } from '../client';

/**
 * Stage 4 output: slot -> place assignment.
 *
 * The entire contract. The model receives a shortlist of real, server-resolved
 * candidates and picks one per slot. It cannot name a place, invent a URL, or
 * fabricate an opening time — the only authority it has is choosing an ID from a
 * list, and the server rejects anything outside that set.
 */

export const assignPlacesWire = z.object({
  assignments: z.array(
    z.object({
      slot_id: z.string().min(1),
      /** Must be one of the candidate ids supplied for this slot. */
      place_id: z.string().min(1),
      /** One line, shown on the activity card. Written for this traveller. */
      reason: z.string().min(8).max(180),
      /** Two or three sentences of context. */
      description: z.string().max(400),
    }),
  ),
  /** Slots the model could not fill from the candidates, with a reason. */
  unfilled: z.array(
    z.object({
      slot_id: z.string().min(1),
      why: z.string().max(200),
    }),
  ),
});

export type AssignPlacesWire = z.infer<typeof assignPlacesWire>;

export interface Assignment {
  readonly slotId: string;
  readonly placeId: string;
  readonly reason: string;
  readonly description: string;
}

export interface AssignmentResult {
  readonly assignments: readonly Assignment[];
  readonly unfilled: readonly { slotId: string; why: string }[];
  /** IDs the model returned that were not in the candidate set. Should be empty. */
  readonly rejected: readonly string[];
}

/**
 * Enforces the candidate-set constraint in code rather than trusting the prompt.
 * A model that invents an ID gets its assignment dropped, not propagated.
 */
export function assignmentsFromWire(
  wire: AssignPlacesWire,
  allowedBySlot: ReadonlyMap<string, ReadonlySet<string>>,
): AssignmentResult {
  const assignments: Assignment[] = [];
  const rejected: string[] = [];
  const usedPlaces = new Set<string>();

  for (const a of wire.assignments) {
    const allowed = allowedBySlot.get(a.slot_id);
    if (!allowed || !allowed.has(a.place_id)) {
      rejected.push(a.place_id);
      continue;
    }
    // Same venue twice in one pass is a duplicate we can catch for free here
    // rather than in validation.
    if (usedPlaces.has(a.place_id)) {
      rejected.push(a.place_id);
      continue;
    }
    usedPlaces.add(a.place_id);
    assignments.push({
      slotId: a.slot_id,
      placeId: a.place_id,
      reason: a.reason,
      description: a.description,
    });
  }

  return {
    assignments,
    unfilled: wire.unfilled.map((u) => ({ slotId: u.slot_id, why: u.why })),
    rejected,
  };
}

export const assignPlacesJsonSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['assignments', 'unfilled'],
  properties: {
    assignments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot_id', 'place_id', 'reason', 'description'],
        properties: {
          slot_id: { type: 'string' },
          place_id: {
            type: 'string',
            description: 'MUST be one of the candidate ids given for that slot. Never invent one.',
          },
          reason: { type: 'string', description: 'One line on why this suits this traveller' },
          description: { type: 'string', description: 'Two or three sentences of context' },
        },
      },
    },
    unfilled: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot_id', 'why'],
        properties: {
          slot_id: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
  },
};
