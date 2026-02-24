'use client';

import { KpiCard } from '@/app/components/kpi-card';
import { HealthIndicator } from '@/app/components/health-indicator';
import type { HealthStatus } from '@/app/components/health-indicator';
import { useKpisWithFallback, calculateHealthStatus } from '@/app/hooks/use-kpis';
import { useSimpleForecast } from '@/app/hooks/use-simple-forecast';
import { SkeletonKpiCard, SkeletonHealthScore } from '@/app/components/skeleton-loader';
import { SectionErrorFallback } from '@/app/components/error-boundary';
import { RefreshCw, AlertTriangle, Clock, TrendingUp, Users, Target, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLastUpdated } from '@/app/hooks/use-data-fetch';

export function HeroStatus() {
  const { kpis, healthStatus, isLoading, isError, error, isStale, lastUpdated, refetch } = useKpisWithFallback(30000);
  
  // Generate 7-day trend forecasts for KPIs
  const { getTrend } = useSimpleForecast(kpis.kpis?.cards);

  return (
    <section className="relative">
      {/* Status Header with refresh indicator */}
      <div 
        className="flex items-center justify-between mb-6 opacity-0 animate-fade-in-up"
        style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Command Center</h2>
            <p className="text-sm text-slate-500">Real-time KPI monitoring</p>
          </div>
          <HealthIndicator 
            status={healthStatus}
            pulse={false}
            className="scale-75"
          />
        </div>
        
        <div className="flex items-center gap-3">
          {isStale && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 animate-fade-in">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Stale data</span>
            </div>
          )}
          <button
            onClick={refetch}
            disabled={isLoading}
            className={cn(
              "p-2 rounded-lg",
              "bg-slate-100 dark:bg-slate-800",
              "hover:bg-slate-200 dark:hover:bg-slate-700",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              "focus-visible:ring-blue-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
              "transition-all duration-200 ease-out",
              "hover:scale-105 active:scale-95",
              isLoading && "animate-spin"
            )}
            aria-label="Refresh data"
          >
            <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="mb-6">
          <SectionErrorFallback 
            title="Failed to load KPIs"
            message={error?.message || 'Unable to fetch latest metrics'}
            onRetry={refetch}
          />
        </div>
      )}

      {/* KPI Grid with staggered animation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonKpiCard />
          </>
        ) : (
          kpis.kpis.cards.map((kpi, index) => (
            <KpiCard
              key={kpi.key}
              label={kpi.label}
              value={kpi.value}
              delta={kpi.deltaText}
              deltaClass={kpi.deltaClass as 'positive' | 'negative' | 'neutral'}
              trend={getTrend(kpi.key) || undefined}
              loading={isLoading}
              index={index}
            />
          ))
        )}
      </div>

      {/* Health Score Panel */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
              <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Lifecycle Health</h3>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              <span>Updated {formatLastUpdated(lastUpdated)}</span>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <SkeletonHealthScore />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {kpis.lifecycle.stages.map((stage, index) => (
              <StageIndicator
                key={stage.key}
                label={stage.label}
                count={typeof stage.count === 'number' ? stage.count : parseInt(String(stage.count)) || 0}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Campaign Summary */}
      {kpis.campaigns && !isLoading && (
        <div className="mt-6">
          <div 
            className="rounded-xl border p-5 transition-all duration-200 ease-out hover:shadow-lg hover:shadow-black/[0.05] dark:hover:shadow-black/10"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Campaign Performance</h3>
                  <p className="text-xs text-slate-500">Last 7 days</p>
                </div>
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {kpis.campaigns.freshness}
              </span>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <CampaignMetric
                label="Ad Spend"
                value={formatCurrency(kpis.campaigns.spend)}
              />
              <CampaignMetric
                label="Revenue"
                value={formatCurrency(kpis.campaigns.revenue)}
                highlight
              />
              <CampaignMetric
                label="Conversions"
                value={typeof kpis.campaigns.conversions === 'number' 
                  ? kpis.campaigns.conversions.toLocaleString() 
                  : String(kpis.campaigns.conversions)}
              />
              <CampaignMetric
                label="ROAS"
                value={typeof kpis.campaigns.roas === 'number' 
                  ? `${kpis.campaigns.roas.toFixed(1)}x` 
                  : String(kpis.campaigns.roas)}
                highlight={typeof kpis.campaigns.roas === 'number' && kpis.campaigns.roas >= 2}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface StageIndicatorProps {
  label: string;
  count: number;
  index?: number;
}

function StageIndicator({ label, count, index = 0 }: StageIndicatorProps) {
  return (
    <div 
      className={cn(
        "p-4 rounded-lg border cursor-default",
        "group transition-all duration-200 ease-out",
        "hover:-translate-y-1 hover:shadow-md",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "focus-visible:ring-blue-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        "opacity-0 animate-fade-in-up"
      )}
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'forwards',
      }}
      tabIndex={0}
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums transition-transform duration-200 group-hover:scale-105">
        {count.toLocaleString()}
      </div>
    </div>
  );
}

interface CampaignMetricProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

function CampaignMetric({ label, value, highlight }: CampaignMetricProps) {
  return (
    <div 
      className={cn(
        "text-center group transition-all duration-200 ease-out",
        "p-3 rounded-lg",
        "hover:bg-slate-50 dark:hover:bg-slate-900",
        "cursor-default focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
      )}
      tabIndex={0}
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
        {label}
      </div>
      <div className={cn(
        "text-xl font-bold tabular-nums transition-transform duration-200 group-hover:scale-105",
        highlight && "text-emerald-600 dark:text-emerald-400",
        !highlight && "text-slate-900 dark:text-slate-100"
      )}>
        {value}
      </div>
    </div>
  );
}

function formatCurrency(value: number | string): string {
  if (typeof value === 'string') return value;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}
