/**
 * Lib exports - Preference Learning System
 */

// Simplified Preference Service (new - recommended)
export {
  getUserPreferences,
  saveUserPreferences,
  storeFeedback,
  getUserFeedback,
  updatePreferenceModel,
  getDefaultPreferences,
  getCardType,
  DEFAULT_CARD_ORDER,
} from './preference-service';

export type {
  CardType,
  PreferenceModel as SimplePreferenceModel,
  SignalType as SimpleSignalType,
} from './preference-service';

// Preference Engine (legacy - kept for compatibility)
export {
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
} from './preference-engine';

export type {
  SignalType,
  LearnableFeature,
  FeatureWeights,
  UIConfig,
  PreferenceModel,
  FeedbackSignal,
  TrainingResult,
  BatchTrainingResult,
} from './preference-engine';

// Learning Scheduler
export {
  startLearningScheduler,
  stopLearningScheduler,
  runLearningNow,
  trainUserNow,
  retrainUserNow,
  getSchedulerStatus,
  getLearningHistory,
  getLatestOutcome,
  clearLearningHistory,
  shouldRunLearning,
  getLearningStats,
  useLearningScheduler,
} from './learning-scheduler';

export type {
  SchedulerConfig,
  LearningLogEntry,
} from './learning-scheduler';

// Suggestion Engine
export {
  getSuggestions,
  getSimilarUserRecommendations,
  getTrendingRecommendations,
  hasEnoughDataForSuggestions,
  useSuggestions,
} from './suggestion-engine';

export type {
  SuggestionType,
  ConfidenceLevel,
  Suggestion,
  KPIPrioritySuggestion,
  ObjectiveHighlightSuggestion,
  NotificationTimingSuggestion,
  SimilarUsersSuggestion,
  NextActionSuggestion,
  ContentRecommendation,
  AnySuggestion,
  SuggestionOptions,
} from './suggestion-engine';

// Learning Initialization
export {
  initLearningSystem,
  shutdownLearningSystem,
  isLearningInitialized,
  useLearningInit,
} from './learning-init';

// Supabase client
export { getSupabaseClient } from './supabase-client';

// Utils
export { cn } from './utils';
export { createInteractionLogger, getInteractionLogger } from './interaction-logger';
export type { InteractionEvent, InteractionBatch, LoggerConfig } from './interaction-logger';
