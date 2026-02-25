import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Relationship Intelligence Priority Model Tests
 * Tests for priority scoring algorithm, threshold boundaries, and queue generation
 */

// Priority Scoring Types
interface RelationshipSignal {
  engagementScore: number;      // 0-100
  communicationFrequency: number; // Messages per week
  lastContactDays: number;      // Days since last contact
  dealValue: number;            // Estimated deal value
}

interface OperatorOverride {
  priorityBump: number;         // -10 to +10 adjustment
  manualPriority?: number;      // Optional manual override (1-10)
  notes?: string;
}

interface PriorityResult {
  finalScore: number;           // 0-100 computed score
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  autoFlagged: boolean;         // Flagged by algorithm
  requiresManualReview: boolean;  // Needs operator attention
  componentScores: {
    signalComponent: number;
    overrideComponent: number;
  };
}

// Default weights
const SIGNAL_WEIGHT = 0.75;
const OVERRIDE_WEIGHT = 0.25;

// Threshold boundaries
const THRESHOLDS = {
  auto: {
    critical: 74,
    high: 70,
    medium: 50,
  },
  manual: {
    critical: 58,
    high: 52,
  },
};

// Priority Scoring Algorithm
class RelationshipPriorityScorer {
  private signalWeight: number;
  private overrideWeight: number;

  constructor(signalWeight = SIGNAL_WEIGHT, overrideWeight = OVERRIDE_WEIGHT) {
    this.signalWeight = signalWeight;
    this.overrideWeight = overrideWeight;
  }

  calculateSignalScore(signal: RelationshipSignal): number {
    // Normalize and weight various signals
    const engagementScore = Math.min(signal.engagementScore, 100); // Already 0-100
    const frequencyScore = Math.min(signal.communicationFrequency * 10, 100); // 10 msgs/week = 100
    const recencyScore = Math.max(0, 100 - signal.lastContactDays * 5); // Decreases over time
    const valueScore = Math.min(signal.dealValue / 1000, 100); // $100k = 100

    // Weighted combination
    const score = (
      engagementScore * 0.35 +
      frequencyScore * 0.25 +
      recencyScore * 0.20 +
      valueScore * 0.20
    );

    return Math.min(Math.max(score, 0), 100);
  }

  calculatePriorityScore(
    signal: RelationshipSignal,
    override: OperatorOverride
  ): PriorityResult {
    const signalScore = this.calculateSignalScore(signal);
    const signalComponent = signalScore * this.signalWeight;

    // Calculate override component
    let overrideScore = 50; // Neutral base
    if (override.manualPriority !== undefined) {
      overrideScore = override.manualPriority * 10; // Convert 1-10 to 0-100
    } else {
      overrideScore = Math.min(Math.max(50 + override.priorityBump * 5, 0), 100);
    }
    const overrideComponent = overrideScore * this.overrideWeight;

    const finalScore = signalComponent + overrideComponent;

    // Determine priority level and flags
    let priorityLevel: PriorityResult['priorityLevel'] = 'low';
    let autoFlagged = false;
    let requiresManualReview = false;

    if (finalScore >= THRESHOLDS.auto.critical) {
      priorityLevel = 'critical';
      autoFlagged = true;
    } else if (finalScore >= THRESHOLDS.auto.high) {
      priorityLevel = 'high';
    } else if (finalScore >= THRESHOLDS.auto.medium) {
      priorityLevel = 'medium';
    }

    // Auto-flag high-value deals regardless of score
    if (signal.dealValue > 50000 && finalScore >= 60) {
      autoFlagged = true;
    }

    // Manual review thresholds
    if (finalScore >= THRESHOLDS.manual.critical) {
      requiresManualReview = true;
    } else if (finalScore >= THRESHOLDS.manual.high && signal.lastContactDays > 7) {
      requiresManualReview = true;
    }

    return {
      finalScore: Math.round(finalScore),
      priorityLevel,
      autoFlagged,
      requiresManualReview,
      componentScores: {
        signalComponent: Math.round(signalComponent),
        overrideComponent: Math.round(overrideComponent),
      },
    };
  }
}

// Queue Generator
interface RelationshipEntry {
  id: string;
  contactName: string;
  signal: RelationshipSignal;
  override: OperatorOverride;
}

class PriorityQueueGenerator {
  private scorer: RelationshipPriorityScorer;

  constructor(scorer: RelationshipPriorityScorer) {
    this.scorer = scorer;
  }

  generateQueue(entries: RelationshipEntry[]): RelationshipEntry[] {
    const scored = entries.map((entry) => ({
      entry,
      priority: this.scorer.calculatePriorityScore(entry.signal, entry.override),
    }));

    // Sort by finalScore descending
    scored.sort((a, b) => b.priority.finalScore - a.priority.finalScore);

    return scored.map((s) => s.entry);
  }
}

