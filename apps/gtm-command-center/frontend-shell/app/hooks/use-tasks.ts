'use client';

import { useDataFetch } from './use-data-fetch';

export interface OperatorTask {
  id: string | number;
  title: string;
  status: string;
  priority: number | null;
  owner: string | null;
  due_date: string | null;
  completed_at?: string | null;
  created_at: string;
  progress?: number;
}

export interface OperatorStatus {
  tasks: {
    recent?: OperatorTask[];
    all?: OperatorTask[];
    highPriority?: OperatorTask[];
    blocked?: OperatorTask[];
  };
  workQueue?: {
    openPriorities: number;
  };
  kpis?: {
    kpis: {
      cards: { key: string; label: string; value: number | string; }[];
    };
  };
  timestamp: string;
}

interface ApiOperatorResponse {
  tasks?: {
    recent?: OperatorTask[];
    all?: OperatorTask[];
    highPriority?: OperatorTask[];
    blocked?: OperatorTask[];
  };
  workQueue?: {
    openPriorities: number;
  };
  kpis?: {
    kpis: {
      cards: { key: string; label: string; value: number | string; }[];
    };
  };
  timestamp?: string;
}

export function useTasks(refreshInterval = 30000) {
  return useDataFetch<ApiOperatorResponse>('/operator-status', {
    refreshInterval,
    retryCount: 2,
    staleWhileRevalidate: true,
    initialData: null,
  });
}

export function sortTasksByPriority(tasks: OperatorTask[] = []): OperatorTask[] {
  return [...tasks].sort((a, b) => {
    // First by priority (nulls last)
    if (a.priority !== null && b.priority === null) return -1;
    if (a.priority === null && b.priority !== null) return 1;
    if (a.priority !== null && b.priority !== null) {
      const priorityDiff = a.priority - b.priority;
      if (priorityDiff !== 0) return priorityDiff;
    }
    // Then by creation date
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function getTaskStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'completed') return 'bg-emerald-500';
  if (s === 'in_progress' || s === 'running') return 'bg-amber-500';
  if (s === 'blocked' || s === 'cancelled') return 'bg-red-500';
  return 'bg-slate-400';
}

export function getTaskStatusColorClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'completed') return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900';
  if (s === 'in_progress' || s === 'running') return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900';
  if (s === 'blocked' || s === 'cancelled') return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900';
  if (s === 'todo') return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900';
  return 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700';
}

export function getTaskProgress(task: OperatorTask): number {
  if (task.progress !== undefined) return task.progress;
  const s = task.status.toLowerCase();
  if (s === 'done' || s === 'completed') return 100;
  if (s === 'in_progress' || s === 'running') return 50;
  return 0;
}

export function formatTaskPriority(priority: number | null): string {
  if (priority === null) return 'No priority';
  if (priority <= 5) return 'Critical';
  if (priority <= 10) return 'High';
  if (priority <= 20) return 'Medium';
  return 'Low';
}

export function getPriorityColorClass(priority: number | null): string {
  if (priority === null) return 'bg-slate-400';
  if (priority <= 5) return 'bg-rose-500';
  if (priority <= 10) return 'bg-orange-500';
  if (priority <= 20) return 'bg-blue-500';
  return 'bg-slate-400';
}
