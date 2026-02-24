'use client';

import { cn, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { Skeleton } from './skeleton';
import { type TrendData, getTrendColorClass, getTrendBgClass } from '@/lib/predictions/simple-forecast';

interface KpiCardProps {
  label: string;
  value: number | string;
  delta?: string;
  deltaClass?: 'positive' | 'negative' | 'neutral';
  trend?: TrendData; // New: 7-day trend data
  loading?: boolean;
  className?: string;
  index?: number; // For staggered animation
}

// Simple sparkline SVG component
function MiniSparkline({ trend }: { trend: 'positive' | 'negative' | 'neutral' }) {
  // Generate a simple path based on trend direction
  const points = trend === 'positive' 
    ? "2 14 6 10 10 12 14 6 18 4 22 2"
    : trend === 'negative'
    ? "2 4 6 6 10 8 14 12 18 14 22 16"
    : "2 9 6 8 10 10 14 9 18 10 22 9";
  
  const colorClass = trend === 'positive' 
    ? 'stroke-emerald-500' 
    : trend === 'negative' 
    ? 'stroke-red-500' 
    : 'stroke-slate-400';

  return (
    <svg 
      className={cn("w-12 h-6", colorClass)} 
      viewBox="0 0 24 18" 
      fill="none" 
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points={points} className="opacity-60" />
    </svg>
  );
}

export function KpiCard({ label, value, delta, deltaClass = 'neutral', trend, loading, className, index = 0 }: KpiCardProps) {
  if (loading) {
    return (
      <div 
        className={cn(
          'rounded-xl p-5 border',
          'animate-pulse',
          className
        )}
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mb-2 h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="mb-3 h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
      </div>
    );
  }

  const getTrendIcon = () => {
    switch (deltaClass) {
      case 'positive':
        return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
      case 'negative':
        return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Minus className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const getTrendColor = () => {
    switch (deltaClass) {
      case 'positive':
        return 'text-emerald-500';
      case 'negative':
        return 'text-red-500';
      default:
        return 'text-slate-500';
    }
  };

  const getTrendBg = () => {
    switch (deltaClass) {
      case 'positive':
        return 'bg-emerald-50 dark:bg-emerald-500/10';
      case 'negative':
        return 'bg-red-50 dark:bg-red-500/10';
      default:
        return 'bg-slate-100 dark:bg-slate-800';
    }
  };

  const formattedValue = typeof value === 'number' ? formatNumber(value) : value;

  // Get simple arrow for trend display
  const getTrendArrowOnly = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return <ArrowUp className="h-3 w-3" />;
      case 'down':
        return <ArrowDown className="h-3 w-3" />;
      case 'flat':
      default:
        return <ArrowRight className="h-3 w-3" />;
    }
  };
  
  return (
    <div
      className={cn(
        'group relative rounded-xl p-5 border',
        'transition-all duration-200 ease-out',
        'hover:shadow-xl hover:shadow-black/[0.08] dark:hover:shadow-black/20',
        'hover:-translate-y-1',
        'cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-blue-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
        'opacity-0 animate-fade-in-up',
        className
      )}
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
        animationDelay: `${index * 100}ms`,
        animationFillMode: 'forwards',
      }}
      role="region"
      aria-label={`${label} KPI`}
      tabIndex={0}
    >
      {/* Background gradient on hover */}
      <div 
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.03) 100%)',
        }}
      />
      
      <div className="relative">
        {/* Label + Sparkline row */}
        <div className="flex items-center justify-between mb-3">
          <p 
            className="text-sm font-medium transition-colors duration-200 group-hover:text-[var(--color-text-primary)]"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {label}
          </p>
          <div className="opacity-60 group-hover:opacity-100 transition-opacity duration-200">
            <MiniSparkline trend={deltaClass} />
          </div>
        </div>
        
        {/* Big value */}
        <div className="mb-3">
          <span 
            className="text-3xl font-bold tracking-tight tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {formattedValue}
          </span>
        </div>
        
        {/* Trend indicator */}
        {delta && (
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
            getTrendColor(),
            getTrendBg(),
            "transition-transform duration-200 group-hover:scale-105"
          )}>
            {getTrendIcon()}
            <span>{delta}</span>
          </div>
        )}

        {/* 7-day trend indicator (new) */}
        {trend && (
          <div className={cn(
            "inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium",
            getTrendColorClass(trend.direction)
          )}>
            {getTrendArrowOnly()}
            <span>{trend.displayText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
