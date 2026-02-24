/**
 * Autonomy Dashboard Hooks
 * 
 * Provides hooks for monitoring autonomous system behavior:
 * - Decision metrics and override rates
 * - Auto-created tasks
 * - Self-healing events
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataFetch } from './use-data-fetch';
import type { 
  AutonomousTask, 
  HealingEvent, 
  AutonomyMetrics,
  AutonomyEvent 
} from '@/lib/autonomy/types';

// ============================================================================
// Types
// ============================================================================

export interface AutonomyMetricsResult {
  data: AutonomyMetrics | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface AutonomousTasksResult {
  tasks: AutonomousTask[];
  pendingTasks: AutonomousTask[];
  completedToday: number;
  createdToday: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface SelfHealingResult {
  events: HealingEvent[];
  todayCount: number;
  weekCount: number;
  successRate: number;
  avgTimeToHealMs: number;
  escalationRate: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Mock Data Generators (for development/demo)
// ============================================================================

function generateMockMetrics(): AutonomyMetrics {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Generate realistic autonomy metrics
  const totalToday = Math.floor(Math.random() * 50) + 20;
  const autoExecuted = Math.floor(totalToday * 0.92); // 92% auto-execution
  const operatorApproved = Math.floor(totalToday * 0.05);
  const operatorRejected = totalToday - autoExecuted - operatorApproved;
  
  return {
    decisions: {
      today: {
        total: totalToday,
        autoExecuted,
        operatorApproved,
        operatorRejected,
      },
      thisWeek: {
        total: totalToday * 5 + Math.floor(Math.random() * 100),
        autoExecuted: autoExecuted * 5,
        operatorOverride: operatorApproved + operatorRejected + Math.floor(Math.random() * 10),
      },
      overrideRate: parseFloat(((operatorApproved + operatorRejected) / totalToday * 100).toFixed(2)),
    },
    healing: {
      eventsToday: Math.floor(Math.random() * 8) + 2,
      eventsThisWeek: Math.floor(Math.random() * 30) + 10,
      successRate: parseFloat((85 + Math.random() * 14).toFixed(1)),
      avgTimeToHealMs: Math.floor(Math.random() * 30000) + 5000,
      escalationRate: parseFloat((2 + Math.random() * 3).toFixed(1)),
    },
    predictiveGuard: {
      totalPredictions: Math.floor(Math.random() * 100) + 50,
      preventedCount: Math.floor(Math.random() * 40) + 20,
      occurredCount: Math.floor(Math.random() * 15) + 5,
      falsePositiveCount: Math.floor(Math.random() * 10) + 2,
      avgConfidence: parseFloat((75 + Math.random() * 20).toFixed(1)),
      accuracyRate: parseFloat((75 + Math.random() * 20).toFixed(1)),
    },
    strategic: {
      activeHypotheses: Math.floor(Math.random() * 5) + 1,
      testsRunning: Math.floor(Math.random() * 3) + 1,
      pendingApprovals: Math.floor(Math.random() * 4),
      recentValidations: Math.floor(Math.random() * 6),
    },
    health: {
      status: Math.random() > 0.9 ? 'degraded' : 'healthy',
      lastCheck: new Date().toISOString(),
      activeTasks: Math.floor(Math.random() * 20) + 5,
      blockedTasks: Math.floor(Math.random() * 3),
    },
  };
}

function generateMockTasks(count: number = 8): AutonomousTask[] {
  const types = ['kpi_investigation', 'unblock_work', 'strategic_gap', 'anomaly_response', 'proactive_mitigation'] as const;
  const priorities = ['critical', 'high', 'medium', 'low'] as const;
  const statuses = ['pending', 'assigned', 'in_progress', 'completed'] as const;
  
  const tasks: AutonomousTask[] = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const createdAt = new Date(today.getTime() - Math.random() * 86400000 * 3);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    tasks.push({
      id: `autotask_${Date.now()}_${i}`,
      type: types[Math.floor(Math.random() * types.length)],
      title: [
        'Investigate conversion rate decline',
        'Unblock 3 critical tasks',
        'Address strategic gap in onboarding',
        'Respond to traffic anomaly',
        'Proactive mitigation for predicted blocker',
        'Review dashboard performance',
        'Analyze churn indicator spike',
      ][i % 7],
      description: 'Auto-generated task based on system signals and anomaly detection.',
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status,
      trigger: {
        type: ['kpi_anomaly', 'blocked_work', 'strategic_gap', 'prediction'][Math.floor(Math.random() * 4)] as any,
        sourceId: `trigger_${i}`,
        confidence: Math.floor(Math.random() * 40) + 60,
      },
      autoAssigned: Math.random() > 0.3,
      assignedTo: Math.random() > 0.3 ? `agent:${['analytics', 'ops', 'dev', 'strategy'][Math.floor(Math.random() * 4)]}` : undefined,
      createdAt: createdAt.toISOString(),
      assignedAt: status !== 'pending' ? new Date(createdAt.getTime() + Math.random() * 3600000).toISOString() : undefined,
      dueAt: new Date(createdAt.getTime() + 86400000 * (Math.random() * 2 + 1)).toISOString(),
      completedAt: status === 'completed' ? new Date(createdAt.getTime() + Math.random() * 43200000).toISOString() : undefined,
      context: {
        affectedMetrics: ['conversion_rate', 'user_engagement'],
      },
      execution: {
        attempts: Math.floor(Math.random() * 3),
      },
    });
  }
  
  return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function generateMockHealingEvents(count: number = 6): HealingEvent[] {
  const strategies = ['immediate_retry', 'exponential_backoff', 'circuit_breaker', 'fallback_execution'] as const;
  const statuses = ['healed', 'healed', 'healed', 'healed', 'escalated'] as const;
  
  const events: HealingEvent[] = [];
  
  for (let i = 0; i < count; i++) {
    const startedAt = new Date(Date.now() - Math.random() * 86400000 * 7);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    
    const attempts = Math.floor(Math.random() * 3) + 1;
    const healingAttempts = Array.from({ length: attempts }, (_, j) => ({
      attemptNumber: j + 1,
      strategy: strategy as string,
      timestamp: new Date(startedAt.getTime() + j * 5000).toISOString(),
      success: j === attempts - 1 && status === 'healed',
      delayMs: Math.floor(Math.random() * 5000) + 1000,
    }));
    
    events.push({
      id: `heal_${Date.now()}_${i}`,
      errorId: `err_${i}`,
      taskId: `task_${i}`,
      status,
      strategy: strategy as any,
      attempts: healingAttempts,
      startedAt: startedAt.toISOString(),
      resolvedAt: status === 'healed' ? new Date(startedAt.getTime() + attempts * 5000).toISOString() : undefined,
      escalatedAt: status === 'escalated' ? new Date(startedAt.getTime() + attempts * 5000).toISOString() : undefined,
    });
  }
  
  return events.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

// ============================================================================
// Mock API Response Handlers
// ============================================================================

async function mockAutonomyMetricsApi(): Promise<AutonomyMetrics> {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 300));
  return generateMockMetrics();
}

async function mockAutonomousTasksApi(): Promise<AutonomousTask[]> {
  await new Promise(resolve => setTimeout(resolve, 250));
  return generateMockTasks();
}

async function mockSelfHealingApi(): Promise<HealingEvent[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return generateMockHealingEvents();
}

// ============================================================================
// Hook: useAutonomyMetrics
// ============================================================================

/**
 * Hook for fetching autonomy system metrics
 * 
 * Returns decision metrics including:
 * - Override rate (target: <5%)
 * - Decisions made today/this week
 * - Self-healing statistics
 * - Predictive guard metrics
 */
