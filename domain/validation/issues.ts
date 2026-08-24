import type { ActivityId, PlaceId } from '../types/ids';
import type { Interest } from '../types/taxonomy';

export type IssueSeverity = 'error' | 'warning';

/**
 * Every way an itinerary can be wrong, as data.
 *
 * Typed rather than stringly so that `repair.ts` can exhaustively switch on the
 * code — adding a rule without adding a fix becomes a compile error.
 */
export type ItineraryIssue =
  | { code: 'OVERLAP'; severity: 'error'; dayIndex: number; activityIds: readonly [ActivityId, ActivityId]; overlapMinutes: number }
  | { code: 'CLOSED_AT_VISIT'; severity: 'error'; dayIndex: number; activityId: ActivityId; visitMinute: number }
  | { code: 'HOURS_UNKNOWN'; severity: 'warning'; dayIndex: number; activityId: ActivityId }
  | { code: 'TRAVEL_TIME_IMPOSSIBLE'; severity: 'error'; dayIndex: number; fromId: ActivityId; toId: ActivityId; needMinutes: number; haveMinutes: number }
  | { code: 'GEOGRAPHIC_THRASH'; severity: 'warning'; dayIndex: number; travelMinutes: number; limitMinutes: number }
  | { code: 'OVERPACKED'; severity: 'error'; dayIndex: number; activeMinutes: number; limitMinutes: number }
  | { code: 'TOO_MANY_ACTIVITIES'; severity: 'warning'; dayIndex: number; count: number; limit: number }
  | { code: 'UNDERFILLED'; severity: 'warning'; dayIndex: number; count: number }
  | { code: 'BUDGET_EXCEEDED'; severity: 'error'; overBy: number; ratio: number }
  | { code: 'BUDGET_UNDERSPENT'; severity: 'warning'; underBy: number; ratio: number }
  | { code: 'INTEREST_UNMET'; severity: 'warning'; interest: Interest }
  | { code: 'DUPLICATE_PLACE'; severity: 'error'; placeId: PlaceId; dayIndexes: readonly number[] }
  | { code: 'DURATION_MISMATCH'; severity: 'error'; expected: number; actual: number }
  | { code: 'MISSING_MEAL'; severity: 'warning'; dayIndex: number; meal: 'lunch' | 'dinner' }
  | { code: 'UNKNOWN_PLACE'; severity: 'error'; dayIndex: number; activityId: ActivityId }
  | { code: 'IMPLAUSIBLE_MODE'; severity: 'warning'; dayIndex: number; activityId: ActivityId; mode: string; meters: number }
  | { code: 'DATE_MISMATCH'; severity: 'error'; dayIndex: number; expected: string; actual: string };

export type IssueCode = ItineraryIssue['code'];

export function errorsOnly(issues: readonly ItineraryIssue[]): readonly ItineraryIssue[] {
  return issues.filter((i) => i.severity === 'error');
}

/** Human-facing copy. Used both in the repair log and, for survivors, in the UI. */
export function describeIssue(issue: ItineraryIssue): string {
  switch (issue.code) {
    case 'OVERLAP':
      return `Day ${issue.dayIndex}: two activities overlap by ${issue.overlapMinutes} minutes.`;
    case 'CLOSED_AT_VISIT':
      return `Day ${issue.dayIndex}: a place is scheduled while it is closed.`;
    case 'HOURS_UNKNOWN':
      return `Day ${issue.dayIndex}: opening hours are unknown for one stop — worth checking before you go.`;
    case 'TRAVEL_TIME_IMPOSSIBLE':
      return `Day ${issue.dayIndex}: only ${issue.haveMinutes} minutes allowed for a ${issue.needMinutes}-minute journey.`;
    case 'GEOGRAPHIC_THRASH':
      return `Day ${issue.dayIndex}: ${issue.travelMinutes} minutes of travel is more than this day should need.`;
    case 'OVERPACKED':
      return `Day ${issue.dayIndex}: ${Math.round(issue.activeMinutes / 60)} hours scheduled against a ${Math.round(issue.limitMinutes / 60)}-hour limit.`;
    case 'TOO_MANY_ACTIVITIES':
      return `Day ${issue.dayIndex}: ${issue.count} activities is more than this pace allows.`;
    case 'UNDERFILLED':
      return `Day ${issue.dayIndex}: only ${issue.count} things planned.`;
    case 'BUDGET_EXCEEDED':
      return `The estimate is ${Math.round(issue.ratio * 100)}% over budget.`;
    case 'BUDGET_UNDERSPENT':
      return `The estimate is ${Math.round(Math.abs(issue.ratio) * 100)}% under budget — there is room for more.`;
    case 'INTEREST_UNMET':
      return `Nothing in this trip covers "${issue.interest}".`;
    case 'DUPLICATE_PLACE':
      return `The same place appears on days ${issue.dayIndexes.join(' and ')}.`;
    case 'DURATION_MISMATCH':
      return `The trip has ${issue.actual} days but ${issue.expected} were requested.`;
    case 'MISSING_MEAL':
      return `Day ${issue.dayIndex} has no ${issue.meal}.`;
    case 'UNKNOWN_PLACE':
      return `Day ${issue.dayIndex}: an activity references a place that could not be resolved.`;
    case 'IMPLAUSIBLE_MODE':
      return `Day ${issue.dayIndex}: ${issue.mode} for ${(issue.meters / 1000).toFixed(1)} km is not realistic.`;
    case 'DATE_MISMATCH':
      return `Day ${issue.dayIndex} is dated ${issue.actual} but should be ${issue.expected}.`;
  }
}
