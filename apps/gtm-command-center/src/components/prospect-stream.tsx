'use client';

/**
 * Prospect Stream
 * Card-based infinite scroll (not tables)
 * Swipeable on mobile
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Prospect, ProspectSignal } from '@/types';

interface ProspectStreamProps {
  prospects: Prospect[];
  onStartOutreach: (prospect: Prospect) => void;
  onViewSignals: (prospect: Prospect) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

interface ProspectCardProps {
  prospect: Prospect;
  onStartOutreach: () => void;
  onViewSignals: () => void;
}

const SIGNAL_ICONS: Record<ProspectSignal['type'], string> = {
  hiring: '📈',
  funding: '💰',
  growth: '📈',
  expansion: '🚀',
  tech_stack: '⚡',
  intent: '🎯',
  engagement: '👋',
  news: '📰',
};

const SIGNAL_COLORS: Record<ProspectSignal['strength'], string> = {
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const SIGNAL_COLOR_BG: Record<ProspectSignal['type'], string> = {
  hiring: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  funding: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  growth: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  expansion: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  tech_stack: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  intent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  engagement: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  news: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

function ProspectCard({ prospect, onStartOutreach, onViewSignals }: ProspectCardProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0.5, 1, 0.5]);
  const background = useTransform(
    x,
    [-200, 0, 200],
    ['rgba(239, 68, 68, 0.1)', 'rgba(0, 0, 0, 0)', 'rgba(34, 197, 94, 0.1)']
  );

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      onStartOutreach();
    }
  };

  const gradeColor = {
    'A+': 'bg-emerald-500 text-emerald-950',
    'A': 'bg-emerald-400 text-emerald-950', 
    'B+': 'bg-blue-500 text-blue-950',
    'B': 'bg-blue-400 text-blue-950',
    'C': 'bg-slate-400 text-slate-950',
    'D': 'bg-slate-500 text-slate-950',
  }[prospect.scoreGrade];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <motion.div
      style={{ x, opacity, background }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="relative cursor-grab active:cursor-grabbing"
    >
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-lg font-bold text-slate-300">
              {prospect.photoUrl ? (
                <img
                  src={prospect.photoUrl}
                  alt={prospect.name}
                  className="w-full h-full rounded-2xl object-cover opacity-90"
                />
              ) : (
                getInitials(prospect.name)
              )}
            </div>
            <div className={`
              absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-900
              ${gradeColor}
            `}>
              {prospect.scoreGrade}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-100 truncate">
                  {prospect.name}
                </h3>
                <p className="text-slate-400 text-sm">
                  {prospect.title}
                </p>
                <p className="text-indigo-400 text-sm font-medium">
                  @ {prospect.company}
                </p>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-200">
                  {prospect.score}
                </div>
                <div className="text-xs text-slate-500">
                  {prospect.confidence}% match
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
              {prospect.location && (
                <span className="flex items-center gap-1">
                  📍 {prospect.location}
                </span>
              )}
              {prospect.companySize && (
                <span className="flex items-center gap-1">
                  👥 {prospect.companySize}
                </span>
              )}
              {prospect.industry && (
                <span className="flex items-center gap-1">
                  🏢 {prospect.industry}
                </span>
              )}
            </div>
          </div>
        </div>

        {prospect.signals.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-slate-500 mb-2">Buying Signals</div>
            <div className="flex flex-wrap gap-2">
              {prospect.signals.map((signal) => (
                <motion.button
                  key={signal.type}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onViewSignals}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer
                    ${SIGNAL_COLORS[signal.strength]}
                  `}
                >
                  <span>{SIGNAL_ICONS[signal.type]}</span>
                  <span>{signal.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onStartOutreach}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-medium transition-colors"
          >
            <span>🎯</span>
            <span>Start Outreach</span>
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onViewSignals}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            📊 Details
          </motion.button>
        </div>

        <div className="sm:hidden mt-3 flex justify-between text-xs text-slate-600">
          <span>👈 Skip</span>
          <span>Swipe</span>
          <span>Outreach 👉</span>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
        <span className="text-4xl">🔍</span>
      </div>
      <h3 className="text-lg font-medium text-slate-300">No prospects yet</h3>
      <p className="text-slate-500 mt-1 max-w-sm">
        Try searching with natural language like "Find CMOs at fintechs in NYC"
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-1/3 bg-slate-800 rounded animate-pulse" />
              <div className="h-4 w-1/4 bg-slate-800 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProspectStream({
  prospects,
  onStartOutreach,
  onViewSignals,
  onLoadMore,
  hasMore,
  isLoading,
}: ProspectStreamProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target.isIntersecting && hasMore && !isLoading) {
        onLoadMore?.();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(handleObserver, {
      rootMargin: '100px',
    });
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [handleObserver]);

  if (isLoading && prospects.length === 0) {
    return <LoadingSkeleton />;
  }

  if (!isLoading && prospects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {prospects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            onStartOutreach={() => onStartOutreach(prospect)}
            onViewSignals={() => onViewSignals(prospect)}
          />
        ))}
      </AnimatePresence>
      
      {(hasMore || isLoading) && (
        <div ref={loadMoreRef} className="py-8 flex justify-center">
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          ) : (
            <span className="text-sm text-slate-500">Scroll for more</span>
          )}
        </div>
      )}
    </div>
  );
}