export function useAutonomyMetrics(refreshInterval: number = 30000): AutonomyMetricsResult {
  const [data, setData] = useState<AutonomyMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      const metrics = await mockAutonomyMetricsApi();
      setData(metrics);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchMetrics]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchMetrics,
  };
}

// ============================================================================
// Hook: useAutonomousTasks
// ============================================================================

/**
 * Hook for fetching auto-created autonomous tasks
 * 
 * Returns tasks generated by the autonomous system including:
 * - KPI investigation tasks
 * - Unblock work tasks
 * - Strategic gap tasks
 * - Anomaly response tasks
 */
export function useAutonomousTasks(refreshInterval: number = 30000): AutonomousTasksResult {
  const [tasks, setTasks] = useState<AutonomousTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      const data = await mockAutonomousTasksApi();
      setTasks(data);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const interval = setInterval(fetchTasks, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchTasks]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  const pendingTasks = useMemo(() => 
    tasks.filter(t => t.status === 'pending' || t.status === 'assigned' || t.status === 'in_progress'),
    [tasks]
  );
  
  const createdToday = useMemo(() => 
    tasks.filter(t => t.createdAt.startsWith(today)).length,
    [tasks, today]
  );
  
  const completedToday = useMemo(() => 
    tasks.filter(t => t.status === 'completed' && t.completedAt?.startsWith(today)).length,
    [tasks, today]
  );

  return {
    tasks,
    pendingTasks,
    completedToday,
    createdToday,
    isLoading,
    isError,
    error,
    refetch: fetchTasks,
  };
}

