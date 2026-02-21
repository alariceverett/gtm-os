export type BudgetBand = '$' | '$$' | '$$$' | '$$$$';

export interface EventIntakeRequest {
  title: string;
  eventDate: string; // ISO date (YYYY-MM-DD)
  timeWindowStart?: string; // HH:mm
  timeWindowEnd?: string; // HH:mm
  minPartySize: number;
  maxPartySize: number;
  neighborhoods: string[];
  budgetBand?: BudgetBand;
  dietaryNotes?: string;
  accessibilityNotes?: string;
}

export interface IntakeValidationIssue {
  field: string;
  message: string;
}

export interface IntakeValidationResult {
  ok: boolean;
  issues: IntakeValidationIssue[];
}

export interface RestaurantCandidateInput {
  id: string;
  name: string;
  neighborhood?: string;
  borough?: string;
  cuisine?: string;
  budgetBand?: BudgetBand;
  supportsLargeParty?: boolean;
  supportsDietary?: boolean;
  supportsAccessibility?: boolean;
  platformUrls?: {
    resy?: string;
    opentable?: string;
    direct?: string;
  };
}

export interface CandidateScoreBreakdown {
  neighborhoodMatch: number;
  budgetMatch: number;
  partyFit: number;
  dietaryFit: number;
  accessibilityFit: number;
  platformCoverage: number;
}

export interface ScoredCandidate {
  candidate: RestaurantCandidateInput;
  score: number;
  breakdown: CandidateScoreBreakdown;
  reasons: string[];
}

export interface ShortlistOptions {
  maxResults?: number;
}
