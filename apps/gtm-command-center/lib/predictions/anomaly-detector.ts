/**
 * Anomaly Detection Engine
 *
 * Statistical anomaly detection using Z-scores and rolling averages
 * Monitors: Meeting booking rates, Email response rates, Account engagement
 */

export interface DataPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface AnomalyResult {
  id: string;
  metric: string;
  detectedAt: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'spike' | 'drop' | 'pattern_break';
  value: number;
  expectedRange: { min: number; max: number };
  zScore: number;
  message: string;
  affectedEntity?: {
    id: string;
    name: string;
    type: 'account' | 'campaign' | 'user' | 'system';
  };
  recommendedAction?: string;
}

export interface AnomalyDetectionConfig {
  zScoreThreshold: number;
  windowSize: number; // Rolling window size
  minDataPoints: number;
  sensitivity: 'high' | 'medium' | 'low';
}

export interface AnomalyReport {
  generatedAt: string;
  anomalies: AnomalyResult[];
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    newAnomalies: number; // Since last check
  };
  health: 'healthy' | 'degraded' | 'critical';
}

// Default configuration by sensitivity
export const DETECTION_CONFIGS: Record<string, AnomalyDetectionConfig> = {
  high: { zScoreThreshold: 1.5, windowSize: 7, minDataPoints: 5, sensitivity: 'high' },
  medium: { zScoreThreshold: 2.0, windowSize: 14, minDataPoints: 7, sensitivity: 'medium' },
  low: { zScoreThreshold: 2.5, windowSize: 30, minDataPoints: 14, sensitivity: 'low' },
};

// Calculate rolling statistics
interface RollingStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
}

function calculateRollingStats(data: number[], windowSize: number): RollingStats {
  const recent = data.slice(-windowSize);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;

  const squaredDiffs = recent.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / recent.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, min: Math.min(...recent), max: Math.max(...recent) };
}

// Calculate Z-score
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// Detect anomalies in a single metric
export function detectAnomalies(
  metric: string,
  data: DataPoint[],
  config: AnomalyDetectionConfig = DETECTION_CONFIGS.medium
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const values = data.map((d) => d.value);

  if (values.length < config.minDataPoints) {
    return anomalies;
  }

  const { mean, stdDev } = calculateRollingStats(values, config.windowSize);
  const expectedRange = {
    min: mean - config.zScoreThreshold * stdDev,
    max: mean + config.zScoreThreshold * stdDev,
  };

  // Check the most recent point
  const latest = data[data.length - 1];
  const zScore = calculateZScore(latest.value, mean, stdDev);
  const absZScore = Math.abs(zScore);

  if (absZScore > config.zScoreThreshold) {
    const isSpike = zScore > 0;
    const severity = absZScore > 3 ? 'critical' : absZScore > 2.5 ? 'warning' : 'info';

    const anomalyId = `${metric}-${Date.now()}`;

    anomalies.push({
      id: anomalyId,
      metric,
      detectedAt: new Date().toISOString(),
      severity,
      type: isSpike ? 'spike' : 'drop',
      value: latest.value,
      expectedRange,
      zScore,
      message: generateAnomalyMessage(metric, latest.value, expectedRange, isSpike, zScore),
      affectedEntity: latest.metadata?.entity as AnomalyResult['affectedEntity'],
      recommendedAction: generateRecommendedAction(metric, isSpike, severity),
    });
  }

  // Check for pattern breaks (sudden change in variance)
  if (values.length >= config.windowSize * 2) {
    const recentWindow = values.slice(-config.windowSize);
    const previousWindow = values.slice(-config.windowSize * 2, -config.windowSize);

    const recentVariance = calculateVariance(recentWindow);
    const previousVariance = calculateVariance(previousWindow);

    if (previousVariance > 0) {
      const varianceRatio = recentVariance / previousVariance;
      if (varianceRatio > 2.5 || varianceRatio < 0.4) {
        anomalies.push({
          id: `${metric}-pattern-${Date.now()}`,
          metric,
          detectedAt: new Date().toISOString(),
          severity: 'warning',
          type: 'pattern_break',
          value: latest.value,
          expectedRange,
          zScore: 0,
          message: `${formatMetricName(metric)} showing unusual behavior pattern`,
          recommendedAction: 'Investigate recent changes in processes or external factors',
        });
      }
    }
  }

  return anomalies;
}

