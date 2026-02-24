/**
 * usePersonalization Hook (Legacy - Complex)
 * 
 * Fetches user's preference model and applies personalized UI config:
 * - Dashboard card order (reorder based on weights)
 * - Default time range (user's preference)
 * - Notification preferences
 * - Theme integration
 * 
 * Used by components to adapt UI based on learned preferences.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getUserModel, PreferenceModel, UIConfig } from '../lib/preference-engine';
import { getSupabaseClient } from '../lib/supabase-client';

// Default UI configuration
export const DEFAULT_UI_CONFIG: Required<UIConfig> = {
  dashboard_card_order: ['strategy', 'ops', 'targeting', 'research', 'comms'],
  default_time_range: '7d',
  notification_frequency: 'daily',
  notification_timing: { start: 9, end: 17, timezone: 'America/New_York' },
  kpi_priority: ['revenue', 'conversion', 'engagement', 'retention'],
  objective_visibility: {},
  theme_preference: 'system',
  content_density: 'comfortable',
  auto_refresh: true,
};

// Hook return type
export interface PersonalizationState {
  // Data
  model: PreferenceModel | null;
  uiConfig: Required<UIConfig>;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  updateConfig: (updates: Partial<UIConfig>) => Promise<void>;
  
  // Helpers
  getCardOrder: (defaultOrder?: string[]) => string[];
  getDefaultTimeRange: () => '7d' | '30d' | '90d' | 'custom';
  getNotificationFrequency: () => 'realtime' | 'hourly' | 'daily' | 'weekly';
  getKPIPriority: (kpis: string[]) => string[];
  shouldShowObjective: (objectiveId: string) => boolean;
}

// Local storage key for caching
const CACHE_KEY = 'personalization_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  model: PreferenceModel;
  timestamp: number;
}

/**
 * Get user ID from localStorage or generate anonymous ID
 */
function getUserId(): string {
  if (typeof window === 'undefined') return 'anonymous';
  
  let userId = localStorage.getItem('personalization_user_id');
  if (!userId) {
    userId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('personalization_user_id', userId);
  }
  return userId;
}

/**
 * Load cached model from localStorage
 */
function loadCachedModel(userId: string): PreferenceModel | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return null;
    
    const entry: CacheEntry = JSON.parse(cache);
    if (entry.model.user_id !== userId) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) return null;
    
    return entry.model;
  } catch {
    return null;
  }
}

/**
 * Save model to localStorage cache
 */
