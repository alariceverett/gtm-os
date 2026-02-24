'use client';

import { useAnomalies, useKpiForecasts, useRiskScores } from '@/app/hooks/use-predictions';
import { SkeletonIntelligenceItem, SkeletonText, SkeletonHealthScore } from '@/app/components/skeleton-loader';
import { SectionErrorFallback } from '@/app/components/error-boundary';
import { formatLastUpdated } from '@/app/hooks/use-data-fetch';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Brain,
  Target,
  ArrowRight,
  TrendingFlat,
  ChevronRight,
  Clock,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { useState, useMemo } from 'react';

type AlertTab = 'predictions' | 'anomalies' | 'risks';

interface SmartAlertsProps {
  limit?: number;
}

export function SmartAlerts({ limit = 5 }: SmartAlertsProps) {
  const [activeTab, setActiveTab] = useState<AlertTab>('predictions');

  const {
    forecasts,
    isLoading: forecastsLoading,
    isError: forecastsError,
    error: forecastsErr,
    refetch: refetchForecasts,
  } = useKpiForecasts(60000);

  const {
    anomalies,
    anomalySummary,
    criticalAnomalies,
    warningAnomalies,
    isLoading: anomaliesLoading,
    isError: anomaliesError,
    error: anomaliesErr,
    refetch: refetchAnomalies,
  } = useAnomalies(30000);

  const {
    risks,
    topRisks,
    isLoading: risksLoading,
    isError: risksError,
    error: risksErr,
    refetch: refetchRisks,
  } = useRiskScores(60000);

  const isLoading = forecastsLoading || anomaliesLoading || risksLoading;
  const isError = forecastsError || anomaliesError || risksError;
  const error = forecastsErr || anomaliesErr || risksErr;

  const alertCount = useMemo(() => {
    const importantForecasts = forecasts?.forecasts?.filter(
      (f) => f.trajectoryChanged || Math.abs(f.changePercent) > 20
    ).length || 0;
    const anomalyCount = criticalAnomalies.length + warningAnomalies.length;
    const riskCount = topRisks?.filter((d) => d.level === 'critical' || d.level === 'high').length || 0;
    return importantForecasts + anomalyCount + riskCount;
  }, [forecasts, criticalAnomalies, warningAnomalies, topRisks]);

  const refetchAll = () => {
    refetchForecasts();
    refetchAnomalies();
    refetchRisks();
  };

  const lastUpdated = forecasts?.generated_at || anomalies?.generated_at || risks?.generated_at;

  return (
    <section className="relative">
      {/* Header with tabs and refresh */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            Smart Alerts
            {alertCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500 text-black font-semibold">
                {alertCount}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={refetchAll}
              disabled={isLoading}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'hover:bg-slate-100 dark:hover:bg-slate-800',
                isLoading && 'animate-spin'
              )}
              aria-label="Refresh predictions"
            >
              <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
          <Tab
            label="Predictions"
            badge={forecasts?.summary?.trendChanges || 0}
            isActive={activeTab === 'predictions'}
            onClick={() => setActiveTab('predictions')}
            icon={TrendingUp}
          />
          <Tab
            label="Anomalies"
            badge={anomalySummary?.newAnomalies || 0}
            severity={anomalySummary?.criticalCount ? 'error' : anomalySummary?.warningCount ? 'warning' : undefined}
            isActive={activeTab === 'anomalies'}
            onClick={() => setActiveTab('anomalies')}
            icon={Activity}
          />
          <Tab
            label="Risks"
            badge={risks?.summary?.criticalCount || 0}
            severity={risks?.summary?.criticalCount ? 'error' : risks?.summary?.highCount ? 'warning' : undefined}
            isActive={activeTab === 'risks'}
            onClick={() => setActiveTab('risks')}
            icon={Target}
          />
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="mb-4">
          <SectionErrorFallback
            title="Failed to load smart alerts"
            message={error?.message || 'Unable to fetch prediction data'}
            onRetry={refetchAll}
          />
        </div>
      )}

      {/* Content based on active tab */}
      <div className="space-y-2">
        {isLoading ? (
          <>
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
          </>
        ) : activeTab === 'predictions' ? (
          <PredictionsTab forecasts={forecasts} limit={limit} />
        ) : activeTab === 'anomalies' ? (
          <AnomaliesTab anomalies={anomalies} limit={limit} />
        ) : (
          <RisksTab risks={risks} limit={limit} />
        )}
      </div>

      {/* Footer */}
      {lastUpdated && !isLoading && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Updated {formatLastUpdated(lastUpdated)}</span>
          </div>
        </div>
      )}
    </section>
  );
}

