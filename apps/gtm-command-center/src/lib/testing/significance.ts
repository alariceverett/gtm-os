/**
 * Statistical Significance Calculator
 * Implements statistical tests for A/B testing
 * 
 * Supports:
 * - Z-test for proportions (default for open rates, click rates, reply rates)
 * - Chi-square test for independence
 * - Confidence intervals
 * - Sample size calculations
 */

export interface SignificanceResult {
  // Test statistics
  zScore: number;
  pValue: number;
  confidenceInterval: [number, number]; // [lower, upper]
  standardError: number;
  
  // Interpretation
  significant: boolean; // At given confidence level
  confidenceLevel: number; // e.g., 0.95
  winner?: 'control' | 'treatment';
  
  // Effect size
  absoluteDifference: number;
  relativeLift: number; // Percentage improvement
  
  // Sample metadata
  controlSample: number;
  treatmentSample: number;
  minimumDetectableEffect: number;
  recommendedSampleSize: number;
}

export interface SampleSizeParams {
  baselineRate: number;        // Control conversion rate (0-1)
  minimumDetectableEffect: number; // Relative improvement (0-1)
  confidenceLevel: number;     // e.g., 0.95
  statisticalPower: number;    // e.g., 0.8
  numVariants?: number;        // For Bonferroni correction
}

// Z-scores for common confidence levels
const Z_SCORES: Record<number, number> = {
  0.9: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};

// Z-scores for statistical power
const POWER_Z_SCORES: Record<number, number> = {
  0.7: 0.52,
  0.8: 0.84,
  0.9: 1.28,
  0.95: 1.645,
};

/**
 * Calculate statistical significance using z-test for proportions
 * 
 * @param controlSample - Total sample size for control
 * @param controlConversions - Conversions (successes) in control
 * @param treatmentSample - Total sample size for treatment
 * @param treatmentConversions - Conversions (successes) in treatment
 * @param confidenceLevel - Confidence level (default 0.95)
 * @returns SignificanceResult with all statistics
 */
export function calculateStatisticalSignificance(
  controlSample: number,
  controlConversions: number,
  treatmentSample: number,
  treatmentConversions: number,
  confidenceLevel: number = 0.95
): Omit<SignificanceResult, 'controlSample' | 'treatmentSample' | 'minimumDetectableEffect' | 'recommendedSampleSize'> {
  // Input validation
  if (controlSample <= 0 || treatmentSample <= 0) {
    return {
      zScore: 0,
      pValue: 1,
      confidenceInterval: [0, 0],
      standardError: 0,
      significant: false,
      confidenceLevel,
      absoluteDifference: 0,
      relativeLift: 0,
    };
  }

  // Conversion rates
  const controlRate = controlConversions / controlSample;
  const treatmentRate = treatmentConversions / treatmentSample;

  // Pooled probability for two-proportion z-test
  const pooledRate = (controlConversions + treatmentConversions) / (controlSample + treatmentSample);

  // Standard error
  const standardError = Math.sqrt(
    pooledRate * (1 - pooledRate) * (1 / controlSample + 1 / treatmentSample)
  );

  // Z-score
  const zScore = standardError > 0 
    ? (treatmentRate - controlRate) / standardError 
    : 0;

  // P-value (two-tailed)
  const pValue = 2 * (1 - standardNormalCDF(Math.abs(zScore)));

  // Confidence interval for difference
  const z = Z_SCORES[confidenceLevel] || 1.96;
  const diffSE = Math.sqrt(
    (controlRate * (1 - controlRate)) / controlSample +
    (treatmentRate * (1 - treatmentRate)) / treatmentSample
  );
  const delta = treatmentRate - controlRate;
  const marginOfError = z * diffSE;

  return {
    zScore,
    pValue,
    confidenceInterval: [delta - marginOfError, delta + marginOfError],
    standardError,
    significant: pValue < (1 - confidenceLevel) && zScore > 0,
    confidenceLevel,
    winner: zScore > 0 ? 'treatment' : zScore < 0 ? 'control' : undefined,
    absoluteDifference: delta,
    relativeLift: controlRate > 0 ? ((treatmentRate - controlRate) / controlRate) * 100 : 0,
  };
}

/**
 * Quick check if test is significant (convenience method)
 */
export function isSignificant(
  controlSample: number,
  controlConversions: number,
  treatmentSample: number,
  treatmentConversions: number,
  confidenceLevel: number = 0.95
): boolean {
  const result = calculateStatisticalSignificance(
    controlSample,
    controlConversions,
    treatmentSample,
    treatmentConversions,
    confidenceLevel
  );
  return result.significant;
}

/**
 * Calculate required sample size for A/B test
 * Uses standard power analysis formula for proportions
 * 
 * @param params - Sample size calculation parameters
 * @returns Required sample size per variant
 */
