'use client';

import { useState } from 'react';
import { 
  AnimatedCard, 
  AnimatedButton, 
  AnimatedProgressBar, 
  StatusIndicator,
  IconButton,
  Tooltip,
  FOCUS_RING
} from '../components/motion';
import { ThemeToggle, ThemeSelector } from '../components/theme-toggle';
import { 
  Skeleton, 
  SkeletonKpiCard, 
  SkeletonCard
} from '../components/skeleton';
import { 
  ResponsiveGrid, 
  ResponsiveStack,
  useIsMobile
} from '../components/responsive-helpers';
import { 
  ErrorMessage, 
  FormLabel, 
  KeyboardShortcut,
} from '../components/accessibility';
import { 
  Bell, 
  Settings,
  TrendingUp,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// DEMO: Theme Toggle Section
// ============================================================================

function ThemeDemo() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">
        Theme System
      </h2>
      
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <AnimatedCard className="p-6 flex-1">
          <h3 className="text-lg font-semibold mb-4">
            Compact Toggle
          </h3>
          <div className="flex items-center gap-4">
            <ThemeToggle variant="compact" />
            <span className="text-sm text-slate-500">
              Click to toggle light/dark
            </span>
          </div>
        </AnimatedCard>
        
        <AnimatedCard className="p-6 flex-1">
          <h3 className="text-lg font-semibold mb-4">
            Theme Selector
          </h3>
          <ThemeSelector />
        </AnimatedCard>
      </div>
    </section>
  );
}

// ============================================================================
// DEMO: Micro-interactions Section
// ============================================================================

function MicroInteractionsDemo() {
  const [progress, setProgress] = useState(65);
  
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">
        Micro-interactions
      </h2>
      
      <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }} gap="md">
        {/* Card Hover Demo */}
        <AnimatedCard className="p-6" lift="lg">
          <h3 className="text-lg font-semibold mb-3">
            Card Hover Effects
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            Hover over these cards to see the lift and shadow effects.
          </p>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-400">Smooth 200ms ease-out</span>
          </div>
        </AnimatedCard>
        
        {/* Button Interactions */}
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            Button States
          </h3>
          
          <ResponsiveStack direction="row" gap="sm" className="flex-wrap">
            <AnimatedButton variant="primary">Primary</AnimatedButton>
            <AnimatedButton variant="secondary">Secondary</AnimatedButton>
            <AnimatedButton variant="ghost">Ghost</AnimatedButton>
          </ResponsiveStack>
        </AnimatedCard>
        
        {/* Icon Buttons */}
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            Icon Buttons
          </h3>
          
          <div className="flex items-center gap-2">
            <IconButton icon={<Bell />} ariaLabel="Notifications" badge={5} />
            <IconButton icon={<Settings />} ariaLabel="Settings" />
            <Tooltip content="Hover me!" position="top">
              <IconButton icon={<Info />} ariaLabel="Info" />
            </Tooltip>
          </div>
        </AnimatedCard>
        
        {/* Progress Bars */}
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            Animated Progress Bars
          </h3>
          
          <div className="space-y-4">
            <AnimatedProgressBar progress={25} showLabel color="red" />
            <AnimatedProgressBar progress={progress} showLabel />
            <AnimatedProgressBar progress={85} showLabel color="green" />
          </div>
          
          <div className="flex items-center gap-2">
            <AnimatedButton 
              variant="secondary" 
              size="sm"
              onClick={() => setProgress(Math.random() * 100)}
            >
              Randomize
            </AnimatedButton>
          </div>
        </AnimatedCard>
        
        {/* Status Indicators */}
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">
            Status Indicators
          </h3>
          
          <div className="space-y-3">
            <StatusIndicator status="success" label="All systems operational" />
            <StatusIndicator status="warning" label="Warning: High CPU usage" pulse={false} />
            <StatusIndicator status="error" label="Connection lost" />
            <StatusIndicator status="info" label="Update available" size="sm" />
          </div>
        </AnimatedCard>
      </ResponsiveGrid>
    </section>
  );
}

// ============================================================================
// DEMO: Skeleton Loading States
// ============================================================================

function SkeletonDemo() {
  const [loading, setLoading] = useState(true);
  
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">
        Skeleton Loading States
      </h2>
      
      <div className="flex items-center gap-4 mb-6">
        <AnimatedButton 
          variant="secondary"
          onClick={() => setLoading(!loading)}
        >
          {loading ? 'Show Content' : 'Show Skeletons'}
        </AnimatedButton>
        <span className="text-sm text-slate-500">
          Toggle to see skeleton states
        </span>
      </div>
      
      <ResponsiveGrid cols={{ default: 1, md: 2 }} gap="md">
        {loading ? (
          <>
            <SkeletonKpiCard />
            <SkeletonKpiCard />
            <SkeletonCard hasHeader contentLines={4} />
            <SkeletonCard hasHeader contentLines={3} />
          </>
        ) : (
          <>
            <AnimatedCard className="p-5">
              <p className="text-sm text-slate-400 mb-2">Revenue</p>
              <p className="text-3xl font-bold">$124.5K</p>
              <p className="text-xs text-emerald-500"><TrendingUp className="inline h-3 w-3 mr-1" />+12.5%</p>
            </AnimatedCard>
            <AnimatedCard className="p-5">
              <p className="text-sm text-slate-400 mb-2">Users</p>
              <p className="text-3xl font-bold">8,492</p>
              <p className="text-xs text-emerald-500"><TrendingUp className="inline h-3 w-3 mr-1" />+8.2%</p>
            </AnimatedCard>
            
            <AnimatedCard className="p-6">
              <h3 className="font-semibold">Card Content</h3>
              <p className="text-slate-500 mt-2">This content was loaded successfully!</p>
            </AnimatedCard>
            
            <AnimatedCard className="p-6">
              <h3 className="font-semibold">Another Card</h3>
              <p className="text-slate-500 mt-2">Smooth loading experience with no layout shift.</p>
            </AnimatedCard>
          </>
        )}
      </ResponsiveGrid>
    </section>
  );
}

