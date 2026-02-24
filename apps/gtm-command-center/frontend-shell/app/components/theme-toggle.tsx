'use client';

import { useTheme } from './theme-provider';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'default' | 'compact';
}

export function ThemeToggle({ 
  className, 
  showLabel = false,
  variant = 'default' 
}: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className={cn(
          'relative p-2 rounded-lg',
          'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          'hover:bg-slate-100 dark:hover:bg-slate-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
          'transition-all duration-200 ease-out',
          'active:scale-95',
          className
        )}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Sun className={cn(
          'h-5 w-5 transition-all duration-300 ease-out',
          isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
        )} />
        <Moon className={cn(
          'h-5 w-5 absolute top-2 left-2 transition-all duration-300 ease-out',
          isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
        )} />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'group relative flex items-center gap-2 px-3 py-2 rounded-lg',
        'bg-slate-100 dark:bg-slate-800',
        'hover:bg-slate-200 dark:hover:bg-slate-700',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'transition-all duration-200 ease-out',
        'active:scale-[0.98]',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative h-5 w-5">
        <Sun className={cn(
          'h-5 w-5 absolute transition-all duration-300 ease-out',
          isDark ? 'opacity-0 rotate-90 scale-0 text-slate-400' : 'opacity-100 rotate-0 scale-100 text-amber-500'
        )} />
        <Moon className={cn(
          'h-5 w-5 absolute transition-all duration-300 ease-out',
          isDark ? 'opacity-100 rotate-0 scale-100 text-indigo-400' : 'opacity-0 -rotate-90 scale-0 text-slate-400'
        )} />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}

type Theme = 'light' | 'dark' | 'system';

export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="h-4 w-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="h-4 w-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="h-4 w-4" />, label: 'System' },
  ];

  return (
    <div className={cn('flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
            'transition-all duration-200 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
            'active:scale-95',
            theme === option.value
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          )}
          aria-label={`Set theme to ${option.label}`}
          aria-pressed={theme === option.value}
        >
          {option.icon}
          <span className="hidden sm:inline">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