interface TabProps {
  label: string;
  badge?: number;
  severity?: 'error' | 'warning';
  isActive: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

function Tab({ label, badge = 0, severity, isActive, onClick, icon: Icon }: TabProps) {
  const badgeColor = severity === 'error'
    ? 'bg-red-500 text-white'
    : severity === 'warning'
    ? 'bg-amber-500 text-black'
    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300';

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5',
        isActive
          ? 'border-purple-500 text-purple-600 dark:text-purple-400'
          : 'border-transparent text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge > 0 && (
        <span className={cn('ml-1 px-1.5 py-0.5 text-xs rounded-full', badgeColor)}>
          {badge}
        </span>
      )}
    </button>
  );
}

interface ForecastsTabProps {
  forecasts: any;
  limit: number;
}

function PredictionsTab({ forecasts, limit }: ForecastsTabProps) {
  const importantForecasts = forecasts?.forecasts?.filter(
    (f: any) => f.trajectoryChanged || Math.abs(f.changePercent) > 15 || f.horizon === '7d'
  ).slice(0, limit) || [];

  if (importantForecasts.length === 0) {
    return <EmptyState icon={TrendingUp} message="No significant predictions" />;
  }

  return (
    <div className="space-y-2">
      {importantForecasts.map((forecast: any) => (
        <PredictionItem key={`${forecast.metric}-${forecast.horizon}`} forecast={forecast} />
      ))}
    </div>
  );
}

interface PredictionItemProps {
  forecast: {
    metric: string;
    horizon: '7d' | '30d';
    currentValue: number;
    predictedValue: number;
    changePercent: number;
    trend: 'up' | 'down' | 'stable';
    confidence: number;
    trajectoryChanged: boolean;
    display_message?: string;
  };
}

