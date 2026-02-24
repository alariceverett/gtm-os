/**
 * Predictions Library
 * 
 * Exports forecasting, anomaly detection, and risk scoring utilities
 */

// Simple Forecast (MVP - 7-day trend)
export {
  calculate7dAverage,
  calculateTrend,
  calculateKpiTrend,
  generateSimpleForecast,
  getTrendForMetric,
  getTrendColorClass,
  getTrendBgClass,
} from './simple-forecast';
export type {
  KpiHistoryPoint,
  KpiTrend,
  SimpleForecastResult,
} from './simple-forecast';

// API Client
export {
  fetchKpiForecasts,
  fetchAnomalies,
  fetchRiskScores,
} from './api';

// Types
export type {
  ForecastResult,
  ForecastResponse,
  AnomalyResult,
  AnomalyResponse,
  DealRiskScore,
  RiskResponse,
} from './types';
