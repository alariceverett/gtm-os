/**
 * Decision Synthesis Engine
 * 
 * Transforms KPI trends + user preferences + feedback signals into
 * prioritized, actionable recommendations with confidence scores.
 * 
 * Uses rule-based weighted scoring (trend direction × preference match × historical accuracy)
 */

import type { KpiTrend, SimpleForecastResult } from '@/lib/predictions/simple-forecast';
import type { CardType, SignalType } from '@/lib/preference-service';

// Recommendation types
export type RecommendationType = 
  | 'investigate_decline'
  | 'double_down_growth'
  | 'reorder_dashboard'
  | 'address_anomaly'
  | 'review_blocked_tasks'
  | 'pause_underperforming';

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  priority: RecommendationPriority;
  confidenceScore: number; // 0-100
  confidenceTrend: 'rising' | 'stable' | 'falling';
  
  // Source data
  sourceMetrics: string[];
  sourceTrends: KpiTrend[];
  
  // Scoring breakdown
  scores: {
    trendImpact: number;      // -100 to +100
    preferenceMatch: number;  // 0 to 100
    historicalAccuracy: number; // 0 to 100 (historical success rate of similar recommendations)
    combined: number;         // Final weighted score (0-100)
  };
  
  // Action
  suggestedAction: {
    type: 'auto' | 'manual_review';
    description: string;
    estimatedImpact: string;
  };
  
  // Metadata
  createdAt: string;
  expiresAt: string; // Recommendations expire after 24h
  userFeedback?: 'accepted' | 'rejected' | 'dismissed';
}

// Input types
export interface SynthesisInput {
  forecast: SimpleForecastResult | null;
  preferences: {
    cardOrder: CardType[];
    recentFeedback: Array<{
      signalType: SignalType;
      section?: string;
      timestamp: string;
    }>;
  };
  historicalAccuracy: Record<RecommendationType, number>; // Historical success rates
  context?: {
    blockedTasks?: number;
    openPriorities?: number;
    activeRuns?: number;
  };
}

// Scoring weights
const SCORING_WEIGHTS = {
  trendImpact: 0.4,      // 40% - How strong/urgent is the trend
  preferenceMatch: 0.3,  // 30% - How well does it align with user preferences
  historicalAccuracy: 0.3, // 30% - Historical success rate of similar recommendations
};

// Trend thresholds
const TREND_THRESHOLDS = {
  declineCritical: -15,  // -15% or worse = critical
  declineWarning: -5,    // -5% or worse = warning
  growthOpportunity: 10, // +10% or better = double down opportunity
};

// Historical accuracy defaults (will be overridden by actual data)
const DEFAULT_HISTORICAL_ACCURACY: Record<RecommendationType, number> = {
  investigate_decline: 0.75,
  double_down_growth: 0.68,
  reorder_dashboard: 0.82,
  address_anomaly: 0.71,
  review_blocked_tasks: 0.79,
  pause_underperforming: 0.65,
};

// Helper: Generate unique ID
function generateId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Calculate trend impact score (-100 to +100)
function calculateTrendImpact(trend: KpiTrend): number {
  const changePercent = trend.changePercent;
  
  // Negative trends get higher impact scores (more urgent)
  if (changePercent <= TREND_THRESHOLDS.declineCritical) {
    return -100; // Critical decline
  } else if (changePercent <= TREND_THRESHOLDS.declineWarning) {
    return -70; // Warning decline
  } else if (changePercent < 0) {
    return -40; // Mild decline
  } else if (changePercent >= TREND_THRESHOLDS.growthOpportunity) {
    return +80; // Strong growth
  } else if (changePercent > 0) {
    return +40; // Mild growth
  }
  return 0; // Flat
}