function PredictionItem({ forecast }: PredictionItemProps) {
  const trendColor =
    forecast.trend === 'up'
      ? 'text-emerald-600 dark:text-emerald-400'
      : forecast.trend === 'down'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-600 dark:text-slate-400';

  const TrendIcon = forecast.trend === 'up' ? TrendingUp : forecast.trend === 'down' ? TrendingDown : TrendingFlat;

  const metricName = forecast.metric.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const horizonText = forecast.horizon === '7d' ? '7d' : '30d';

  return (
    <div className={cn(
      'group flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer',
      forecast.trajectoryChanged
        ? 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900'
        : 'bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 hover:border-purple-500 dark:hover:border-purple-500'
    )}>
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', forecast.trend === 'up' ? 'bg-emerald-100 dark:bg-emerald-900' : forecast.trend === 'down' ? 'bg-red-100 dark:bg-red-900' : 'bg-slate-100 dark:bg-slate-800')}>
        <TrendIcon className={cn('w-4 h-4', trendColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{metricName}</p>
          <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
            {horizonText}
          </span>
          {forecast.trajectoryChanged && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 flex items-center gap-1">
              <Flame className="w-3 h-3" />
              Trend Change
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs">
          <span className={cn('font-medium', trendColor)}>
            {forecast.changePercent > 0 ? '+' : ''}
            {forecast.changePercent.toFixed(1)}%
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">
            {forecast.currentValue} → {Math.round(forecast.predictedValue)}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-500">{Math.round(forecast.confidence * 100)}% confidence</span>
        </div>
      </div>

      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
}

interface AnomaliesTabProps {
  anomalies: any;
  limit: number;
}

function AnomaliesTab({ anomalies, limit }: AnomaliesTabProps) {
  const sortedAnomalies = (anomalies?.anomalies || [])
    .sort((a: any, b: any) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    })
    .slice(0, limit);

  if (sortedAnomalies.length === 0) {
    return <EmptyState icon={CheckCircle2} message="No anomalies detected - everything looks normal" />;
  }

  return (
    <div className="space-y-2">
      {sortedAnomalies.map((anomaly: any) => (
        <AnomalyItem key={anomaly.id} anomaly={anomaly} />
      ))}
    </div>
  );
}

interface AnomalyItemProps {
  anomaly: {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    type: 'spike' | 'drop' | 'pattern_break';
    message: string;
    recommendedAction?: string;
    zScore: number;
  };
}

function AnomalyItem({ anomaly }: AnomalyItemProps) {
  const severityConfig = {
    critical: {
      bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900',
      iconBg: 'bg-red-100 dark:bg-red-900',
      iconColor: 'text-red-600 dark:text-red-400',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      label: 'Critical',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
      iconBg: 'bg-amber-100 dark:bg-amber-900',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      label: 'Warning',
    },
    info: {
      bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
      iconBg: 'bg-blue-100 dark:bg-blue-900',
      iconColor: 'text-blue-600 dark:text-blue-400',
      badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      label: 'Info',
    },
  };

  const config = severityConfig[anomaly.severity];

  return (
    <div className={cn('group flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer', config.bg)}>
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', config.iconBg)}>
        <AlertTriangle className={cn('w-4 h-4', config.iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{anomaly.message}</p>
          <span className={cn('px-1.5 py-0.5 text-xs rounded-full', config.badge)}>{config.label}</span>
        </div>

        {anomaly.recommendedAction && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">💡 {anomaly.recommendedAction}</p>
        )}

        <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
          <span>Z-score: {anomaly.zScore.toFixed(2)}</span>
          <span>•</span>
          <span className="capitalize">{anomaly.type.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </div>
    </div>
  );
}

interface RisksTabProps {
  risks: any;
  limit: number;
}

function RisksTab({ risks, limit }: RisksTabProps) {
  const sortedRisks = (risks?.top_risks || []).slice(0, limit);

  if (sortedRisks.length === 0) {
    return <EmptyState icon={ShieldCheck} message="All deals are healthy" />;
  }

  return (
    <div className="space-y-2">
      {sortedRisks.map((deal: any) => (
        <RiskItem key={deal.dealId} deal={deal} />
      ))}
    </div>
  );
}

interface RiskItemProps {
  deal: {
    dealId: string;
    accountName: string;
    totalScore: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    emoji: string;
    topReasons: string[];
    recommendedActions: string[];
    trend: 'improving' | 'stable' | 'worsening';
    daysInStage: number;
  };
}

function RiskItem({ deal }: RiskItemProps) {
  const levelConfig = {
    critical: {
      bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      progressColor: 'bg-red-500',
    },
    high: {
      bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900',
      badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      progressColor: 'bg-orange-500',
    },
    medium: {
      bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      progressColor: 'bg-amber-500',
    },
    low: {
      bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      progressColor: 'bg-emerald-500',
    },
  };

  const config = levelConfig[deal.level];

  return (
    <div className={cn('group p-3 rounded-lg border transition-all cursor-pointer', config.bg)}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-lg">{deal.emoji}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{deal.accountName}</p>
            <span className={cn('px-1.5 py-0.5 text-xs rounded-full capitalize', config.badge)}>{deal.level}</span>
            {deal.trend === 'improving' && (
              <TrendingUp className="w-3 h-3 text-emerald-600" />
            )}
          </div>

          {/* Risk score bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
            <div
              className={cn('h-1.5 rounded-full transition-all', config.progressColor)}
              style={{ width: `${deal.totalScore}%` }}
            />
          </div>

          {/* Top reason */}
          {deal.topReasons.length > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5">
              ⚠️ {deal.topReasons[0]}
            </p>
          )}

          {/* Primary recommendation */}
          {deal.recommendedActions.length > 0 && deal.level === 'critical' && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">
              🚨 {deal.recommendedActions[0]}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
            <span>Risk: {deal.totalScore.toFixed(0)}%</span>
            <span>•</span>
            <span>{deal.daysInStage}d in stage</span>
            <span>•</span>
            <span className={cn(
              deal.trend === 'improving' ? 'text-emerald-600' :
              deal.trend === 'worsening' ? 'text-red-600' : 'text-slate-500'
            )}>
              {deal.trend}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}

function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="p-6 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
      <Icon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

// ShieldCheck for the healthy state
function ShieldCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
