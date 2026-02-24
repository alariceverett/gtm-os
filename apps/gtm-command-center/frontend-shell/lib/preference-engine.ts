/**
 * Preference Engine
 * 
 * Trains user preference models from feedback signals.
 * Calculates feature weights based on:
 * - explicit_positive (+1.0)
 * - explicit_negative (-1.0)
 * - implicit_dwell (+0.5)
 * - implicit_skip (-0.3)
 * - override_taken (+0.8)
 * 
 * Updates preference_models table with learned weights.
 */

import { getSupabaseClient } from './supabase-client';

// Signal weights for scoring algorithm
export const SIGNAL_WEIGHTS = {
  explicit_positive: 1.0,
  explicit_negative: -1.0,
  implicit_dwell: 0.5,
  implicit_skip: -0.3,
  override_taken: 0.8,
  command_issued: 0.3,
  question_asked: 0.2,
} as const;

export type SignalType = keyof typeof SIGNAL_WEIGHTS;

// Feature categories that can be learned
export const LEARNABLE_FEATURES = [
  'dashboard_card_order',
  'default_time_range',
  'notification_frequency',
  'notification_timing',
  'kpi_priority',
  'objective_visibility',
  'theme_preference',
  'content_density',
  'auto_refresh',
] as const;

export type LearnableFeature = typeof LEARNABLE_FEATURES[number];

// Feature weights structure
export interface FeatureWeights {
  [feature: string]: number;
}

// UI configuration preferences
export interface UIConfig {
  dashboard_card_order?: string[];
  default_time_range?: '7d' | '30d' | '90d' | 'custom';
  notification_frequency?: 'realtime' | 'hourly' | 'daily' | 'weekly';
  notification_timing?: { start: number; end: number; timezone: string };
  kpi_priority?: string[];
  objective_visibility?: Record<string, boolean>;
  theme_preference?: 'light' | 'dark' | 'system';
  content_density?: 'compact' | 'comfortable' | 'spacious';
  auto_refresh?: boolean;
}

// Preference model structure
export interface PreferenceModel {
  user_id: string;
  model_version: number;
  feature_weights: FeatureWeights;
  ui_config: UIConfig;
  prediction_accuracy: number;
  training_examples: number;
  last_updated: string;
  created_at: string;
}

// Raw feedback signal from database
export interface FeedbackSignal {
  id: string;
  user_id: string;
  timestamp: string;
  signal_type: SignalType;
  context: {
    page?: string;
    section?: string;
    feature?: string;
    previous_actions?: string[];
    ui_state?: Record<string, any>;
    [key: string]: any;
  };
  content?: string;
  outcome?: Record<string, any>;
  learning_weight: number;
}

// Training result
export interface TrainingResult {
  success: boolean;
  userId: string;
  signalsProcessed: number;
  featuresUpdated: string[];
  modelVersion: number;
  accuracy: number;
  message: string;
}

// Batch training result
export interface BatchTrainingResult {
  totalUsers: number;
  processed: number;
  failed: number;
  results: TrainingResult[];
}

/**
 * Get unprocessed feedback signals for a user
 */
