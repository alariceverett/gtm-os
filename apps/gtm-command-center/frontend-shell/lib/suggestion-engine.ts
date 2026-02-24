/**
 * Smart Suggestions Engine
 * 
 * Based on preference model, suggests:
 * - Which KPI to show first
 * - Which objectives to highlight
 * - Optimal notification timing
 * - "Users like you also view..." recommendations
 * 
 * Uses collaborative filtering and content-based recommendations.
 */

import { 
  PreferenceModel, 
  FeatureWeights, 
  UIConfig,
  getUserModel,
  LEARNABLE_FEATURES 
} from './preference-engine';
import { getSupabaseClient } from './supabase-client';

// Suggestion types
export type SuggestionType = 
  | 'kpi_priority'
  | 'objective_highlight'
  | 'notification_timing'
  | 'similar_users'
  | 'next_action'
  | 'content_recommendation';

// Suggestion confidence level
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Base suggestion interface
export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-1
  reason: string;
  action?: {
    label: string;
    handler?: () => void | Promise<void>;
    path?: string;
    icon?: string;
  };
  expiresAt?: Date;
}

// KPI priority suggestion
export interface KPIPrioritySuggestion extends Suggestion {
  type: 'kpi_priority';
  kpiOrder: string[];
  primaryKPI: string;
}

// Objective highlight suggestion
export interface ObjectiveHighlightSuggestion extends Suggestion {
  type: 'objective_highlight';
  objectiveIds: string[];
  priorityLevel: 'high' | 'medium' | 'low';
}

// Notification timing suggestion
export interface NotificationTimingSuggestion extends Suggestion {
  type: 'notification_timing';
  optimalHours: { start: number; end: number };
  timezone: string;
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  reason: string;
}

// Similar users recommendation
export interface SimilarUsersSuggestion extends Suggestion {
  type: 'similar_users';
  similarUserCount: number;
  popularFeatures: string[];
  trendingContent: string[];
}

// Next action prediction
export interface NextActionSuggestion extends Suggestion {
  type: 'next_action';
  action: {
    label: string;
    path: string;
    icon?: string;
    handler?: () => void | Promise<void>;
  };
  predictedOutcome: string;
}

// Content recommendation
export interface ContentRecommendation extends Suggestion {
  type: 'content_recommendation';
  contentType: 'report' | 'kpi' | 'objective' | 'insight';
  contentId: string;
  source: 'similar_users' | 'trending' | 'predicted_interest';
}

// Union type of all suggestions
export type AnySuggestion = 
  | KPIPrioritySuggestion 
  | ObjectiveHighlightSuggestion 
  | NotificationTimingSuggestion 
  | SimilarUsersSuggestion 
  | NextActionSuggestion 
  | ContentRecommendation;

// Suggestion request options
export interface SuggestionOptions {
  userId?: string;
  types?: SuggestionType[];
  limit?: number;
  minConfidence?: number;
  context?: {
    currentPage?: string;
    currentSection?: string;
    recentActions?: string[];
    timeOfDay?: number;
    dayOfWeek?: number;
  };
}

// User similarity score
interface UserSimilarity {
  userId: string;
  similarity: number; // 0-1
  sharedFeatures: string[];
}

// Trending item
interface TrendingItem {
  id: string;
  type: string;
  viewCount: number;
  uniqueUsers: number;
  trend: 'up' | 'down' | 'stable';
}

/**
 * Calculate confidence based on training data quality
 */
function calculateConfidence(model: PreferenceModel | null): ConfidenceLevel {
  if (!model) return 'low';
  
  const examples = model.training_examples || 0;
  const accuracy = model.prediction_accuracy || 0;
  
  // High confidence: many examples + decent accuracy
  if (examples >= 50 && accuracy >= 0.6) return 'high';
  
  // Medium confidence: some examples or good accuracy
  if (examples >= 20 || accuracy >= 0.5) return 'medium';
  
  return 'low';
}

/**
 * Calculate confidence score (0-1)
 */
