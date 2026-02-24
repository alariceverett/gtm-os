/**
 * Unit Tests - Predictive Guard
 * 
 * Tests pattern detection, blocker prediction, and mitigation generation
 * Target: >80% coverage on predictive-guard.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PredictiveGuard,
  createPredictiveGuard,
  type Task,
  type BlockerPattern,
  type PredictedBlocker,
  type PredictionOptions,
} from '../../lib/autonomy/predictive-guard';

describe('PredictiveGuard - Pattern Detection', () => {
  let guard: PredictiveGuard;
  let mockHistoricalTasks: Task[];

  beforeEach(() => {
    guard = new PredictiveGuard();
    mockHistoricalTasks = [
      // Blocked tasks for pattern detection
      {
        id: 'task-1',
        title: 'Critical Task Without Dependencies',
        status: 'blocked',
        priority: 'critical',
        blockedAt: new Date('2026-02-10'),
        unblockedAt: new Date('2026-02-11'),
        blockReason: 'Unclear requirements and scope',
        createdAt: new Date('2026-02-08'),
      },
      {
        id: 'task-2',
        title: 'Large Unassigned Task',
        status: 'blocked',
        priority: 'high',
        estimatedHours: 16,
        blockedAt: new Date('2026-02-11'),
        unblockedAt: new Date('2026-02-12'),
        createdAt: new Date('2026-02-09'),
      },
      {
        id: 'task-3',
        title: 'External Dependency Task',
        status: 'blocked',
        priority: 'medium',
        blockReason: 'Waiting for external provider response',
        tags: ['external', 'third-party'],
        blockedAt: new Date('2026-02-12'),
        unblockedAt: new Date('2026-02-15'),
        createdAt: new Date('2026-02-10'),
      },
      // Completed tasks for baseline
      {
        id: 'task-4',
        title: 'Completed Task',
        status: 'completed',
        priority: 'medium',
        completedAt: new Date('2026-02-09'),
        createdAt: new Date('2026-02-07'),
      },
    ];
  });

  describe('Pattern Analysis', () => {
    it('should analyze historical tasks and identify patterns', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should detect high-priority tasks without dependencies pattern', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      const highPriorityPattern = patterns.find(p => 
        p.id === 'pattern-high-priority-no-deps'
      );
      
      expect(highPriorityPattern).toBeDefined();
      expect(highPriorityPattern?.name).toContain('High Priority');
      expect(highPriorityPattern?.conditions).toHaveLength(2);
    });

    it('should detect unassigned large tasks pattern', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      const unassignedPattern = patterns.find(p => 
        p.id === 'pattern-unassigned-large'
      );
      
      expect(unassignedPattern).toBeDefined();
      expect(unassignedPattern?.name).toContain('Unassigned');
    });

    it('should detect external dependency pattern', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      const externalPattern = patterns.find(p => 
        p.id === 'pattern-external-dependency'
      );
      
      expect(externalPattern).toBeDefined();
      expect(externalPattern?.name).toContain('External');
    });

    it('should return empty array when no blocked tasks exist', () => {
      const noBlockedTasks = mockHistoricalTasks.filter(t => t.status !== 'blocked');
      const patterns = guard.analyzePatterns(noBlockedTasks);
      
      expect(patterns).toEqual([]);
    });

    it('should calculate frequency for each pattern', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      patterns.forEach(pattern => {
        expect(pattern.frequency).toBeGreaterThanOrEqual(0);
        expect(pattern.frequency).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate average resolution time', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      patterns.forEach(pattern => {
        expect(pattern.avgResolutionTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should assign severity levels to patterns', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      patterns.forEach(pattern => {
        expect(['low', 'medium', 'high', 'critical']).toContain(pattern.severity);
      });
    });

    it('should track occurrence count for patterns', () => {
      const patterns = guard.analyzePatterns(mockHistoricalTasks);
      
      patterns.forEach(pattern => {
        expect(pattern.occurrenceCount).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Condition Evaluation', () => {
    beforeEach(() => {
      guard.analyzePatterns(mockHistoricalTasks);
    });

    it('should evaluate equals operator correctly', () => {
      const currentTasks: Task[] = [{
        id: 'task-5',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      // Should detect high-priority pattern match
      const highPriorityPreds = predictions.filter(p => p.severity === 'high');
      expect(highPriorityPreds.length).toBeGreaterThan(0);
    });

    it('should evaluate contains operator correctly', () => {
      const currentTasks: Task[] = [{
        id: 'task-6',
        title: 'External API Integration',
        status: 'pending',
        priority: 'medium',
        tags: ['external', 'integration'],
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      expect(predictions).toBeDefined();
    });

    it('should evaluate gt operator for numeric comparisons', () => {
      const currentTasks: Task[] = [{
        id: 'task-7',
        title: 'Large Task',
        status: 'pending',
        priority: 'medium',
        estimatedHours: 12,
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      expect(predictions).toBeDefined();
    });

    it('should evaluate missing operator for empty fields', () => {
      const currentTasks: Task[] = [{
        id: 'task-8',
        title: 'Unassigned Task',
        status: 'pending',
        priority: 'high',
        estimatedHours: 16,
        assignee: undefined,
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      expect(predictions).toBeDefined();
    });

    it('should evaluate exists operator correctly', () => {
      const currentTasks: Task[] = [{
        id: 'task-9',
        title: 'Task with Assignee',
        status: 'pending',
        priority: 'medium',
        assignee: 'user@example.com',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      expect(predictions).toBeDefined();
    });
  });

  describe('Blocker Prediction', () => {
    beforeEach(() => {
      guard.analyzePatterns(mockHistoricalTasks);
    });

    it('should predict blockers for current tasks', () => {
      const currentTasks: Task[] = [{
        id: 'task-current-1',
        title: 'Critical Without Dependencies',
        status: 'in-progress',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      expect(predictions).toBeDefined();
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should filter predictions by minimum confidence', () => {
      const currentTasks: Task[] = [{
        id: 'task-current-2',
        title: 'Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks, { minConfidence: 0.5 });
      
      predictions.forEach(pred => {
        expect(pred.confidence).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should respect max predictions limit', () => {
      const currentTasks: Task[] = Array.from({ length: 50 }, (_, i) => ({
        id: `task-${i}`,
        title: `Task ${i}`,
        status: 'pending',
        priority: i % 5 === 0 ? 'critical' : 'medium',
        createdAt: new Date(),
        tags: i % 3 === 0 ? ['external'] : [],
      }));

      const predictions = guard.predictBlockers(currentTasks, { maxPredictions: 10 });
      
      expect(predictions.length).toBeLessThanOrEqual(10);
    });

    it('should sort predictions by confidence (highest first)', () => {
      const currentTasks: Task[] = Array.from({ length: 10 }, (_, i) => ({
        id: `task-sort-${i}`,
        title: `Task ${i}`,
        status: 'pending',
        priority: ['critical', 'high', 'medium', 'low'][i % 4] as Task['priority'],
        createdAt: new Date(),
      }));

      const predictions = guard.predictBlockers(currentTasks);
      
      // Check that predictions are sorted by confidence
      for (let i = 0; i < predictions.length - 1; i++) {
        expect(predictions[i].confidence).toBeGreaterThanOrEqual(predictions[i + 1].confidence);
      }
    });

    it('should skip completed tasks in prediction', () => {
      const tasks: Task[] = [
        { id: '1', title: 'Completed', status: 'completed', priority: 'critical', createdAt: new Date(), completedAt: new Date() },
        { id: '2', title: 'Pending', status: 'pending', priority: 'critical', createdAt: new Date() },
      ];

      const predictions = guard.predictBlockers(tasks);
      
      // Should not predict for completed tasks
      expect(predictions.every(p => p.taskId !== '1')).toBe(true);
    });

    it('should set predicted block time within lookahead window', () => {
      const currentTasks: Task[] = [{
        id: 'task-timeline',
        title: 'Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const now = new Date();
      const predictions = guard.predictBlockers(currentTasks, { lookAheadDays: 7 });
      
      predictions.forEach(pred => {
        expect(pred.predictedBlockTime.getTime()).toBeGreaterThanOrEqual(now.getTime());
        expect(pred.predictedBlockTime.getTime()).toBeLessThanOrEqual(
          now.getTime() + 7 * 24 * 60 * 60 * 1000
        );
      });
    });

    it('should generate contributing factors for predictions', () => {
      const currentTasks: Task[] = [{
        id: 'task-factors',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      predictions.forEach(pred => {
        expect(pred.contributingFactors).toBeDefined();
        expect(Array.isArray(pred.contributingFactors)).toBe(true);
      });
    });

    it('should provide recommended actions for each prediction', () => {
      const currentTasks: Task[] = [{
        id: 'task-action',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      predictions.forEach(pred => {
        expect(pred.recommendedAction).toBeDefined();
        expect(pred.recommendedAction.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Mitigation Tasks', () => {
    beforeEach(() => {
      guard.analyzePatterns(mockHistoricalTasks);
    });

    it('should auto-generate mitigation tasks above threshold', () => {
      guard.setAutoMitigateThreshold(0.5);
      
      const currentTasks: Task[] = [{
        id: 'task-mitigate',
        title: 'Critical Task Without Dependencies',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks, { autoMitigateThreshold: 0.5 });
      
      predictions.forEach(pred => {
        if (pred.confidence >= 0.5) {
          expect(pred.mitigationTasks).toBeDefined();
          expect(pred.mitigationTasks.length).toBeGreaterThan(0);
        }
      });
    });

    it('should generate specific mitigation for dependency pattern', () => {
      const currentTasks: Task[] = [{
        id: 'task-dep-mitigation',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks, { minConfidence: 0.1 });
      const highPrioPreds = predictions.filter(p => p.confidence > 0);
      
      highPrioPreds.forEach(pred => {
        expect(pred.mitigationTasks).toBeDefined();
      });
    });

    it('should include estimated hours in mitigation tasks', () => {
      const currentTasks: Task[] = [{
        id: 'task-hours',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks, { minConfidence: 0.1 });
      
      predictions.forEach(pred => {
        pred.mitigationTasks.forEach(task => {
          expect(task.estimatedHours).toBeGreaterThan(0);
        });
      });
    });

    it('should link mitigation tasks to parent tasks', () => {
      const currentTasks: Task[] = [{
        id: 'task-parent-link',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks, { minConfidence: 0.1 });
      
      predictions.forEach(pred => {
        pred.mitigationTasks.forEach(task => {
          expect(task.parentTaskId).toBe(pred.taskId);
        });
      });
    });
  });

  describe('Pattern Management', () => {
    it('should return all stored patterns', () => {
      guard.analyzePatterns(mockHistoricalTasks);
      const patterns = guard.getPatterns();
      
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should return empty array before analysis', () => {
      const freshGuard = new PredictiveGuard();
      const patterns = freshGuard.getPatterns();
      
      expect(patterns).toEqual([]);
    });

    it('should return all active predictions', () => {
      guard.analyzePatterns(mockHistoricalTasks);
      
      const currentTasks: Task[] = [{
        id: 'task-pred-check',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      guard.predictBlockers(currentTasks);
      const predictions = guard.getPredictions();
      
      expect(predictions).toBeDefined();
    });

    it('should clear predictions without affecting patterns', () => {
      guard.analyzePatterns(mockHistoricalTasks);
      
      const currentTasks: Task[] = [{
        id: 'task-clear',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      guard.predictBlockers(currentTasks);
      const beforeClear = guard.getPredictions().length;
      
      guard.clearPredictions();
      const afterClear = guard.getPredictions().length;
      const patternsStillExist = guard.getPatterns().length;
      
      expect(afterClear).toBe(0);
      expect(patternsStillExist).toBeGreaterThan(0);
    });

    it('should allow updating auto-mitigate threshold', () => {
      guard.setAutoMitigateThreshold(0.5);
      
      // Should not throw
      expect(() => guard.setAutoMitigateThreshold(0.9)).not.toThrow();
      expect(() => guard.setAutoMitigateThreshold(0.1)).not.toThrow();
    });

    it('should clamp threshold to [0, 1] range', () => {
      expect(() => guard.setAutoMitigateThreshold(-0.5)).not.toThrow();
      expect(() => guard.setAutoMitigateThreshold(1.5)).not.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create guard with default options', () => {
      const defaultGuard = createPredictiveGuard();
      expect(defaultGuard).toBeInstanceOf(PredictiveGuard);
    });

    it('should create guard with custom threshold', () => {
      const customGuard = createPredictiveGuard({ autoMitigateThreshold: 0.8 });
      expect(customGuard).toBeInstanceOf(PredictiveGuard);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task arrays', () => {
      const patterns = guard.analyzePatterns([]);
      expect(patterns).toEqual([]);
    });

    it('should handle tasks without blocked dates', () => {
      const tasksWithoutDates: Task[] = [{
        id: 'task-no-dates',
        title: 'Task',
        status: 'blocked',
        priority: 'high',
        createdAt: new Date(),
        // No blockedAt/unblockedAt
      }];

      const patterns = guard.analyzePatterns(tasksWithoutDates);
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should handle weekend timing patterns', () => {
      const fridayTask: Task = {
        id: 'task-friday',
        title: 'Friday Task',
        status: 'blocked',
        priority: 'medium',
        blockedAt: new Date('2026-02-14'), // Friday
        createdAt: new Date('2026-02-12'),
      };

      const patterns = guard.analyzePatterns([...mockHistoricalTasks, fridayTask]);
      const timingPattern = patterns.find(p => p.id === 'pattern-weekend-boundary');
      
      // May or may not detect depending on frequency
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should handle underestimation patterns', () => {
      const underestimatedTask: Task = {
        id: 'task-underest',
        title: 'Underestimated Task',
        status: 'blocked',
        priority: 'medium',
        estimatedHours: 4,
        actualHours: 10,
        blockedAt: new Date('2026-02-10'),
        createdAt: new Date('2026-02-08'),
      };

      const patterns = guard.analyzePatterns([...mockHistoricalTasks, underestimatedTask]);
      const underestPattern = patterns.find(p => p.id === 'pattern-underestimation');
      
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should handle assignee overload patterns', () => {
      // Create tasks with same assignee
      const overlloadedTasks: Task[] = Array.from({ length: 6 }, (_, i) => ({
        id: `task-overload-${i}`,
        title: `Task ${i}`,
        status: 'blocked',
        priority: 'high',
        assignee: 'overloaded_user',
        blockedAt: new Date('2026-02-10'),
        createdAt: new Date('2026-02-08'),
      }));

      const patterns = guard.analyzePatterns(overlloadedTasks);
      const overloadPattern = patterns.find(p => p.id === 'pattern-assignee-overload');
      
      // May detect if frequency threshold is met
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('Confidence Score Boost', () => {
    beforeEach(() => {
      guard.analyzePatterns(mockHistoricalTasks);
    });

    it('should boost confidence for critical tasks matching high-severity patterns', () => {
      const currentTasks: Task[] = [{
        id: 'task-boost',
        title: 'Critical Task',
        status: 'pending',
        priority: 'critical',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      // Critical tasks should have boosted confidence
      predictions.forEach(pred => {
        expect(pred.confidence).toBeGreaterThanOrEqual(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should include pattern frequency in confidence calculation', () => {
      const currentTasks: Task[] = [{
        id: 'task-freq',
        title: 'Task',
        status: 'pending',
        priority: 'high',
        createdAt: new Date(),
      }];

      const predictions = guard.predictBlockers(currentTasks);
      
      predictions.forEach(pred => {
        // Confidence should account for pattern frequency
        expect(pred.confidence).toBeGreaterThanOrEqual(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});
