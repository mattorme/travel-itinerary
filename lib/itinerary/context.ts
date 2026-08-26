import type { TripRequestParsed } from '@/domain/schemas/trip-request';
import type { Stage } from './stage-names';
import type { DraftDay } from './draft';

/**
 * What every pipeline stage is given.
 *
 * In its own module so a stage can depend on the shape without importing the
 * orchestrator that runs it.
 */
export interface PipelineContext {
  readonly tripId: string;
  readonly jobId: string;
  readonly request: TripRequestParsed;
  readonly onStage: (stage: Stage, progress: number) => Promise<void>;
  /** Called as each day completes so the UI can render it before the rest finish. */
  readonly onDayReady?: (day: DraftDay) => Promise<void>;
}