function calculateConfidenceScore(model: PreferenceModel | null): number {
  if (!model) return 0;
  
  const examples = Math.min(model.training_examples || 0, 100) / 100;
  const accuracy = model.prediction_accuracy || 0;
  const featureCount = Object.keys(model.feature_weights || {}).length;
  const featureCoverage = Math.min(featureCount / 10, 1);
  
  // Weighted combination
  return (examples * 0.3) + (accuracy * 0.5) + (featureCoverage * 0.2);
}

/**
 * Generate KPI priority suggestion
 */
function generateKPIPrioritySuggestion(
  model: PreferenceModel | null,
  confidence: ConfidenceLevel,
  confidenceScore: number
): KPIPrioritySuggestion | null {
  if (!model?.ui_config?.kpi_priority) return null;
  
  const kpiOrder = model.ui_config.kpi_priority;
  if (kpiOrder.length === 0) return null;
  
  return {
    id: `kpi-${Date.now()}`,
    type: 'kpi_priority',
    title: 'Recommended KPI Order',
    description: `Based on your usage patterns, ${kpiOrder[0]} should be shown first.`,
    confidence,
    confidenceScore,
    reason: 'Learned from your dwell time and interaction patterns with different KPIs.',
    kpiOrder,
    primaryKPI: kpiOrder[0],
  };
}

/**
 * Generate objective highlight suggestion
 */
function generateObjectiveHighlightSuggestion(
  model: PreferenceModel | null,
  confidence: ConfidenceLevel,
  confidenceScore: number
): ObjectiveHighlightSuggestion | null {
  if (!model?.feature_weights) return null;
  
  // Find high-weight objective features
  const objectiveFeatures = Object.entries(model.feature_weights)
    .filter(([key, weight]) => key.startsWith('objective:') && weight > 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (objectiveFeatures.length === 0) return null;
  
  const objectiveIds = objectiveFeatures.map(([key]) => key.replace('objective:', ''));
  const avgWeight = objectiveFeatures.reduce((sum, [, w]) => sum + w, 0) / objectiveFeatures.length;
  
  return {
    id: `obj-${Date.now()}`,
    type: 'objective_highlight',
    title: 'Objectives You Care About',
    description: `${objectiveIds.length} objectives match your interests based on positive feedback.`,
    confidence,
    confidenceScore,
    reason: 'Detected from your explicit positive feedback and dwell time on specific objectives.',
    objectiveIds,
    priorityLevel: avgWeight > 0.6 ? 'high' : avgWeight > 0.4 ? 'medium' : 'low',
  };
}

/**
 * Generate notification timing suggestion
 */
function generateNotificationTimingSuggestion(
  model: PreferenceModel | null,
  confidence: ConfidenceLevel,
  confidenceScore: number
): NotificationTimingSuggestion | null {
  if (!model?.ui_config?.notification_timing) return null;
  
  const timing = model.ui_config.notification_timing;
  const frequency = model.ui_config.notification_frequency || 'daily';
  
  return {
    id: `notif-${Date.now()}`,
    type: 'notification_timing',
    title: 'Optimal Notification Schedule',
    description: `Notifications set to ${frequency} during ${timing.start}:00-${timing.end}:00 ${timing.timezone}.`,
    confidence,
    confidenceScore,
    reason: 'Learned from when you typically engage with the dashboard.',
    optimalHours: { start: timing.start, end: timing.end },
    timezone: timing.timezone,
    frequency,
  };
}

/**
 * Find similar users based on feature weights
 */
async function findSimilarUsers(
  userId: string,
  model: PreferenceModel | null,
  limit: number = 10
): Promise<UserSimilarity[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !model?.feature_weights) return [];
  
  try {
    // Get all other users' models
    const { data, error } = await supabase
      .from('preference_models')
      .select('user_id, feature_weights')
      .neq('user_id', userId)
      .limit(50);
    
    if (error || !data) return [];
    
    const myFeatures = (model as PreferenceModel | null)?.feature_weights || {};
    const similarities: UserSimilarity[] = [];
    
    for (const other of data as any[]) {
      const otherFeatures = (other.feature_weights as FeatureWeights) || {};
      
      // Calculate cosine similarity
      const allFeatures = new Set([...Object.keys(myFeatures), ...Object.keys(otherFeatures)]);
      let dotProduct = 0;
      let myMagnitude = 0;
      let otherMagnitude = 0;
      
      const sharedFeatures: string[] = [];
      
      for (const feature of allFeatures) {
        const myWeight = myFeatures[feature] || 0;
        const otherWeight = otherFeatures[feature] || 0;
        
        dotProduct += myWeight * otherWeight;
        myMagnitude += myWeight * myWeight;
        otherMagnitude += otherWeight * otherWeight;
        
        if (myWeight > 0.3 && otherWeight > 0.3) {
          sharedFeatures.push(feature);
        }
      }
      
      const magnitude = Math.sqrt(myMagnitude) * Math.sqrt(otherMagnitude);
      const similarity = magnitude > 0 ? dotProduct / magnitude : 0;
      
      if (similarity > 0.3) { // Minimum similarity threshold
        similarities.push({
          userId: (other as any).user_id,
          similarity,
          sharedFeatures,
        });
      }
    }
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
      
  } catch {
    return [];
  }
}

