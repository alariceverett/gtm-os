/**
 * Learning Pipeline Scheduler
 * 
 * - Processes unprocessed feedback every 5 minutes
 * - Batch updates preference models
 * - Logs learning outcomes
 * - Triggers UI refresh recommendations
 * 
 * Can run in browser (client-side) or be adapted for server-side use.
 */

import { 
  trainBatchModels, 
  TrainingResult, 
  BatchTrainingResult,
  trainUserModel 
} from './preference-engine';
import { getSupabaseClient } from './supabase-client';

// Scheduler configuration
export interface SchedulerConfig {
  /** Interval between runs in milliseconds (default: 5 minutes) */
  intervalMs?: number;
  /** Maximum signals to process per batch (default: 100) */
  batchSize?: number;
  /** Enable/disable logging (default: true) */
  enableLogging?: boolean;
  /** Callback when learning completes */
  onLearningComplete?: (result: BatchTrainingResult) => void;
  /** Callback when UI refresh is recommended */
  onUIRefreshRecommended?: (userIds: string[]) => void;
}

// Learning outcome log entry
export interface LearningLogEntry {
  id: string;
  timestamp: string;
  runType: 'scheduled' | 'manual' | 'on-demand';
  durationMs: number;
  signalsProcessed: number;
  usersTrained: number;
  usersFailed: number;
  accuracy: number;
  details: BatchTrainingResult;
}

// Scheduler state
interface SchedulerState {
  isRunning: boolean;
  lastRun: number | null;
  nextRun: number | null;
  totalRuns: number;
  totalSignalsProcessed: number;
  timerId: NodeJS.Timeout | null;
  learningHistory: LearningLogEntry[];
}

// Default configuration
const DEFAULT_CONFIG: Required<SchedulerConfig> = {
  intervalMs: 5 * 60 * 1000, // 5 minutes
  batchSize: 100,
  enableLogging: true,
  onLearningComplete: () => {},
  onUIRefreshRecommended: () => {},
};

// Scheduler state (module-level singleton)
const state: SchedulerState = {
  isRunning: false,
  lastRun: null,
  nextRun: null,
  totalRuns: 0,
  totalSignalsProcessed: 0,
  timerId: null,
  learningHistory: [],
};

// LocalStorage keys
const STORAGE_KEY_STATE = 'learning_scheduler_state';
const STORAGE_KEY_LOGS = 'learning_scheduler_logs';
const MAX_LOG_ENTRIES = 100;

/**
 * Load persisted state from localStorage
 */
function loadPersistedState(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY_STATE);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.lastRun = parsed.lastRun;
      state.totalRuns = parsed.totalRuns || 0;
      state.totalSignalsProcessed = parsed.totalSignalsProcessed || 0;
    }
    
    const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    if (savedLogs) {
      state.learningHistory = JSON.parse(savedLogs);
    }
  } catch (error) {
    console.warn('Failed to load scheduler state:', error);
  }
}

/**
 * Save state to localStorage
 */
function savePersistedState(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify({
      lastRun: state.lastRun,
      totalRuns: state.totalRuns,
      totalSignalsProcessed: state.totalSignalsProcessed,
    }));
    
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(
      state.learningHistory.slice(-MAX_LOG_ENTRIES)
    ));
  } catch (error) {
    console.warn('Failed to save scheduler state:', error);
  }
}

/**
 * Log learning outcome
 */
function logOutcome(entry: LearningLogEntry, enableLogging: boolean): void {
  if (!enableLogging) return;
  
  state.learningHistory.push(entry);
  
  // Keep only recent entries
  if (state.learningHistory.length > MAX_LOG_ENTRIES) {
    state.learningHistory = state.learningHistory.slice(-MAX_LOG_ENTRIES);
  }
  
  savePersistedState();
  
  // Console logging
  console.log('[LearningScheduler]', {
    type: entry.runType,
    users: entry.usersTrained,
    signals: entry.signalsProcessed,
    accuracy: `${(entry.accuracy * 100).toFixed(1)}%`,
    duration: `${entry.durationMs}ms`,
  });
}

