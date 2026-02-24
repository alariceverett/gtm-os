'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  themePreferenceLearned: boolean;
}

// User preference tracking state
interface ThemePreferenceState {
  darkToggles: number;
  lightToggles: number;
  lastPreference: Theme | null;
  confidence: number;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'gtm-theme-preference';
const THEME_LEARNING_KEY = 'gtm-theme-learning';
const THEME_USER_ID_KEY = 'gtm_user_id';
const THEME_MAX_STORAGE_SIZE = 100; // Maximum number of toggle events to store

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Get user ID for preference tracking
function getUserId(): string {
  if (typeof window === 'undefined') return 'anonymous';
  let id = localStorage.getItem(THEME_USER_ID_KEY);
  if (!id) {
    id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(THEME_USER_ID_KEY, id);
  }
  return id;
}

// Load theme learning state
function loadThemeLearning(): ThemePreferenceState {
  if (typeof window === 'undefined') {
    return { darkToggles: 0, lightToggles: 0, lastPreference: null, confidence: 0 };
  }
  const stored = localStorage.getItem(THEME_LEARNING_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as ThemePreferenceState;
    } catch {
      return { darkToggles: 0, lightToggles: 0, lastPreference: null, confidence: 0 };
    }
  }
  return { darkToggles: 0, lightToggles: 0, lastPreference: null, confidence: 0 };
}

// Save theme learning state
function saveThemeLearning(state: ThemePreferenceState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_LEARNING_KEY, JSON.stringify(state));
}

// Update user preferences on backend
async function updateUserPreferences(userId: string, preferences: { dark_mode_preference: number }) {
  try {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delta: { dark_mode_preference: preferences.dark_mode_preference }
      }),
    });
    if (!response.ok) throw new Error('Failed to update preferences');
  } catch (error) {
    console.debug('[Theme Learning] Failed to sync preferences:', error);
  }
}

// Send feedback signal
async function sendThemeFeedback(signalType: 'explicit_positive' | 'explicit_negative' | 'implicit_dwell', context: Record<string, any>) {
  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signal_type: signalType,
        context,
        outcome: { theme_feedback: true },
      }),
    });
  } catch (error) {
    console.debug('[Theme Learning] Failed to send feedback:', error);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [themePreferenceLearned, setThemePreferenceLearned] = useState(false);
  const learningStateRef = useRef<ThemePreferenceState>({ darkToggles: 0, lightToggles: 0, lastPreference: null, confidence: 0 });

  // Initialize theme from localStorage and load learning state
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    }
    learningStateRef.current = loadThemeLearning();
  }, []);

  // Update resolved theme when theme changes
  useEffect(() => {
    if (!mounted) return;
    
    const newResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(newResolvedTheme);
    
    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newResolvedTheme);
    root.style.colorScheme = newResolvedTheme;
  }, [theme, mounted]);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted || theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const newTheme = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(newTheme);
      
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(newTheme);
      root.style.colorScheme = newTheme;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  // Analyze and learn from theme toggles
  const learnFromToggle = useCallback((newTheme: Theme) => {
    const current = learningStateRef.current;
    
    // Update toggle counts
    if (newTheme === 'dark') {
      current.darkToggles += 1;
    } else if (newTheme === 'light') {
      current.lightToggles += 1;
    }
    
    // Calculate confidence based on toggle patterns
    const totalToggles = current.darkToggles + current.lightToggles;
    const darkRatio = totalToggles > 0 ? current.darkToggles / totalToggles : 0.5;
    
    // If user consistently (80%+) toggles to same theme, we have confidence
    if (totalToggles >= THEME_MAX_STORAGE_SIZE) {
      if (darkRatio > 0.8 || darkRatio < 0.2) {
        current.confidence = Math.min(1, totalToggles / 50); // Cap confidence at 1
        setThemePreferenceLearned(true);
        
        // Sync learned preference to backend
        const userId = getUserId();
        updateUserPreferences(userId, { dark_mode_preference: darkRatio });
        
        // Send feedback signal for learning
        sendThemeFeedback('implicit_dwell', {
          page: 'global',
          section: 'theme-provider',
          theme_preference_learned: true,
          dark_ratio: darkRatio,
          confidence: current.confidence,
          total_toggles: totalToggles,
        });
        
        // Also log explicit feedback if it's a strong preference
        if (darkRatio > 0.9 || darkRatio < 0.1) {
          sendThemeFeedback('explicit_positive', {
            page: 'global',
            section: 'theme-toggle',
            theme: newTheme,
            reason: 'learned_preference',
          });
        }
      }
    }
    
    current.lastPreference = newTheme;
    learningStateRef.current = { ...current };
    saveThemeLearning(current);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    learnFromToggle(newTheme);
  }, [learnFromToggle]);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // Prevent flash by not rendering until mounted
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }}>
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme, themePreferenceLearned }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default values during SSR or when context is not available
    return {
      theme: 'system' as Theme,
      resolvedTheme: 'light' as const,
      setTheme: () => {},
      toggleTheme: () => {},
      themePreferenceLearned: false,
    };
  }
  return context;
}

export function useThemeLearning() {
  const { themePreferenceLearned } = useTheme() || { themePreferenceLearned: false };
  const [learningState, setLearningState] = useState<ThemePreferenceState | null>(null);

  useEffect(() => {
    setLearningState(loadThemeLearning());
  }, []);

  return {
    themePreferenceLearned,
    learningState,
    preferenceStrength: learningState
      ? Math.abs(learningState.darkToggles - learningState.lightToggles) /
        Math.max(1, learningState.darkToggles + learningState.lightToggles)
      : 0,
  };
}

export default ThemeProvider;
