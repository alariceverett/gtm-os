'use client';

import { useTasks, sortTasksByPriority, getTaskStatusColorClass, formatTaskPriority, getPriorityColorClass } from '@/app/hooks/use-tasks';
import { SkeletonObjectiveItem } from '@/app/components/skeleton-loader';
import { SectionErrorFallback } from '@/app/components/error-boundary';
import { formatLastUpdated } from '@/app/hooks/use-data-fetch';
import { cn } from '@/lib/utils';
import { RefreshCw, AlertTriangle, Clock, CheckCircle2, Circle, Loader2, Lock, ArrowRight } from 'lucide-react';
import { useState, useMemo } from 'react';

interface ObjectivesListProps {
  limit?: number;
}

export function ObjectivesList({ limit = 5 }: ObjectivesListProps) {
  const [filter, setFilter] = useState<'all' | 'high' | 'blocked' | 'done'>('all');
  
  const { 
    data, 
    isLoading, 
    isError, 
    error, 
    isStale, 
    lastUpdated, 
    refetch 
  } = useTasks(30000);

  const allTasks = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.all || [];
  }, [data]);

  const filteredTasks = useMemo(() => {
    let filtered = [...allTasks];
    
    if (filter === 'high') {
      filtered = filtered.filter(t => (t.priority || 999) <= 10);
    } else if (filter === 'blocked') {
      filtered = filtered.filter(t => 
        t.status?.toLowerCase() === 'blocked' || t.status?.toLowerCase() === 'cancelled'
      );
    } else if (filter === 'done') {
      filtered = filtered.filter(t => 
        t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'completed'
      );
    }
    
    // Sort by priority, then by creation date
    return sortTasksByPriority(filtered).slice(0, limit);
  }, [allTasks, filter, limit]);

  const stats = useMemo(() => ({
    total: allTasks.length,
    high: allTasks.filter(t => (t.priority || 999) <= 10).length,
    blocked: allTasks.filter(t => 
      t.status?.toLowerCase() === 'blocked' || t.status?.toLowerCase() === 'cancelled'
    ).length,
    done: allTasks.filter(t => 
      t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'completed'
    ).length,
  }), [allTasks]);

  const openPriorities = data?.workQueue?.openPriorities ?? 0;

  return (
    <section className="relative">
      {/* Header with filters and refresh */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Objectives</h2>
            {openPriorities > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-full">
                {openPriorities} open
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isStale && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            <button
              onClick={refetch}
              disabled={isLoading}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                isLoading && "animate-spin"
              )}
              aria-label="Refresh tasks"
            >
              <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>
        
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1">
          <FilterTab
            label="All"
            count={stats.total}
            isActive={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterTab
            label="High Priority"
            count={stats.high}
            isActive={filter === 'high'}
            onClick={() => setFilter('high')}
            color="warning"
          />
          <FilterTab
            label="Blocked"
            count={stats.blocked}
            isActive={filter === 'blocked'}
            onClick={() => setFilter('blocked')}
            color="danger"
          />
          <FilterTab
            label="Done"
            count={stats.done}
            isActive={filter === 'done'}
            onClick={() => setFilter('done')}
            color="success"
          />
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="mb-4">
          <SectionErrorFallback
            title="Failed to load objectives"
            message={error?.message || 'Unable to fetch latest tasks'}
            onRetry={refetch}
          />
        </div>
      )}

      {/* Tasks list */}
      <div className="space-y-2">
        {isLoading ? (
          // Loading skeletons
          <>
            <SkeletonObjectiveItem />
            <SkeletonObjectiveItem />
            <SkeletonObjectiveItem />
            <SkeletonObjectiveItem />
            <SkeletonObjectiveItem />
          </>
        ) : filteredTasks.length === 0 ? (
          // Empty state
          <div className="p-8 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === 'all' ? 'No objectives found' : `No ${filter} objectives`}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Create a new task to get started
            </p>
          </div>
        ) : (
          // Task items
          filteredTasks.map((task) => (
            <TaskItem 
              key={task.id} 
              task={task} 
            />
          ))
        )}
      </div>

      {/* Footer with last updated */}
      {lastUpdated && !isLoading && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Updated {formatLastUpdated(lastUpdated)}</span>
            {isStale && (
              <span className="text-amber-600 dark:text-amber-400"> (stale)</span>
            )}
          </div>
          <div className="text-slate-400">
            {filteredTasks.length} of {allTasks.length}
          </div>
        </div>
      )}
    </section>
  );
}

interface FilterTabProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color?: 'default' | 'warning' | 'danger' | 'success';
}

function FilterTab({ label, count, isActive, onClick, color = 'default' }: FilterTabProps) {
  const colorClasses = {
    default: isActive ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
    warning: isActive ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100' : 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950',
    danger: isActive ? 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100' : 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950',
    success: isActive ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100' : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
        colorClasses[color]
      )}
    >
      {label} <span className="ml-1 opacity-60">{count}</span>
    </button>
  );
}

interface TaskItemProps {
  task: {
    id: string | number;
    title: string;
    status: string;
    priority: number | null;
    owner: string | null;
    due_date: string | null;
  };
}

function TaskItem({ task }: TaskItemProps) {
  const status = task.status?.toLowerCase() || 'todo';
  const isDone = status === 'done' || status === 'completed';
  const isBlocked = status === 'blocked' || status === 'cancelled';
  const isInProgress = status === 'in_progress' || status === 'running';

  const StatusIcon = isDone ? CheckCircle2 : isBlocked ? Lock : isInProgress ? Loader2 : Circle;

  return (
    <div 
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border transition-all",
        "hover:shadow-sm cursor-pointer",
        getTaskStatusColorClass(status)
      )}
    >
      <div className="flex-shrink-0">
        <StatusIcon className={cn(
          "w-5 h-5",
          isInProgress && "animate-spin"
        )} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          isDone && "line-through opacity-60"
        )}>
          {task.title}
        </p>
        
        <div className="flex items-center gap-2 mt-1">
          {task.priority && (
            <span className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded",
              "bg-white/50 dark:bg-slate-800/50"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", getPriorityColorClass(task.priority))} />
              {formatTaskPriority(task.priority)}
            </span>
          )}
          
          {task.owner && (
            <span className="text-xs opacity-70">
              @{task.owner}
            </span>
          )}
          
          {task.due_date && (
            <span className={cn(
              "text-xs",
              new Date(task.due_date) < new Date() && !isDone ? "text-red-600 font-medium" : "opacity-70"
            )}>
              Due {new Date(task.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  );
}