// ============================================================================
// DEMO: Responsive Helpers
// ============================================================================

function ResponsiveDemo() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">
        Responsive Design
      </h2>
      
      <ResponsiveGrid cols={{ default: 1, md: 3 }} gap="md">
        <AnimatedCard className="p-6">
          <h3 className="font-semibold mb-2">Mobile First</h3>
          <p className="text-sm text-slate-500">Stacks vertically on mobile, side-by-side on desktop.</p>
          <div className="mt-4 flex gap-2">
            <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">sm: 640px</span>
            <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">md: 768px</span>
            <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">lg: 1024px</span>
          </div>
        </AnimatedCard>
        
        <AnimatedCard className="p-6">
          <h3 className="font-semibold mb-2">Touch Targets</h3>
          <p className="text-sm text-slate-500">Minimum 44px touch targets for accessibility.</p>
          <div className="mt-4">
            <AnimatedButton size="sm">44px min height</AnimatedButton>
          </div>
        </AnimatedCard>
        
        <AnimatedCard className="p-6">
          <h3 className="font-semibold mb-2">Responsive Text</h3>
          <p className="text-slate-500 text-base sm:text-lg lg:text-xl">
            This text scales based on screen width.
          </p>
        </AnimatedCard>
      </ResponsiveGrid>
    </section>
  );
}

// ============================================================================
// DEMO: Accessibility Features
// ============================================================================

function AccessibilityDemo() {
  const [error, setError] = useState(false);
  
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">
        Accessibility
      </h2>
      
      <ResponsiveGrid cols={{ default: 1, md: 2 }} gap="md">
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="font-semibold">Focus Rings</h3>
          
          <p className="text-sm text-slate-500">
            All interactive elements have visible 2px focus rings with high contrast offset.
          </p>
          
          <div className="flex flex-wrap gap-2">
            <button className={cn("px-4 py-2 rounded-lg bg-blue-600 text-white", FOCUS_RING)}>
              Tab to me
            </button>
            <button className={cn("px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700", FOCUS_RING)}>
              Then me
            </button>
          </div>
        </AnimatedCard>
        
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="font-semibold">ARIA Labels</h3>
          
          <p className="text-sm text-slate-500">All buttons have proper ARIA labels for screen readers.</p>
          
          <div className="flex items-center gap-2">
            <IconButton 
              icon={<Bell />} 
              ariaLabel="View 5 unread notifications" 
              badge={5}
            />
            <span className="text-sm text-slate-400">
              Announces: &ldquo;View 5 unread notifications&rdquo;
            </span>
          </div>
        </AnimatedCard>
        
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="font-semibold">Error Messages</h3>
          
          <div className="space-y-2">
            <AnimatedButton 
              variant={error ? "danger" : "secondary"} 
              size="sm"
              onClick={() => setError(!error)}
            >
              {error ? 'Clear Error' : 'Show Error'}
            </AnimatedButton>
            
            {error && (
              <ErrorMessage>
                This is an error message with proper role=&quot;alert&quot;
              </ErrorMessage>
            )}
          </div>
        </AnimatedCard>
        
        <AnimatedCard className="p-6 space-y-4">
          <h3 className="font-semibold">Keyboard Shortcuts</h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Toggle theme</span>
              <KeyboardShortcut keys={['Ctrl', 'Shift', 'L']} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Command palette</span>
              <KeyboardShortcut keys={['⌘', 'K']} />
            </div>
          </div>
        </AnimatedCard>
      </ResponsiveGrid>
    </section>
  );
}

// ============================================================================
// MAIN DEMO PAGE
// ============================================================================

export default function PolishDemoPage() {
  return (
    <main 
      className="min-h-screen py-12 bg-slate-50 dark:bg-slate-900 transition-colors duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
                AdZeta Polish System
              </h1>
              <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
                Dark mode, micro-interactions, responsive design, and accessibility
              </p>
            </div>
            <ThemeToggle variant="default" showLabel />
          </div>
        </header>
        
        {/* Demo Sections */}
        <div className="space-y-16">
          <ThemeDemo />
          
          <div className="border-t border-slate-200 dark:border-slate-700" />
          
          <MicroInteractionsDemo />
          
          <div className="border-t border-slate-200 dark:border-slate-700" />
          
          <SkeletonDemo />
          
          <div className="border-t border-slate-200 dark:border-slate-700" />
          
          <ResponsiveDemo />
          
          <div className="border-t border-slate-200 dark:border-slate-700" />
          
          <AccessibilityDemo />
        </div>
        
        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-200 dark:border-slate-700">
          <p className="text-center text-sm text-slate-500">
            AdZeta — Built with polished interactions and accessibility in mind
          </p>
        </footer>
      </div>
    </main>
  );
}
