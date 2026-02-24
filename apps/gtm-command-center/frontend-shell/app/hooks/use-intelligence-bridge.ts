/**
 * Intelligence Bridge Hook
 * 
 * Watches recommendations from the Decision Synthesis Engine
 * and manages the handoff to execution:
 * - Auto-creates action items for high-confidence recommendations (>80%)
 * - Queues low-confidence recommendations for operator review
 * - Tracks recommendation lifecycle (pending → approved → executed)
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSimpleForecast } from './use-simple-forecast';
import { useCardOrder, useFeedbackRecorder } from './use-personalization';
import { useTasks } from './use-tasks';
import {
  generateRecommendations,
  getAutoExecutableRecommendations,
  getReviewQueueRecommendations,
  getAverageConfidence,
  getConfidenceDistribution,
  type Recommendation,
  type SynthesisInput,
  type RecommendationType,
} from '@/lib/intelligence/recommendation-engine';
import type { CardType, SignalType } from '@/lib/preference-service';

// Simple KPI data type for the bridge
interface SimpleKpiData {
  key: string;
  label: string;
  value: number | string;
}

// Action item created from a recommendation
export interface ActionItem {
  id: string;
  recommendationId: string;
  title: string;
  description: string;
  status: 'pending' | 'queued' | 'executed' | 'failed';
  priority: 'critical' | 'high' | 'medium' | 'low';
  createdAt: string;
  executedAt?: string;
  error?: string;
}

// Stream state
export interface IntelligenceStreamState {
  recommendations: Recommendation[];
  autoExecuted: ActionItem[];
  reviewQueue: Recommendation[];
  isProcessing: boolean;
  lastUpdated: string | null;
  error: Error | null;
  
  // Statistics
  stats: {
    total: number;
    autoExecutable: number;
    queuedForReview: number;
    avgConfidence: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
}

// Hook return type
export interface UseIntelligenceBridgeResult extends IntelligenceStreamState {
  // Actions
  approveRecommendation: (id: string) => Promise<boolean>;
  rejectRecommendation: (id: string, reason?: string) => Promise<boolean>;
  executeRecommendation: (id: string) => Promise<boolean>;
  retryAutoExecution: (id: string) => Promise<boolean>;
  refresh: () => void;
  
  // Helper
  dismissRecommendation: (id: string) => void;
}

// Historical accuracy storage (would be persisted in DB in production)
const historicalAccuracyStore: Record<string, Record<RecommendationType, number>> = {};

interface StoredFeedback {
  signalType: SignalType;
  section?: string;
  timestamp: string;
}

// Storage for recommendations and actions (session-based)
const recommendationStore = new Map<string, Recommendation>();
const actionStore = new Map<string, ActionItem>();
const dismissedRecommendations = new Set<string>();

/**
 * Hook to stream intelligence recommendations and manage execution handoff
 * 
 * @param userId - The user's unique identifier
 * @param autoExecuteThreshold - Confidence threshold for auto-execution (default: 80)
 * @returns Stream state and control functions
 * 
 * @example
 * ```tsx
 * const { 
 *   recommendations, 
 *   autoExecuted, 
 *   reviewQueue,
 *   approveRecommendation,
 *   rejectRecommendation 
 * } = useIntelligenceStream('user-123', 80);
 * ```
 */
