'use client';

import { cn } from '@/lib/utils';
import { ReactNode, useEffect, useRef, useState, createContext, useContext } from 'react';

// ============================================================================
// SKIP LINK COMPONENT
// ============================================================================

interface SkipLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only',
        'fixed top-4 left-4 z-[100]',
        'px-4 py-2 rounded-lg',
        'bg-blue-600 text-white font-medium',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-4',
        className
      )}
    >
      {children}
    </a>
  );
}

// ============================================================================
// VISUALLY HIDDEN (but accessible to screen readers)
// ============================================================================

interface VisuallyHiddenProps {
  children: ReactNode;
}

export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return (
    <span className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0">
      {children}
    </span>
  );
}

// ============================================================================
// LIVE REGION FOR ANNOUNCEMENTS
// ============================================================================

type LiveRegionType = 'polite' | 'assertive';
type LiveRegionMode = 'off' | 'polite' | 'assertive';

interface LiveRegionProps {
  id?: string;
  'aria-live'?: LiveRegionType;
  'aria-atomic'?: boolean;
  children?: ReactNode;
  className?: string;
}

export function LiveRegion({ 
  id, 
  'aria-live': ariaLive = 'polite',
  'aria-atomic': ariaAtomic = true,
  children,
  className 
}: LiveRegionProps) {
  return (
    <div
      id={id}
      aria-live={ariaLive}
      aria-atomic={ariaAtomic}
      className={cn(
        'sr-only',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// ANNOUNCEMENT CONTEXT
// ============================================================================

interface AnnouncementContextType {
  announce: (message: string, priority?: LiveRegionType) => void;
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

export function AnnouncementProvider({ children }: { children: ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = (message: string, priority: LiveRegionType = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage(message);
      // Clear after announcement
      setTimeout(() => setAssertiveMessage(''), 1000);
    } else {
      setPoliteMessage(message);
      setTimeout(() => setPoliteMessage(''), 1000);
    }
  };

  return (
    <AnnouncementContext.Provider value={{ announce }}>
      {children}
      <LiveRegion id="announcement-polite" aria-live="polite">
        {politeMessage}
      </LiveRegion>
      <LiveRegion id="announcement-assertive" aria-live="assertive">
        {assertiveMessage}
      </LiveRegion>
    </AnnouncementContext.Provider>
  );
}

export function useAnnouncement() {
  const context = useContext(AnnouncementContext);
  if (!context) {
    throw new Error('useAnnouncement must be used within AnnouncementProvider');
  }
  return context;
}

// ============================================================================
// FOCUS TRAP (for modals/drawers)
// ============================================================================

interface FocusTrapProps {
  children: ReactNode;
  isActive: boolean;
  onEscape?: () => void;
}

export function FocusTrap({ children, isActive, onEscape }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onEscape]);

  return <div ref={containerRef}>{children}</div>;
}

// ============================================================================
// FOCUS VISIBLE HELPER
// ============================================================================

export function useFocusVisible(): boolean {
  const [isKeyboard, setIsKeyboard] = useState(false);

  useEffect(() => {
    const handleKeyDown = () => setIsKeyboard(true);
    const handlePointerDown = () => setIsKeyboard(false);

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  return isKeyboard;
}

// ============================================================================
// ACCESSIBLE BUTTON
// ============================================================================

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-pressed'?: boolean | 'mixed';
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function AccessibleButton({
  children,
  className,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHasPopup,
  'aria-pressed': ariaPressed,
  variant = 'primary',
  ...props
}: AccessibleButtonProps) {
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      className={cn(
        'px-4 py-2 rounded-lg font-medium',
        'transition-colors duration-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        className
      )}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHasPopup}
      aria-pressed={ariaPressed}
      {...props}
    >
      {children}
    </button>
  );
}

// ============================================================================
// ACCESSIBLE LOADING STATE
// ============================================================================

interface LoadingStateProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
  spinner?: ReactNode;
  className?: string;
}

export function LoadingState({ 
  isLoading, 
  children, 
  loadingText = 'Loading...',
  spinner,
  className 
}: LoadingStateProps) {
  if (!isLoading) return <>{children}</>;

  return (
    <div 
      className={cn('flex items-center gap-2', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {spinner || (
        <svg 
          className="animate-spin h-5 w-5 text-slate-500" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      <span className="sr-only">{loadingText}</span>
      <span aria-hidden="true">{loadingText}</span>
    </div>
  );
}

// ============================================================================
// ERROR MESSAGE
// ============================================================================

interface ErrorMessageProps {
  id?: string;
  children: ReactNode;
  className?: string;
}

export function ErrorMessage({ id, children, className }: ErrorMessageProps) {
  return (
    <span
      id={id}
      role="alert"
      className={cn(
        'text-sm text-red-600 dark:text-red-400',
        className
      )}
    >
      {children}
    </span>
  );
}

// ============================================================================
// FORM LABEL WITH REQUIRED INDICATOR
// ============================================================================

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}

export function FormLabel({ 
  children, 
  required, 
  optional,
  className,
  ...props 
}: FormLabelProps) {
  return (
    <label
      className={cn(
        'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1',
        className
      )}
      {...props}
    >
      {children}
      {required && (
        <span className="text-red-500 ml-0.5" aria-label="required">*</span>
      )}
      {optional && !required && (
        <span className="text-slate-400 font-normal ml-1">(optional)</span>
      )}
    </label>
  );
}

// ============================================================================
// KEYBOARD SHORTCUT
// ============================================================================

interface KeyboardShortcutProps {
  keys: string[];
  className?: string;
}

export function KeyboardShortcut({ keys, className }: KeyboardShortcutProps) {
  return (
    <kbd className={cn(
      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
      'text-xs font-mono font-medium',
      'bg-slate-100 dark:bg-slate-800',
      'text-slate-600 dark:text-slate-400',
      'border border-slate-300 dark:border-slate-700',
      className
    )}>
      {keys.map((key, i) => (
        <span key={i}>
          {key}
          {i < keys.length - 1 && <span className="mx-0.5">+</span>}
        </span>
      ))}
    </kbd>
  );
}

// ============================================================================
// USE FOCUS MANAGEMENT
// ============================================================================

export function useFocusManagement() {
  const previousFocus = useRef<HTMLElement | null>(null);

  const saveFocus = () => {
    previousFocus.current = document.activeElement as HTMLElement;
  };

  const restoreFocus = () => {
    previousFocus.current?.focus();
  };

  return { saveFocus, restoreFocus };
}

// ============================================================================
// COLOR CONTRAST UTILITIES
// ============================================================================

// WCAG AA compliant text colors on various backgrounds
export const contrastText = {
  // On white backgrounds
  onWhite: {
    primary: 'text-slate-900',    // 21:1 contrast
    secondary: 'text-slate-600',  // 7:1 contrast
    muted: 'text-slate-500',      // 4.6:1 contrast (minimum for WCAG AA)
  },
  // On dark backgrounds
  onDark: {
    primary: 'text-white',        // 21:1 contrast
    secondary: 'text-slate-300',  // 11:1 contrast
    muted: 'text-slate-400',      // 7:1 contrast
  },
  // Links
  link: {
    blue: 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300',
  },
};

// ============================================================================
// ARIA HELPER FUNCTIONS
// ============================================================================

export function generateAriaId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

export function combineAriaLabelledBy(...ids: (string | undefined)[]): string | undefined {
  const validIds = ids.filter(Boolean);
  return validIds.length > 0 ? validIds.join(' ') : undefined;
}