/**
 * Generate similar users suggestion
 */
async function generateSimilarUsersSuggestion(
  userId: string,
  model: PreferenceModel | null,
  confidence: ConfidenceLevel,
  confidenceScore: number
): Promise<SimilarUsersSuggestion | null> {
  const similarUsers = await findSimilarUsers(userId, model);
  
  if (similarUsers.length === 0) return null;
  
  // Aggregate popular features from similar users
  const featureFrequency: Record<string, number> = {};
  for (const user of similarUsers) {
    for (const feature of user.sharedFeatures) {
      featureFrequency[feature] = (featureFrequency[feature] || 0) + user.similarity;
    }
  }
  
  const popularFeatures = Object.entries(featureFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([f]) => f);
  
  return {
    id: `similar-${Date.now()}`,
    type: 'similar_users',
    title: 'Users Like You Also View',
    description: `${similarUsers.length} users with similar interests are engaging with different content.`,
    confidence,
    confidenceScore,
    reason: `Calculated cosine similarity against ${similarUsers.length} users with shared interests.`,
    similarUserCount: similarUsers.length,
    popularFeatures,
    trendingContent: popularFeatures.slice(0, 3),
  };
}

/**
 * Get trending content
 */
async function getTrendingContent(limit: number = 10): Promise<TrendingItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  
  try {
    // Get recent dwell time data
    const { data, error } = await supabase
      .from('dwell_time_sessions')
      .select('page, section, user_id, duration_seconds')
      .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('duration_seconds', { ascending: false })
      .limit(200);
    
    if (error || !data) return [];
    
    // Aggregate by content
    const contentMap: Record<string, { views: number; users: Set<string>; duration: number }> = {};
    
    for (const item of data as any[]) {
      const key = `${item.page}${item.section ? `/${item.section}` : ''}`;
      
      if (!contentMap[key]) {
        contentMap[key] = { views: 0, users: new Set(), duration: 0 };
      }
      
      contentMap[key].views++;
      contentMap[key].users.add(item.user_id);
      contentMap[key].duration += item.duration_seconds || 0;
    }
    
    return Object.entries(contentMap)
      .map(([id, stats]): TrendingItem => ({
        id,
        type: id.includes('/') ? 'section' : 'page',
        viewCount: stats.views,
        uniqueUsers: stats.users.size,
        trend: stats.views > 10 ? 'up' : 'stable',
      }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);
      
  } catch {
    return [];
  }
}

/**
 * Generate next action suggestion based on patterns
 */
