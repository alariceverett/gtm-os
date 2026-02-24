/**
 * API Data Fetching Hooks
 * 
 * This module exports data fetching hooks with caching, error handling, and refresh:
 * 
 * ```tsx
 * import { useKpis, useTasks, useIntelligence, useDataFetch } from '@/app/hooks';
 * ```
 */

// Generic data fetching with caching and intervals
export { useDataFetch, formatLastUpdated, isDataStale } from './use-data-fetch';
export type { UseDataFetchOptions, UseDataFetchResult } from './use-data-fetch';

// KPI data fetching
export { useKpis, useKpisWithFallback, calculateHealthStatus, getMockKpiData } from './use-kpis';
export type { KpiCard, LifecycleStage, LifecycleSummary, CampaignSummary, KpiData, KpiAggregate } from './use-kpis';

// Tasks/Objectives data fetching
export { 
  useTasks, 
  sortTasksByPriority, 
  getTaskStatusColorClass,
  getTaskStatusColor,
  getTaskProgress,
  formatTaskPriority,
  getPriorityColorClass 
} from './use-tasks';
export type { OperatorTask, OperatorStatus } from './use-tasks';

// Intelligence/Relationships data fetching
export { useIntelligence } from './use-intelligence';
export type { RelationshipIntelligence } from './use-intelligence';

// Voice input
export { useVoiceInput } from './use-voice-input';

// Simple Trend Forecasting
export { useSimpleForecast } from './use-simple-forecast';
export type { SimpleForecastResult, KpiTrend } from '@/lib/predictions/simple-forecast';

// Predictions & Anomaly Detection
export {
  useKpiForecasts,
  useAnomalies,
  useRiskScores,
  useAllPredictions
} from './use-predictions';
export type {
  ForecastResult,
  ForecastResponse,
  AnomalyResult,
  DealRiskScore,
  RiskResponse
} from '@/lib/predictions/types';

// Personalization & User Preferences
export { useCardOrder, useFeedbackRecorder } from './use-personalization';
export type { UseCardOrderResult, UseFeedbackRecorderResult } from './use-personalization';

// Intelligence Bridge (Phase 3)
export { useIntelligenceStream } from './use-intelligence-bridge';
export type { 
  UseIntelligenceBridgeResult, 
  ActionItem, 
  IntelligenceStreamState 
} from './use-intelligence-bridge';

// Autonomy Layer (Phase 4)
export { 
  useAutonomyMetrics, 
  useAutonomousTasks, 
  useSelfHealingEvents,
  formatAutonomyTime,
  getOverrideRateColor,
  getHealingStatusColor,
  getTaskTypeIcon,
  formatHealingStrategy,
  formatDuration,
} from './use-autonomy';
export type { 
  AutonomyMetricsResult, 
  AutonomousTasksResult, 
  SelfHealingResult 
} from './use-autonomy';
export type { AutonomyMetrics, AutonomousTask, HealingEvent } from '@/lib/autonomy/types';
