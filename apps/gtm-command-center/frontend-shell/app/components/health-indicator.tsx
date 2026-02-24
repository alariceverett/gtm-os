'use client';

import { cn } from '@/lib/utils';

interface HealthIndicatorProps {
  status: 'healthy' | 'warning' | 'critical';
  label?: string;
  className?: string;
  pulse?: boolean;
}

const statusConfig = {
  healthy: {
    color: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
    label: 'System Healthy',
  },
  warning: {
    color: 'bg-amber-500',
    ring: 'ring-amber-500/30',
    label: 'Attention Needed',
  },
  critical: {
    color: 'bg-red-500',
    ring: 'ring-red-500/30',
    label: 'Critical Issue',
  },
};

export type HealthStatus = 'healthy' | 'warning' | 'critical';

export function HealthIndicator({ status, label, className, pulse = true }: HealthIndicatorProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex items-center justify-center">
        {/* Pulsing ring */}
        {pulse && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              config.color,
              pulse ? 'animate-ping' : 'opacity-0'
            )}
          />
        )}
        {/* Status dot */}
        <span
          className={cn(
            'relative inline-flex h-3 w-3 rounded-full ring-2 ring-offset-2 ring-offset-slate-900',
            config.color,
            config.ring
          )}
        />
      </div>
      <span className="text-sm font-medium text-slate-100">
        {label || config.label}
      </span>
    </div>
  );
}