// Helper: Calculate preference match score (0-100)
function calculatePreferenceMatch(
  recommendationType: RecommendationType,
  preferences: SynthesisInput['preferences']
): number {
  // Score based on alignment with user's card ordering and feedback
  const cardScores: Record<string, number> = {
    kpi: preferences.cardOrder.indexOf('kpi'),
    objectives: preferences.cardOrder.indexOf('objectives'),
    alerts: preferences.cardOrder.indexOf('alerts'),
    intelligence: preferences.cardOrder.indexOf('intelligence'),
  };
  
  // Lower index = higher priority = higher score
  const normalizeScore = (index: number): number => Math.max(0, 100 - index * 25);
  
  // Map recommendation types to card types
  const typeToCard: Record<RecommendationType, keyof typeof cardScores> = {
    investigate_decline: 'kpi',
    double_down_growth: 'kpi',
    reorder_dashboard: 'intelligence',
    address_anomaly: 'alerts',
    review_blocked_tasks: 'objectives',
    pause_underperforming: 'alerts',
  };
  
  const baseScore = normalizeScore(cardScores[typeToCard[recommendationType]] || 2);
  
  // Boost score if user has given positive feedback to similar recommendations
  const positiveSignals = preferences.recentFeedback.filter(
    f => f.signalType === 'explicit_positive'
  ).length;
  const negativeSignals = preferences.recentFeedback.filter(
    f => f.signalType === 'explicit_negative'
  ).length;
  
  const feedbackBoost = Math.min(positiveSignals * 10, 30) - Math.min(negativeSignals * 10, 20);
  return Math.min(100, Math.max(0, baseScore + feedbackBoost));
}

// Helper: Compute weighted confidence score
function computeConfidenceScore(
  trendImpact: number,
  preferenceMatch: number,
  historicalAccuracy: number
): number {
  // Convert trend impact to absolute score (0-100)
  const trendScore = Math.abs(trendImpact);
  
  const combined = 
    trendScore * SCORING_WEIGHTS.trendImpact +
    preferenceMatch * SCORING_WEIGHTS.preferenceMatch +
    historicalAccuracy * 100 * SCORING_WEIGHTS.historicalAccuracy;
  
  return Math.round(Math.min(100, Math.max(0, combined)));
}

// Helper: Determine confidence trend
function calculateConfidenceTrend(
  currentTrend: KpiTrend,
  previousTrend?: KpiTrend
): 'rising' | 'stable' | 'falling' {
  if (!previousTrend) return 'stable';
  
  const diff = Math.abs(currentTrend.changePercent) - Math.abs(previousTrend.changePercent);
  if (diff > 3) return 'rising';
  if (diff < -3) return 'falling';
  return 'stable';
}

// Helper: Get priority based on confidence and trend direction
function determinePriority(
  confidenceScore: number,
  trendImpact: number
): RecommendationPriority {
  if (trendImpact <= -70 || confidenceScore >= 90) return 'critical';
  if (trendImpact <= -40 || confidenceScore >= 75) return 'high';
  if (confidenceScore >= 50) return 'medium';
  return 'low';
}