function calculateVariance(data: number[]): number {
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const squaredDiffs = data.map((v) => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
}

function generateAnomalyMessage(
  metric: string,
  value: number,
  expectedRange: { min: number; max: number },
  isSpike: boolean,
  zScore: number
): string {
  const metricName = formatMetricName(metric);
  const percentOff = Math.abs((value - (isSpike ? expectedRange.max : expectedRange.min)) /
    (isSpike ? expectedRange.max : expectedRange.min) * 100);

  if (isSpike) {
    return `${metricName} ${percentOff.toFixed(0)}% above normal (Z-score: ${zScore.toFixed(2)})`;
  } else {
    return `${metricName} ${percentOff.toFixed(0)}% below normal (Z-score: ${zScore.toFixed(2)})`;
  }
}

function generateRecommendedAction(metric: string, isSpike: boolean, severity: string): string {
  const actions: Record<string, string> = {
    'meeting_booking_rate': isSpike
      ? 'Analyze successful booking patterns and replicate'
      : 'Review calendar availability and outreach messaging',
    'email_response_rate': isSpike
      ? 'Document effective subject lines and timing'
      : 'A/B test new email templates and follow-up sequences',
    'account_engagement': isSpike
      ? 'Identify triggers for high engagement'
      : 'Schedule check-in calls and personalized outreach',
    'delegation_completion': isSpike
      ? 'Scale successful delegation patterns'
      : 'Review delegation clarity and resource allocation',
    'pipeline_velocity': isSpike
      ? 'Accelerate similar opportunities'
      : 'Identify blockers and unblock stuck deals',
  };

  if (severity === 'critical' && !isSpike) {
    return 'URGENT: Immediate leadership attention required';
  }

  return actions[metric] || (isSpike ? 'Investigate positive drivers' : 'Review and optimize processes');
}

function formatMetricName(metric: string): string {
  return metric
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/\brate\b/gi, 'Rate')
    .replace(/\bemail\b/gi, 'Email');
}

// Monitor multiple metrics for anomalies
export function detectAllAnomalies(
  metricsData: Record<string, DataPoint[]>,
  config?: AnomalyDetectionConfig
): AnomalyReport {
  const generatedAt = new Date().toISOString();
  const allAnomalies: AnomalyResult[] = [];

  for (const [metric, data] of Object.entries(metricsData)) {
    const anomalies = detectAnomalies(metric, data, config);
    allAnomalies.push(...anomalies);
  }

  // Sort by severity and recency
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  allAnomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const criticalCount = allAnomalies.filter((a) => a.severity === 'critical').length;
  const warningCount = allAnomalies.filter((a) => a.severity === 'warning').length;
  const infoCount = allAnomalies.filter((a) => a.severity === 'info').length;

  let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (criticalCount > 0) health = 'critical';
  else if (warningCount > 2 || allAnomalies.length > 5) health = 'degraded';

  return {
    generatedAt,
    anomalies: allAnomalies,
    summary: {
      totalAnomalies: allAnomalies.length,
      criticalCount,
      warningCount,
      infoCount,
      newAnomalies: allAnomalies.length, // In real implementation, compare with previous state
    },
    health,
  };
}

// Generate mock data for testing
export function generateMockMetricData(
  metric: string,
  days: number = 30,
  injectAnomaly: boolean = false
): DataPoint[] {
  const data: DataPoint[] = [];
  const now = new Date();

  // Base values by metric type
  const baseValues: Record<string, number> = {
    meeting_booking_rate: 0.25,
    email_response_rate: 0.15,
    account_engagement: 65,
    delegation_completion: 0.75,
    pipeline_velocity: 12,
  };

  const base = baseValues[metric] || 50;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    let value = base * (0.9 + Math.random() * 0.2); // ±10% variance

    // Inject anomaly at day 1 if requested
    if (injectAnomaly && i === 1) {
      value = base * 0.4; // 40% drop
    }

    data.push({
      timestamp: date.toISOString(),
      value: parseFloat(value.toFixed(3)),
    });
  }

  return data;
}

// Format anomaly for display
export function formatAnomalyMessage(anomaly: AnomalyResult): string {
  const emoji = anomaly.severity === 'critical' ? '🚨' :
                anomaly.severity === 'warning' ? '⚠️' : 'ℹ️';
  return `${emoji} ${anomaly.message}`;
}
