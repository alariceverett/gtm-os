'use client';

/**
 * Suggestion Carousel
 * Context-aware recommendations
 * Swipeable cards
 */

import { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Suggestion } from '@/types';

interface SuggestionsProps {
  suggestions: Suggestion[];
  onAction: (suggestion: Suggestion) => void;
  onDismiss?: (suggestionId: string) => void;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAction: () => void;
  onDismiss: () => void;
}

const TYPE_ICONS: Record<Suggestion['type'], string> = {
  campaign: '🚀',
  sequence: '📧',
  prospect: '⭐',
  optimization: '⚡',
  insight: '💡',
};

const PRIORITY_COLORS: Record<Suggestion['priority'], { border: string; gradient: string; badge: string }> = {
  high: {
    border: 'border-amber-500/50',
    gradient: 'from-amber-500/10 to-transparent',
    badge: 'bg-amber-500/20 text-amber-400',
  },
  medium: {
    border: 'border-blue-500/50',
    gradient: 'from-blue-500/10 to-transparent',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  low: {
    border: 'border-slate-500/50',
    gradient: 'from-slate-500/10 to-transparent',
    badge: 'bg-slate-500/20 text-slate-400',
  },
};

function SuggestionCard({ suggestion, onAction, onDismiss }: SuggestionCardProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.5, 1, 0.5]);
  const scale = useTransform(x, [-150, 0, 150], [0.9, 1, 0.9]);
  const rotate = useTransform(x, [-150, 0, 150], [-8, 0, 8]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      onAction();
    } else if (info.offset.x < -100) {
      onDismiss();
    }
  };

  const priorityColors = PRIORITY_COLORS[suggestion.priority];

  return (
    <motion.div
      style={{ x, opacity, scale, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      className="flex-shrink-0 w-[280px] sm:w-[320px] cursor-grab active:cursor-grabbing select-none"
    >
      <div className={`
        h-full p-4 rounded-2xl border ${priorityColors.border}
        bg-gradient-to-br ${priorityColors.gradient} bg-slate-900/90
        backdrop-blur-xl
      `}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{TYPE_ICONS[suggestion.type]}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors.badge}`}>
              {suggestion.priority.toUpperCase()}
            </span>
          </div>
          
          <button
            onClick={onDismiss}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <h3 className="mt-3 text-base font-semibold text-slate-100 line-clamp-2">
          {suggestion.title}
        </h3>

        <p className="mt-1 text-sm text-slate-400 line-clamp-3">
          {suggestion.description}
        </p>

        {suggestion.context && (
          <div className="mt-3 p-2 rounded-lg bg-slate-800/50 text-xs text-slate-500">
            {suggestion.context}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onAction}
            className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
          >
            {suggestion.actionLabel}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Suggestions({ suggestions, onAction, onDismiss }: SuggestionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">✨</span>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Smart Suggestions
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`p-1.5 rounded-lg transition-colors ${
              canScrollLeft
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-900 text-slate-600 cursor-not-allowed'
            }`}
          >
            ◀
          </button>
          
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`p-1.5 rounded-lg transition-colors ${
              canScrollRight
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-900 text-slate-600 cursor-not-allowed'
            }`}
          >
            ▶
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAction={() => onAction(suggestion)}
            onDismiss={() => onDismiss?.(suggestion.id)}
          />
        ))}
      </div>

      {canScrollLeft && (
        <div className="absolute left-0 top-8 bottom-2 w-8 bg-gradient-to-r from-slate-950 to-transparent pointer-events-none" />
      )}
      
      {canScrollRight && (
        <div className="absolute right-0 top-8 bottom-2 w-8 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none" />
      )}
    </motion.div>
  );
}
