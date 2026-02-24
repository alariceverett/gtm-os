'use client';

import { cn } from '@/lib/utils';
import { ReactNode, useState, useEffect } from 'react';

// ============================================================================
// BREAKPOINT CONSTANTS
// ============================================================================

export const BREAKPOINTS = {
  sm: 640,   // Mobile landscape
  md: 768,   // Tablet
  lg: 1024,  // Desktop
  xl: 1280,  // Large desktop
  '2xl': 1536, // XLarge
};

// ============================================================================
// HOOK: useBreakpoint
// ============================================================================

export function useBreakpoint(breakpoint: keyof typeof BREAKPOINTS) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
    setMatches(query.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, [breakpoint]);

  return matches;
}

// ============================================================================
// HOOK: useMediaQuery
// ============================================================================

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// ============================================================================
// HOOK: useReducedMotion
// ============================================================================

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// ============================================================================
// HOOK: useIsMobile
// ============================================================================

export function useIsMobile(): boolean {
  return !useBreakpoint('md');
}

// ============================================================================
// HOOK: useIsTablet
// ============================================================================

export function useIsTablet(): boolean {
  const isMd = useBreakpoint('md');
  const isLg = useBreakpoint('lg');
  return isMd && !isLg;
}

// ============================================================================
// HOOK: useIsDesktop
// ============================================================================

export function useIsDesktop(): boolean {
  return useBreakpoint('lg');
}

