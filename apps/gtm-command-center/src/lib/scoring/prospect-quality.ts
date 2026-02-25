/**
 * Prospect Quality Scoring Engine
 * A-F grading based on ICP fit and buying signals
 */

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface QualitySignals {
  // Hiring signals
  isHiring: boolean;
  hiringRoles?: string[];
  hiringCount?: number;
  
  // Funding signals  
  raisedFunding: boolean;
  fundingAmount?: number;
  fundingStage?: string;
  fundingDate?: Date;
  
  // Tech stack alignment
  techStackMatch: string[];
  missingTech?: string[];
  
  // Intent data
  intentData: boolean;
  intentScore?: number;
  intentTopics?: string[];
  
  // Recent events
  recentEvent: boolean;
  eventType?: 'funding' | 'hiring' | 'acquisition' | 'expansion' | 'layoffs' | 'other';
  eventDate?: Date;
  
  // Engagement history
  previousEngagement?: boolean;
  lastInteractionDate?: Date;
  engagementScore?: number;
}

export interface ICPProfile {
  // Company criteria
  targetIndustries: string[];
  excludeIndustries?: string[];
  targetSize: string[]; // e.g., ["51-200", "201-500"]
  targetRevenueRanges?: string[];
  targetFundingStages?: string[];
  targetLocations?: string[];
  excludeLocations?: string[];
  
  // Contact criteria
  targetTitles: string[];
  targetDepartments: string[];
  targetSeniorities: string[];
  
  // Tech stack must-haves/nice-to-haves
  mustHaveTech?: string[];
  niceToHaveTech?: string[];
  
  // Signal weights
  signalWeights?: Partial<SignalWeights>;
}

export interface SignalWeights {
  funding: number;
  hiring: number;
  techStack: number;
  intent: number;
  titleMatch: number;
  companySize: number;
  industryMatch: number;
  location: number;
  maxPossible: number;
}

export interface ScoringConfig {
  // Grade thresholds
  gradeThresholds: {
    A: number; // >= 90
    B: number; // 80-89
    C: number; // 70-79
    D: number; // 60-69
    E: number; // 50-59
    F: number; // < 50
  };
  
  // Score calculation
  weights: SignalWeights;
  
  // Feature flags
  requireMinScore: boolean;
  minScoreForQualified: number;
  autoBlacklist: boolean;
  blacklistThreshold: number;
}

export interface ProspectData {
  companyName: string;
  industry?: string;
  size?: string;
  revenue?: string;
  fundingStage?: string;
  location?: string;
  techStack?: string[];
  
  contactTitle?: string;
  department?: string;
  seniority?: string;
  email?: string;
  
  signals?: QualitySignals;
}

export interface ScoredProspect extends ProspectData {
  qualityScore: QualityGrade;
  fitScore: number;
  intentScore: number;
  detailedBreakdown: ScoreBreakdown;
  reasoning: string[];
  recommendedAction: 'immediate_outreach' | 'nurture' | 'low_priority' | 'blacklist';
}

export interface ScoreBreakdown {
  companyFit: number;
  contactFit: number;
  signalScore: number;
  techAlignment: number;
  timingScore: number;
  total: number;
}

const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  funding: 25,
  hiring: 20,
  techStack: 20,
  intent: 15,
  titleMatch: 10,
  companySize: 5,
  industryMatch: 5,
  location: 0,
  maxPossible: 100,
};

const DEFAULT_GRADE_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  E: 50,
  F: 0,
};

const DEFAULT_CONFIG: ScoringConfig = {
  gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  weights: DEFAULT_SIGNAL_WEIGHTS,
  requireMinScore: true,
  minScoreForQualified: 60,
  autoBlacklist: false,
  blacklistThreshold: 30,
};

/**
 * Calculate numeric score to letter grade
 */
export function scoreToGrade(score: number): QualityGrade {
  if (score >= DEFAULT_GRADE_THRESHOLDS.A) return 'A';
  if (score >= DEFAULT_GRADE_THRESHOLDS.B) return 'B';
  if (score >= DEFAULT_GRADE_THRESHOLDS.C) return 'C';
  if (score >= DEFAULT_GRADE_THRESHOLDS.D) return 'D';
  if (score >= DEFAULT_GRADE_THRESHOLDS.E) return 'E';
  return 'F';
}

/**
 * Grade to numeric score (midpoint)
 */
export function gradeToScore(grade: QualityGrade): number {
  const scores: Record<QualityGrade, number> = {
    A: 95,
    B: 85,
    C: 75,
    D: 65,
    E: 55,
    F: 45,
  };
  return scores[grade];
}

/**
 * Check if value matches target (fuzzy matching)
 */
function fuzzyMatch(value: string, targets: string[]): boolean {
  const normalizedValue = value.toLowerCase().trim();
  return targets.some(target => {
    const normalizedTarget = target.toLowerCase().trim();
    return normalizedValue.includes(normalizedTarget) || 
           normalizedTarget.includes(normalizedValue) ||
           // Industry synonyms
           (normalizedTarget === 'saas' && ['software', 'cloud', 'b2b software'].includes(normalizedValue)) ||
           (normalizedTarget === 'fintech' && ['financial', 'banking', 'payments'].includes(normalizedValue));
  });
}