function saveCachedModel(model: PreferenceModel): void {
  if (typeof window === 'undefined') return;
  
  try {
    const entry: CacheEntry = {
      model,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Merge UI config with defaults
 */
function mergeWithDefaults(config: UIConfig | undefined | null): Required<UIConfig> {
  if (!config) return DEFAULT_UI_CONFIG;
  
  return {
    dashboard_card_order: config.dashboard_card_order || DEFAULT_UI_CONFIG.dashboard_card_order,
    default_time_range: config.default_time_range || DEFAULT_UI_CONFIG.default_time_range,
    notification_frequency: config.notification_frequency || DEFAULT_UI_CONFIG.notification_frequency,
    notification_timing: config.notification_timing || DEFAULT_UI_CONFIG.notification_timing,
    kpi_priority: config.kpi_priority || DEFAULT_UI_CONFIG.kpi_priority,
    objective_visibility: config.objective_visibility || DEFAULT_UI_CONFIG.objective_visibility,
    theme_preference: config.theme_preference || DEFAULT_UI_CONFIG.theme_preference,
    content_density: config.content_density || DEFAULT_UI_CONFIG.content_density,
    auto_refresh: config.auto_refresh ?? DEFAULT_UI_CONFIG.auto_refresh,
  };
}

/**
 * Sort items based on learned priority
 */
function sortByPriority<T extends string>(
  items: T[],
  priority: string[]
): T[] {
  const priorityMap = new Map(priority.map((p, i) => [p, i]));
  
  return [...items].sort((a, b) => {
    const priorityA = priorityMap.get(a) ?? Infinity;
    const priorityB = priorityMap.get(b) ?? Infinity;
    return priorityA - priorityB;
  });
}

/**
 * Personalization hook
 */
export function usePersonalization(): PersonalizationState {
  const userId = useMemo(() => getUserId(), []);
  
  const [model, setModel] = useState<PreferenceModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Computed UI config
  const uiConfig = useMemo(() => 
    mergeWithDefaults(model?.ui_config),
    [model]
  );
  
  // Fetch model
  const fetchModel = useCallback(async (forceRefresh = false) => {
    try {
      // Try cache first
      if (!forceRefresh) {
        const cached = loadCachedModel(userId);
        if (cached) {
          setModel(cached);
          setIsLoading(false);
          return;
        }
      }
      
      // Fetch from backend
      const fetchedModel = await getUserModel(userId);
      
      if (fetchedModel) {
        setModel(fetchedModel);
        saveCachedModel(fetchedModel);
      } else {
        // Create default model for new users
        const defaultModel: PreferenceModel = {
          user_id: userId,
          model_version: 1,
          feature_weights: {},
          ui_config: DEFAULT_UI_CONFIG,
          prediction_accuracy: 0,
          training_examples: 0,
          last_updated: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        setModel(defaultModel);
        saveCachedModel(defaultModel);
      }
      
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load preferences';
      setError(message);
      console.error('Personalization fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  
  // Initial load
  useEffect(() => {
    fetchModel();
  }, [fetchModel]);
  
  // Refresh function
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchModel(true);
    setIsRefreshing(false);
  }, [fetchModel]);
  
  // Update config function
  const updateConfig = useCallback(async (updates: Partial<UIConfig>) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    const newConfig = { ...uiConfig, ...updates };
    
    try {
      setIsRefreshing(true);
      
      type PreferenceModelInsert = {
        user_id: string;
        ui_config: UIConfig;
        model_version: number;
        last_updated: string;
      };

      const insertData: PreferenceModelInsert = {
        user_id: userId,
        ui_config: newConfig,
        model_version: (model?.model_version || 0) + 1,
        last_updated: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('preference_models')
        .upsert(insertData as any, { onConflict: 'user_id' });
      
      if (error) throw error;
      
      // Update local state
      setModel(prev => prev ? {
        ...prev,
        ui_config: newConfig,
        model_version: (prev.model_version || 0) + 1,
        last_updated: new Date().toISOString(),
      } : null);
      
    } catch (err) {
      console.error('Failed to update config:', err);
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  }, [userId, uiConfig, model]);
  
  // Get card order with personalization
  const getCardOrder = useCallback((defaultOrder?: string[]): string[] => {
    const order = defaultOrder || DEFAULT_UI_CONFIG.dashboard_card_order;
    return sortByPriority(order, uiConfig.dashboard_card_order);
  }, [uiConfig.dashboard_card_order]);
  
  // Get default time range
  const getDefaultTimeRange = useCallback((): '7d' | '30d' | '90d' | 'custom' => {
    return uiConfig.default_time_range;
  }, [uiConfig.default_time_range]);
  
  // Get notification frequency
  const getNotificationFrequency = useCallback((): 'realtime' | 'hourly' | 'daily' | 'weekly' => {
    return uiConfig.notification_frequency;
  }, [uiConfig.notification_frequency]);
  
  // Get KPI priority order
  const getKPIPriority = useCallback((kpis: string[]): string[] => {
    return sortByPriority(kpis, uiConfig.kpi_priority);
  }, [uiConfig.kpi_priority]);
  
  // Check if objective should be shown
  const shouldShowObjective = useCallback((objectiveId: string): boolean => {
    // If not explicitly hidden, show it
    return uiConfig.objective_visibility[objectiveId] !== false;
  }, [uiConfig.objective_visibility]);
  
  return {
    model,
    uiConfig,
    isLoading,
    isRefreshing,
    error,
    refresh,
    updateConfig,
    getCardOrder,
    getDefaultTimeRange,
    getNotificationFrequency,
    getKPIPriority,
    shouldShowObjective,
  };
}

/**
 * Hook to get personalized dashboard card order
 */
export function usePersonalizedCardOrder(defaultOrder: string[]): string[] {
  const { getCardOrder } = usePersonalization();
  return useMemo(() => getCardOrder(defaultOrder), [getCardOrder, defaultOrder]);
}

/**
 * Hook to get user's preferred time range
 */
export function usePreferredTimeRange(): '7d' | '30d' | '90d' | 'custom' {
  const { getDefaultTimeRange } = usePersonalization();
  return useMemo(() => getDefaultTimeRange(), [getDefaultTimeRange]);
}

/**
 * Hook to get notification preferences
 */
export function useNotificationPreferences() {
  const { uiConfig, updateConfig } = usePersonalization();
  
  return {
    frequency: uiConfig.notification_frequency,
    timing: uiConfig.notification_timing,
    updateFrequency: (frequency: UIConfig['notification_frequency']) => 
      updateConfig({ notification_frequency: frequency }),
    updateTiming: (timing: UIConfig['notification_timing']) => 
      updateConfig({ notification_timing: timing }),
  };
}

/**
 * Hook to get personalized KPI order
 */
export function usePersonalizedKPIs(availableKPIs: string[]): string[] {
  const { getKPIPriority } = usePersonalization();
  return useMemo(() => getKPIPriority(availableKPIs), [getKPIPriority, availableKPIs]);
}

/**
 * Hook for theme preference integration
 */
export function usePersonalizedTheme() {
  const { uiConfig, updateConfig } = usePersonalization();
  
  return {
    theme: uiConfig.theme_preference,
    setTheme: (theme: UIConfig['theme_preference']) => 
      updateConfig({ theme_preference: theme }),
  };
}

export default usePersonalization;
