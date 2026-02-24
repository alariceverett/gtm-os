/**
 * Autonomy Layer Types
 * 
 * Shared type definitions for the autonomous GTM Command Center
 */

import type { Recommendation, RecommendationType } from '@/lib/intelligence/recommendation-engine';
import type { AnomalyResult } from '@/lib/predictions/types';

// ============================================================================
// Task Generator Types
// ============================================================================

export type AutonomousTaskType = 
  | 'kpi_investigation'
  | 'unblock_work'
  | 'strategic_gap'
  | 'anomaly_response'
  | 'proactive_mitigation'
  | 'ab_test_proposal';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface AutonomousTask {
  id: string;
  type: AutonomousTaskType;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  
  // Trigger source
  trigger: {
    type: 'kpi_anomaly' | 'blocked_work' | 'strategic_gap' | 'prediction' | 'recommendation';
    sourceId: string; // ID of the triggering entity
    confidence: number; // 0-100
  };
  
  // Assignment
  assignedTo?: string; // Agent/user ID
  autoAssigned: boolean;
  
  // Timing
  createdAt: string;
  assignedAt?: string;
  dueAt?: string;
  completedAt?: string;
  
  // Context
  context: {
    affectedMetrics?: string[];
    relatedRecommendations?: string[];
    historicalPatterns?: BlockerPattern[];
  };
  
  // Execution tracking
  execution?: {
    attempts: number;
    lastAttemptAt?: string;
    error?: string;
    healedBy?: string; // ID of healing event if applicable
  };
}

// ============================================================================
// Self-Healing Types
// ============================================================================

export type ErrorSeverity = 'transient' | 'persistent' | 'critical';
export type HealingStatus = 'pending' | 'retrying' | 'healed' | 'escalated' | 'failed';

export interface ErrorEvent {
  id: string;
  taskId: string;
  type: string; // Error type/classification
  message: string;
  severity: ErrorSeverity;
  timestamp: string;
  attemptCount: number;
  stackTrace?: string;
  context?: Record<string, unknown>;
}

export interface HealingEvent {
  id: string;
  errorId: string;
  taskId: string;
  status: HealingStatus;
  strategy: HealingStrategy;
  attempts: HealingAttempt[];
  startedAt: string;
  resolvedAt?: string;
  escalatedAt?: string;
  error?: string;
}

export interface HealingAttempt {
  attemptNumber: number;
  strategy: string;
  timestamp: string;
  success: boolean;
  error?: string;
  delayMs: number;
}

export type HealingStrategy = 
  | 'immediate_retry'
  | 'exponential_backoff'
  | 'circuit_breaker'
  | 'fallback_execution'
  | 'operator_escalation';

// ============================================================================
// Predictive Guard Types
// ============================================================================

export interface BlockerPattern {
  id: string;
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  occurrences: number;
  lastOccurredAt: string;
  typicalPreconditions: string[];
  avgTimeToBlockMs: number;
  confidence: number; // 0-100
}

export interface PredictedBlocker {
  id: string;
  patternId: string;
  predictedAt: string;
  predictedFor: string; // ISO timestamp when expected to occur
  confidence: number; // 0-100
  preconditions: {
    condition: string;
    met: boolean;
    score: number;
  }[];
  
  // Proposed mitigation
  mitigationTask?: AutonomousTask;
  autoMitigate: boolean; // Whether to auto-create mitigation task
  
  // Resolution tracking
  status: 'predicted' | 'prevented' | 'occurred' | 'false_positive';
  resolvedAt?: string;
  actualOutcome?: 'blocked' | 'unblocked' | 'no_issue';
}

export interface GuardMetrics {
  totalPredictions: number;
  preventedCount: number;
  occurredCount: number;
  falsePositiveCount: number;
  avgConfidence: number;
  accuracyRate: number; // % of predictions that were correct
}

// ============================================================================
// Strategic Steering Types
// ============================================================================

export type HypothesisType = 'messaging' | 'audience' | 'channel' | 'timing' | 'creative';
export type HypothesisStatus = 'proposed' | 'approved' | 'rejected' | 'testing' | 'validated' | 'invalidated';

export interface ABTestHypothesis {
  id: string;
  type: HypothesisType;
  title: string;
  description: string;
  
  // Hypothesis details
  currentState: string;
  proposedChange: string;
  expectedOutcome: string;
  
  // Data backing
  supportingData: {
    metric: string;
    change: number;
    timeframe: string;
    confidence: number;
  }[];
  
  // Test parameters
  testParameters: {
    durationDays: number;
    sampleSize: number;
    successCriteria: string;
    rollbackCriteria: string;
  };
  
  // Status and ownership
  status: HypothesisStatus;
  proposedAt: string;
  proposedBy: 'system' | string; // 'system' for auto-generated
  approvedAt?: string;
  approvedBy?: string;
  
  // Results
  testResults?: {
    startedAt: string;
    endedAt?: string;
    controlMetrics: Record<string, number>;
    variantMetrics: Record<string, number>;
    winner: 'control' | 'variant' | 'inconclusive';
    liftPercent: number;
  };
}

export interface GTMPivotRecommendation {
  id: string;
  category: 'segment' | 'channel' | 'messaging' | 'budget' | 'timing';
  title: string;
  description: string;
  
  // Evidence
  triggers: {
    metric: string;
    trend: 'up' | 'down' | 'flat';
    changePercent: number;
    durationDays: number;
  }[];
  
  // Impact assessment
  expectedImpact: {
    metric: string;
    direction: 'increase' | 'decrease';
    magnitude: 'small' | 'medium' | 'large';
    confidence: number;
  }[];
  
  // Risk assessment
  risks: {
    description: string;
    likelihood: 'low' | 'medium' | 'high';
    mitigation: string;
  }[];
  
  // Approval flow
  status: 'proposed' | 'approved' | 'rejected' | 'implemented';
  requiresApproval: boolean;
  proposedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  
  // Timing
  effectiveDate?: string;
  reviewDate?: string; // For quarterly reviews
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface AutonomyMetrics {
  // Decision metrics
  decisions: {
    today: {
      total: number;
      autoExecuted: number;
      operatorApproved: number;
      operatorRejected: number;
    };
    thisWeek: {
      total: number;
      autoExecuted: number;
      operatorOverride: number;
    };
    overrideRate: number; // % of auto-decisions overridden (target: <5%)
  };
  
  // Self-healing metrics
  healing: {
    eventsToday: number;
    eventsThisWeek: number;
    successRate: number; // % healed without escalation
    avgTimeToHealMs: number;
    escalationRate: number;
  };
  
  // Predictive guard metrics
  predictiveGuard: GuardMetrics;
  
  // Strategic metrics
  strategic: {
    activeHypotheses: number;
    testsRunning: number;
    pendingApprovals: number;
    recentValidations: number;
  };
  
  // System health
  health: {
    status: 'healthy' | 'degraded' | 'critical';
    lastCheck: string;
    activeTasks: number;
    blockedTasks: number;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export type AutonomyEventType = 
  | 'task_created'
  | 'task_assigned'
  | 'task_completed'
  | 'healing_started'
  | 'healing_succeeded'
  | 'healing_escalated'
  | 'blocker_predicted'
  | 'blocker_prevented'
  | 'hypothesis_proposed'
  | 'pivot_recommended';

export interface AutonomyEvent {
  id: string;
  type: AutonomyEventType;
  timestamp: string;
  entityId: string; // Task/healing/blocker/hypothesis ID
  entityType: 'task' | 'healing' | 'blocker' | 'hypothesis' | 'pivot';
  metadata: Record<string, unknown>;
}
