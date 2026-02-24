'use client';

import { cn } from '@/lib/utils';
import { ReactNode, useState, useEffect } from 'react';

// ============================================================================
// ANIMATION TIMING & EASING
// ============================================================================

export const ANIMATION = {
  // Duration in ms
  duration: {
    instant: 100,
    fast: 150,
    normal: 200,
    slow: 300,
    slower: 500,
    entrance: 600,
  },
  
  // Easing functions
  easing: {
    // Standard ease-out
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Decelerate (entrance)
    entrance: 'cubic-bezier(0, 0, 0.2, 1)',
    // Slight overshoot (bouncy)
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    // Very smooth
    smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    // Linear (for continuous animations)
    linear: 'linear',
  },
} as const;

// ============================================================================
// TRANSITION CONSTANTS
// ============================================================================

export const TRANSITION_DEFAULT = 'transition-all duration-200 ease-out';
export const TRANSITION_SLOW = 'transition-all duration-300 ease-out';
export const TRANSITION_FAST = 'transition-all duration-150 ease-out';

// Hover scale amounts
export const HOVER_SCALE_SM = 'hover:scale-[1.02]';
export const HOVER_SCALE_MD = 'hover:scale-[1.03]';
export const HOVER_SCALE_LG = 'hover:scale-[1.05]';

// Card lift effect
export const CARD_LIFT = 'hover:-translate-y-0.5 hover:shadow-lg';
export const CARD_LIFT_LG = 'hover:-translate-y-1 hover:shadow-xl';

// Active states
export const ACTIVE_SCALE = 'active:scale-[0.98]';
export const ACTIVE_SCALE_SM = 'active:scale-[0.99]';

// Focus rings
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';
export const FOCUS_RING_OFFSET = 'focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900';

// ============================================================================
// ANIMATED CARD COMPONENT
// ============================================================================

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'flat' | 'dark';
  lift?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  href?: string;
  glow?: boolean;
}

export function AnimatedCard({ 
  children, 
  className,
  variant = 'default',
  lift = 'md',
  onClick,
  href,
  glow = false,
}: AnimatedCardProps) {
  const baseClasses = cn(
    'rounded-xl overflow-hidden',
    TRANSITION_SLOW,
    ACTIVE_SCALE,
    FOCUS_RING,
    'cursor-pointer'
  );

  const variantClasses = {
    default: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm',
    elevated: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md',
    flat: 'bg-slate-50 dark:bg-slate-900/50',
    dark: 'bg-slate-900 border border-slate-800/50',
  };

  const liftClasses = {
    none: '',
    sm: 'hover:shadow-md',
    md: CARD_LIFT,
    lg: CARD_LIFT_LG,
  };

  const glowClass = glow ? 'hover:ring-2 hover:ring-blue-500/20' : '';

  const classes = cn(
    baseClasses,
    variantClasses[variant],
    liftClasses[lift],
    glowClass,
    className
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <div 
      className={classes}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// ============================================================================
// ANIMATED BUTTON COMPONENT
// ============================================================================

interface AnimatedButtonProps {
  children: ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;
  loading?: boolean;
}

export function AnimatedButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  type = 'button',
  ariaLabel,
  loading = false,
}: AnimatedButtonProps) {
  const baseClasses = cn(
    'inline-flex items-center justify-center gap-2 font-medium',
    'rounded-xl',
    TRANSITION_FAST,
    HOVER_SCALE_SM,
    ACTIVE_SCALE,
    FOCUS_RING,
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100',
    loading && 'cursor-wait',
    className
  );

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-600/20',
    secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
    danger: 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-600/20',
    accent: 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500 shadow-sm shadow-violet-600/20',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size])}
    >
      {loading && (
        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

// ============================================================================
// ANIMATED PROGRESS BAR
// ============================================================================

interface AnimatedProgressBarProps {
  progress: number;
  className?: string;
  barClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animate?: boolean;
  color?: 'auto' | 'green' | 'blue' | 'amber' | 'red' | 'purple';
}

export function AnimatedProgressBar({
  progress,
  className,
  barClassName,
  size = 'md',
  showLabel = false,
  animate = true,
  color = 'auto',
}: AnimatedProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Animate progress on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDisplayProgress(clampedProgress);
    }, 100);
    return () => clearTimeout(timeout);
  }, [clampedProgress]);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

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

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full rounded-full bg-slate-700 overflow-hidden',
          sizeClasses[size]
        )}
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

// ============================================================================
// PULSE STATUS INDICATOR
// ============================================================================

type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusIndicatorProps {
  status: StatusType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  label?: string;
}

