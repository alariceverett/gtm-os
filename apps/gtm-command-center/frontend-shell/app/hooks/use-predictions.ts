'use client';

import { useDataFetch } from './use-data-fetch';
import {
  fetchKpiForecasts,
  fetchAnomalies,
  fetchRiskScores,
  getMockForecasts,
  getMockAnomalies,
  getMockRiskScores,
} from '@/lib/predictions/api';
import type {
  ForecastResponse,
  AnomalyResponse,
  RiskResponse,
} from '@/lib/predictions/types';

// Hook for KPI forecasts
export function useKpiForecasts(refreshInterval = 60000) {
  const result = useDataFetch<ForecastResponse>('/api/predictions/kpis', {
    refreshInterval,
    retryCount: 2,
    initialData: null,
  });

  const forecasts = result.data || getMockForecasts();

  return {
    ...result,
    forecasts,
    // Helpers
    getUpcomingForecasts: () =>
      forecasts.forecasts?.filter((f) => f.horizon === '7d') || [],
    getLongTermForecasts: () =>
      forecasts.forecasts?.filter((f) => f.horizon === '30d') || [],
    getImportantForecasts: () =>
      forecasts.forecasts?.filter((f) =>
        f.trajectoryChanged || Math.abs(f.changePercent) > 20
      ) || [],
  };
}

// Hook for anomaly detection
export function useAnomalies(refreshInterval = 30000) {
  const result = useDataFetch<AnomalyResponse>('/api/predictions/anomalies', {
    refreshInterval,
    retryCount: 2,
    initialData: null,
  });

  const anomalies = result.data || getMockAnomalies();
  const allAnomalies = anomalies.anomalies || [];

  return {
    ...result,
    anomalies,
    // Helpers
    criticalAnomalies: allAnomalies.filter((a) => a.severity === 'critical'),
    warningAnomalies: allAnomalies.filter((a) => a.severity === 'warning'),
    infoAnomalies: allAnomalies.filter((a) => a.severity === 'info'),
    hasCriticalIssues: anomalies.health === 'critical',
    isDegraded: anomalies.health !== 'healthy',
    criticalCount: anomalies.summary?.criticalCount || 0,
    warningCount: anomalies.summary?.warningCount || 0,
    totalCount: anomalies.summary?.totalAnomalies || 0,
  };
}

// Hook for risk scores
export function useRiskScores(refreshInterval = 60000) {
  const result = useDataFetch<RiskResponse>('/api/predictions/risks', {
    refreshInterval,
    retryCount: 2,
    initialData: null,
  });

  const risks = result.data || getMockRiskScores();
  const topRisks = risks.top_risks || [];
  const improvingDeals = risks.improving_deals || [];

  return {
    ...result,
    risks,
    // Helpers
    topRisks,
    improvingDeals,
    criticalDeals: topRisks.filter((d) => d.level === 'critical'),
    highRiskDeals: topRisks.filter((d) => d.level === 'high'),
    mediumRiskDeals: topRisks.filter((d) => d.level === 'medium'),
    atRiskPipelineValue: risks.summary?.atRiskPipelineValue || 0,
    averageRiskScore: risks.summary?.averageRiskScore || 0,
    totalDeals: risks.summary?.totalDeals || 0,
  };
}

// Combined hook for all predictions
export function useAllPredictions(refreshInterval = 60000) {
  const forecasts = useKpiForecasts(refreshInterval);
  const anomalies = useAnomalies(refreshInterval);
  const risks = useRiskScores(refreshInterval);

  const hasAnyAlerts =
    anomalies.criticalCount > 0 ||
    anomalies.warningCount > 0 ||
    risks.criticalDeals.length > 0 ||
    risks.highRiskDeals.length > 0;

  const alertCount =
    anomalies.criticalCount +
    anomalies.warningCount +
    risks.criticalDeals.length +
    risks.highRiskDeals.length;

  return {
    forecasts,
    anomalies,
    risks,
    hasAnyAlerts,
    alertCount,
    isLoading: forecasts.isLoading || anomalies.isLoading || risks.isLoading,
    isError: forecasts.isError || anomalies.isError || risks.isError,
    refetchAll: () => {
      forecasts.refetch();
      anomalies.refetch();
      risks.refetch();
    },
  };
}