/**
 * Get users who need UI refresh recommendation
 */
async function getUsersNeedingUIRefresh(result: BatchTrainingResult): Promise<string[]> {
  const refreshThreshold = 0.2; // 20% accuracy improvement triggers refresh
  const userIds: string[] = [];
  
  for (const r of result.results) {
    // Check for significant improvement
    const model = r.modelVersion > 1 ? await import('./preference-engine').then(m => m.getUserModel(r.userId)) : null;
    
    if (model) {
      const accuracyDiff = r.accuracy - (model.prediction_accuracy || 0);
      if (accuracyDiff > refreshThreshold || r.signalsProcessed > 10) {
        userIds.push(r.userId);
      }
    }
  }
  
  return userIds;
}

/**
 * Run the learning pipeline
 */
async function runLearningPipeline(
  config: Required<SchedulerConfig>,
  runType: LearningLogEntry['runType'] = 'scheduled'
): Promise<BatchTrainingResult> {
  const startTime = Date.now();
  
  try {
    // Run batch training
    const result = await trainBatchModels(undefined, {
      batchSize: config.batchSize,
    });
    
    const durationMs = Date.now() - startTime;
    
    // Calculate average accuracy
    const avgAccuracy = result.results.length > 0 
      ? result.results.reduce((sum, r) => sum + r.accuracy, 0) / result.results.length 
      : 0;
    
    // Update state
    state.lastRun = Date.now();
    state.totalRuns++;
    state.totalSignalsProcessed += result.results.reduce((sum, r) => sum + r.signalsProcessed, 0);
    
    // Create log entry
    const entry: LearningLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      runType,
      durationMs,
      signalsProcessed: result.results.reduce((sum, r) => sum + r.signalsProcessed, 0),
      usersTrained: result.processed,
      usersFailed: result.failed,
      accuracy: avgAccuracy,
      details: result,
    };
    
    logOutcome(entry, config.enableLogging);
    
    // Check for UI refresh recommendations
    const refreshUsers = await getUsersNeedingUIRefresh(result);
    if (refreshUsers.length > 0) {
      config.onUIRefreshRecommended(refreshUsers);
    }
    
    // Notify completion
    config.onLearningComplete(result);
    
    return result;
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorResult: BatchTrainingResult = {
      totalUsers: 0,
      processed: 0,
      failed: 1,
      results: [{
        success: false,
        userId: 'pipeline',
        signalsProcessed: 0,
        featuresUpdated: [],
        modelVersion: 0,
        accuracy: 0,
        message: error instanceof Error ? error.message : 'Pipeline error',
      }],
    };
    
    const entry: LearningLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      runType,
      durationMs,
      signalsProcessed: 0,
      usersTrained: 0,
      usersFailed: 1,
      accuracy: 0,
      details: errorResult,
    };
    
    logOutcome(entry, config.enableLogging);
    
    return errorResult;
  }
}

/**
 * Schedule next run
 */
function scheduleNextRun(config: Required<SchedulerConfig>): void {
  if (state.timerId) {
    clearTimeout(state.timerId);
  }
  
  state.nextRun = Date.now() + config.intervalMs;
  
  state.timerId = setTimeout(() => {
    if (state.isRunning) {
      runLearningPipeline(config, 'scheduled').then(() => {
        if (state.isRunning) {
          scheduleNextRun(config);
        }
      });
    }
  }, config.intervalMs);
}

/**
 * Start the learning scheduler
 */
export function startLearningScheduler(config: SchedulerConfig = {}): void {
  if (typeof window === 'undefined') {
    console.warn('Learning scheduler can only run in browser environment');
    return;
  }
  
  // Load persisted state
  loadPersistedState();
  
  if (state.isRunning) {
    console.log('Learning scheduler already running');
    return;
  }
  
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  state.isRunning = true;
  
  // Run immediately on start
  runLearningPipeline(fullConfig, 'scheduled');
  
  // Schedule next runs
  scheduleNextRun(fullConfig);
  
  console.log(`[LearningScheduler] Started with ${fullConfig.intervalMs}ms interval`);
}

