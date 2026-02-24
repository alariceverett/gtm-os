import { EventIntakeRequest, IntakeValidationIssue, IntakeValidationResult } from '../domain/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^\d{2}:\d{2}$/;

export function validateEventIntake(input: EventIntakeRequest): IntakeValidationResult {
  const issues: IntakeValidationIssue[] = [];

  if (!input.title?.trim()) {
    issues.push({ field: 'title', message: 'Title is required.' });
  }

  if (!ISO_DATE.test(input.eventDate)) {
    issues.push({ field: 'eventDate', message: 'eventDate must be YYYY-MM-DD.' });
  }

  if (input.timeWindowStart && !HH_MM.test(input.timeWindowStart)) {
    issues.push({ field: 'timeWindowStart', message: 'timeWindowStart must be HH:mm.' });
  }

  if (input.timeWindowEnd && !HH_MM.test(input.timeWindowEnd)) {
    issues.push({ field: 'timeWindowEnd', message: 'timeWindowEnd must be HH:mm.' });
  }

  if (input.timeWindowStart && input.timeWindowEnd && input.timeWindowStart >= input.timeWindowEnd) {
    issues.push({ field: 'timeWindow', message: 'timeWindowStart must be earlier than timeWindowEnd.' });
  }

  if (!Number.isInteger(input.minPartySize) || input.minPartySize < 2) {
    issues.push({ field: 'minPartySize', message: 'minPartySize must be an integer >= 2.' });
  }

  if (!Number.isInteger(input.maxPartySize) || input.maxPartySize < input.minPartySize) {
    issues.push({ field: 'maxPartySize', message: 'maxPartySize must be an integer >= minPartySize.' });
  }

  if (!Array.isArray(input.neighborhoods) || input.neighborhoods.length === 0) {
    issues.push({ field: 'neighborhoods', message: 'At least one neighborhood is required.' });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
