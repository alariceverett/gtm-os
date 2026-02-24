import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | string | undefined): string {
  if (num === undefined || num === null) return '—';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

export function formatPercentage(num: number | string | undefined): string {
  if (num === undefined || num === null) return '—';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`;
}

export function formatCurrency(num: number | string | undefined): string {
  if (num === undefined || num === null) return '—';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export function getDueDateColor(dueDate: string | Date | null): string {
  if (!dueDate) return 'text-slate-400';
  const d = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'text-red-500';
  if (diffDays <= 3) return 'text-amber-500';
  return 'text-emerald-500';
}