// Generate recommendation for declining metrics
function generateDeclineRecommendation(
  trend: KpiTrend,
  input: SynthesisInput
): Recommendation | null {
  if (trend.direction !== 'down' || trend.changePercent > TREND_THRESHOLDS.declineWarning) {
    return null;
  }
  
  const trendImpact = calculateTrendImpact(trend);
  const preferenceMatch = calculatePreferenceMatch('investigate_decline', input.preferences);
  const historicalAccuracy = input.historicalAccuracy?.investigate_decline ?? 
    DEFAULT_HISTORICAL_ACCURACY.investigate_decline;
  
  const confidenceScore = computeConfidenceScore(trendImpact, preferenceMatch, historicalAccuracy);
  
  return {
    id: generateId(),
    type: 'investigate_decline',
    title: `Investigate decline in ${trend.metric}`,
    description: `${trend.metric} is down ${Math.abs(trend.changePercent).toFixed(1)}% vs 7-day average. Current: ${trend.currentValue}, Average: ${trend.avg7dValue.toFixed(1)}`,
    priority: determinePriority(confidenceScore, trendImpact),
    confidenceScore,
    confidenceTrend: 'rising',
    sourceMetrics: [trend.metric],
    sourceTrends: [trend],
    scores: {
      trendImpact,
      preferenceMatch,
      historicalAccuracy,
      combined: confidenceScore,
    },
    suggestedAction: {
      type: confidenceScore >= 80 ? 'auto' : 'manual_review',
      description: 'Create investigation task to identify root cause',
      estimatedImpact: 'Prevent further decline',
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// Generate recommendation for growth opportunities
function generateGrowthRecommendation(
  trend: KpiTrend,
  input: SynthesisInput
): Recommendation | null {
  if (trend.direction !== 'up' || trend.changePercent < TREND_THRESHOLDS.growthOpportunity) {
    return null;
  }
  
  const trendImpact = calculateTrendImpact(trend);
  const preferenceMatch = calculatePreferenceMatch('double_down_growth', input.preferences);
  const historicalAccuracy = input.historicalAccuracy?.double_down_growth ?? 
    DEFAULT_HISTORICAL_ACCURACY.double_down_growth;
  
  const confidenceScore = computeConfidenceScore(trendImpact, preferenceMatch, historicalAccuracy);
  
  return {
    id: generateId(),
    type: 'double_down_growth',
    title: `Double down on ${trend.metric} growth`,
    description: `${trend.metric} is up ${trend.changePercent.toFixed(1)}% vs 7-day average. Consider scaling this initiative.`,
    priority: determinePriority(confidenceScore, trendImpact),
    confidenceScore,
    confidenceTrend: 'rising',
    sourceMetrics: [trend.metric],
    sourceTrends: [trend],
    scores: {
      trendImpact,
      preferenceMatch,
      historicalAccuracy,
      combined: confidenceScore,
    },
    suggestedAction: {
      type: confidenceScore >= 85 ? 'auto' : 'manual_review',
      description: 'Create expansion task to capitalize on momentum',
      estimatedImpact: 'Accelerate growth',
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// Generate recommendation for dashboard reordering based on preferences
function generateDashboardReorderRecommendation(
  input: SynthesisInput
): Recommendation | null {
  // Only suggest if user has given enough feedback signals
  const signalCount = input.preferences.recentFeedback.length;
  if (signalCount < 3) return null;
  
  const positiveSignals = input.preferences.recentFeedback.filter(
    f => f.signalType === 'explicit_positive'
  ).length;
  
  // Only suggest if positive engagement is high
  if (positiveSignals < 2) return null;
  
  const preferenceMatch = calculatePreferenceMatch('reorder_dashboard', input.preferences);
  const historicalAccuracy = input.historicalAccuracy?.reorder_dashboard ?? 
    DEFAULT_HISTORICAL_ACCURACY.reorder_dashboard;
  
  // Trend impact is neutral for this type
  const trendImpact = 0;
  const confidenceScore = computeConfidenceScore(trendImpact, preferenceMatch, historicalAccuracy);
  
  if (confidenceScore < 60) return null;
  
  return {
    id: generateId(),
    type: 'reorder_dashboard',
    title: 'Optimize dashboard layout',
    description: `Based on your recent engagement patterns, consider reordering cards: ${input.preferences.cardOrder.join(' → ')}`,
    priority: 'low',
    confidenceScore,
    confidenceTrend: 'stable',
    sourceMetrics: ['user_engagement'],
    sourceTrends: [],
    scores: {
      trendImpact,
      preferenceMatch,
      historicalAccuracy,
      combined: confidenceScore,
    },
    suggestedAction: {
      type: 'manual_review',
      description: 'Review and apply new card order',
      estimatedImpact: 'Improve workflow efficiency',
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };
}

// Generate recommendation for blocked tasks
function generateBlockedTasksRecommendation(
  input: SynthesisInput
): Recommendation | null {
  const blockedCount = input.context?.blockedTasks ?? 0;
  if (blockedCount < 2) return null;
  
  const trendImpact = -60; // Moderate negative impact
  const preferenceMatch = calculatePreferenceMatch('review_blocked_tasks', input.preferences);
  const historicalAccuracy = input.historicalAccuracy?.review_blocked_tasks ?? 
    DEFAULT_HISTORICAL_ACCURACY.review_blocked_tasks;
  
  const confidenceScore = computeConfidenceScore(trendImpact, preferenceMatch, historicalAccuracy);
  
  return {
    id: generateId(),
    type: 'review_blocked_tasks',
    title: `Review ${blockedCount} blocked tasks`,
    description: `${blockedCount} tasks are currently blocked. Review and unblock to maintain momentum.`,
    priority: blockedCount >= 5 ? 'high' : 'medium',
    confidenceScore,
    confidenceTrend: 'stable',
    sourceMetrics: ['blocked_tasks'],
    sourceTrends: [],
    scores: {
      trendImpact,
      preferenceMatch,
      historicalAccuracy,
      combined: confidenceScore,
    },
    suggestedAction: {
      type: confidenceScore >= 80 ? 'auto' : 'manual_review',
      description: 'Create unblocking session task',
      estimatedImpact: 'Restore workflow velocity',
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
  };
}

// Helper: Sort recommendations by priority and confidence
function sortRecommendations(recommendations: Recommendation[]): Recommendation[] {
  const priorityOrder: Record<RecommendationPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  
  return recommendations.sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by confidence (highest first)
    return b.confidenceScore - a.confidenceScore;
  });
}

/**
 * Main function: Generate recommendations from synthesis input
 * 
 * @param input - Synthesis input containing forecasts, preferences, and context
 * @returns Array of ranked recommendations with confidence scores
 */
export function generateRecommendations(
  input: SynthesisInput
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  // Process each KPI trend
  if (input.forecast?.trends) {
    for (const trend of input.forecast.trends) {
      // Generate decline recommendations
      const declineRec = generateDeclineRecommendation(trend, input);
      if (declineRec) recommendations.push(declineRec);
      
      // Generate growth recommendations
      const growthRec = generateGrowthRecommendation(trend, input);
      if (growthRec) recommendations.push(growthRec);
    }
  }
  
  // Generate dashboard reorder recommendation
  const reorderRec = generateDashboardReorderRecommendation(input);
  if (reorderRec) recommendations.push(reorderRec);
  
  // Generate blocked tasks recommendation
  const blockedRec = generateBlockedTasksRecommendation(input);
  if (blockedRec) recommendations.push(blockedRec);
  
  // Sort by priority and confidence
  return sortRecommendations(recommendations);
}

// Helper: Filter recommendations for auto-execution
export function getAutoExecutableRecommendations(
  recommendations: Recommendation[],
  threshold: number = 80
): Recommendation[] {
  return recommendations.filter(
    r => r.confidenceScore >= threshold && r.suggestedAction.type === 'auto'
  );
}

// Helper: Filter recommendations for operator review
export function getReviewQueueRecommendations(
  recommendations: Recommendation[],
  threshold: number = 80
): Recommendation[] {
  return recommendations.filter(
    r => r.confidenceScore < threshold || r.suggestedAction.type === 'manual_review'
  );
}

// Helper: Get average confidence score
export function getAverageConfidence(recommendations: Recommendation[]): number {
  if (recommendations.length === 0) return 0;
  const sum = recommendations.reduce((acc, r) => acc + r.confidenceScore, 0);
  return Math.round(sum / recommendations.length);
}

// Helper: Get confidence trend distribution
export function getConfidenceDistribution(recommendations: Recommendation[]): {
  high: number;    // >= 80
  medium: number;  // 50-79
  low: number;     // < 50
} {
  return {
    high: recommendations.filter(r => r.confidenceScore >= 80).length,
    medium: recommendations.filter(r => r.confidenceScore >= 50 && r.confidenceScore < 80).length,
    low: recommendations.filter(r => r.confidenceScore < 50).length,
  };
}