export function calculateSampleSize(params: SampleSizeParams): number {
  const {
    baselineRate,
    minimumDetectableEffect,
    confidenceLevel,
    statisticalPower,
    numVariants = 2,
  } = params;

  const zAlpha = Z_SCORES[confidenceLevel] || 1.96;
  const zBeta = POWER_Z_SCORES[statisticalPower] || 0.84;

  // Treatment rate
  const treatmentRate = baselineRate * (1 + minimumDetectableEffect);
  
  // Pooled rate
  const pooledRate = (baselineRate + treatmentRate) / 2;

  // Effect size (Cohen's h for proportions)
  const effectSize = 2 * Math.asin(Math.sqrt(baselineRate)) - 2 * Math.asin(Math.sqrt(treatmentRate));
  
  // Sample size per variant (with Bonferroni correction for multiple variants)
  const bonferroniCorrection = numVariants > 2 ? Math.sqrt(numVariants - 1) : 1;
  const adjustedZAlpha = zAlpha * bonferroniCorrection;

  const n = Math.ceil(
    Math.pow(adjustedZAlpha * Math.sqrt(2 * pooledRate * (1 - pooledRate)) +
             zBeta * Math.sqrt(baselineRate * (1 - baselineRate) + treatmentRate * (1 - treatmentRate)),
             2) /
    Math.pow(baselineRate - treatmentRate, 2)
  );

  return Math.max(n, 100); // Minimum 100 per variant
}

/**
 * Calculate sample size for a target metric
 */
export function calculateSampleSizeForMetric(
  metric: 'openRate' | 'clickRate' | 'replyRate' | 'bookRate',
  baselineRate: number,
  targetLift: number,
  confidenceLevel: number = 0.95,
  power: number = 0.8
): number {
  return calculateSampleSize({
    baselineRate,
    minimumDetectableEffect: targetLift,
    confidenceLevel,
    statisticalPower: power,
  });
}

/**
 * Chi-square test for independence
 * Useful when comparing overall distributions
 */
export function chiSquareTest(
  observed: number[][]
): { chi2: number; pValue: number; significant: boolean; degreesOfFreedom: number } {
  const rows = observed.length;
  const cols = observed[0]?.length || 0;
  const df = (rows - 1) * (cols - 1);

  // Calculate row and column totals
  const rowTotals = observed.map(r => r.reduce((a, b) => a + b, 0));
  const colTotals = observed[0].map((_, c) => 
    observed.reduce((sum, r) => sum + r[c], 0)
  );
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  // Calculate chi-square statistic
  let chi2 = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / grandTotal;
      if (expected > 0) {
        chi2 += Math.pow(observed[i][j] - expected, 2) / expected;
      }
    }
  }

  // Approximate p-value (simplified Chi-squared CDF)
  const pValue = 1 - chiSquaredCDF(chi2, df);

  return {
    chi2,
    pValue,
    significant: pValue < 0.05,
    degreesOfFreedom: df,
  };
}

/**
 * Bayesian analysis for A/B test
 * Returns probability that treatment is better than control
 */
export function bayesianAnalysis(
  controlSample: number,
  controlConversions: number,
  treatmentSample: number,
  treatmentConversions: number,
  simulations: number = 10000
): { probabilityTreatmentWins: number; expectedLift: number; credibleInterval: [number, number] } {
  // Beta prior (uniform)
  const alphaPrior = 1;
  const betaPrior = 1;

  // Posterior parameters
  const controlAlpha = alphaPrior + controlConversions;
  const controlBeta = betaPrior + controlSample - controlConversions;
  const treatmentAlpha = alphaPrior + treatmentConversions;
  const treatmentBeta = betaPrior + treatmentSample - treatmentConversions;

  // Monte Carlo simulation
  let treatmentWins = 0;
  let lifts: number[] = [];

  for (let i = 0; i < simulations; i++) {
    const controlRate = sampleBeta(controlAlpha, controlBeta);
    const treatmentRate = sampleBeta(treatmentAlpha, treatmentBeta);
    
    if (treatmentRate > controlRate) {
      treatmentWins++;
    }
    
    lifts.push((treatmentRate - controlRate) / controlRate);
  }

  // Sort for credible interval
  lifts.sort((a, b) => a - b);
  const lower = lifts[Math.floor(simulations * 0.025)];
  const upper = lifts[Math.floor(simulations * 0.975)];

  return {
    probabilityTreatmentWins: treatmentWins / simulations,
    expectedLift: lifts.reduce((a, b) => a + b, 0) / simulations,
    credibleInterval: [lower, upper],
  };
}

/**
 * Sequential testing (optional early stopping)
 * Uses optimistic bounds for valid p-values with optional stopping
 */
export function sequentialTest(
  visits: { control: number[]; treatment: number[] },
  conversions: { control: number[]; treatment: number[] },
  alpha: number = 0.05
): { shouldStop: boolean; significant: boolean; pValue: number; currentZ: number } {
  // Calculate cumulative statistics
  const cumControlVisits = visits.control.reduce((a, b) => a + b, 0);
  const cumControlConv = conversions.control.reduce((a, b) => a + b, 0);
  const cumTreatmentVisits = visits.treatment.reduce((a, b) => a + b, 0);
  const cumTreatmentConv = conversions.treatment.reduce((a, b) => a + b, 0);

  // Calculate z-score
  const result = calculateStatisticalSignificance(
    cumControlVisits,
    cumControlConv,
    cumTreatmentVisits,
    cumTreatmentConv
  );

  // Sequential bounds (simplified - in production use proper spending functions)
  const numAnalyses = visits.control.length;
  const adjustedAlpha = alpha / numAnalyses; // Bonferroni correction

  return {
    shouldStop: result.pValue < adjustedAlpha,
    significant: result.pValue < adjustedAlpha,
    pValue: result.pValue,
    currentZ: result.zScore,
  };
}