export function useIntelligenceStream(
  userId: string | null,
  autoExecuteThreshold: number = 80,
  kpiData?: SimpleKpiData[]
): UseIntelligenceBridgeResult {
  // Get data from existing hooks
  const { forecast } = useSimpleForecast(kpiData);
  const { cardOrder } = useCardOrder(userId);
  const { recordFeedback } = useFeedbackRecorder();
  const { data: tasksData } = useTasks(60000); // Check tasks every minute
  
  // Local state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [autoExecuted, setAutoExecuted] = useState<ActionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<StoredFeedback[]>([]);
  
  const isMountedRef = useRef(true);
  const processingRef = useRef(false);
  
  // Initialize feedback from localStorage (simulated for now)
  useEffect(() => {
    if (typeof window !== 'undefined' && userId) {
      const stored = localStorage.getItem(`intelligence-feedback-${userId}`);
      if (stored) {
        try {
          setRecentFeedback(JSON.parse(stored));
        } catch {
          setRecentFeedback([]);
        }
      }
    }
  }, [userId]);
  
  // Main synthesis effect - runs when inputs change
  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setError(null);
    
    try {
      // Build synthesis input
      const blockedTasks = tasksData?.tasks?.blocked?.length ?? 0;
      const openPriorities = tasksData?.workQueue?.openPriorities ?? 0;
      
      // Default historical accuracy for new users
      const defaultAccuracy: Record<RecommendationType, number> = {
        investigate_decline: 0.75,
        double_down_growth: 0.68,
        reorder_dashboard: 0.82,
        address_anomaly: 0.71,
        review_blocked_tasks: 0.79,
        pause_underperforming: 0.65,
      };
      
      const input: SynthesisInput = {
        forecast,
        preferences: {
          cardOrder,
          recentFeedback,
        },
        historicalAccuracy: userId ? (historicalAccuracyStore[userId] ?? defaultAccuracy) : defaultAccuracy,
        context: {
          blockedTasks,
          openPriorities,
        },
      };
      
      // Generate recommendations
      const newRecommendations = generateRecommendations(input);
      
      // Filter out dismissed recommendations
      const filtered = newRecommendations.filter(
        r => !dismissedRecommendations.has(r.id)
      );
      
      // Store in map for quick lookup
      filtered.forEach(r => recommendationStore.set(r.id, r));
      
      if (isMountedRef.current) {
        setRecommendations(filtered);
        setLastUpdated(new Date().toISOString());
      }
      
      // Auto-execute high-confidence recommendations
      const autoExecutable = getAutoExecutableRecommendations(filtered, autoExecuteThreshold);
      
      for (const rec of autoExecutable) {
        // Check if not already executed
        const existingAction = Array.from(actionStore.values()).find(
          a => a.recommendationId === rec.id
        );
        
        if (!existingAction) {
          executeAction(rec);
        }
      }
      
      // Load existing auto-executed actions
      const existingActions = Array.from(actionStore.values()).filter(
        a => filtered.some(r => r.id === a.recommendationId)
      );
      
      if (isMountedRef.current) {
        setAutoExecuted(existingActions);
        setIsProcessing(false);
      }
      
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to process intelligence'));
        setIsProcessing(false);
      }
    } finally {
      processingRef.current = false;
    }
  }, [forecast, cardOrder, recentFeedback, userId, tasksData, autoExecuteThreshold]);
  
  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Execute an action from a recommendation
  const executeAction = useCallback(async (recommendation: Recommendation): Promise<ActionItem> => {
    const action: ActionItem = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recommendationId: recommendation.id,
      title: recommendation.title,
      description: recommendation.suggestedAction.description,
      status: 'pending',
      priority: recommendation.priority,
      createdAt: new Date().toISOString(),
    };
    
    try {
      // In production, this would call an API to create a task
      // For now, simulate API call
      await simulateActionExecution(recommendation);
      
      action.status = 'executed';
      action.executedAt = new Date().toISOString();
      
      // Update recommendation status
      const rec = recommendationStore.get(recommendation.id);
      if (rec) {
        // Would update in DB
      }
      
    } catch (err) {
      action.status = 'failed';
      action.error = err instanceof Error ? err.message : 'Unknown error';
    }
    
    actionStore.set(action.id, action);
    
    if (isMountedRef.current) {
      setAutoExecuted(prev => [...prev.filter(a => a.id !== action.id), action]);
    }
    
    return action;
  }, []);
  
  // Simulate action execution (would be real API calls in production)
  const simulateActionExecution = async (recommendation: Recommendation): Promise<void> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simulate occasional failure for testing
    if (Math.random() < 0.05) {
      throw new Error('Simulated execution failure');
    }
    
    // In production, this would:
    // - Create a task in the task management system
    // - Send notifications
    // - Update analytics
    console.log('[Intelligence Bridge] Auto-executed:', recommendation.title);
  };
  
  // Approve a recommendation (move from queue to execution)
  const approveRecommendation = useCallback(async (id: string): Promise<boolean> => {
    const recommendation = recommendationStore.get(id);
    if (!recommendation) return false;
    
    try {
      const action = await executeAction(recommendation);
      
      // Update recommendation feedback
      recommendation.userFeedback = 'accepted';
      
      // Update historical accuracy (simplified)
      if (userId) {
        updateHistoricalAccuracy(userId, recommendation.type, true);
      }
      
      // Record feedback signal
      await recordFeedback('explicit_positive', 'intelligence');
      
      // Update recent feedback
      const newFeedback: StoredFeedback = {
        signalType: 'explicit_positive',
        section: 'intelligence',
        timestamp: new Date().toISOString(),
      };
      setRecentFeedback(prev => [...prev, newFeedback]);
      
      return action.status === 'executed';
    } catch (err) {
      console.error('Failed to approve recommendation:', err);
      return false;
    }
  }, [userId, recordFeedback]);
  
  // Reject a recommendation
  const rejectRecommendation = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    const recommendation = recommendationStore.get(id);
    if (!recommendation) return false;
    
    try {
      recommendation.userFeedback = 'rejected';
      
      // Update historical accuracy
      if (userId) {
        updateHistoricalAccuracy(userId, recommendation.type, false);
      }
      
      // Record feedback
      await recordFeedback('explicit_negative', 'intelligence');
      
      // Update recent feedback
      const newFeedback: StoredFeedback = {
        signalType: 'explicit_negative',
        section: 'intelligence',
        timestamp: new Date().toISOString(),
      };
      setRecentFeedback(prev => [...prev, newFeedback]);
      
      console.log('[Intelligence Bridge] Rejected recommendation:', id, reason);
      return true;
    } catch (err) {
      console.error('Failed to reject recommendation:', err);
      return false;
    }
  }, [userId, recordFeedback]);
  
  // Execute a specific recommendation (manual trigger)
  const executeRecommendation = useCallback(async (id: string): Promise<boolean> => {
    const recommendation = recommendationStore.get(id);
    if (!recommendation) return false;
    
    try {
      const action = await executeAction(recommendation);
      return action.status === 'executed';
    } catch (err) {
      console.error('Failed to execute recommendation:', err);
      return false;
    }
  }, [executeAction]);
  
  // Retry a failed auto-execution
  const retryAutoExecution = useCallback(async (id: string): Promise<boolean> => {
    const action = Array.from(actionStore.values()).find(
      a => a.recommendationId === id && a.status === 'failed'
    );
    
    if (!action) return false;
    
    const recommendation = recommendationStore.get(id);
    if (!recommendation) return false;
    
    try {
      actionStore.delete(action.id);
      const newAction = await executeAction(recommendation);
      return newAction.status === 'executed';
    } catch (err) {
      console.error('Failed to retry execution:', err);
      return false;
    }
  }, [executeAction]);
  
  // Dismiss a recommendation (hide without rejecting)
  const dismissRecommendation = useCallback((id: string): void => {
    dismissedRecommendations.add(id);
    const rec = recommendationStore.get(id);
    if (rec) {
      rec.userFeedback = 'dismissed';
    }
    setRecommendations(prev => prev.filter(r => r.id !== id));
  }, []);
  
  // Manual refresh trigger
  const refresh = useCallback(() => {
    processingRef.current = false;
    setLastUpdated(null);
  }, []);
  
  // Compute review queue
  const reviewQueue = useMemo(() => {
    return getReviewQueueRecommendations(recommendations, autoExecuteThreshold)
      .filter(r => !r.userFeedback); // Only show pending
  }, [recommendations, autoExecuteThreshold]);
  
  // Compute statistics
  const stats = useMemo(() => {
    const distribution = getConfidenceDistribution(recommendations);
    const autoExecutable = getAutoExecutableRecommendations(recommendations, autoExecuteThreshold);
    
    return {
      total: recommendations.length,
      autoExecutable: autoExecutable.length,
      queuedForReview: reviewQueue.length,
      avgConfidence: getAverageConfidence(recommendations),
      highConfidence: distribution.high,
      mediumConfidence: distribution.medium,
      lowConfidence: distribution.low,
    };
  }, [recommendations, reviewQueue, autoExecuteThreshold]);
  
  return {
    recommendations,
    autoExecuted,
    reviewQueue,
    isProcessing,
    lastUpdated,
    error,
    stats,
    approveRecommendation,
    rejectRecommendation,
    executeRecommendation,
    retryAutoExecution,
    dismissRecommendation,
    refresh,
  };
}

// Helper: Update historical accuracy for a recommendation type
function updateHistoricalAccuracy(
  userId: string,
  type: RecommendationType,
  wasSuccessful: boolean
): void {
  if (!historicalAccuracyStore[userId]) {
    historicalAccuracyStore[userId] = {} as Record<RecommendationType, number>;
  }
  
  const current = historicalAccuracyStore[userId][type] ?? 0.7;
  // Simple exponential moving average
  const newAccuracy = current * 0.9 + (wasSuccessful ? 1 : 0) * 0.1;
  historicalAccuracyStore[userId][type] = newAccuracy;
}

// Export individual functions for testing
export {
  getAutoExecutableRecommendations,
  getReviewQueueRecommendations,
  getAverageConfidence,
  getConfidenceDistribution,
};
