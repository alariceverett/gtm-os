/**
 * Preference Service (Simplified)
 * 
 * Basic preference model service:
 * - Reads feedback_signals from DB
 * - Simple scoring: count explicit feedback per user  
 * - Stores in preference_models table
 * - Updates every 5 minutes
 */

import { getSupabaseClient } from './supabase-client';

// Card types that can be reordered
export type CardType = 'kpi' | 'objectives' | 'intelligence' | 'alerts';

// Default card order
export const DEFAULT_CARD_ORDER: CardType[] = ['kpi', 'objectives', 'alerts', 'intelligence'];

// Simplified preference model
export interface PreferenceModel {
  user_id: string;
  card_order: CardType[];
  updated_at: string;
}

// Feedback signal types we track
export type SignalType = 'explicit_positive' | 'explicit_negative' | 'dwell' | 'skip';

// DB row types
interface PreferenceModelRow {
  user_id: string;
  card_order: CardType[];
  updated_at: string;
}

interface FeedbackSignalRow {
  id?: string;
  user_id: string;
  signal_type: string;
  context: { section?: string };
  timestamp: string;
  processed?: boolean;
}

// Signal weights for simple scoring
const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  explicit_positive: 1.0,
  explicit_negative: -1.0,
  dwell: 0.5,
  skip: -0.3,
};

// Card section mapping
const CARD_SECTIONS: Record<string, CardType> = {
  'hero-status': 'kpi',
  'kpi': 'kpi',
  'objectives': 'objectives',
  'objectives-list': 'objectives',
  'intelligence': 'intelligence',
  'intelligence-feed': 'intelligence',
  'alerts': 'alerts',
  'smart-alerts': 'alerts',
};

/**
 * Get card type from section name
 */
export function getCardType(section: string): CardType | null {
  return CARD_SECTIONS[section.toLowerCase()] || null;
}

/**
 * Calculate card scores from feedback signals
 */
function calculateCardScores(
  signals: Array<{ signal_type: SignalType; section?: string }>
): Map<CardType, number> {
  const scores = new Map<CardType, number>();
  
  // Initialize with 0
  DEFAULT_CARD_ORDER.forEach(card => scores.set(card, 0));
  
  // Aggregate scores
  for (const signal of signals) {
    const cardType = signal.section ? getCardType(signal.section) : null;
    if (!cardType) continue;
    
    const weight = SIGNAL_WEIGHTS[signal.signal_type] || 0;
    scores.set(cardType, (scores.get(cardType) || 0) + weight);
  }
  
  return scores;
}

/**
 * Sort cards by score (highest first), fallback to default order
 */
function sortCardsByScore(scores: Map<CardType, number>): CardType[] {
  const cardsWithScores = DEFAULT_CARD_ORDER.map(card => ({
    card,
    score: scores.get(card) || 0,
  }));
  
  // Sort by score descending, then by default position
  cardsWithScores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return DEFAULT_CARD_ORDER.indexOf(a.card) - DEFAULT_CARD_ORDER.indexOf(b.card);
  });
  
  return cardsWithScores.map(c => c.card);
}

/**
 * Fetch user's preference model from database
 */
export async function getUserPreferences(userId: string): Promise<PreferenceModel | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not available, using defaults');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('preference_models')
      .select('user_id, card_order, updated_at')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found - return null to use defaults
        return null;
      }
      throw error;
    }
    
    if (!data) return null;
    
    const row = data as unknown as PreferenceModelRow;
    return {
      user_id: row.user_id,
      card_order: row.card_order || DEFAULT_CARD_ORDER,
      updated_at: row.updated_at,
    };
  } catch (err) {
    console.error('Failed to fetch preferences:', err);
    return null;
  }
}

/**
 * Save preference model to database
 */
export async function saveUserPreferences(
  userId: string,
  cardOrder: CardType[]
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  
  try {
    const row: PreferenceModelRow = {
      user_id: userId,
      card_order: cardOrder,
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('preference_models')
      .upsert(row as any, { onConflict: 'user_id' });
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to save preferences:', err);
    return false;
  }
}

/**
 * Store a feedback signal
 */
export async function storeFeedback(
  userId: string,
  signalType: SignalType,
  section?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  
  try {
    const row: FeedbackSignalRow = {
      user_id: userId,
      signal_type: signalType,
      context: { section: section || undefined },
      timestamp: new Date().toISOString(),
      processed: false,
    };
    
    const { error } = await supabase
      .from('feedback_signals')
      .insert(row as any);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Failed to store feedback:', err);
    return false;
  }
}

/**
 * Fetch recent feedback signals for a user
 */
export async function getUserFeedback(
  userId: string,
  hours: number = 24
): Promise<Array<{ signal_type: SignalType; section?: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('feedback_signals')
      .select('signal_type, context')
      .eq('user_id', userId)
      .gte('timestamp', since);
    
    if (error) throw error;
    
    return (data || []).map(row => {
      const r = row as unknown as FeedbackSignalRow;
      return {
        signal_type: r.signal_type as SignalType,
        section: r.context?.section,
      };
    });
  } catch (err) {
    console.error('Failed to fetch feedback:', err);
    return [];
  }
}

/**
 * Update preference model from recent feedback (simple recalculation)
 */
export async function updatePreferenceModel(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  
  try {
    // Get all unprocessed feedback for this user
    const { data: signals, error } = await supabase
      .from('feedback_signals')
      .select('id, signal_type, context')
      .eq('user_id', userId)
      .eq('processed', false);
    
    if (error) throw error;
    if (!signals || signals.length === 0) return true; // Nothing to process
    
    // Calculate new card order
    const scoredSignals = (signals as unknown as FeedbackSignalRow[]).map(s => ({
      signal_type: s.signal_type as SignalType,
      section: s.context?.section,
    }));
    
    const scores = calculateCardScores(scoredSignals);
    const newOrder = sortCardsByScore(scores);
    
    // Save new preferences
    await saveUserPreferences(userId, newOrder);
    
    // Mark signals as processed
    const signalIds = (signals as unknown as Array<{ id: string }>)
      .map(s => s.id)
      .filter(Boolean);
      
    if (signalIds.length > 0) {
      for (const id of signalIds) {
        await (supabase as any)
          .from('feedback_signals')
          .update({ processed: true })
          .eq('id', id);
      }
    }
    
    return true;
  } catch (err) {
    console.error('Failed to update preference model:', err);
    return false;
  }
}

/**
 * Get or create default preferences
 */
export function getDefaultPreferences(userId: string): PreferenceModel {
  return {
    user_id: userId,
    card_order: [...DEFAULT_CARD_ORDER],
    updated_at: new Date().toISOString(),
  };
}

export default {
  getUserPreferences,
  saveUserPreferences,
  storeFeedback,
  getUserFeedback,
  updatePreferenceModel,
  getDefaultPreferences,
  DEFAULT_CARD_ORDER,
};
