/**
 * KPI Trend Prediction Engine
 * 
 * Time series analysis for KPI forecasting with confidence intervals
 * Supports 7-day and 30-day forecasts
 */

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

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
  confidence: number; // 0-1
  trajectoryChanged: boolean;
  generatedAt: string;
}

export interface KpiForecasts {
  generatedAt: string;
  forecasts: ForecastResult[];
  summary: {
    totalPredictions: number;
    trendChanges: number;
    overallTrajectory: 'accelerating' | 'decelerating' | 'stable';
  };
}

// Simple linear regression for time series forecasting
function linearRegression(data: TimeSeriesPoint[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.value || 0, r2: 0 };

  const x = data.map((d, i) => i);
  const y = data.map((d) => d.value);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumXX = x.reduce((total, xi) => total + xi * xi, 0);
  const sumYY = y.reduce((total, yi) => total + yi * yi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = y.reduce((total, yi) => total + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((total, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return total + Math.pow(yi - predicted, 2);
  }, 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
}

// Calculate standard deviation for confidence intervals
function calculateStdDev(data: TimeSeriesPoint[], slope: number, intercept: number): number {
  if (data.length < 2) return 0;
  const residuals = data.map((d, i) => {
    const predicted = slope * i + intercept;
    return Math.pow(d.value - predicted, 2);
  });
  return Math.sqrt(residuals.reduce((a, b) => a + b, 0) / (data.length - 1));
}

// Detect if trajectory has changed significantly
function detectTrajectoryChange(data: TimeSeriesPoint[], forecastSlope: number): boolean {
  if (data.length < 7) return false;

  // Compare recent trend (last 3 days) vs overall trend
  const recentData = data.slice(-3);
  const historicalData = data.slice(0, -3);

  if (historicalData.length < 2) return false;

  const recentRegression = linearRegression(recentData);
  const historicalRegression = linearRegression(historicalData);

  // Significant change if slopes differ by more than 50% and recent trend is stronger
  const slopeChange = Math.abs(recentRegression.slope - historicalRegression.slope);
  const avgSlope = (Math.abs(recentRegression.slope) + Math.abs(historicalRegression.slope)) / 2;

  return avgSlope > 0 && slopeChange / avgSlope > 0.5 && Math.abs(recentRegression.slope) > Math.abs(historicalRegression.slope);
}

// Generate forecast for a specific metric
export function generateForecast(
  metric: string,
  data: TimeSeriesPoint[],
  horizon: '7d' | '30d'
): ForecastResult {
  const now = new Date();
  const generatedAt = now.toISOString();

  if (data.length < 3) {
    const lastValue = data[data.length - 1]?.value || 0;
    return {
      metric,
      horizon,
      currentValue: lastValue,
      predictedValue: lastValue,
      confidenceInterval: { lower: lastValue * 0.9, upper: lastValue * 1.1 },
      changePercent: 0,
      trend: 'stable',
      confidence: 0.3,
      trajectoryChanged: false,
      generatedAt,
    };
  }

  const { slope, intercept, r2 } = linearRegression(data);
  const stdDev = calculateStdDev(data, slope, intercept);

  // Forecast horizon in days
  const horizonDays = horizon === '7d' ? 7 : 30;
  const lastIndex = data.length - 1;
  const forecastIndex = lastIndex + horizonDays;

  const currentValue = data[lastIndex].value;
  const predictedValue = slope * forecastIndex + intercept;

  // Confidence interval using standard error
  const confidenceMultiplier = 1.96; // 95% confidence
  const stderr = stdDev * Math.sqrt(1 + 1 / data.length + Math.pow(forecastIndex - lastIndex, 2) / data.length);
  const margin = confidenceMultiplier * stderr;

  const changePercent = currentValue > 0 ? ((predictedValue - currentValue) / currentValue) * 100 : 0;
  const trend = changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'stable';

  const trajectoryChanged = detectTrajectoryChange(data, slope);

  return {
    metric,
    horizon,
    currentValue,
    predictedValue: Math.max(0, predictedValue),
    confidenceInterval: {
      lower: Math.max(0, predictedValue - margin),
      upper: Math.max(0, predictedValue + margin),
    },
    changePercent,
    trend,
    confidence: Math.min(0.95, Math.max(0.3, r2)),
    trajectoryChanged,
    generatedAt,
  };
}

// Generate forecasts for all KPIs
export function generateKpiForecasts(
  kpiData: Record<string, TimeSeriesPoint[]>
): KpiForecasts {
  const generatedAt = new Date().toISOString();
  const forecasts: ForecastResult[] = [];

  for (const [metric, data] of Object.entries(kpiData)) {
    // Generate 7-day forecast
    forecasts.push(generateForecast(metric, data, '7d'));
    // Generate 30-day forecast
    forecasts.push(generateForecast(metric, data, '30d'));
  }

  const trendChanges = forecasts.filter((f) => f.trajectoryChanged).length;
  const upTrends = forecasts.filter((f) => f.trend === 'up').length;
  const downTrends = forecasts.filter((f) => f.trend === 'down').length;

  let overallTrajectory: 'accelerating' | 'decelerating' | 'stable' = 'stable';
  if (upTrends > downTrends * 1.5) overallTrajectory = 'accelerating';
  else if (downTrends > upTrends * 1.5) overallTrajectory = 'decelerating';

  return {
    generatedAt,
    forecasts,
    summary: {
      totalPredictions: forecasts.length,
      trendChanges,
      overallTrajectory,
    },
  };
}

// Mock historical data generator for development/testing
export function generateMockHistory(
  metric: string,
  days: number = 90,
  baseValue: number = 100,
  volatility: number = 0.1
): TimeSeriesPoint[] {
  const data: TimeSeriesPoint[] = [];
  const now = new Date();

  // Add trend component
  const trend = metric.includes('revenue') || metric.includes('pipeline') ? 0.02 : 
                metric.includes('backlog') ? 0.01 : 0;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Base value with trend and weekly seasonality
    const trendFactor = 1 + (trend * (days - i) / days);
    const weeklySeasonality = 1 + 0.1 * Math.sin((date.getDay() / 7) * 2 * Math.PI);
    const noise = 1 + (Math.random() - 0.5) * volatility;

    const value = Math.round(baseValue * trendFactor * weeklySeasonality * noise);

    data.push({
      timestamp: date.toISOString(),
      value: Math.max(0, value),
    });
  }

  return data;
}

// Format forecast for display
export function formatForecastMessage(forecast: ForecastResult): string {
  const { metric, horizon, predictedValue, changePercent, trend, trajectoryChanged } = forecast;
  const metricName = metric.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const horizonText = horizon === '7d' ? 'next week' : 'next 30 days';

  let message = `Forecast: ${metricName} `;

  if (trend === 'up') {
    message += `↑ ${changePercent.toFixed(1)}% ${horizonText}`;
  } else if (trend === 'down') {
    message += `↓ ${Math.abs(changePercent).toFixed(1)}% ${horizonText}`;
  } else {
    message += `stable ${horizonText}`;
  }

  if (trajectoryChanged) {
    message += ' • Trajectory changed';
  }

  return message;
}
