import { supabase } from '@/lib/supabase';
import { createABTestEvent, getTestResults } from './tracker';

export interface ABTest {
  id: string;
  name: string;
  description?: string;
  type: 'sequence' | 'touch';
  sequenceId: string;
  touchId?: string;
  variants: ABTestVariant[];
  split: number;
  minSample: number;
  maxSample?: number;
  confidenceThreshold: number;
  primaryMetric: 'openRate' | 'clickRate' | 'replyRate' | 'bookRate';
  status: ABTestStatus;
  winningVariantId?: string;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ABTestVariant {
  id: string;
  testId: string;
  variantKey: 'a' | 'b' | 'c' | 'd';
  name: string;
  weight: number;
  touchVariants?: Record<string, string>;
  sampleSize: number;
  metrics: {
    openRate: number;
    clickRate: number;
    replyRate: number;
    bookRate: number;
  };
  isControl: boolean;
  isWinner?: boolean;
  confidenceVsControl?: number;
}

export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'winner_selected';

export interface ABTestResult {
  testId: string;
  variantId: string;
  variantKey: 'a' | 'b' | 'c' | 'd';
  sampleSize: number;
  metrics: {
    openRate: number;
    clickRate: number;
    replyRate: number;
    bookRate: number;
  };
  statistics: {
    pValue: number;
    confidenceInterval: [number, number];
    power: number;
    significant: boolean;
    liftVsControl?: number;
  };
}

/**
 * Statistical significance calculation
 */
export function calculateStatisticalSignificance(
  variantSample: number,
  variantSuccesses: number,
  controlSample: number,
  controlSuccesses: number
): { pValue: number; confidenceInterval: [number, number]; power: number } {
  // Pooled proportion
  const pPooled = (variantSuccesses + controlSuccesses) / (variantSample + controlSample);
  
  // Standard error
  const se = Math.sqrt(
    pPooled * (1 - pPooled) * (1 / variantSample + 1 / controlSample)
  );
  
  // Z-score
  const p1 = variantSuccesses / variantSample;
  const p2 = controlSuccesses / controlSample;
  const z = (p1 - p2) / se;
  
  // P-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  
  // Confidence interval (95%)
  const diff = p1 - p2;
  const margin = 1.96 * se;
  const confidenceInterval: [number, number] = [diff - margin, diff + margin];
  
  // Statistical power (simplified)
  const power = calculatePower(variantSample, controlSample, p1, p2);
  
  return { pValue, confidenceInterval, power };
}

function normalCDF(x: number): number {
  // Approximation of standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1 + sign * y);
}

function calculatePower(
  n1: number,
  n2: number,
  p1: number,
  p2: number
): number {
  const se = Math.sqrt(
    (p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2
  );
  const z = (p1 - p2) / se;
  return normalCDF(z - 1.96) + normalCDF(-z - 1.96);
}

export class ABEngine {
  private supabase = supabase;

  /**
   * Create a new A/B test with automatic variant generation
   */
  async createTest(config: {
    name: string;
    description?: string;
    sequenceId: string;
    touchId?: string;
    variantCount?: number;
    variants?: string[];
    split?: number;
    minSample?: number;
    maxSample?: number;
    confidenceThreshold?: number;
    primaryMetric?: 'openRate' | 'clickRate' | 'replyRate' | 'bookRate';
    createdBy: string;
  }): Promise<ABTest> {
    const variantCount = config.variantCount || 2;
    const variantNames = Array.isArray(config.variants) 
      ? config.variants 
      : this.generateVariantNames(variantCount);
    
    const testData = {
      name: config.name,
      description: config.description,
      type: config.touchId ? 'touch' : 'sequence',
      sequence_id: config.sequenceId,
      touch_id: config.touchId,
      split: config.split || 0.5,
      min_sample: config.minSample || 100,
      max_sample: config.maxSample,
      confidence_threshold: config.confidenceThreshold || 0.95,
      primary_metric: config.primaryMetric || 'replyRate',
      status: 'draft' as ABTestStatus,
      created_by: config.createdBy,
    };

    const { data: test, error } = await this.supabase
      .from('ab_tests')
      .insert([testData])
      .select()
      .single();

    if (error || !test) throw error;

    // Create variants
    const variants = variantNames.map((name, i) => ({
      test_id: test.id,
      variant_key: String.fromCharCode(97 + i),
      name,
      weight: i === 0 ? 0.5 : 0.5 / (variantNames.length - 1),
      touch_variants: config.touchId ? { [config.touchId]: name } : undefined,
      is_control: i === 0,
    }));

    const { error: variantError } = await this.supabase
      .from('ab_test_variants')
      .insert(variants);

    if (variantError) throw variantError;

    return this.hydrateTest(test);
  }

  private generateVariantNames(count: number): string[] {
    const letters = ['A', 'B', 'C', 'D'];
    return letters.slice(0, count).map(l => `Variant ${l}`);
  }

  /**
   * Start a test (change status from draft to running)
   */
  async startTest(testId: string): Promise<ABTest> {
    const { data, error } = await this.supabase
      .from('ab_tests')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', testId)
      .select()
      .single();

    if (error || !data) throw error;
    return this.hydrateTest(data);
  }

  /**
   * Get test by ID
   */
  async getTest(testId: string): Promise<ABTest> {
    const { data, error } = await this.supabase
      .from('ab_tests')
      .select('*, ab_test_variants(*)')
      .eq('id', testId)
      .single();

    if (error || !data) throw error;
    return this.hydrateTest(data);
  }

  private hydrateTest(data: Record<string, unknown>): ABTest {
    const variants = (data.ab_test_variants as Record<string, unknown>[] || []).map(v => ({
      id: v.id as string,
      testId: v.test_id as string,
      variantKey: v.variant_key as 'a' | 'b' | 'c' | 'd',
      name: v.name as string,
      weight: v.weight as number,
      touchVariants: v.touch_variants as Record<string, string> | undefined,
      sampleSize: v.sample_size as number,
      metrics: v.metrics as ABTestVariant['metrics'],
      isControl: v.is_control as boolean,
      isWinner: v.is_winner as boolean | undefined,
      confidenceVsControl: v.confidence_vs_control as number | undefined,
    }));

    return {
      id: data.id as string,
      name: data.name as string,
      description: data.description as string | undefined,
      type: data.type as 'sequence' | 'touch',
      sequenceId: data.sequence_id as string,
      touchId: data.touch_id as string | undefined,
      variants,
      split: data.split as number,
      minSample: data.min_sample as number,
      maxSample: data.max_sample as number | undefined,
      confidenceThreshold: data.confidence_threshold as number,
      primaryMetric: data.primary_metric as ABTest['primaryMetric'],
      status: data.status as ABTestStatus,
      winningVariantId: data.winning_variant_id as string | undefined,
      confidence: data.confidence as number | undefined,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
      createdBy: data.created_by as string,
    };
  }

  /**
   * Assign prospects to test variants
   */
  async assignProspectsToVariants(
    testId: string,
    prospectIds: string[]
  ): Promise<Record<string, string>> {
    const test = await this.getTest(testId);
    const assignments: Record<string, string> = {};

    for (const prospectId of prospectIds) {
      // Use consistent hashing based on prospect ID
      const variant = this.assignVariant(prospectId, test.variants);
      assignments[prospectId] = variant.id;

      // Track enrollment event
      await createABTestEvent({
        testId,
        variantId: variant.id,
        prospectId,
        sequenceId: test.sequenceId,
        touchId: test.touchId,
        eventType: 'sent',
        metadata: { enrollment: true },
      });
    }

    return assignments;
  }

  private assignVariant(prospectId: string, variants: ABTestVariant[]): ABTestVariant {
    // Use consistent hashing based on prospect ID
    const hash = prospectId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);

    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    const normalizedHash = Math.abs(hash) / Number.MAX_SAFE_INTEGER;
    const threshold = normalizedHash * totalWeight;

    let cumulativeWeight = 0;
    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (threshold <= cumulativeWeight) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  /**
   * Analyze test results
   */
  async analyzeResults(testId: string): Promise<ABTestResult[]> {
    const test = await this.getTest(testId);
    const control = test.variants.find(v => v.isControl);
    
    const allResults = await getTestResults(testId);
    const controlResults = control 
      ? allResults.find(r => r.variant_id === control.id)
      : undefined;

    const results: ABTestResult[] = [];

    for (const variant of test.variants) {
      const variantResults = allResults.find(r => r.variant_id === variant.id);
      
      if (!variantResults) continue;

      const metrics = {
        openRate: variantResults.open_rate,
        clickRate: variantResults.click_rate,
        replyRate: variantResults.reply_rate,
        bookRate: variantResults.meeting_rate,
      };

      let primaryValue = 0;
      let controlValue = 0;
      
      switch (test.primaryMetric) {
        case 'openRate':
          primaryValue = metrics.openRate;
          controlValue = controlResults?.open_rate ?? 0;
          break;
        case 'clickRate':
          primaryValue = metrics.clickRate;
          controlValue = controlResults?.click_rate ?? 0;
          break;
        case 'replyRate':
          primaryValue = metrics.replyRate;
          controlValue = controlResults?.reply_rate ?? 0;
          break;
        case 'bookRate':
          primaryValue = metrics.bookRate;
          controlValue = controlResults?.meeting_rate ?? 0;
          break;
      }

      const stats = calculateStatisticalSignificance(
        variantResults.sent,
        primaryValue * variantResults.sent,
        controlResults?.sent ?? 0,
        controlValue * (controlResults?.sent ?? 0)
      );

      let liftVsControl: number | undefined;
      if (control && variant.id !== control.id && controlValue > 0) {
        liftVsControl = ((primaryValue - controlValue) / controlValue) * 100;
      }

      results.push({
        testId,
        variantId: variant.id,
        variantKey: variant.variantKey,
        sampleSize: variantResults.sent,
        metrics,
        statistics: {
          ...stats,
          significant: stats.pValue < 0.05 && liftVsControl !== undefined && Math.abs(liftVsControl) > 5,
          liftVsControl,
        },
      });
    }

    return results;
  }

  /**
   * Get winning variant (if any)
   */
  async getWinner(testId: string): Promise<ABTestVariant | null> {
    const results = await this.analyzeResults(testId);
    
    const winner = results.find(
      r => r.statistics.significant && (r.statistics.liftVsControl ?? 0) > 0
    );

    if (!winner) return null;

    const test = await this.getTest(testId);
    return test.variants.find(v => v.id === winner.variantId) || null;
  }

  /**
   * Select winning variant and complete test
   */
  async selectWinner(testId: string, variantId: string): Promise<ABTest> {
    const { data, error } = await this.supabase
      .from('ab_tests')
      .update({
        status: 'winner_selected',
        winning_variant_id: variantId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testId)
      .select()
      .single();

    if (error || !data) throw error;

    // Update variant
    await this.supabase
      .from('ab_test_variants')
      .update({ is_winner: true })
      .eq('id', variantId);

    return this.hydrateTest(data);
  }

  /**
   * Get test progress
   */
  async getTestProgress(testId: string): Promise<{
    totalEnrolled: number;
    totalSent: number;
    variantBreakdown: Record<string, { enrolled: number; sent: number; openRate: number; replyRate: number }>;
  }> {
    const results = await this.analyzeResults(testId);

    const breakdown: Record<string, { enrolled: number; sent: number; openRate: number; replyRate: number }> = {};

    for (const result of results) {
      breakdown[result.variantKey] = {
        enrolled: result.sampleSize,
        sent: result.sampleSize,
        openRate: result.metrics.openRate,
        replyRate: result.metrics.replyRate,
      };
    }

    return {
      totalEnrolled: results.reduce((sum, r) => sum + r.sampleSize, 0),
      totalSent: results.reduce((sum, r) => sum + r.sampleSize, 0),
      variantBreakdown: breakdown,
    };
  }
}

export { ABEngine as default };
