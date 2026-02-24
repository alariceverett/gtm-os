'use client';

import { cn } from '@/lib/utils';

// ============================================================================
// SKELETON BASE COMPONENT
// ============================================================================

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  animate?: boolean;
  style?: React.CSSProperties;
}

export function Skeleton({ 
  className, 
  width, 
  height, 
  circle = false,
  animate = true 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-slate-200 dark:bg-slate-700',
        animate && 'animate-pulse',
        circle && 'rounded-full',
        !circle && 'rounded-md',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

// ============================================================================
// SKELETON TEXT
// ============================================================================

interface SkeletonTextProps {
  className?: string;
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: string;
  animate?: boolean;
}

export function SkeletonText({ 
  className, 
  lines = 3, 
  lineHeight = 16,
  lastLineWidth = '70%',
  animate = true 
}: SkeletonTextProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-full"
          height={lineHeight}
          animate={animate}
          style={{
            width: i === lines - 1 ? lastLineWidth : '100%',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SKELETON CARD
// ============================================================================

interface SkeletonCardProps {
  className?: string;
  hasImage?: boolean;
  hasHeader?: boolean;
  hasFooter?: boolean;
  contentLines?: number;
  imageHeight?: number;
  animate?: boolean;
}

export function SkeletonCard({
  className,
  hasImage = false,
  hasHeader = true,
  hasFooter = false,
  contentLines = 3,
  imageHeight = 160,
  animate = true,
}: SkeletonCardProps) {
  return (
    <div className={cn(
      'rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden',
      className
    )}>
      {hasImage && (
        <Skeleton 
          className="w-full rounded-none" 
          height={imageHeight} 
          animate={animate} 
        />
      )}
      
      <div className="p-4 space-y-4">
        {hasHeader && (
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" circle animate={animate} />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-2/3 h-4" animate={animate} />
              <Skeleton className="w-1/3 h-3" animate={animate} />
            </div>
          </div>
        )}
        
        <SkeletonText 
          lines={contentLines} 
          lineHeight={12} 
          animate={animate} 
        />
        
        {hasFooter && (
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="w-20 h-8" animate={animate} />
            <Skeleton className="w-24 h-8" animate={animate} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON KPI CARD
// ============================================================================

interface SkeletonKpiCardProps {
  className?: string;
  animate?: boolean;
}

export function SkeletonKpiCard({ className, animate = true }: SkeletonKpiCardProps) {
  return (
    <div className={cn(
      'rounded-xl bg-slate-100 dark:bg-slate-800/50 p-5 border border-slate-200 dark:border-slate-700/50',
      className
    )}>
      <Skeleton className="mb-2 h-4 w-20" animate={animate} />
      <Skeleton className="mb-3 h-10 w-24" animate={animate} />
      <Skeleton className="h-3 w-32" animate={animate} />
    </div>
  );
}

// ============================================================================
// SKELETON LIST
// ============================================================================

interface SkeletonListProps {
  className?: string;
  items?: number;
  hasIcon?: boolean;
  hasMeta?: boolean;
  animate?: boolean;
}

export function SkeletonList({
  className,
  items = 4,
  hasIcon = true,
  hasMeta = true,
  animate = true,
}: SkeletonListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30"
        >
          {hasIcon && <Skeleton className="h-10 w-10" circle animate={animate} />}
          <div className="flex-1 space-y-2">
            <Skeleton className="w-3/4 h-4" animate={animate} />
            <Skeleton className="w-1/2 h-3" animate={animate} />
          </div>
          {hasMeta && <Skeleton className="w-16 h-6" animate={animate} />}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SKELETON TABLE
// ============================================================================

interface SkeletonTableProps {
  className?: string;
  rows?: number;
  columns?: number;
  hasHeader?: boolean;
  animate?: boolean;
}

export function SkeletonTable({
  className,
  rows = 5,
  columns = 4,
  hasHeader = true,
  animate = true,
}: SkeletonTableProps) {
  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      {hasHeader && (
        <div className="flex gap-4 pb-3 mb-3 border-b border-slate-200 dark:border-slate-700">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={`header-${i}`}
              className="flex-1"
              height={20}
              animate={animate}
            />
          ))}
        </div>
      )}
      
      {/* Rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 items-center">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className="flex-1"
                height={colIndex === 0 ? 16 : 12}
                animate={animate}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON DASHBOARD
// ============================================================================

interface SkeletonDashboardProps {
  className?: string;
  kpiCount?: number;
  listItems?: number;
  animate?: boolean;
}

export function SkeletonDashboard({
  className,
  kpiCount = 4,
  listItems = 3,
  animate = true,
}: SkeletonDashboardProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: kpiCount }).map((_, i) => (
          <SkeletonKpiCard key={i} animate={animate} />
        ))}
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          <SkeletonCard 
            hasImage={false}
            hasHeader={true}
            contentLines={4}
            animate={animate}
          />
          <SkeletonCard 
            hasImage={false}
            hasHeader={true}
            contentLines={3}
            animate={animate}
          />
        </div>
        
        {/* Right Column */}
        <div className="lg:col-span-4">
          <SkeletonList 
            items={listItems}
            hasIcon={true}
            hasMeta={true}
            animate={animate}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON HERO
// ============================================================================

interface SkeletonHeroProps {
  className?: string;
  hasImage?: boolean;
  animate?: boolean;
}

export function SkeletonHero({ 
  className, 
  hasImage = true,
  animate = true 
}: SkeletonHeroProps) {
  return (
    <div className={cn(
      'flex flex-col lg:flex-row items-center gap-8 lg:gap-12',
      className
    )}>
      <div className={cn(
        'flex flex-col gap-4',
        hasImage ? 'lg:w-1/2' : 'w-full'
      )}>
        <Skeleton className="h-10 w-3/4 sm:w-2/3" animate={animate} />
        <SkeletonText lines={2} lineHeight={20} animate={animate} />
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Skeleton className="w-32 h-10" animate={animate} />
          <Skeleton className="w-32 h-10" animate={animate} />
        </div>
      </div>
      
      {hasImage && (
        <div className="lg:w-1/2 order-first lg:order-last w-full">
          <Skeleton 
            className="w-full aspect-video rounded-xl" 
            animate={animate} 
          />
        </div>
      )}
    </div>
  );
}