// ============================================================================
// RESPONSIVE CONTAINER
// ============================================================================

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function ResponsiveContainer({ 
  children, 
  className, 
  size = 'lg',
  padding = 'md' 
}: ResponsiveContainerProps) {
  const sizeClasses = {
    sm: 'max-w-3xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-none',
  };

  const paddingClasses = {
    none: 'px-0',
    sm: 'px-3 sm:px-4',
    md: 'px-4 sm:px-6 lg:px-8',
    lg: 'px-4 sm:px-6 lg:px-8 xl:px-12',
  };

  return (
    <div className={cn(
      'mx-auto w-full',
      sizeClasses[size],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================================
// RESPONSIVE GRID
// ============================================================================

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export function ResponsiveGrid({ 
  children, 
  className,
  cols = { default: 1, md: 2, lg: 3 },
  gap = 'md'
}: ResponsiveGridProps) {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-3',
    md: 'gap-4 md:gap-6',
    lg: 'gap-6 md:gap-8',
    xl: 'gap-8 md:gap-10',
  };

  const getColClasses = () => {
    const classes: string[] = ['grid'];
    if (cols.default) classes.push(`grid-cols-${cols.default}`);
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    return classes.join(' ');
  };

  return (
    <div className={cn(getColClasses(), gapClasses[gap], className)}>
      {children}
    </div>
  );
}

// ============================================================================
// RESPONSIVE STACK (Vertical on mobile, horizontal on desktop)
// ============================================================================

interface ResponsiveStackProps {
  children: ReactNode;
  className?: string;
  direction?: 'row' | 'column';
  breakpoint?: 'sm' | 'md' | 'lg';
  gap?: 'none' | 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}

export function ResponsiveStack({
  children,
  className,
  direction = 'column',
  breakpoint = 'md',
  gap = 'md',
  align = 'stretch',
  justify = 'start',
}: ResponsiveStackProps) {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  };

  const getDirectionClasses = () => {
    if (direction === 'row') {
      return `flex flex-col ${breakpoint}:flex-row`;
    }
    return 'flex flex-col';
  };

  return (
    <div className={cn(
      getDirectionClasses(),
      gapClasses[gap],
      alignClasses[align],
      justifyClasses[justify],
      className
    )}>
      {children}
    </div>
  );
}

// ============================================================================
// HIDE/SHOW BASED ON BREAKPOINT
// ============================================================================

interface HideProps {
  children: ReactNode;
  className?: string;
  below?: 'sm' | 'md' | 'lg' | 'xl';
  above?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Hide({ children, className, below, above }: HideProps) {
  let hideClasses = '';
  
  if (below) {
    hideClasses += `${below}:hidden `;
  }
  if (above) {
    const breakpointMap = {
      sm: '',
      md: 'sm:hidden',
      lg: 'md:hidden',
      xl: 'lg:hidden',
    };
    hideClasses += breakpointMap[above];
  }

  return <div className={cn(hideClasses, className)}>{children}</div>;
}

interface ShowProps {
  children: ReactNode;
  className?: string;
  above: 'sm' | 'md' | 'lg' | 'xl';
}

export function Show({ children, className, above }: ShowProps) {
  return (
    <div className={cn(`hidden ${above}:block`, className)}>
      {children}
    </div>
  );
}

// ============================================================================
// TOUCH TARGET (Minimum 44px)
// ============================================================================

interface TouchTargetProps {
  children: ReactNode;
  className?: string;
  minSize?: number;
}

export function TouchTarget({ children, className, minSize = 44 }: TouchTargetProps) {
  return (
    <div 
      className={cn('inline-flex items-center justify-center', className)}
      style={{ minWidth: minSize, minHeight: minSize }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// MOBILE-FIRST HERO LAYOUT
// ============================================================================

interface HeroLayoutProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  visual?: ReactNode;
  className?: string;
  align?: 'left' | 'center';
}

export function HeroLayout({ 
  title, 
  subtitle, 
  actions, 
  visual,
  className,
  align = 'left'
}: HeroLayoutProps) {
  return (
    <div className={cn(
      'flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12',
      align === 'center' && 'text-center lg:text-left',
      className
    )}>
      <div className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'items-center lg:items-start',
        visual ? 'lg:w-1/2' : 'w-full'
      )}>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl">
            {subtitle}
          </p>
        )}
        {actions && (
          <div className={cn(
            'flex flex-col sm:flex-row gap-3 mt-2',
            align === 'center' && 'items-center lg:items-start'
          )}>
            {actions}
          </div>
        )}
      </div>
      {visual && (
        <div className="lg:w-1/2 order-first lg:order-last">
          {visual}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SAFARI BOTTOM BAR COMPENSATION
// ============================================================================

interface SafeAreaProps {
  children: ReactNode;
  className?: string;
  position?: 'top' | 'bottom';
}

export function SafeArea({ children, className, position = 'bottom' }: SafeAreaProps) {
  return (
    <div 
      className={cn(
        position === 'bottom' && 'pb-[env(safe-area-inset-bottom)]',
        position === 'top' && 'pt-[env(safe-area-inset-top)]',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// TEXT TRUNCATION WITH TOOLTIP
// ============================================================================

interface TruncateTextProps {
  children: string;
  className?: string;
  lines?: 1 | 2 | 3;
  as?: 'p' | 'span' | 'div';
}

export function TruncateText({ 
  children, 
  className, 
  lines = 1,
  as: Component = 'span'
}: TruncateTextProps) {
  const lineClasses = {
    1: 'line-clamp-1',
    2: 'line-clamp-2',
    3: 'line-clamp-3',
  };

  return (
    <Component 
      className={cn(lineClasses[lines], className)}
      title={children}
    >
      {children}
    </Component>
  );
}

// ============================================================================
// MOBILE SHEET (Slide up panel for mobile)
// ============================================================================

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}

export function MobileSheet({ isOpen, onClose, children, className, title }: MobileSheetProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => {
        setIsAnimating(false);
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div 
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-2xl',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-y-0' : 'translate-y-full',
          'max-h-[85vh] overflow-y-auto',
          className
        )}
      >
        {/* Handle */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 pt-3 pb-2 px-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3" />
          {title && (
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
          )}
        </div>
        
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VIEWPORT DETECTION FOR iPHONE SE
// ============================================================================

export function useIsSmallMobile(): boolean {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsSmall(window.innerWidth <= 375);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isSmall;
}

// ============================================================================
// RESPONSIVE FONT SIZES
// ============================================================================

export const responsiveText = {
  xs: 'text-xs sm:text-sm',
  sm: 'text-sm sm:text-base',
  base: 'text-base sm:text-lg',
  lg: 'text-lg sm:text-xl lg:text-2xl',
  xl: 'text-xl sm:text-2xl lg:text-3xl',
  '2xl': 'text-2xl sm:text-3xl lg:text-4xl',
  '3xl': 'text-3xl sm:text-4xl lg:text-5xl',
  '4xl': 'text-4xl sm:text-5xl lg:text-6xl',
};