function generateNextActionSuggestion(
  model: PreferenceModel | null,
  context: SuggestionOptions['context'],
  confidence: ConfidenceLevel,
  confidenceScore: number
): NextActionSuggestion | null {
  if (!model?.feature_weights) return null;
  
  // Find most engaged page
  const pageWeights = Object.entries(model.feature_weights)
    .filter(([key]) => key.startsWith('page:'))
    .sort((a, b) => b[1] - a[1]);
  
  if (pageWeights.length === 0) return null;
  
  const [topPage] = pageWeights[0];
  const pagePath = topPage.replace('page:', '');
  
  // Don't suggest current page
  if (context?.currentPage === pagePath) {
    // Try second choice
    if (pageWeights.length > 1) {
      const [, secondWeight] = pageWeights[1];
      if (secondWeight > 0.2) {
        return {
          id: `next-${Date.now()}`,
          type: 'next_action',
          title: 'Suggested Next Step',
          description: `Based on your patterns, you often navigate to ${pageWeights[1][0].replace('page:', '')} next.`,
          confidence,
          confidenceScore,
          reason: `Detected sequence pattern from your navigation history.${context?.recentActions ? ` Recent actions: ${context.recentActions.slice(-3).join(' → ')}` : ''}`,
          action: {
            label: `Go to ${pageWeights[1][0].replace('page:', '')}`,
            path: pageWeights[1][0].replace('page:', ''),
            icon: '→',
          },
          predictedOutcome: 'Continue productive workflow based on past behavior.',
        };
      }
    }
    return null;
  }
  
  return {
    id: `next-${Date.now()}`,
    type: 'next_action',
    title: 'Recommended Action',
    description: `You spend the most time on ${pagePath}. Open it now?`,
    confidence,
    confidenceScore,
    reason: 'Learned from your dwell time patterns across different pages.',
    action: {
      label: `Open ${pagePath}`,
      path: pagePath,
      icon: '→',
    },
    predictedOutcome: 'Quick access to your most-used content.',
  };
}

/**
 * Generate content recommendations
 */
async function generateContentRecommendations(
  userId: string,
  model: PreferenceModel | null,
  limit: number,
  trending: TrendingItem[]
): Promise<ContentRecommendation[]> {
  const recommendations: ContentRecommendation[] = [];
  const confidence = calculateConfidence(model);
  const confidenceScore = calculateConfidenceScore(model);
  
  // Get user's feature weights
  const interests = Object.entries(model?.feature_weights || {})
    .filter(([, weight]) => weight > 0.2)
    .map(([feature]) => feature);
  
  // Recommend trending content that matches interests
  for (const item of trending) {
    const matchesInterest = interests.some(i => 
      item.id.toLowerCase().includes(i.toLowerCase())
    );
    
    if (matchesInterest) {
      recommendations.push({
        id: `rec-${item.id}-${Date.now()}`,
        type: 'content_recommendation',
        title: 'Trending for You',
        description: `${item.id} is trending and matches your interests.`,
        confidence,
        confidenceScore: confidenceScore * 0.8,
        reason: 'Trending content aligned with your preferences.',
        contentType: item.type === 'page' ? 'report' : 'insight',
        contentId: item.id,
        source: 'trending',
      });
    }
  }
  
  // Fill with similar user recommendations if needed
  if (recommendations.length < limit) {
    const similarUsers = await findSimilarUsers(userId, model, 5);
    
    for (const user of similarUsers.slice(0, limit - recommendations.length)) {
      const topFeature = user.sharedFeatures[0];
      if (topFeature) {
        recommendations.push({
          id: `rec-sim-${user.userId}-${Date.now()}`,
          type: 'content_recommendation',
          title: 'Popular with Similar Users',
          description: `Users like you are interested in ${topFeature}.`,
          confidence,
          confidenceScore: confidenceScore * user.similarity,
          reason: `Calculated ${(user.similarity * 100).toFixed(0)}% similarity with engaged users.`,
          contentType: topFeature.startsWith('page:') ? 'report' : 'kpi',
          contentId: topFeature,
          source: 'similar_users',
        });
      }
    }
  }
  
  return recommendations.slice(0, limit);
}

/**
 * Get personalized suggestions for a user
 */