// ============================================================================
// Hook: useSelfHealingEvents
// ============================================================================

/**
 * Hook for fetching self-healing event history
 * 
 * Returns healing events including:
 * - Healing strategy used
 * - Success/failure status
 * - Time to heal
 * - Escalation rate
 */
export function useSelfHealingEvents(refreshInterval: number = 30000): SelfHealingResult {
  const [events, setEvents] = useState<HealingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      const data = await mockSelfHealingApi();
      setEvents(data);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch healing events'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    const interval = setInterval(fetchEvents, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchEvents]);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const todayCount = useMemo(() => 
    events.filter(e => e.startedAt.startsWith(today)).length,
    [events, today]
  );
  
  const weekCount = useMemo(() => 
    events.filter(e => e.startedAt >= weekAgo).length,
    [events, weekAgo]
  );
  
  const successRate = useMemo(() => {
    if (events.length === 0) return 0;
    const healed = events.filter(e => e.status === 'healed').length;
    return Math.round((healed / events.length) * 100);
  }, [events]);
  
  const avgTimeToHealMs = useMemo(() => {
    const healedEvents = events.filter(e => e.status === 'healed' && e.resolvedAt);
    if (healedEvents.length === 0) return 0;
    const totalTime = healedEvents.reduce((sum, e) => {
      return sum + (new Date(e.resolvedAt!).getTime() - new Date(e.startedAt).getTime());
    }, 0);
    return Math.round(totalTime / healedEvents.length);
  }, [events]);
  
  const escalationRate = useMemo(() => {
    if (events.length === 0) return 0;
    const escalated = events.filter(e => e.status === 'escalated').length;
    return parseFloat(((escalated / events.length) * 100).toFixed(1));
  }, [events]);

  return {
    events,
    todayCount,
    weekCount,
    successRate,
    avgTimeToHealMs,
    escalationRate,
    isLoading,
    isError,
    error,
    refetch: fetchEvents,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format autonomy event timestamp
 */
export function formatAutonomyTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * Get color for override rate (green if <5%, amber if <10%, red otherwise)
 */
export function getOverrideRateColor(rate: number): string {
  if (rate < 5) return 'text-emerald-600';
  if (rate < 10) return 'text-amber-600';
  return 'text-rose-600';
}

/**
 * Get status color for healing event
 */
export function getHealingStatusColor(status: string): string {
  switch (status) {
    case 'healed': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'escalated': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'failed': return 'text-rose-600 bg-rose-50 border-rose-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}

/**
 * Get icon for autonomous task type
 */
export function getTaskTypeIcon(type: string): string {
  switch (type) {
    case 'kpi_investigation': return '🔍';
    case 'unblock_work': return '🚧';
    case 'strategic_gap': return '🎯';
    case 'anomaly_response': return '⚡';
    case 'proactive_mitigation': return '🛡️';
    case 'ab_test_proposal': return '🧪';
    default: return '🤖';
  }
}

/**
 * Format healing strategy for display
 */
export function formatHealingStrategy(strategy: string): string {
  return strategy
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format milliseconds to human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

// Export types
export type {
  AutonomyMetrics,
  AutonomousTask,
  HealingEvent,
  AutonomyEvent,
} from '@/lib/autonomy/types';