/**
 * Minimum sample size for practical significance
 * Accounts for business significance, not just statistical
 */
export function practicalSignificanceSampleSize(
  baselineRate: number,
  minimumPracticalLift: number, // Minimum business-relevant lift
  confidenceLevel: number = 0.95,
  power: number = 0.8
): { perVariant: number; total: number; recommendations: string[] } {
  const sampleSize = calculateSampleSize({
    baselineRate,
    minimumDetectableEffect: minimumPracticalLift,
    confidenceLevel,
    statisticalPower: power,
  });

  const recommendations: string[] = [];
  
  if (sampleSize > 10000) {
    recommendations.push('Consider reducing confidence level or minimum detectable effect');
    recommendations.push('Or extend test duration to accumulate sufficient sample');
  }
  
  if (baselineRate < 0.05) {
    recommendations.push('Low baseline rate - consider using a different metric or longer test');
  }

  return {
    perVariant: sampleSize,
    total: sampleSize * 2,
    recommendations,
  };
}

/**
 * Estimate test duration from traffic
 */
export function estimateDuration(
  dailyTraffic: number,
  samplesNeeded: number,
  numVariants: number = 2
): { days: number; weeks: number; recommended: string } {
  const samplesPerDay = dailyTraffic / numVariants;
  const days = Math.ceil(samplesNeeded / samplesPerDay);
  const weeks = Math.ceil(days / 7);

  let recommended: string;
  if (weeks < 1) {
    recommended = `${days} days`;
  } else if (weeks <= 4) {
    recommended = `${weeks} week${weeks > 1 ? 's' : ''}`;
  } else {
    recommended = `${Math.ceil(weeks / 4)} month${Math.ceil(weeks / 4) > 1 ? 's' : ''}`;
  }

  return { days, weeks, recommended };
}

/**
 * Calculate confidence interval for a single proportion
 */
export function proportionConfidenceInterval(
  successes: number,
  trials: number,
  confidenceLevel: number = 0.95
): [number, number] {
  if (trials === 0) return [0, 0];

  const p = successes / trials;
  const z = Z_SCORES[confidenceLevel] || 1.96;
  const margin = z * Math.sqrt((p * (1 - p)) / trials);

  return [Math.max(0, p - margin), Math.min(1, p + margin)];
}

/**
 * Calculate relative difference confidence interval
 */
export function relativeDifferenceCI(
  controlRate: number,
  treatmentRate: number,
  controlN: number,
  treatmentN: number,
  confidenceLevel: number = 0.95
): [number, number] {
  const delta = treatmentRate - controlRate;
  const seDelta = Math.sqrt(
    (controlRate * (1 - controlRate)) / controlN +
    (treatmentRate * (1 - treatmentRate)) / treatmentN
  );
  
  const z = Z_SCORES[confidenceLevel] || 1.96;
  const margin = z * seDelta;

  const relativeLift = controlRate > 0 ? ((treatmentRate - controlRate) / controlRate) * 100 : 0;
  const relativeMargin = controlRate > 0 ? (margin / controlRate) * 100 : 0;

  return [relativeLift - relativeMargin, relativeLift + relativeMargin];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Standard normal cumulative distribution function
 */
function standardNormalCDF(x: number): number {
  // Abramowitz and Stegun approximation
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

/**
 * Chi-squared CDF approximation
 */
function chiSquaredCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  
  // Wilson-Hilferty transformation approximation
  const z = Math.pow(x / df, 1/3) - (1 - 2/(9*df));
  const zScore = z / Math.sqrt(2/(9*df));
  
  return standardNormalCDF(zScore);
}

/**
 * Sample from Beta distribution (Box-Muller style)
 */
function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1);
  const y = sampleGamma(beta, 1);
  return x / (x + y);
}

/**
 * Sample from Gamma distribution
 */
function sampleGamma(shape: number, scale: number): number {
  if (shape < 1) {
    return sampleGamma(1 + shape, scale) * Math.pow(Math.random(), 1 / shape);
  }

  const d = shape - 1/3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x, v;
    do {
      x = normalSample();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale;
    }
  }
}

/**
 * Standard normal sample (Box-Muller)
 */
function normalSample(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ============================================
// EXPORTS
// ============================================

export {
  Z_SCORES,
  POWER_Z_SCORES,
};

export default {
  calculateStatisticalSignificance,
  isSignificant,
  calculateSampleSize,
  chiSquareTest,
  bayesianAnalysis,
  proportionConfidenceInterval,
};
