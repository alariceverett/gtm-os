'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchJson } from '@/lib/backend';

export interface UseDataFetchOptions {
  /** Refresh interval in milliseconds (0 to disable) */
  refreshInterval?: number;
  /** Enable stale-while-revalidate pattern */
  staleWhileRevalidate?: boolean;
  /** Retry count on failure */
  retryCount?: number;
  /** Initial data */
  initialData?: any;
}

export interface UseDataFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
}

/**
 * Generic data fetching hook with caching, refresh intervals, and error handling
 */
export function useDataFetch<T>(
  url: string | null,
  options: UseDataFetchOptions = {}
): UseDataFetchResult<T> {
  const {
    refreshInterval = 0,
    staleWhileRevalidate = true,
    retryCount = 2,
    initialData = null,
  } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!url) return;
    
    // Check cache first for stale-while-revalidate
    const cached = cacheRef.current.get(url);
    const now = Date.now();
    
    if (!isBackground && cached && staleWhileRevalidate) {
      setData(cached.data);
      setIsLoading(false);
      setIsStale(true);
    } else if (!isBackground) {
      setIsLoading(true);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= retryCount) {
      try {
        const result = await fetchJson<T>(url);
        
        // Update cache
        cacheRef.current.set(url, { data: result, timestamp: now });
        
        setData(result);
        setIsError(false);
        setError(null);
        setIsStale(false);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
        attempts++;
        
        if (attempts <= retryCount) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
        }
      }
    }

    // All retries failed
    setIsError(true);
    setError(lastError);
    setIsLoading(false);
    
    // If we have cached data, use it as fallback
    if (cached) {
      setData(cached.data);
      setIsStale(true);
    }
  }, [url, retryCount, staleWhileRevalidate]);

  const refetch = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Background refresh interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    
    const intervalId = setInterval(() => {
      fetchData(true);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [refreshInterval, fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    isLoading,
    isError,
    error,
    isStale,
    lastUpdated,
    refetch,
  };
}

/**
 * Format a timestamp for display
 */
export function formatLastUpdated(date: Date | null): string {
  if (!date) return 'Never updated';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffSec < 30) return 'Just now';
  if (diffMin < 1) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Check if data is stale based on threshold
 */
export function isDataStale(lastUpdated: Date | null, thresholdMinutes = 5): boolean {
  if (!lastUpdated) return true;
  const diffMs = Date.now() - lastUpdated.getTime();
  return diffMs > thresholdMinutes * 60 * 1000;
}
