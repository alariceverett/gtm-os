/**
 * useSimplePersonalization Hook (Minimal)
 * 
 * Simplified personalization:
 * - Fetch user's preference model from /api/users/me/preferences
 * - Return default if none exists
 * - Apply to: dashboard card order only
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getUserPreferences,
  storeFeedback,
  DEFAULT_CARD_ORDER,
} from '../lib/preference-service';

export type CardType = 'kpi' | 'objectives' | 'intelligence' | 'alerts';
export type SignalType = 'explicit_positive' | 'explicit_negative' | 'dwell' | 'skip';

export interface PreferenceModel {
  user_id: string;
  card_order: CardType[];
  updated_at: string;
}

// 5 minute TTL for cache
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'prefs_cache';

interface CacheEntry {
  userId: string;
  model: PreferenceModel;
  timestamp: number;
}

// Generate or get user ID
function getUserId(): string {
  if (typeof window === 'undefined') return 'anonymous';
  
  let userId = localStorage.getItem('user_id');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('user_id', userId);
  }
  return userId;
}

// Load from cache
function loadCache(userId: string): PreferenceModel | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.userId !== userId) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    
    return entry.model;
  } catch {
    return null;
  }
}

// Save to cache
function saveCache(userId: string, model: PreferenceModel): void {
  if (typeof window === 'undefined') return;
  
  try {
    const entry: CacheEntry = {
      userId,
      model,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore storage errors
  }
}

export interface PersonalizationState {
  userId: string;
  cardOrder: CardType[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordFeedback: (signalType: SignalType, section?: string) => Promise<void>;
}

/**
 * Minimal personalization hook
 * Fetches preferences and provides card ordering
 */
export function useSimplePersonalization(): PersonalizationState {
  const userId = useMemo(() => getUserId(), []);
  
  const [cardOrder, setCardOrder] = useState<CardType[]>(DEFAULT_CARD_ORDER);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Try cache first
      const cached = loadCache(userId);
      if (cached) {
        setCardOrder(cached.card_order);
        setIsLoading(false);
        // Still fetch in background for freshness
      }
      
      // Fetch from API
      const response = await fetch(`/api/users/${userId}/preferences`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // No preferences yet, use defaults
          const defaultModel = {
            user_id: userId,
            card_order: DEFAULT_CARD_ORDER,
            updated_at: new Date().toISOString(),
          };
          setCardOrder(DEFAULT_CARD_ORDER);
          saveCache(userId, defaultModel);
          setError(null);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const model: PreferenceModel = {
        user_id: data.user_id || userId,
        card_order: data.card_order || DEFAULT_CARD_ORDER,
        updated_at: data.updated_at || new Date().toISOString(),
      };
      
      setCardOrder(model.card_order);
      saveCache(userId, model);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Use defaults on error
      setCardOrder(DEFAULT_CARD_ORDER);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  
  // Initial fetch
  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);
  
  // Refresh function
  const refresh = useCallback(async () => {
    await fetchPreferences();
  }, [fetchPreferences]);
  
  // Record feedback
  const recordFeedback = useCallback(async (signalType: SignalType, section?: string) => {
    try {
      // Optimistic local store
      await storeFeedback(userId, signalType, section);
      
      // Also post to API for server-side processing
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          signal_type: signalType,
          section,
        }),
      });
    } catch (err) {
      console.error('Failed to record feedback:', err);
    }
  }, [userId]);
  
  return {
    userId,
    cardOrder,
    isLoading,
    error,
    refresh,
    recordFeedback,
  };
}

/**
 * Hook to get just the card order
 */
export function useCardOrder(): CardType[] {
  const { cardOrder } = useSimplePersonalization();
  return cardOrder;
}

/**
 * Hook to record section engagement
 */
export function useRecordEngagement() {
  const { recordFeedback } = useSimplePersonalization();
  
  return useCallback(
    (section: string, positive: boolean = true) => {
      const signalType: SignalType = positive ? 'explicit_positive' : 'explicit_negative';
      recordFeedback(signalType, section);
    },
    [recordFeedback]
  );
}

export default useSimplePersonalization;
