'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  progress: number;
  className?: string;
  barClassName?: string;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  color?: 'auto' | 'green' | 'blue' | 'amber' | 'red' | 'purple';
  isLoading?: boolean;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

export function ProgressBar({ 
  progress, 
  className, 
  barClassName,
  animate = true,
  size = 'md',
  showLabel = false,
  color = 'auto',
  isLoading = false,
}: ProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Animate progress on mount and when progress changes
  useEffect(() => {
    if (!animate) {
      setDisplayProgress(clampedProgress);
      return;
    }

    // Small delay for entrance animation
    const timeout = setTimeout(() => {
      setDisplayProgress(clampedProgress);
    }, 100);

    return () => clearTimeout(timeout);
  }, [clampedProgress, animate]);

  const getBarColor = () => {
    if (color !== 'auto') {
      const colors = {
        green: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
        blue: 'bg-gradient-to-r from-blue-500 to-blue-400',
        amber: 'bg-gradient-to-r from-amber-500 to-amber-400',
        red: 'bg-gradient-to-r from-red-500 to-red-400',
        purple: 'bg-gradient-to-r from-purple-500 to-purple-400',
      };
      return colors[color];
    }
    // Auto color based on progress
    if (clampedProgress <= 30) return 'bg-gradient-to-r from-red-500 to-red-400';
    if (clampedProgress <= 70) return 'bg-gradient-to-r from-amber-500 to-amber-400';
    return 'bg-gradient-to-r from-emerald-500 to-emerald-400';
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div 
          className={cn(
            'rounded-full bg-slate-800/50 animate-pulse', 
            sizeClasses[size]
          )} 
        />
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full rounded-full overflow-hidden',
          sizeClasses[size]
        )}
        style={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all',
            animate ? 'duration-700 ease-out' : 'duration-300 ease-out',
            getBarColor(),
            barClassName
          )}
          style={{ 
            width: `${displayProgress}%`,
            transition: animate 
              ? 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)' 
              : 'width 0.3s ease-out'
          }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(clampedProgress)}% complete`}
        />
      </div>
      {showLabel && (
        <span className="mt-1.5 text-xs font-medium text-slate-400">
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );
}
