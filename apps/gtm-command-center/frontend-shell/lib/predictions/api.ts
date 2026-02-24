/**
 * Predictions API Client
 *
 * Client-side utilities for fetching predictions, anomalies, and risk data
 */

import type {
  ForecastResult,
  ForecastResponse,
  AnomalyResult,
  AnomalyResponse,
  DealRiskScore,
  RiskResponse
} from './types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:1981';

export type {
  ForecastResult,
  ForecastResponse,
  AnomalyResult,
  AnomalyResponse,
  DealRiskScore,
  RiskResponse
} from './types';

// API functions
export async function fetchKpiForecasts(): Promise<ForecastResponse> {
  const response = await fetch(`${BACKEND_URL}/api/predictions/kpis`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch forecasts: ${response.status}`);
  }

  return response.json();
}

export async function fetchAnomalies(): Promise<AnomalyResponse> {
  const response = await fetch(`${BACKEND_URL}/api/predictions/anomalies`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch anomalies: ${response.status}`);
  }

  return response.json();
}

export async function fetchRiskScores(): Promise<RiskResponse> {
  const response = await fetch(`${BACKEND_URL}/api/predictions/risks`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch risk scores: ${response.status}`);
  }

  return response.json();
}

// Mock data generators for fallback
export function getMockForecasts(): ForecastResponse {
  return {
    marker: 'kpi-predictions-v1-mock',
    generated_at: new Date().toISOString(),
    forecasts: [
      {
        metric: 'delegations_24h',
        horizon: '7d' as const,
        currentValue: 24,
        predictedValue: 28,
        confidenceInterval: { lower: 24, upper: 32 },
        changePercent: 16.7,
        trend: 'up',
        confidence: 0.82,
        trajectoryChanged: false,
        generatedAt: new Date().toISOString(),
        display_message: 'Forecast: Delegations 24h ↑ 16.7% next week',
      },
      {
        metric: 'delegations_24h',
        horizon: '30d' as const,
        currentValue: 24,
        predictedValue: 32,
        confidenceInterval: { lower: 26, upper: 38 },
        changePercent: 33.3,
        trend: 'up',
        confidence: 0.75,
        trajectoryChanged: true,
        generatedAt: new Date().toISOString(),
        display_message: 'Forecast: Delegations 24h ↑ 33.3% next 30 days • Trajectory changed',
      },
      {
        metric: 'pipeline_velocity',
        horizon: '7d' as const,
        currentValue: 8,
        predictedValue: 6,
        confidenceInterval: { lower: 5, upper: 7 },
        changePercent: -25,
        trend: 'down',
        confidence: 0.68,
        trajectoryChanged: false,
        generatedAt: new Date().toISOString(),
        display_message: 'Forecast: Pipeline velocity ↓ 25.0% next week',
      },
    ],
    summary: {
      totalPredictions: 6,
      trendChanges: 1,
      overallTrajectory: 'accelerating',
    },
  };
}

export function getMockAnomalies(): AnomalyResponse {
  return {
    marker: 'anomaly-detection-v1-mock',
    generated_at: new Date().toISOString(),
    health: 'degraded',
    summary: {
      totalAnomalies: 2,
      criticalCount: 0,
      warningCount: 1,
      infoCount: 1,
      newAnomalies: 2,
    },
    anomalies: [
      {
        id: 'anomaly-1',
        metric: 'acme_corp_engagement',
        detectedAt: new Date().toISOString(),
        severity: 'warning',
        type: 'drop',
        value: 40,
        expectedRange: { min: 60, max: 85 },
        zScore: -2.8,
        message: 'Acme Corp engagement dropped 40% this week',
        display_message: '⚠️ Acme Corp engagement dropped 40% this week',
        affectedEntity: {
          id: 'acct-acme',
          name: 'Acme Corp',
          type: 'account',
        },
        recommendedAction: 'Schedule check-in calls and personalized outreach',
      },
      {
        id: 'anomaly-2',
        metric: 'meeting_booking_rate',
        detectedAt: new Date().toISOString(),
        severity: 'info',
        type: 'spike',
        value: 0.35,
        expectedRange: { min: 0.15, max: 0.28 },
        zScore: 2.1,
        message: 'Meeting booking rate 29% above normal',
        display_message: 'ℹ️ Meeting booking rate 29% above normal',
        recommendedAction: 'Analyze successful booking patterns and replicate',
      },
    ],
  };
}

export function getMockRiskScores(): RiskResponse {
  return {
    marker: 'risk-scoring-v1-mock',
    generated_at: new Date().toISOString(),
    summary: {
      totalDeals: 12,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 4,
      lowCount: 5,
      atRiskPipelineValue: 450000,
      averageRiskScore: 42,
    },
    top_risks: [
      {
        dealId: 'deal-1',
        dealName: 'Deal 1: Enterprise Package',
        accountName: 'Global Dynamics',
        totalScore: 78,
        level: 'critical',
        emoji: '🔴',
        color: 'red',
        factors: [],
        topReasons: ['No contact for 18 days', 'Overall engagement is low'],
        recommendedActions: ['🚨 ESCALATE TO SALES LEADERSHIP IMMEDIATELY', 'Schedule urgent check-in call'],
        lastUpdated: new Date().toISOString(),
        trend: 'worsening',
        daysInStage: 45,
        display_message: '🔴 Global Dynamics: 78% risk • No contact for 18 days',
      },
      {
        dealId: 'deal-2',
        dealName: 'Deal 2: Enterprise Package',
        accountName: 'Beta Labs',
        totalScore: 62,
        level: 'high',
        emoji: '🟠',
        color: 'orange',
        factors: [],
        topReasons: ['Engagement dropped 25 points', 'No internal champion identified'],
        recommendedActions: ['Schedule urgent check-in call', 'Map out decision-making committee'],
        lastUpdated: new Date().toISOString(),
        trend: 'worsening',
        daysInStage: 28,
        display_message: '🟠 Beta Labs: 62% risk • Engagement dropped 25 points',
      },
    ],
    improving_deals: [
      {
        dealId: 'deal-5',
        dealName: 'Deal 5: Enterprise Package',
        accountName: 'TechStart Inc',
        totalScore: 32,
        level: 'medium',
        emoji: '🟡',
        color: 'yellow',
        factors: [],
        topReasons: ['Economic buyer not engaged'],
        recommendedActions: ['Leverage existing champion to connect with economic buyer'],
        lastUpdated: new Date().toISOString(),
        trend: 'improving',
        daysInStage: 14,
        display_message: '🟡 TechStart Inc: 32% risk • Economic buyer not engaged',
      },
    ],
  };
}
