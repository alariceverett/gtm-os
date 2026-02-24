/**
 * Simple KPI Trend Forecast
 * 
 * Calculates 7-day average change for each KPI
 * Shows arrow direction (↑/→/↓) and percentage change
 * NO complex ML - just simple trend calculation
 */

export interface KpiHistoryPoint {
  date: string; // ISO date
  value: number;
}

export interface TrendData {
  direction: 'up' | 'flat' | 'down';
  changePercent: number;
  displayText: string;
  avg7dValue: number;
}

export interface KpiTrend extends TrendData {
  metric: string;
  currentValue: number;
  directionEmoji: '↑' | '→' | '↓';
}

export interface SimpleForecastResult {
  generatedAt: string;
  trends: KpiTrend[];
  summary: {
    trendingUp: number;
    trendingFlat: number;
    trendingDown: number;
  };
}

// Default empty history for development/fallback
const DEFAULT_HISTORY: Record<string, number[]> = {
  delegations_24h: [18, 20, 22, 19, 21, 23, 24],
  completed_24h: [12, 14, 15, 13, 16, 17, 18],
  open_priorities: [15, 14, 13, 14, 13, 12, 12],
  active_runs: [3, 3, 4, 4, 4, 4, 4],
};

/**
 * Calculate 7-day average from an array of values
 */
export function calculate7dAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const last7 = values.slice(-7);
  const sum = last7.reduce((a, b) => a + b, 0);
  return sum / last7.length;
}

/**
 * Calculate trend direction and percentage change
 * 
 * @param current - Current value
 * @param avg7d - 7-day average
 * @returns Trend direction and percentage
 */
export function calculateTrend(
  current: number,
  avg7d: number
): Omit<KpiTrend, 'metric' | 'currentValue' | 'avg7dValue'> {
  if (avg7d === 0) {
    return {
      changePercent: 0,
      direction: 'flat',
      directionEmoji: '→',
      displayText: '→ 0% vs 7d avg',
    };
  }

  const changePercent = ((current - avg7d) / avg7d) * 100;
  
  // Threshold for "flat" - within ±3%
  const threshold = 3;
  
  if (changePercent > threshold) {
    return {
      changePercent,
      direction: 'up',
      directionEmoji: '↑',
      displayText: `↑ ${Math.abs(changePercent).toFixed(0)}% vs 7d avg`,
    };
  } else if (changePercent < -threshold) {
    return {
      changePercent,
      direction: 'down',
      directionEmoji: '↓',
      displayText: `↓ ${Math.abs(changePercent).toFixed(0)}% vs 7d avg`,
    };
  } else {
    return {
      changePercent: 0,
      direction: 'flat',
      directionEmoji: '→',
      displayText: `→ 0% vs 7d avg`,
    };
  }
}

/**
 * Calculate trend for a single KPI
 * 
 * @param metric - Metric identifier
 * @param currentValue - Current value
 * @param history - Array of historical values (oldest to newest)
 * @returns Full trend result
 */
export function calculateKpiTrend(
  metric: string,
  currentValue: number,
  history: number[]
): KpiTrend {
  const avg7d = calculate7dAverage(history);
  const trend = calculateTrend(currentValue, avg7d);

  return {
    metric,
    currentValue,
    avg7dValue: avg7d,
    ...trend,
  };
}

/**
 * Get historical data for a metric
 * In production, this would fetch from API/backend
 * For now, uses default history or generates synthetic data
 */
function getHistoricalData(metricKey: string, currentValue: number): number[] {
  // If we have default history for this metric, use it
  if (DEFAULT_HISTORY[metricKey]) {
    // Adjust to end with a value close to current
    const history = [...DEFAULT_HISTORY[metricKey]];
    const lastIdx = history.length - 1;
    const adjustment = currentValue - history[lastIdx];
    return history.map((v, i) => v + Math.round(adjustment * (i / history.length)));
  }

  // Generate synthetic 7-day history ending near current value
  const history: number[] = [];
  for (let i = 0; i < 7; i++) {
    const variance = (Math.random() - 0.5) * 0.2; // ±10% variance
    history.push(Math.round(currentValue * (1 - variance * (7 - i) / 7)));
  }
  return history;
}

/**
 * Main function: Generate simple forecasts for all KPIs
 * 
 * @param kpis - Array of current KPI data from useKpis
 * @returns Forecast result with trends for each KPI
 */
export function generateSimpleForecast(
  kpis: Array<{ key: string; value: number | string }>
): SimpleForecastResult {
  const trends: KpiTrend[] = [];
  let trendingUp = 0;
  let trendingFlat = 0;
  let trendingDown = 0;

  for (const kpi of kpis) {
    const currentValue = typeof kpi.value === 'string' ? parseFloat(kpi.value) : kpi.value;
    
    // Get historical data for this metric
    const history = getHistoricalData(kpi.key, currentValue);
    
    // Calculate trend
    const trend = calculateKpiTrend(kpi.key, currentValue, history);
    trends.push(trend);

    // Update summary counts
    if (trend.direction === 'up') trendingUp++;
    else if (trend.direction === 'down') trendingDown++;
    else trendingFlat++;
  }

  return {
    generatedAt: new Date().toISOString(),
    trends,
    summary: {
      trendingUp,
      trendingFlat,
      trendingDown,
    },
  };
}

/**
 * Get a single trend by metric key
 */
export function getTrendForMetric(
  forecast: SimpleForecastResult | null,
  metricKey: string
): KpiTrend | null {
  if (!forecast) return null;
  return forecast.trends.find(t => t.metric === metricKey) || null;
}

/**
 * Get CSS color class for trend direction
 */
export function getTrendColorClass(direction: 'up' | 'flat' | 'down'): string {
  switch (direction) {
    case 'up':
      return 'text-emerald-500';
    case 'flat':
      return 'text-slate-500';
    case 'down':
      return 'text-red-500';
    default:
      return 'text-slate-500';
  }
}

/**
 * Get background color class for trend badge
 */
export function getTrendBgClass(direction: 'up' | 'flat' | 'down'): string {
  switch (direction) {
    case 'up':
      return 'bg-emerald-50 dark:bg-emerald-500/10';
    case 'flat':
      return 'bg-slate-100 dark:bg-slate-800';
    case 'down':
      return 'bg-red-50 dark:bg-red-500/10';
    default:
      return 'bg-slate-100 dark:bg-slate-800';
  }
}
