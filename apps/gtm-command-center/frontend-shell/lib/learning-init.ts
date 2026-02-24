/**
 * Learning System Initialization
 * 
 * Starts the learning scheduler on app load.
 * Call this in your app's entry point (layout.tsx or page.tsx).
 * 
 * Usage:
 * ```tsx
 * // In layout.tsx or page.tsx
 * import { initLearningSystem } from '@/lib/learning-init';
 * 
 * export default function RootLayout({ children }) {
 *   useEffect(() => {
 *     initLearningSystem();
 *   }, []);
 *   
 *   return ...
 * }
 * ```
 */

import { startLearningScheduler, stopLearningScheduler } from './learning-scheduler';

// Track if initialized
let isInitialized = false;

/**
 * Initialize the learning system
 */
export function initLearningSystem(options: {
  /** Auto-start the scheduler (default: true) */
  autoStart?: boolean;
  /** Run interval in minutes (default: 5) */
  intervalMinutes?: number;
  /** Callback when learning completes */
  onLearningComplete?: (result: any) => void;
  /** Callback when UI refresh recommended */
  onUIRefreshRecommended?: (userIds: string[]) => void;
} = {}): void {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  
  const { 
    autoStart = true,
    intervalMinutes = 5,
    onLearningComplete,
    onUIRefreshRecommended,
  } = options;
  
  if (autoStart) {
    startLearningScheduler({
      intervalMs: intervalMinutes * 60 * 1000,
      enableLogging: process.env.NODE_ENV === 'development',
      onLearningComplete: (result) => {
        console.log('[Learning] Pipeline completed:', {
          users: result.processed,
          signals: result.results.reduce((sum, r) => sum + r.signalsProcessed, 0),
        });
        
        onLearningComplete?.(result);
      },
      onUIRefreshRecommended: (userIds) => {
        console.log('[Learning] UI refresh recommended for users:', userIds);
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('ui-refresh-recommended', {
          detail: { userIds },
        }));
        
        onUIRefreshRecommended?.(userIds);
      },
    });
    
    isInitialized = true;
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      stopLearningScheduler();
    });
  }
}

/**
 * Shutdown the learning system
 */
export function shutdownLearningSystem(): void {
  stopLearningScheduler();
  isInitialized = false;
}

/**
 * Check if learning system is initialized
 */
export function isLearningInitialized(): boolean {
  return isInitialized;
}

/**
 * React hook for learning initialization
 * 
 * Usage:
 * ```tsx
 * function MyApp() {
 *   useLearningInit({ autoStart: true });
 *   return ...
 * }
 * ```
 */
export function useLearningInit(options: Parameters<typeof initLearningSystem>[0] = {}): void {
  // Will be imported from React in the actual file
  const { useEffect } = require('react');
  
  useEffect(() => {
    initLearningSystem(options);
    
    return () => {
      // Don't stop on unmount - we want learning to continue
    };
  }, []);
}

export default {
  initLearningSystem,
  shutdownLearningSystem,
  isLearningInitialized,
  useLearningInit,
};