/**
 * Score company fit against ICP
 */
function scoreCompanyFit(prospect: ProspectData, icp: ICPProfile): number {
  let score = 0;
  const possible = 35; // company size + industry + location + revenue
  
  // Industry match
  if (prospect.industry && icp.targetIndustries.some(ind => fuzzyMatch(prospect.industry!, [ind]))) {
    score += 15;
  }
  
  // Exclude check
  if (prospect.industry && icp.excludeIndustries?.some(ind => fuzzyMatch(prospect.industry!, [ind]))) {
    score -= 20;
  }
  
  // Company size
  if (prospect.size && icp.targetSize.includes(prospect.size)) {
    score += 10;
  }
  
  // Location
  if (prospect.location && icp.targetLocations?.some(loc => fuzzyMatch(prospect.location!, [loc]))) {
    score += 10;
  }
  
  return Math.max(0, Math.min(score, possible));
}

/**
 * Score contact fit against ICP
 */
function scoreContactFit(prospect: ProspectData, icp: ICPProfile): number {
  let score = 0;
  const possible = 25; // title + department + seniority
  
  // Title match
  if (prospect.contactTitle) {
    const titleWords = prospect.contactTitle.toLowerCase().split(/\s+/);
    if (icp.targetTitles.some(target => 
      titleWords.some(word => target.toLowerCase().includes(word) || word.includes(target.toLowerCase()))
    )) {
      score += 15;
    }
  }
  
  // Department match
  if (prospect.department && icp.targetDepartments.some(d => fuzzyMatch(prospect.department!, [d]))) {
    score += 10;
  }
  
  return Math.max(0, Math.min(score, possible));
}

/**
 * Score buying signals
 */
function scoreSignals(signals: QualitySignals | undefined, weights: SignalWeights): number {
  if (!signals) return 0;
  
  let score = 0;
  
  // Funding signal
  if (signals.raisedFunding) {
    score += weights.funding;
    // Boost for recent funding
    if (signals.recentEvent) {
      score += 5;
    }
  }
  
  // Hiring signal
  if (signals.isHiring) {
    const hireCount = signals.hiringCount || 1;
    const hireMultiplier = Math.min(hireCount / 5, 1) + 0.5;
    score += weights.hiring * hireMultiplier;
  }
  
  // Tech stack match
  if (signals.techStackMatch.length > 0) {
    const techMultiplier = Math.min(signals.techStackMatch.length / 3, 1) + 0.3;
    score += weights.techStack * techMultiplier;
  }
  
  // Intent data
  if (signals.intentData) {
    score += weights.intent;
  }
  
  return Math.min(score, weights.maxPossible);
}

/**
 * Score tech alignment
 */
function scoreTechAlignment(prospect: ProspectData, icp: ICPProfile): number {
  let score = 0;
  const possible = 15;
  
  if (!prospect.techStack) return 0;
  
  // Must-have tech
  if (icp.mustHaveTech) {
    const hasMustHave = icp.mustHaveTech.every(tech => 
      prospect.techStack!.some(st => st.toLowerCase().includes(tech.toLowerCase()))
    );
    if (hasMustHave) {
      score += 10;
    }
  }
  
  // Nice-to-have tech
  if (icp.niceToHaveTech) {
    const niceToHaveCount = icp.niceToHaveTech.filter(tech => 
      prospect.techStack!.some(st => st.toLowerCase().includes(tech.toLowerCase()))
    ).length;
    score += Math.min(niceToHaveCount * 2, 5);
  }
  
  return Math.min(score, possible);
}

/**
 * Score timing (event recency, engagement recency)
 */