/**
 * Stop the learning scheduler
 */
export function stopLearningScheduler(): void {
  state.isRunning = false;
  
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
  
  state.nextRun = null;
  
  console.log('[LearningScheduler] Stopped');
}

/**
 * Run learning pipeline manually (on-demand)
 */
export async function runLearningNow(
  config: SchedulerConfig = {}
): Promise<BatchTrainingResult> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  return runLearningPipeline(fullConfig, 'manual');
}

/**
 * Train a specific user's model on-demand
 */
export async function trainUserNow(
  userId: string
): Promise<TrainingResult> {
  return trainUserModel(userId, { retrain: false });
}

/**
 * Retrain specific user's model from scratch
 */
export async function retrainUserNow(
  userId: string,
  since?: Date
): Promise<TrainingResult> {
  return trainUserModel(userId, { retrain: true, since });
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  totalRuns: number;
  totalSignalsProcessed: number;
} {
  return {
    isRunning: state.isRunning,
    lastRun: state.lastRun ? new Date(state.lastRun).toISOString() : null,
    nextRun: state.nextRun ? new Date(state.nextRun).toISOString() : null,
    totalRuns: state.totalRuns,
    totalSignalsProcessed: state.totalSignalsProcessed,
  };
}

/**
 * Get learning history
 */
export function getLearningHistory(limit: number = 50): LearningLogEntry[] {
  return state.learningHistory.slice(-limit).reverse();
}

/**
 * Get latest learning outcome
 */
export function getLatestOutcome(): LearningLogEntry | null {
  return state.learningHistory[state.learningHistory.length - 1] || null;
}

/**
 * Clear learning history
 */
export function clearLearningHistory(): void {
  state.learningHistory = [];
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_LOGS);
  }
}

/**
 * Check if it's time to run learning (for manual checks)
 */
export function shouldRunLearning(minIntervalMinutes: number = 5): boolean {
  if (!state.lastRun) return true;
  
  const minIntervalMs = minIntervalMinutes * 60 * 1000;
  return Date.now() - state.lastRun >= minIntervalMs;
}

/**
 * Get learning statistics
 */
export function getLearningStats(): {
  totalRuns: number;
  totalSignals: number;
  avgSignalsPerRun: number;
  successRate: number;
  avgDuration: number;
} {
  const runs = state.learningHistory.length;
  if (runs === 0) {
    return {
      totalRuns: 0,
      totalSignals: 0,
      avgSignalsPerRun: 0,
      successRate: 0,
      avgDuration: 0,
    };
  }
  
  const totalSignals = state.learningHistory.reduce((sum, e) => sum + e.signalsProcessed, 0);
  const successfulRuns = state.learningHistory.filter(e => e.usersFailed === 0).length;
  const totalDuration = state.learningHistory.reduce((sum, e) => sum + e.durationMs, 0);
  
  return {
    totalRuns: runs,
    totalSignals,
    avgSignalsPerRun: totalSignals / runs,
    successRate: successfulRuns / runs,
    avgDuration: totalDuration / runs,
  };
}

/**
 * React hook for learning scheduler (for dashboard display)
 */
export function useLearningScheduler() {
  const [isRunning, setIsRunning] = useState(state.isRunning);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsRunning(state.isRunning);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    isRunning,
    status: getSchedulerStatus(),
    history: getLearningHistory(),
    stats: getLearningStats(),
    start: startLearningScheduler,
    stop: stopLearningScheduler,
    runNow: runLearningNow,
    clearHistory: clearLearningHistory,
  };
}

// Import React for hook
import { useState, useEffect } from 'react';

export default {
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
};
