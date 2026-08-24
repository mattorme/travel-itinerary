import { STAGE_COPY, type Stage } from './stage-names';

/** Client-safe stage copy. Kept apart from the pipeline so no server-only
 *  module is dragged into the browser bundle by a progress component. */
export function stageCopyClient(stage: string | null): string {
  if (!stage) return 'Getting started…';
  return STAGE_COPY[stage as Stage] ?? 'Working…';
}