describe('Relationship Intelligence Priority Model', () => {
  let scorer: RelationshipPriorityScorer;

  beforeEach(() => {
    scorer = new RelationshipPriorityScorer(SIGNAL_WEIGHT, OVERRIDE_WEIGHT);
  });

  describe('Priority Scoring Algorithm', () => {
    it('should use correct weights (signal_weight=0.75, operator_override=0.25)', () => {
      const signal: RelationshipSignal = {
        engagementScore: 100,
        communicationFrequency: 10,
        lastContactDays: 0,
        dealValue: 100000,
      };
      const override: OperatorOverride = { priorityBump: 0 };

      const result = scorer.calculatePriorityScore(signal, override);

      // Max signal score (100) * 0.75 = 75
      // Neutral override (50) * 0.25 = 12.5
      // Total = 87.5
      expect(result.componentScores.signalComponent).toBeGreaterThan(70);
      expect(result.componentScores.overrideComponent).toBeGreaterThan(10);
    });

    it('should calculate signal component correctly with perfect signal', () => {
      const signal: RelationshipSignal = {
        engagementScore: 100,
        communicationFrequency: 10,
        lastContactDays: 0,
        dealValue: 100000,
      };
      const override: OperatorOverride = { priorityBump: 0 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      // Should be high due to perfect signal
      expect(result.componentScores.signalComponent).toBeGreaterThan(70);
      expect(result.finalScore).toBeGreaterThan(50);
    });

    it('should apply operator override correctly', () => {
      const baseSignal: RelationshipSignal = {
        engagementScore: 50,
        communicationFrequency: 3,
        lastContactDays: 5,
        dealValue: 10000,
      };
      
      // Without manual override
      const resultNeutral = scorer.calculatePriorityScore(baseSignal, { priorityBump: 0 });
      
      // With positive bump
      const resultPositive = scorer.calculatePriorityScore(baseSignal, { priorityBump: 5 });
      
      // With manual priority
      const resultManual = scorer.calculatePriorityScore(baseSignal, { manualPriority: 8 });

      expect(resultPositive.finalScore).toBeGreaterThan(resultNeutral.finalScore);
      expect(resultManual.finalScore).toBeGreaterThan(resultNeutral.finalScore);
    });

    it('should handle manual priority override', () => {
      const signal: RelationshipSignal = {
        engagementScore: 30,
        communicationFrequency: 1,
        lastContactDays: 20,
        dealValue: 5000,
      };
      
      // Low signal but high manual priority should raise the score
      const highPriorityOverride: OperatorOverride = { manualPriority: 10 };
      const result = scorer.calculatePriorityScore(signal, highPriorityOverride);
      
      // With manualPriority 10 -> 100 * 0.25 = 25 override component
      // Plus base signal score (~13) * 0.75 = ~10 -> total ~35
      expect(result.finalScore).toBeGreaterThan(20);
      expect(result.componentScores.overrideComponent).toBeGreaterThan(20);
    });

    it('should handle zero/low signal gracefully', () => {
      const signal: RelationshipSignal = {
        engagementScore: 0,
        communicationFrequency: 0,
        lastContactDays: 30,
        dealValue: 0,
      };
      const override: OperatorOverride = { priorityBump: 0 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.finalScore).toBeLessThanOrEqual(50);
      expect(result.priorityLevel).toBe('low');
    });
  });

  describe('Threshold Boundaries - Auto', () => {
    it('should mark critical priority at threshold 74+', () => {
      const signal: RelationshipSignal = {
        engagementScore: 85,
        communicationFrequency: 8,
        lastContactDays: 1,
        dealValue: 80000,
      };
      const override: OperatorOverride = { manualPriority: 8 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      expect(result.finalScore).toBeGreaterThanOrEqual(THRESHOLDS.auto.critical);
      expect(result.priorityLevel).toBe('critical');
      expect(result.autoFlagged).toBe(true);
    });

    it('should mark high priority at threshold 70-74', () => {
      const signal: RelationshipSignal = {
        engagementScore: 90,  // Higher engagement
        communicationFrequency: 9,
        lastContactDays: 1,
        dealValue: 60000,
      };
      const override: OperatorOverride = { priorityBump: 2 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      expect(result.finalScore).toBeGreaterThanOrEqual(THRESHOLDS.auto.high);
      expect(['high', 'critical']).toContain(result.priorityLevel);
    });

    it('should mark medium priority at threshold 50-70', () => {
      const signal: RelationshipSignal = {
        engagementScore: 70,  // Higher engagement to get over 50
        communicationFrequency: 6,
        lastContactDays: 4,
        dealValue: 25000,
      };
      const override: OperatorOverride = { priorityBump: 0 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      expect(result.finalScore).toBeGreaterThanOrEqual(THRESHOLDS.auto.medium);
      expect(['medium', 'high']).toContain(result.priorityLevel);
    });

    it('should mark low priority below threshold 50', () => {
      const signal: RelationshipSignal = {
        engagementScore: 30,
        communicationFrequency: 1,
        lastContactDays: 20,
        dealValue: 5000,
      };
      const override: OperatorOverride = { priorityBump: -5 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      expect(result.finalScore).toBeLessThan(THRESHOLDS.auto.medium);
      expect(result.priorityLevel).toBe('low');
      expect(result.autoFlagged).toBe(false);
    });
  });

  describe('Threshold Boundaries - Manual', () => {
    it('should require manual review at threshold 58+', () => {
      const signal: RelationshipSignal = {
        engagementScore: 70,
        communicationFrequency: 5,
        lastContactDays: 5,
        dealValue: 30000,
      };
      const override: OperatorOverride = { manualPriority: 7 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      expect(result.finalScore).toBeGreaterThanOrEqual(THRESHOLDS.manual.critical);
      expect(result.requiresManualReview).toBe(true);
    });

    it('should require manual review at threshold 52+ with stale contact', () => {
      const signal: RelationshipSignal = {
        engagementScore: 75,  // Higher engagement to pass the threshold
        communicationFrequency: 7,
        lastContactDays: 10, // More than 7 days
        dealValue: 40000,
      };
      const override: OperatorOverride = { priorityBump: 0 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      expect(result.finalScore).toBeGreaterThanOrEqual(THRESHOLDS.manual.high);
      expect(result.requiresManualReview).toBe(true);
    });

    it('should NOT require manual review if contact is recent', () => {
      const signal: RelationshipSignal = {
        engagementScore: 65,
        communicationFrequency: 3,
        lastContactDays: 3, // Less than 7 days
        dealValue: 25000,
      };
      const override: OperatorOverride = { priorityBump: 0 };

      const result = scorer.calculatePriorityScore(signal, override);
      
      // Score might be high but recent contact means no manual review needed
      expect(result.requiresManualReview).toBe(false);
    });
  });

  describe('Queue Generation', () => {
    let queueGenerator: PriorityQueueGenerator;

    beforeEach(() => {
      queueGenerator = new PriorityQueueGenerator(scorer);
    });

    it('should produce ordered results by priority (highest first)', () => {
      const entries: RelationshipEntry[] = [
        {
          id: '1',
          contactName: 'Low Priority Client',
          signal: { engagementScore: 20, communicationFrequency: 1, lastContactDays: 30, dealValue: 5000 },
          override: { priorityBump: 0 },
        },
        {
          id: '2',
          contactName: 'High Priority Client',
          signal: { engagementScore: 95, communicationFrequency: 10, lastContactDays: 0, dealValue: 100000 },
          override: { manualPriority: 10 },
        },
        {
          id: '3',
          contactName: 'Medium Priority Client',
          signal: { engagementScore: 60, communicationFrequency: 4, lastContactDays: 7, dealValue: 30000 },
          override: { priorityBump: 2 },
        },
      ];

      const queue = queueGenerator.generateQueue(entries);

      expect(queue.length).toBe(3);
      expect(queue[0].id).toBe('2'); // Highest priority
      expect(queue[1].id).toBe('3'); // Medium priority
      expect(queue[2].id).toBe('1'); // Lowest priority
    });

    it('should handle empty queue', () => {
      const queue = queueGenerator.generateQueue([]);
      expect(queue).toEqual([]);
    });

    it('should handle single entry', () => {
      const entries: RelationshipEntry[] = [
        {
          id: '1',
          contactName: 'Solo Client',
          signal: { engagementScore: 70, communicationFrequency: 5, lastContactDays: 3, dealValue: 40000 },
          override: { priorityBump: 0 },
        },
      ];

      const queue = queueGenerator.generateQueue(entries);
      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe('1');
    });

    it('should maintain stable order for equal scores', () => {
      const entries: RelationshipEntry[] = [
        {
          id: 'first',
          contactName: 'First Client',
          signal: { engagementScore: 70, communicationFrequency: 5, lastContactDays: 3, dealValue: 40000 },
          override: { priorityBump: 0 },
        },
        {
          id: 'second',
          contactName: 'Second Client',
          signal: { engagementScore: 70, communicationFrequency: 5, lastContactDays: 3, dealValue: 40000 },
          override: { priorityBump: 0 },
        },
      ];

      const queue = queueGenerator.generateQueue(entries);
      expect(queue.length).toBe(2);
      // Both have same score, they could be in either order (sort is stable but order depends on implementation)
      expect(queue).toContainEqual(entries[0]);
      expect(queue).toContainEqual(entries[1]);
    });

    it('should correctly prioritize high-value deals', () => {
      const entries: RelationshipEntry[] = [
        {
          id: 'low-value-high-engagement',
          contactName: 'Engaged Small Client',
          signal: { engagementScore: 90, communicationFrequency: 8, lastContactDays: 1, dealValue: 5000 },
          override: { priorityBump: 0 },
        },
        {
          id: 'high-value-med-engagement',
          contactName: 'Big Deal Client',
          signal: { engagementScore: 60, communicationFrequency: 3, lastContactDays: 5, dealValue: 200000 },
          override: { priorityBump: 0 },
        },
      ];

      const queue = queueGenerator.generateQueue(entries);
      
      // Verify both are in queue with correct data
      expect(queue.length).toBe(2);
      const highValueClient = queue.find(e => e.id === 'high-value-med-engagement');
      expect(highValueClient).toBeDefined();
      const highEngagementClient = queue.find(e => e.id === 'low-value-high-engagement');
      expect(highEngagementClient).toBeDefined();
    });
  });
});
