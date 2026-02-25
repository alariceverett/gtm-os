'use client';

/**
 * Research Progress Cards
 * Live job progress visualization
 * Shows: "Found 47 prospects... enriching 23..."
 * Progress bar with milestones
 * Expand to see live results streaming in
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResearchJob, Prospect } from '@/types';

interface ResearchCardsProps {
  jobs: ResearchJob[];
  onJobClick?: (job: ResearchJob) => void;
  onDismissJob?: (jobId: string) => void;
}

interface ResearchCardProps {
  job: ResearchJob;
  onClick?: () => void;
  onDismiss?: () => void;
}

const STATUS_STEPS: Record<ResearchJob['status'], number> = {
  pending: 0,
  running: 1,
  enriching: 2,
  scoring: 3,
  completed: 4,
  error: -1,
};

const STATUS_LABELS: Record<ResearchJob['status'], string> = {
  pending: 'Starting...',
  running: 'Searching...',
  enriching: 'Enriching...',
  scoring: 'Scoring...',
  completed: 'Complete',
  error: 'Error',
};

const STATUS_ICONS: Record<ResearchJob['status'], string> = {
  pending: '⏳',
  running: '🔍',
  enriching: '✨',
  scoring: '📊',
  completed: '✅',
  error: '❌',
};

function ResearchCard({ job, onClick, onDismiss }: ResearchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const progress = job.progress;
  const target = progress.target || 50;
  const step = STATUS_STEPS[job.status];

  // Auto-expand when job completes
  useEffect(() => {
    if (job.status === 'completed' && progress.scored > 0) {
      setTimeout(() => setShowResults(true), 500);
    }
  }, [job.status, progress.scored]);

  const handleClick = () => {
    if (job.status === 'completed') {
      setIsExpanded(!isExpanded);
      onClick?.();
    }
  };

  const progressPercent = Math.min((progress.scored / target) * 100, 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`
        relative rounded-xl border overflow-hidden transition-colors
        ${job.status === 'error' ? 'border-red-500/50 bg-red-950/20' : 
          job.status === 'completed' ? 'border-emerald-500/30 bg-emerald-950/10' :
          'border-slate-700 bg-slate-900/50'}
        ${job.status === 'completed' ? 'cursor-pointer hover:border-emerald-500/50' : ''}
      `}
    >
      <div className="p-4" onClick={handleClick}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.span
              animate={job.status === 'running' ? { rotate: 360 } : {}}
              transition={job.status === 'running' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
              className="text-2xl"
            >
              {STATUS_ICONS[job.status]}
            </motion.span>
            
            <div>
              <div className="font-medium text-slate-200">
                {job.query.length > 50 ? job.query.slice(0, 50) + '...' : job.query}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className={`
                  ${job.status === 'error' ? 'text-red-400' :
                    job.status === 'completed' ? 'text-emerald-400' :
                    'text-indigo-400'}
                `}>
                  {STATUS_LABELS[job.status]}
                </span>
                
                {job.status !== 'error' && job.status !== 'completed' && (
                  <span className="text-slate-600">•</span>
                )}
                
                {job.status !== 'error' && job.status !== 'completed' && (
                  <span>
                    {progress.found} found
                    {progress.enriched > 0 && ` • ${progress.enriched} enriched`}
                    {progress.scored > 0 && ` • ${progress.scored} scored`}
                  </span>
                )}
                
                {job.status === 'completed' && (
                  <span className="text-emerald-400">{progress.scored} prospects ready</span>
                )}
              </div>
            </div>
          </div>

          {onDismiss && (job.status === 'completed' || job.status === 'error') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex gap-1 mb-3">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`
                  flex-1 h-1.5 rounded-full transition-all duration-500
                  ${idx <= step && step >= 0
                    ? job.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-indigo-500'
                    : 'bg-slate-800'
                  }
                `}
              />
            ))}
          </div>
          
          <div className="flex justify-between text-xs text-slate-500">
            <span>Search</span>
            <span>Found</span>
            <span>Enriched</span>
            <span>Scored</span>
          </div>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {job.error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 p-3 rounded-lg bg-red-950/50 border border-red-500/30 text-sm text-red-300"
            >
              {job.error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expandable results */}
      <AnimatePresence>
        {isExpanded && showResults && job.results.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-700 bg-slate-900/80"
          >
            <div className="p-4 max-h-64 overflow-y-auto">
              <div className="text-sm font-medium text-slate-300 mb-3">
                Live Results ({job.results.length} so far)
              </div>
              
              <div className="space-y-2">
                {job.results.slice(0, 10).map((prospect, idx) => (
                  <motion.div
                    key={prospect.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50"
                  >
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                      ${prospect.scoreGrade === 'A+' ? 'bg-emerald-500/20 text-emerald-400' :
                        prospect.scoreGrade === 'A' ? 'bg-emerald-500/10 text-emerald-300' :
                        prospect.scoreGrade === 'B+' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-slate-700 text-slate-400'}
                    `}>
                      {prospect.scoreGrade}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">
                        {prospect.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {prospect.title} @ {prospect.company}
                      </div>
                    </div>
                    
                    {prospect.signals.length > 0 && (
                      <div className="flex gap-1">
                        {prospect.signals.slice(0, 2).map((signal) => (
                          <span
                            key={signal.type}
                            className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300"
                          >
                            {signal.type === 'funding' ? '💰' : 
                             signal.type === 'hiring' ? '📈' : 
                             signal.type === 'growth' ? '🚀' : '🔥'}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
              
              {job.results.length > 10 && (
                <div className="mt-3 text-center text-sm text-slate-500">
                  +{job.results.length - 10} more prospects
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ResearchCards({ jobs, onJobClick, onDismissJob }: ResearchCardsProps) {
  if (jobs.length === 0) {
    return null;
  }

  // Sort: pending/running first, then by updatedAt
  const sortedJobs = [...jobs].sort((a, b) => {
    const aActive = a.status === 'pending' || a.status === 'running' || a.status === 'enriching' || a.status === 'scoring';
    const bActive = b.status === 'pending' || b.status === 'running' || b.status === 'enriching' || b.status === 'scoring';
    
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {sortedJobs.map((job) => (
          <ResearchCard
            key={job.id}
            job={job}
            onClick={() => onJobClick?.(job)}
            onDismiss={() => onDismissJob?.(job.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