export function StatusIndicator({
  status,
  className,
  size = 'md',
  pulse = true,
  label,
}: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  const statusColors = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-slate-400',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('relative flex', sizeClasses[size])}>
        {pulse && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              statusColors[status]
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full',
            sizeClasses[size],
            statusColors[status],
            pulse && 'animate-pulse-gentle'
          )}
        />
      </span>
      {label && (
        <span className="text-sm text-slate-400">
          {label}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// STAGGER ANIMATION CONTAINER
// ============================================================================

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 50,
  initialDelay = 0,
}: StaggerContainerProps) {
  return (
    <div 
      className={cn('stagger-container', className)}
      style={{
        '--stagger-delay': `${staggerDelay}ms`,
        '--initial-delay': `${initialDelay}ms`,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  index?: number;
}

export function StaggerItem({ children, className, index = 0 }: StaggerItemProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 50);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-out',
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4',
        className
      )}
      style={{ transitionDelay: `${index * 50}ms` }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// FADE IN ON MOUNT
// ============================================================================

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 500,
  direction = 'up',
}: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const directionClasses = {
    up: isVisible ? 'translate-y-0' : 'translate-y-4',
    down: isVisible ? 'translate-y-0' : '-translate-y-4',
    left: isVisible ? 'translate-x-0' : 'translate-x-4',
    right: isVisible ? 'translate-x-0' : '-translate-x-4',
    none: '',
  };

  return (
    <div
      className={cn(
        'transition-all ease-out',
        isVisible ? 'opacity-100' : 'opacity-0',
        directionClasses[direction],
        className
      )}
      style={{ 
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// SCALE IN ON MOUNT
// ============================================================================

interface ScaleInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function ScaleIn({
  children,
  className,
  delay = 0,
  duration = 300,
}: ScaleInProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        'transition-all ease-out',
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
        className
      )}
      style={{ 
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// HOVER TEXT REVEAL
// ============================================================================

interface HoverRevealProps {
  children: ReactNode;
  revealContent: ReactNode;
  className?: string;
}

export function HoverReveal({ children, revealContent, className }: HoverRevealProps) {
  return (
    <div className={cn('group relative overflow-hidden', className)}>
      <div className="transition-transform duration-200 ease-out group-hover:-translate-y-full">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center translate-y-full transition-transform duration-200 ease-out group-hover:translate-y-0">
        {revealContent}
      </div>
    </div>
  );
}

// ============================================================================
// ICON BUTTON WITH FEEDBACK
// ============================================================================

interface IconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel: string;
  badge?: number;
}

export function IconButton({
  icon,
  onClick,
  className,
  variant = 'default',
  size = 'md',
  ariaLabel,
  badge,
}: IconButtonProps) {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const variantClasses = {
    default: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-800 hover:text-slate-300',
    subtle: 'bg-transparent text-slate-600 hover:text-slate-400',
  };

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'relative rounded-xl transition-all duration-200 ease-out',
        HOVER_SCALE_SM,
        ACTIVE_SCALE,
        FOCUS_RING,
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      <span className={iconSizes[size]}>{icon}</span>
      {badge !== undefined && badge > 0 && (
        <span className={cn(
          'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
          'flex items-center justify-center',
          'text-xs font-semibold text-white bg-red-500 rounded-full',
          'ring-2 ring-slate-900',
          'animate-scale-in'
        )}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// TOOLTIP COMPONENT
// ============================================================================

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({
  content,
  children,
  className,
  position = 'top',
  delay = 200,
}: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={cn('group relative inline-flex', className)}>      
      {children}      
      <div className={cn(
        'absolute z-50 px-2 py-1',
        'text-xs font-medium text-white',
        'bg-slate-800 rounded-md',
        'whitespace-nowrap',
        'opacity-0 invisible',
        'transition-all duration-200 ease-out',
        'group-hover:opacity-100 group-hover:visible',
        'pointer-events-none',
        positionClasses[position]
      )}
      >        
        {content}        
        <span className={cn(
          'absolute w-2 h-2 bg-slate-800 rotate-45',
          position === 'top' && 'top-full left-1/2 -translate-x-1/2 -mt-1',
          position === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
          position === 'left' && 'left-full top-1/2 -translate-y-1/2 -ml-1',
          position === 'right' && 'right-full top-1/2 -translate-y-1/2 -mr-1',
        )} />      </div>    </div>
  );
}

// ============================================================================
// SKELETON SHIMMER
// ============================================================================

interface SkeletonShimmerProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
}

export function SkeletonShimmer({
  width,
  height,
  circle = false,
  className,
}: SkeletonShimmerProps) {
  return (
    <div
      className={cn(
        'bg-slate-800/50 animate-pulse',
        circle ? 'rounded-full' : 'rounded-md',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}
