'use client';

import { useMemo } from 'react';
import { 
  generateSimpleForecast, 
  getTrendForMetric,
  type SimpleForecastResult,
  type KpiTrend,
} from '@/lib/predictions/simple-forecast';

interface KpiData {
  key: string;
  label: string;
  value: number | string;
}

/**
 * Hook to generate simple 7-day trend forecasts for KPIs
 * 
 * @param kpis - Array of KPI data
 * @returns Forecast result and helper function
 * 
 * Example:
 * ```tsx
 * const { forecast, getTrend } = useSimpleForecast(kpiData);
 * return <KpiCard trend={getTrend('delegations_24h')} ... />
 * ```
 */
export function useSimpleForecast(kpis: KpiData[] | undefined): {
  forecast: SimpleForecastResult | null;
  getTrend: (metricKey: string) => KpiTrend | null;
} {
  const forecast = useMemo(() => {
    if (!kpis || kpis.length === 0) return null;
    return generateSimpleForecast(kpis);
  }, [kpis]);

  const getTrend = (metricKey: string): KpiTrend | null => {
    return getTrendForMetric(forecast, metricKey);
  };

  return { forecast, getTrend };
}
