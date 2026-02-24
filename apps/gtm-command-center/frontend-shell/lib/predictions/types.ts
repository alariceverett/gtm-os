/**
 * Prediction Types
 *
 * Shared type definitions for predictions, anomalies, and risk scoring
 */

// Forecast types
export interface ForecastResult {
  metric: string;
  horizon: '7d' | '30d';
  currentValue: number;
  predictedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  trajectoryChanged: boolean;
  generatedAt: string;
  display_message: string;
}

export interface ForecastResponse {
  marker: string;
  generated_at: string;
  forecasts: ForecastResult[];
  summary: {
    totalPredictions: number;
    trendChanges: number;
    overallTrajectory: 'accelerating' | 'decelerating' | 'stable';
  };
}

// Anomaly types
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
  display_message: string;
  affectedEntity?: {
    id: string;
    name: string;
    type: 'account' | 'campaign' | 'user' | 'system';
  };
  recommendedAction?: string;
}

export interface AnomalyResponse {
  marker: string;
  generated_at: string;
  health: 'healthy' | 'degraded' | 'critical';
  summary: {
    totalAnomalies: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    newAnomalies: number;
  };
  anomalies: AnomalyResult[];
}

// Risk types
export interface DealRiskFactor {
  name: string;
  weight: number;
  score: number;
  rawValue: number;
  description: string;
}

export interface DealRiskScore {
  dealId: string;
  dealName: string;
  accountName: string;
  totalScore: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  emoji: '🟢' | '🟡' | '🟠' | '🔴';
  color: 'green' | 'yellow' | 'orange' | 'red';
  factors: DealRiskFactor[];
  topReasons: string[];
  recommendedActions: string[];
  lastUpdated: string;
  trend: 'improving' | 'stable' | 'worsening';
  daysInStage: number;
  estimatedCloseDate?: string;
  display_message: string;
}

export interface RiskResponse {
  marker: string;
  generated_at: string;
  summary: {
    totalDeals: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    atRiskPipelineValue: number;
    averageRiskScore: number;
  };
  top_risks: DealRiskScore[];
  improving_deals: DealRiskScore[];
}