export async function getUnprocessedSignals(
  userId: string,
  limit: number = 100
): Promise<FeedbackSignal[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  const { data, error } = await supabase
    .from('feedback_signals')
    .select('*')
    .eq('user_id', userId)
    .eq('processed', false)
    .order('timestamp', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch signals: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all feedback signals for a user (for retraining)
 */
export async function getAllUserSignals(
  userId: string,
  since?: Date
): Promise<FeedbackSignal[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client not available');
  }

  let query = supabase
    .from('feedback_signals')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (since) {
    query = query.gte('timestamp', since.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch signals: ${error.message}`);
  }

  return data || [];
}

/**
 * Calculate feature weights from signals using weighted scoring
 */
export function calculateFeatureWeights(
  signals: FeedbackSignal[],
  existingWeights: FeatureWeights = {}
): FeatureWeights {
  const weights: FeatureWeights = { ...existingWeights };
  const featureCounts: Record<string, { positive: number; negative: number; total: number }> = {};

  // Aggregate scores by feature
  for (const signal of signals) {
    const baseWeight = SIGNAL_WEIGHTS[signal.signal_type] || 0;
    const weightedScore = baseWeight * (signal.learning_weight || 1.0);
    
    // Extract features from context
    const features = extractFeaturesFromSignal(signal);
    
    for (const feature of features) {
      if (!featureCounts[feature]) {
        featureCounts[feature] = { positive: 0, negative: 0, total: 0 };
      }
      
      featureCounts[feature].total += 1;
      if (weightedScore > 0) {
        featureCounts[feature].positive += weightedScore;
      } else {
        featureCounts[feature].negative += Math.abs(weightedScore);
      }
      
      // Update running average with exponential decay
      const currentWeight = weights[feature] || 0;
      const alpha = 0.3; // Learning rate
      weights[feature] = currentWeight + alpha * (weightedScore - currentWeight);
    }
  }

  // Normalize weights to [-1, 1] range
  for (const feature in weights) {
    weights[feature] = Math.max(-1, Math.min(1, weights[feature]));
  }

  return weights;
}

/**
 * Extract relevant features from a feedback signal
 */
function extractFeaturesFromSignal(signal: FeedbackSignal): string[] {
  const features: string[] = [];
  const context = signal.context || {};

  // Page/section based features
  if (context.page) {
    features.push(`page:${context.page}`);
  }
  if (context.section) {
    features.push(`section:${context.section}`);
  }
  if (context.feature) {
    features.push(`feature:${context.feature}`);
  }

  // Signal type feature
  features.push(`signal:${signal.signal_type}`);

  // Content-based features (if available)
  if (signal.content) {
    const contentKeywords = extractKeywords(signal.content);
    features.push(...contentKeywords.map(k => `content:${k}`));
  }

  // Outcome-based features
  if (signal.outcome) {
    for (const key of Object.keys(signal.outcome)) {
      features.push(`outcome:${key}`);
    }
  }

  return features;
}

/**
 * Extract keywords from text content
 */
function extractKeywords(text: string): string[] {
  const keywords = text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !STOPWORDS.includes(word));
  
  // Return unique keywords
  return [...new Set(keywords)].slice(0, 5);
}

const STOPWORDS = [
  'about', 'above', 'after', 'again', 'against', 'all', 'and', 'any', 'are', 'because',
  'before', 'being', 'below', 'between', 'both', 'but', 'can', 'did', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'how', 'into', 'its',
  'itself', 'more', 'most', 'myself', 'nor', 'once', 'only', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'same', 'she', 'should', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'too', 'under', 'until', 'very', 'was', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with',
  'would', 'you', 'your', 'yours', 'yourself', 'yourselves',
];

/**
 * Generate UI config from feature weights
 */
export function generateUIConfig(
  weights: FeatureWeights,
  existingConfig: UIConfig = {}
): UIConfig {
  const config: UIConfig = { ...existingConfig };

  // Determine dashboard card order based on weights
  const pageWeights: Record<string, number> = {};
  for (const [feature, weight] of Object.entries(weights)) {
    if (feature.startsWith('page:')) {
      const page = feature.replace('page:', '');
      pageWeights[page] = weight;
    }
  }
  
  // Sort pages by weight
  const sortedPages = Object.entries(pageWeights)
    .sort((a, b) => b[1] - a[1])
    .map(([page]) => page);
  
  if (sortedPages.length > 0) {
    config.dashboard_card_order = sortedPages;
  }

  // Determine default time range based on dwell patterns
  const hasLongDwell = Object.entries(weights).some(
    ([f, w]) => f.includes('time_range') && w > 0.3
  );
  if (hasLongDwell && !config.default_time_range) {
    config.default_time_range = '30d';
  }

  // Notification frequency based on engagement
  const engagementScore = Object.values(weights).reduce((a, b) => a + b, 0) / 
    (Object.values(weights).length || 1);
  
  if (!config.notification_frequency) {
    if (engagementScore > 0.5) {
      config.notification_frequency = 'realtime';
    } else if (engagementScore > 0) {
      config.notification_frequency = 'daily';
    } else {
      config.notification_frequency = 'weekly';
    }
  }

  return config;
}

/**
 * Train preference model for a single user
 */
export async function trainUserModel(
  userId: string,
  options: {
    retrain?: boolean;
    since?: Date;
  } = {}
): Promise<TrainingResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      userId,
      signalsProcessed: 0,
      featuresUpdated: [],
      modelVersion: 0,
      accuracy: 0,
      message: 'Supabase client not available',
    };
  }

  try {
    // Fetch existing model
    const { data: existingModelRaw } = await supabase
      .from('preference_models')
      .select('*')
      .eq('user_id', userId)
      .single();

    const existingModel = existingModelRaw as PreferenceModel | null;

    // Get signals to process
    const signals = options.retrain
      ? await getAllUserSignals(userId, options.since)
      : await getUnprocessedSignals(userId);

    if (signals.length === 0) {
      return {
        success: true,
        userId,
        signalsProcessed: 0,
        featuresUpdated: [],
        modelVersion: existingModel?.model_version || 1,
        accuracy: existingModel?.prediction_accuracy || 0,
        message: 'No new signals to process',
      };
    }

    // Calculate new weights
    const existingWeights = existingModel?.feature_weights || {};
    const newWeights = calculateFeatureWeights(signals, existingWeights);

    // Generate updated UI config
    const existingConfig = existingModel?.ui_config || {};
    const newConfig = generateUIConfig(newWeights, existingConfig);

    // Calculate accuracy (simplified)
    const positiveSignals = signals.filter(s => 
      SIGNAL_WEIGHTS[s.signal_type] > 0
    ).length;
    const accuracy = signals.length > 0 ? positiveSignals / signals.length : 0;

    // Update or insert model
    const modelData = {
      user_id: userId,
      model_version: ((existingModel as PreferenceModel | null)?.model_version || 0) + 1,
      feature_weights: newWeights,
      ui_config: newConfig,
      prediction_accuracy: accuracy,
      training_examples: ((existingModel as PreferenceModel | null)?.training_examples || 0) + signals.length,
      last_updated: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('preference_models')
      .upsert(modelData as any, { onConflict: 'user_id' });

    if (upsertError) {
      throw new Error(`Failed to update model: ${upsertError.message}`);
    }

    // Mark signals as processed
    const signalIds = signals.map(s => s.id);
    const updateData: { processed: boolean } = { processed: true };
    const { error: updateError } = await supabase
      .from('feedback_signals')
      // @ts-ignore - Supabase type limitation
      .update(updateData)
      .in('id', signalIds);

    if (updateError) {
      console.warn('Failed to mark signals as processed:', updateError);
    }

    return {
      success: true,
      userId,
      signalsProcessed: signals.length,
      featuresUpdated: Object.keys(newWeights),
      modelVersion: modelData.model_version,
      accuracy,
      message: `Successfully trained model with ${signals.length} signals`,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      userId,
      signalsProcessed: 0,
      featuresUpdated: [],
      modelVersion: 0,
      accuracy: 0,
      message,
    };
  }
}

/**
 * Train models for multiple users in batch
 */
export async function trainBatchModels(
  userIds?: string[],
  options: {
    batchSize?: number;
  } = {}
): Promise<BatchTrainingResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      totalUsers: 0,
      processed: 0,
      failed: 0,
      results: [],
    };
  }

  try {
    // Get users with unprocessed signals if no specific userIds provided
    let targetUserIds = userIds;
    if (!targetUserIds) {
      const { data } = await supabase
        .from('feedback_signals')
        .select('user_id')
        .eq('processed', false)
        .limit(options.batchSize || 100);

      targetUserIds = [...new Set((data as any[])?.map(d => d.user_id) || [])];
    }

    const results: TrainingResult[] = [];
    let failed = 0;

    // Process each user
    for (const userId of targetUserIds) {
      const result = await trainUserModel(userId);
      results.push(result);
      if (!result.success) {
        failed++;
      }
    }

    return {
      totalUsers: targetUserIds.length,
      processed: targetUserIds.length - failed,
      failed,
      results,
    };

  } catch (error) {
    return {
      totalUsers: 0,
      processed: 0,
      failed: 0,
      results: [{
        success: false,
        userId: 'batch',
        signalsProcessed: 0,
        featuresUpdated: [],
        modelVersion: 0,
        accuracy: 0,
        message: error instanceof Error ? error.message : 'Batch training failed',
      }],
    };
  }
}

/**
 * Get user's preference model
 */
export async function getUserModel(userId: string): Promise<PreferenceModel | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('preference_models')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  return data as PreferenceModel;
}

/**
 * Get feature weight for a specific feature
 */
export function getFeatureWeight(
  model: PreferenceModel | null,
  feature: string
): number {
  if (!model?.feature_weights) return 0;
  return model.feature_weights[feature] || 0;
}

/**
 * Check if model needs retraining (stale data)
 */
export function isModelStale(model: PreferenceModel | null, maxAgeHours: number = 24): boolean {
  if (!model?.last_updated) return true;
  
  const lastUpdate = new Date(model.last_updated);
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  
  return Date.now() - lastUpdate.getTime() > maxAge;
}

export default {
  SIGNAL_WEIGHTS,
  LEARNABLE_FEATURES,
  trainUserModel,
  trainBatchModels,
  getUserModel,
  getUnprocessedSignals,
  calculateFeatureWeights,
  generateUIConfig,
  getFeatureWeight,
  isModelStale,
};
