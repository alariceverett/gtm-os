'use client';

import { useDataFetch } from './use-data-fetch';

export interface KpiCard {
  key: string;
  label: string;
  value: number | string;
  freshness: string;
  deltaText?: string;
  deltaClass?: string;
}

export interface LifecycleStage {
  key: string;
  label: string;
  count: number | string;
}

export interface LifecycleSummary {
  stages: LifecycleStage[];
  movement_last_7d: number | string;
  freshness: string;
}

export interface CampaignSummary {
  metric_window: string;
  spend: number | string;
  revenue: number | string;
  conversions: number | string;
  roas: number | string;
  freshness: string;
}

export interface KpiData {
  generated_at: string;
  freshness: string;
  cards: KpiCard[];
}

export interface KpiAggregate {
  generated_at: string;
  mode: string;
  kpis: KpiData;
  lifecycle: LifecycleSummary;
  campaigns: CampaignSummary;
}

export function useKpis(refreshInterval = 30000) {
  return useDataFetch<KpiAggregate>('/api/command-center/kpis', {
    refreshInterval,
    retryCount: 2,
    staleWhileRevalidate: true,
    initialData: null,
  });
}

export function calculateHealthStatus(kpis: KpiData | undefined): 'healthy' | 'warning' | 'critical' {
  if (!kpis || !kpis.cards) return 'healthy';
  
  const openPriorities = kpis.cards.find((c) => c.key === 'open_priorities')?.value;
  const activeRuns = kpis.cards.find((c) => c.key === 'active_runs')?.value;
  
  const openCount = typeof openPriorities === 'number' ? openPriorities : parseInt(String(openPriorities)) || 0;
  const activeCount = typeof activeRuns === 'number' ? activeRuns : parseInt(String(activeRuns)) || 0;
  
  if (openCount > 30 || activeCount === 0) return 'critical';
  if (openCount > 20 || activeCount < 2) return 'warning';
  return 'healthy';
}

// Fallback KPI data for demo/development
export function getMockKpiData(): KpiAggregate {
  return {
    generated_at: new Date().toISOString(),
    mode: 'local',
    kpis: {
      generated_at: new Date().toISOString(),
      freshness: 'local',
      cards: [
        { key: 'delegations_24h', label: 'Delegations (24h)', value: 24, freshness: 'local', deltaText: '+8 vs yesterday', deltaClass: 'positive' },
        { key: 'completed_24h', label: 'Completed (24h)', value: 18, freshness: 'local', deltaText: '+5 vs yesterday', deltaClass: 'positive' },
        { key: 'open_priorities', label: 'Open priorities', value: 12, freshness: 'local', deltaText: 'Within target', deltaClass: 'neutral' },
        { key: 'active_runs', label: 'Active runs', value: 4, freshness: 'local', deltaText: 'Normal', deltaClass: 'neutral' },
      ],
    },
    lifecycle: {
      stages: [
        { key: 'lead', label: 'Lead', count: 45 },
        { key: 'mql', label: 'MQL', count: 28 },
        { key: 'sql', label: 'SQL', count: 12 },
        { key: 'opportunity', label: 'Opportunity', count: 3 },
        { key: 'customer', label: 'Customer', count: 8 },
      ],
      movement_last_7d: 8,
      freshness: 'local',
    },
    campaigns: {
      metric_window: 'last_7d',
      spend: 15000,
      revenue: 45000,
      conversions: 8,
      roas: 3.0,
      freshness: 'local',
    },
  };
}

// Hook that returns processed KPIs with fallback
export function useKpisWithFallback(refreshInterval = 30000) {
  const result = useKpis(refreshInterval);
  
  // Use mock data if API fails and we have no data
  const kpis = result.data || getMockKpiData();
  const healthStatus = calculateHealthStatus(kpis.kpis);
  
  return {
    ...result,
    kpis,
    healthStatus,
  };
}