function scoreTiming(signals: QualitySignals | undefined): number {
  if (!signals) return 0;
  
  let score = 0;
  
  // Recent funding/hiring (within 3 months)
  if (signals.recentEvent && signals.eventDate) {
    const daysSinceEvent = Math.floor(
      (Date.now() - new Date(signals.eventDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceEvent <= 30) {
      score += 15;
    } else if (daysSinceEvent <= 90) {
      score += 10;
    }
  }
  
  // Previous engagement (nurture existing)
  if (signals.previousEngagement && signals.lastInteractionDate) {
    const daysSinceInteraction = Math.floor(
      (Date.now() - new Date(signals.lastInteractionDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceInteraction > 30) {
      score += 5; // Re-engagement window
    }
  }
  
  return Math.min(score, 20);
}

/**
 * Generate reasoning for the score
 */
function generateReasoning(
  prospect: ProspectData,
  breakdown: ScoreBreakdown,
  icp: ICPProfile
): string[] {
  const reasoning: string[] = [];
  
  // Company fit reasoning
  if (breakdown.companyFit >= 30) {
    reasoning.push(`Strong company fit: ${prospect.industry} industry, ${prospect.size} size`);
  } else if (breakdown.companyFit <= 10) {
    reasoning.push('Weak company fit: outside target profile');
  }
  
  // Contact fit reasoning
  if (breakdown.contactFit >= 20) {
    reasoning.push(`Strong contact fit: ${prospect.contactTitle} in ${prospect.department}`);
  }
  
  // Signal reasoning
  if (prospect.signals?.raisedFunding) {
    reasoning.push(`Recent ${prospect.signals.fundingStage} funding: ${prospect.signals.fundingAmount}`);
  }
  if (prospect.signals?.isHiring) {
    const roles = prospect.signals.hiringRoles?.join(', ') || 'multiple roles';
    reasoning.push(`Actively hiring: ${roles}`);
  }
  if (prospect.signals?.techStackMatch.length) {
    reasoning.push(`Tech stack match: ${prospect.signals.techStackMatch.slice(0, 3).join(', ')}`);
  }
  if (prospect.signals?.intentData) {
    reasoning.push('Showing high intent signals');
  }
  
  return reasoning.length > 0 ? reasoning : ['Standard prospect based on limited data'];
}

/**
 * Determine recommended action
 */
function getRecommendedAction(score: number, grade: QualityGrade, breakdown: ScoreBreakdown):
  ScoredProspect['recommendedAction'] {
  if (grade === 'A' || (grade === 'B' && breakdown.signalScore >= 40)) {
    return 'immediate_outreach';
  }
  if (grade === 'C' || grade === 'B') {
    return 'nurture';
  }
  if (grade === 'F' || score < 40) {
    return 'blacklist';
  }
  return 'low_priority';
}

/**
 * Score a prospect against ICP criteria
 */
export function scoreProspect(
  prospect: ProspectData,
  icp: ICPProfile,
  config?: Partial<ScoringConfig>
): ScoredProspect {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const weights = { ...DEFAULT_SIGNAL_WEIGHTS, ...icp.signalWeights };
  
  // Calculate component scores
  const companyFit = scoreCompanyFit(prospect, icp);
  const contactFit = scoreContactFit(prospect, icp);
  const signalScore = scoreSignals(prospect.signals, weights);
  const techAlignment = scoreTechAlignment(prospect, icp);
  const timingScore = scoreTiming(prospect.signals);
  
  // Calculate totals
  const fitScore = Math.round(companyFit + contactFit);
  const intentScore = Math.round(signalScore + techAlignment + timingScore);
  const totalScore = Math.min(fitScore + intentScore, 100);
  
  const grade = scoreToGrade(totalScore);
  
  const breakdown: ScoreBreakdown = {
    companyFit: Math.round(companyFit),
    contactFit: Math.round(contactFit),
    signalScore: Math.round(signalScore),
    techAlignment: Math.round(techAlignment),
    timingScore: Math.round(timingScore),
    total: totalScore,
  };
  
  return {
    ...prospect,
    qualityScore: grade,
    fitScore,
    intentScore,
    detailedBreakdown: breakdown,
    reasoning: generateReasoning(prospect, breakdown, icp),
    recommendedAction: getRecommendedAction(totalScore, grade, breakdown),
  };
}

/**
 * Batch score multiple prospects
 */
export function scoreProspects(
  prospects: ProspectData[],
  icp: ICPProfile,
  config?: Partial<ScoringConfig>
): ScoredProspect[] {
  return prospects.map(p => scoreProspect(p, icp, config));
}

/**
 * Filter prospects by minimum score
 */
export function filterByScore(
  prospects: ScoredProspect[],
  minScore: number
): ScoredProspect[] {
  return prospects.filter(p => p.detailedBreakdown.total >= minScore);
}

/**
 * Sort prospects by quality (highest first)
 */
export function sortByQuality(prospects: ScoredProspect[]): ScoredProspect[] {
  return [...prospects].sort((a, b) => {
    // First by grade
    const gradeDiff = gradeToScore(b.qualityScore) - gradeToScore(a.qualityScore);
    if (gradeDiff !== 0) return gradeDiff;
    
    // Then by total score
    return b.detailedBreakdown.total - a.detailedBreakdown.total;
  });
}

/**
 * Quality Scoring Service
 */
export class ProspectQualityScorer {
  private icp: ICPProfile;
  private config: ScoringConfig;
  
  constructor(icp: ICPProfile, config?: Partial<ScoringConfig>) {
    this.icp = icp;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  score(prospect: ProspectData): ScoredProspect {
    return scoreProspect(prospect, this.icp, this.config);
  }
  
  scoreMany(prospects: ProspectData[]): ScoredProspect[] {
    return scoreProspects(prospects, this.icp, this.config);
  }
  
  getQualified(prospects: ScoredProspect[]): ScoredProspect[] {
    return prospects.filter(p => 
      p.qualityScore <= 'C' && // A, B, or C
      p.detailedBreakdown.total >= this.config.minScoreForQualified
    );
  }
  
  getHighPriority(prospects: ScoredProspect[]): ScoredProspect[] {
    return prospects.filter(p => p.qualityScore <= 'B');
  }
  
  updateICP(newIcp: ICPProfile): void {
    this.icp = newIcp;
  }
  
  get currentICP(): ICPProfile {
    return this.icp;
  }
}

export default ProspectQualityScorer;
