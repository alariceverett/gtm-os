'use client';

import { Suspense, useEffect } from 'react';
import { HeroStatus } from '@/app/components/hero-status';
import { ObjectivesList } from '@/app/components/objectives-list';
import { IntelligenceFeed } from '@/app/components/intelligence-feed';
import { SmartAlerts } from '@/components/smart-alerts';
import { ErrorBoundary, SectionErrorFallback } from '@/app/components/error-boundary';
import { VoiceFeedback } from '@/components/voice-feedback';
import { SkeletonKpiCard, SkeletonObjectiveItem, SkeletonIntelligenceItem } from '@/app/components/skeleton-loader';
import { useSimplePersonalization, CardType } from '@/hooks/use-simple-personalization';

// Card components map
const CARD_COMPONENTS: Record<CardType, React.ReactNode> = {
  kpi: (
    <ErrorBoundary fallback={<SectionErrorFallback title="KPI Dashboard Error" />}>
      <Suspense fallback={
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SkeletonKpiCard />
          <SkeletonKpiCard />
          <SkeletonKpiCard />
          <SkeletonKpiCard />
        </div>
      }>
        <HeroStatus />
      </Suspense>
    </ErrorBoundary>
  ),
  objectives: (
    <section
      className="rounded-2xl border p-6 lg:p-8 transition-all duration-200 ease-out hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-black/10"
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
      }}
    >
      <ErrorBoundary fallback={<SectionErrorFallback title="Objectives Error" />}>
        <Suspense fallback={
          <div className="space-y-3">
            <SkeletonObjectiveItem />
            <SkeletonObjectiveItem />
            <SkeletonObjectiveItem />
          </div>
        }>
          <ObjectivesList />
        </Suspense>
      </ErrorBoundary>
    </section>
  ),
  alerts: (
    <section
      className="rounded-2xl border p-6 transition-all duration-200 ease-out hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-black/10"
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
      }}
    >
      <ErrorBoundary fallback={<SectionErrorFallback title="Smart Alerts Error" />}>
        <Suspense fallback={
          <div className="space-y-3">
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
          </div>
        }>
          <SmartAlerts />
        </Suspense>
      </ErrorBoundary>
    </section>
  ),
  intelligence: (
    <section
      className="rounded-2xl border p-6 transition-all duration-200 ease-out hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-black/10"
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
      }}
    >
      <ErrorBoundary fallback={<SectionErrorFallback title="Intelligence Feed Error" />}>
        <Suspense fallback={
          <div className="space-y-3">
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
            <SkeletonIntelligenceItem />
          </div>
        }>
          <IntelligenceFeed />
        </Suspense>
      </ErrorBoundary>
    </section>
  ),
};

// Card configuration with metadata
const CARD_META: Record<CardType, { section: string; order: number }> = {
  kpi: { section: 'hero-status', order: 1 },
  objectives: { section: 'objectives', order: 2 },
  alerts: { section: 'smart-alerts', order: 3 },
  intelligence: { section: 'intelligence', order: 4 },
};

export default function Home() {
  // Fetch preferences on mount
  const { cardOrder, isLoading, recordFeedback } = useSimplePersonalization();

  // Record page view on mount
  useEffect(() => {
    recordFeedback('dwell', 'dashboard');
  }, [recordFeedback]);

  // Sort cards based on preference order
  const sortedCards = cardOrder || ['kpi', 'objectives', 'alerts', 'intelligence'];

  // Split into main content (kpi, objectives) and sidebar (alerts, intelligence)
  // based on card order - cards are either in main (8 cols) or sidebar (4 cols)
  const mainCards: CardType[] = [];
  const sidebarCards: CardType[] = [];

  sortedCards.forEach((card, index) => {
    // First 2 cards go to main, rest to sidebar
    if (index < 2) {
      mainCards.push(card);
    } else {
      sidebarCards.push(card);
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header - Premium sticky header with subtle blur */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-xl">
        <div
          className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 transition-colors duration-300"
          style={{ borderColor: 'var(--color-border)' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">GTM Command Center</h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {isLoading ? 'Loading preferences...' : 'Real-time operations dashboard'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection status indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Live</span>
              </div>

              <VoiceFeedback />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main content - 8 columns on large screens */}
          <div className="lg:col-span-8 space-y-8">
            {mainCards.map((cardType) => (
              <div 
                key={cardType}
                className={cardType === 'kpi' ? 'space-y-6' : ''}
                onMouseEnter={() => recordFeedback('dwell', CARD_META[cardType].section)}
              >
                {CARD_COMPONENTS[cardType]}
              </div>
            ))}
          </div>

          {/* Sidebar - 4 columns on large screens */}
          <div className="lg:col-span-4 space-y-8">
            {sidebarCards.map((cardType) => (
              <div 
                key={cardType}
                onMouseEnter={() => recordFeedback('dwell', CARD_META[cardType].section)}
              >
                {CARD_COMPONENTS[cardType]}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t mt-12"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <span>GTM Command Center v0.1.0</span>
              <span className="hidden sm:inline">•</span>
              <span>Auto-refresh: 30s</span>
            </div>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Documentation</a>
              <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
