/**
 * AdZeta Polish System - Component Index
 * 
 * This module exports all polish components for easy importing:
 * 
 * ```tsx
 * import { 
 *   ThemeProvider, ThemeToggle, useTheme,
 *   AnimatedCard, AnimatedButton, AnimatedProgressBar, StatusIndicator,
 *   Skeleton, SkeletonCard, SkeletonKpiCard,
 *   ResponsiveContainer, ResponsiveGrid, useBreakpoint, useIsMobile,
 *   SkipLink, FocusTrap, useAnnouncement
 * } from '@/app/components';
 * ```
 */

// Theme System
export { ThemeProvider, useTheme } from './theme-provider';
export { ThemeToggle, ThemeSelector } from './theme-toggle';

// Micro-interactions
export {
  AnimatedCard,
  AnimatedButton,
  AnimatedProgressBar,
  StatusIndicator,
  StaggerContainer,
  StaggerItem,
  FadeIn,
  HoverReveal,
  IconButton,
  Tooltip,
  // Constants
  TRANSITION_DEFAULT,
  TRANSITION_SLOW,
  TRANSITION_FAST,
  HOVER_SCALE_SM,
  HOVER_SCALE_MD,
  HOVER_SCALE_LG,
  CARD_LIFT,
  CARD_LIFT_LG,
  ACTIVE_SCALE,
  FOCUS_RING,
} from './motion';

// Responsive Helpers
export {
  BREAKPOINTS,
  useBreakpoint,
  useMediaQuery,
  useReducedMotion,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveStack,
  Hide,
  Show,
  TouchTarget,
  HeroLayout,
  SafeArea,
  TruncateText,
  MobileSheet,
  useIsSmallMobile,
  responsiveText,
} from './responsive-helpers';

// Skeleton Loading States
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonKpiCard,
  SkeletonList,
  SkeletonTable,
  SkeletonDashboard,
  SkeletonHero,
} from './skeleton';

// API Integration Skeleton Loaders
export {
  SkeletonObjectiveItem,
  SkeletonIntelligenceItem,
  SkeletonHealthScore,
} from './skeleton-loader';

// Accessibility
export {
  SkipLink,
  VisuallyHidden,
  LiveRegion,
  AnnouncementProvider,
  useAnnouncement,
  FocusTrap,
  useFocusVisible,
  AccessibleButton,
  LoadingState,
  ErrorMessage,
  FormLabel,
  KeyboardShortcut,
  useFocusManagement,
  contrastText,
  generateAriaId,
  combineAriaLabelledBy,
} from './accessibility';

// Error Handling
export { ErrorBoundary, SectionErrorFallback, NetworkErrorFallback } from './error-boundary';
