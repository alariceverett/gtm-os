'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserPreferences,
  saveUserPreferences,
  storeFeedback,
  DEFAULT_CARD_ORDER,
  type CardType,
  type SignalType,
} from '@/lib/preference-service';

export interface UseCardOrderResult {
  cardOrder: CardType[];
  isLoading: boolean;
  error: Error | null;
  saveOrder: (newOrder: CardType[]) => Promise<boolean>;
}

export interface UseFeedbackRecorderResult {
  recordFeedback: (signalType: SignalType, section?: string) => Promise<boolean>;
  isRecording: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and manage user's card order preferences
 * 
 * @param userId - The user's unique identifier
 * @returns Card order state and save function
 * 
 * @example
 * ```tsx
 * const { cardOrder, isLoading, error, saveOrder } = useCardOrder('user-123');
 * 
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 * 
 * return <Dashboard cards={cardOrder} onReorder={saveOrder} />;
 * ```
 */
export function useCardOrder(userId: string | null): UseCardOrderResult {
  const [cardOrder, setCardOrder] = useState<CardType[]>(DEFAULT_CARD_ORDER);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  const isMountedRef = useRef(true);

  // Fetch preferences on mount or userId change
  useEffect(() => {
    isMountedRef.current = true;
    
    async function fetchPreferences() {
      if (!userId) {
        setCardOrder(DEFAULT_CARD_ORDER);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const preferences = await getUserPreferences(userId);
        
        if (isMountedRef.current) {
          if (preferences?.card_order) {
            setCardOrder(preferences.card_order);
          } else {
            setCardOrder(DEFAULT_CARD_ORDER);
          }
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error('Failed to fetch preferences'));
          // Fall back to defaults on error
          setCardOrder(DEFAULT_CARD_ORDER);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    fetchPreferences();

    return () => {
      isMountedRef.current = false;
    };
  }, [userId]);

  /**
   * Save a new card order for the user
   */
  const saveOrder = useCallback(async (newOrder: CardType[]): Promise<boolean> => {
    if (!userId) return false;

    try {
      const success = await saveUserPreferences(userId, newOrder);
      if (success && isMountedRef.current) {
        setCardOrder(newOrder);
      }
      return success;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to save preferences'));
      }
      return false;
    }
  }, [userId]);

  return {
    cardOrder,
    isLoading,
    error,
    saveOrder,
  };
}

/**
 * Hook to record user feedback signals
 * 
 * @returns Feedback recording function and state
 * 
 * @example
 * ```tsx
 * const { recordFeedback, isRecording } = useFeedbackRecorder();
 * 
 * const handleThumbsUp = () => {
 *   recordFeedback('explicit_positive', 'kpi');
 * };
 * ```
 */
export function useFeedbackRecorder(): UseFeedbackRecorderResult {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Record a feedback signal
   * @param signalType - Type of feedback signal
   * @param section - Optional UI section context
   * @returns Whether the feedback was recorded successfully
   */
  const recordFeedback = useCallback(async (
    signalType: SignalType,
    section?: string
  ): Promise<boolean> => {
    setIsRecording(true);
    setError(null);

    try {
      // Get userId from session/context - simplified for now
      const userId = getCurrentUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const success = await storeFeedback(userId, signalType, section);
      
      if (!success) {
        throw new Error('Failed to store feedback');
      }

      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to record feedback'));
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsRecording(false);
      }
    }
  }, []);

  return {
    recordFeedback,
    isRecording,
    error,
  };
}

/**
 * Get current user ID from session/context
 * TODO: Replace with actual auth context when available
 */
function getCurrentUserId(): string | null {
  // Check for userId in localStorage (set by auth flow)
  if (typeof window !== 'undefined') {
    return localStorage.getItem('gtm-user-id') || 'anonymous-user';
  }
  return null;
}