export async function getSuggestions(
  options: SuggestionOptions = {}
): Promise<AnySuggestion[]> {
  const {
    userId: providedUserId,
    types,
    limit = 5,
    minConfidence = 0,
    context,
  } = options;
  
  // Get user ID
  const userId = providedUserId || (typeof window !== 'undefined' 
    ? localStorage.getItem('personalization_user_id') || 'anonymous'
    : 'anonymous');
  
  // Fetch model
  const model = await getUserModel(userId);
  
  const confidence = calculateConfidence(model);
  const confidenceScore = calculateConfidenceScore(model);
  
  // Filter by minimum confidence
  if (confidenceScore < minConfidence) {
    return [];
  }
  
  const suggestions: AnySuggestion[] = [];
  const requestTypes = types || [
    'kpi_priority',
    'objective_highlight',
    'notification_timing',
    'similar_users',
    'next_action',
  ];
  
  // Generate KPI priority suggestion
  if (requestTypes.includes('kpi_priority')) {
    const suggestion = generateKPIPrioritySuggestion(model, confidence, confidenceScore);
    if (suggestion) suggestions.push(suggestion);
  }
  
  // Generate objective highlight suggestion
  if (requestTypes.includes('objective_highlight')) {
    const suggestion = generateObjectiveHighlightSuggestion(model, confidence, confidenceScore);
    if (suggestion) suggestions.push(suggestion);
  }
  
  // Generate notification timing suggestion
  if (requestTypes.includes('notification_timing')) {
    const suggestion = generateNotificationTimingSuggestion(model, confidence, confidenceScore);
    if (suggestion) suggestions.push(suggestion);
  }
  
  // Generate similar users suggestion
  if (requestTypes.includes('similar_users')) {
    const suggestion = await generateSimilarUsersSuggestion(userId, model, confidence, confidenceScore);
    if (suggestion) suggestions.push(suggestion);
  }
  
  // Generate next action suggestion
  if (requestTypes.includes('next_action')) {
    const suggestion = generateNextActionSuggestion(model, context, confidence, confidenceScore);
    if (suggestion) suggestions.push(suggestion);
  }
  
  // Generate content recommendations
  if (requestTypes.includes('content_recommendation')) {
    const trending = await getTrendingContent(20);
    const recs = await generateContentRecommendations(userId, model, limit, trending);
    suggestions.push(...recs);
  }
  
  // Sort by confidence and limit
  return suggestions
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, limit);
}

/**
 * Get "Users like you also view" recommendations
 */
export async function getSimilarUserRecommendations(
  userId?: string,
  limit: number = 5
): Promise<string[]> {
  const uid = userId || (typeof window !== 'undefined' 
    ? localStorage.getItem('personalization_user_id') || 'anonymous'
    : 'anonymous');
  
  const model = await getUserModel(uid);
  const similarUsers = await findSimilarUsers(uid, model, 20);
  
  if (similarUsers.length === 0) return [];
  
  // Aggregate features from similar users that this user doesn't have
  const myFeatures = new Set(Object.keys(model?.feature_weights || {}));
  const recommendations: Array<{ feature: string; score: number }> = [];
  
  for (const user of similarUsers) {
    for (const feature of user.sharedFeatures) {
      if (!myFeatures.has(feature)) {
        const existing = recommendations.find(r => r.feature === feature);
        if (existing) {
          existing.score += user.similarity;
        } else {
          recommendations.push({ feature, score: user.similarity });
        }
      }
    }
  }
  
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.feature);
}

/**
 * Get trending content recommendations
 */
export async function getTrendingRecommendations(
  limit: number = 5
): Promise<TrendingItem[]> {
  return getTrendingContent(limit);
}

/**
 * Check if user has enough data for suggestions
 */
export function hasEnoughDataForSuggestions(
  model: PreferenceModel | null,
  minExamples: number = 10
): boolean {
  if (!model) return false;
  return (model.training_examples || 0) >= minExamples;
}

/**
 * React hook for getting suggestions
 */
export function useSuggestions(options: SuggestionOptions = {}) {
  const [suggestions, setSuggestions] = useState<AnySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await getSuggestions(options);
        if (!cancelled) {
          setSuggestions(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load suggestions');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    
    load();
    
    return () => { cancelled = true; };
  }, [
    options.userId,
    options.limit,
    options.minConfidence,
    JSON.stringify(options.types),
    JSON.stringify(options.context),
  ]);
  
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSuggestions({ ...options, forceRefresh: true } as any);
      setSuggestions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, [options]);
  
  return { suggestions, isLoading, error, refresh };
}

// Import React for hook
import { useState, useEffect, useCallback } from 'react';

export default {
  getSuggestions,
  getSimilarUserRecommendations,
  getTrendingRecommendations,
  hasEnoughDataForSuggestions,
  calculateConfidence,
  calculateConfidenceScore,
  useSuggestions,
};
