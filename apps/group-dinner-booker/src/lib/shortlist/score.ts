import {
  CandidateScoreBreakdown,
  EventIntakeRequest,
  RestaurantCandidateInput,
  ScoredCandidate,
  ShortlistOptions,
} from '../domain/types';

const WEIGHTS = {
  neighborhood: 30,
  budget: 20,
  party: 20,
  dietary: 10,
  accessibility: 10,
  platform: 10,
} as const;

function buildBreakdown(
  intake: EventIntakeRequest,
  candidate: RestaurantCandidateInput,
): CandidateScoreBreakdown {
  const neighborhoodMatch =
    candidate.neighborhood &&
    intake.neighborhoods.some((n) => n.toLowerCase() === candidate.neighborhood?.toLowerCase())
      ? WEIGHTS.neighborhood
      : 0;

  const budgetMatch =
    !intake.budgetBand || !candidate.budgetBand || intake.budgetBand === candidate.budgetBand
      ? WEIGHTS.budget
      : 0;

  const partyFit = candidate.supportsLargeParty ? WEIGHTS.party : Math.floor(WEIGHTS.party / 2);

  const dietaryRequested = Boolean(intake.dietaryNotes?.trim());
  const dietaryFit = !dietaryRequested || candidate.supportsDietary ? WEIGHTS.dietary : 0;

  const accessibilityRequested = Boolean(intake.accessibilityNotes?.trim());
  const accessibilityFit = !accessibilityRequested || candidate.supportsAccessibility ? WEIGHTS.accessibility : 0;

  const platformCoverage =
    candidate.platformUrls &&
    (candidate.platformUrls.resy || candidate.platformUrls.opentable || candidate.platformUrls.direct)
      ? WEIGHTS.platform
      : 0;

  return {
    neighborhoodMatch,
    budgetMatch,
    partyFit,
    dietaryFit,
    accessibilityFit,
    platformCoverage,
  };
}

function total(b: CandidateScoreBreakdown): number {
  return (
    b.neighborhoodMatch +
    b.budgetMatch +
    b.partyFit +
    b.dietaryFit +
    b.accessibilityFit +
    b.platformCoverage
  );
}

function reasonsFromBreakdown(breakdown: CandidateScoreBreakdown): string[] {
  const reasons: string[] = [];
  if (breakdown.neighborhoodMatch > 0) reasons.push('Neighborhood match');
  if (breakdown.budgetMatch > 0) reasons.push('Budget compatible');
  if (breakdown.partyFit >= 10) reasons.push('Large-party fit');
  if (breakdown.dietaryFit > 0) reasons.push('Dietary support likely');
  if (breakdown.accessibilityFit > 0) reasons.push('Accessibility support likely');
  if (breakdown.platformCoverage > 0) reasons.push('Has platform/direct booking link');
  return reasons;
}

export function scoreCandidate(intake: EventIntakeRequest, candidate: RestaurantCandidateInput): ScoredCandidate {
  const breakdown = buildBreakdown(intake, candidate);
  return {
    candidate,
    breakdown,
    score: total(breakdown),
    reasons: reasonsFromBreakdown(breakdown),
  };
}

export function buildShortlist(
  intake: EventIntakeRequest,
  candidates: RestaurantCandidateInput[],
  options?: ShortlistOptions,
): ScoredCandidate[] {
  const scored = candidates.map((candidate) => scoreCandidate(intake, candidate));
  scored.sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));

  const maxResults = options?.maxResults ?? 5;
  return scored.slice(0, maxResults);
}
