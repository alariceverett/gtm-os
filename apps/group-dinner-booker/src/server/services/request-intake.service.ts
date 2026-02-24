import {
  EventIntakeRequest,
  RestaurantCandidateInput,
  ScoredCandidate,
} from '../../lib/domain/types';
import { buildShortlist } from '../../lib/shortlist/score';
import { validateEventIntake } from '../../lib/validators/request-intake';

export interface IntakeResult {
  intakeAccepted: boolean;
  validationErrors: Array<{ field: string; message: string }>;
  shortlist: ScoredCandidate[];
}

/**
 * v1 scaffold: validates organizer input and returns shortlist rankings.
 * Persistence and API route wiring are intentionally left for milestone wiring.
 */
export function intakeAndShortlist(
  intake: EventIntakeRequest,
  candidatePool: RestaurantCandidateInput[],
  maxResults = 5,
): IntakeResult {
  const validation = validateEventIntake(intake);

  if (!validation.ok) {
    return {
      intakeAccepted: false,
      validationErrors: validation.issues,
      shortlist: [],
    };
  }

  return {
    intakeAccepted: true,
    validationErrors: [],
    shortlist: buildShortlist(intake, candidatePool, { maxResults }),
  };
}
