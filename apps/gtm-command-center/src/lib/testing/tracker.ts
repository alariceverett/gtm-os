/**
 * A/B Test Event Tracker
 * Tracks opens, clicks, replies, meetings by variant
 */

import { supabase } from '@/lib/supabase';

export interface ABTestEvent {
  id?: string;
  testId: string;
  variantId: string;
  prospectId: string;
  sequenceId: string;
  touchId?: string;
  eventType: 'sent' | 'opened' | 'clicked' | 'replied' | 'meeting_booked' | 'unsubscribed';
  metadata?: Record<string, any>;
  createdAt?: string;
}

export interface TestResults {
  test_id: string;
  variant_id: string;
  variant_name: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  meeting_booked: number;
  unsubscribed: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  meeting_rate: number;
}

/**
 * Record an A/B test event
 */
export async function createABTestEvent(
  event: Omit<ABTestEvent, 'id' | 'createdAt'>
): Promise<{ data: ABTestEvent | null; error: Error | null }> {
  // Map camelCase to snake_case for database
  const dbEvent = {
    test_id: event.testId,
    variant_id: event.variantId,
    prospect_id: event.prospectId,
    sequence_id: event.sequenceId,
    touch_id: event.touchId,
    event_type: event.eventType,
    metadata: event.metadata,
  };
  
  const { data, error } = await supabase
    .from('ab_test_events')
    .insert([dbEvent])
    .select()
    .single();

  if (error || !data) {
    return { data: null, error };
  }
  
  // Map snake_case back to camelCase
  return {
    data: {
      id: data.id,
      testId: data.test_id,
      variantId: data.variant_id,
      prospectId: data.prospect_id,
      sequenceId: data.sequence_id,
      touchId: data.touch_id,
      eventType: data.event_type,
      metadata: data.metadata,
      createdAt: data.created_at,
    },
    error: null,
  };
}

/**
 * Get aggregated results for an A/B test
 */
export async function getTestResults(testId: string): Promise<TestResults[]> {
  // Get all events for this test
  const { data: events, error } = await supabase
    .from('ab_test_events')
    .select(`
      *,
      ab_test_variants!inner(name)
    `)
    .eq('test_id', testId);

  if (error || !events) {
    console.error('Error fetching test results:', error);
    return [];
  }

  // Aggregate by variant
  const resultsByVariant = new Map<string, TestResults>();

  for (const event of events) {
    const variantId = event.variant_id;
    const variantName = event.ab_test_variants?.name || 'Unknown';

    if (!resultsByVariant.has(variantId)) {
      resultsByVariant.set(variantId, {
        test_id: testId,
        variant_id: variantId,
        variant_name: variantName,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        meeting_booked: 0,
        unsubscribed: 0,
        open_rate: 0,
        click_rate: 0,
        reply_rate: 0,
        meeting_rate: 0,
      });
    }

    const results = resultsByVariant.get(variantId)!;
    const eventType = event.event_type as keyof typeof results;
    if (typeof results[eventType] === 'number') {
      (results[eventType] as number)++;
    }
  }

  // Calculate rates
  const results: TestResults[] = [];
  for (const [variantId, data] of resultsByVariant) {
    const sent = Math.max(data.sent, 1); // Avoid division by zero
    results.push({
      ...data,
      open_rate: (data.opened / sent) * 100,
      click_rate: (data.clicked / sent) * 100,
      reply_rate: (data.replied / sent) * 100,
      meeting_rate: (data.meeting_booked / sent) * 100,
    });
  }

  return results;
}

/**
 * Get real-time event stream for a test
 */
export async function subscribeToTestEvents(
  testId: string,
  onEvent: (event: ABTestEvent) => void
) {
  return supabase
    .channel(`ab-test-${testId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ab_test_events',
        filter: `test_id=eq.${testId}`,
      },
      (payload) => {
        onEvent(payload.new as ABTestEvent);
      }
    )
    .subscribe();
}

/**
 * Batch record events (for webhooks)
 */
export async function batchCreateEvents(
  events: Omit<ABTestEvent, 'id' | 'createdAt'>[]
): Promise<{ data: ABTestEvent[] | null; error: Error | null }> {
  // Map camelCase to snake_case for database
  const dbEvents = events.map(event => ({
    test_id: event.testId,
    variant_id: event.variantId,
    prospect_id: event.prospectId,
    sequence_id: event.sequenceId,
    touch_id: event.touchId,
    event_type: event.eventType,
    metadata: event.metadata,
  }));
  
  const { data, error } = await supabase
    .from('ab_test_events')
    .insert(dbEvents)
    .select();

  if (error || !data) {
    return { data: null, error };
  }
  
  // Map snake_case back to camelCase
  return {
    data: data.map(item => ({
      id: item.id,
      testId: item.test_id,
      variantId: item.variant_id,
      prospectId: item.prospect_id,
      sequenceId: item.sequence_id,
      touchId: item.touch_id,
      eventType: item.event_type,
      metadata: item.metadata,
      createdAt: item.created_at,
    })),
    error: null,
  };
}

/**
 * Get variant assignment for a prospect
 * Uses consistent hashing for 50/50 or custom split
 */
export function assignVariant(
  prospectId: string,
  variants: string[],
  weights?: number[]
): string {
  // Simple hash-based assignment
  const hash = prospectId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);

  // Use weights or uniform distribution
  const totalWeight = weights?.reduce((a, b) => a + b, 0) || variants.length;
  const normalizedHash = Math.abs(hash) / Number.MAX_SAFE_INTEGER;
  const threshold = normalizedHash * totalWeight;

  let cumulativeWeight = 0;
  for (let i = 0; i < variants.length; i++) {
    cumulativeWeight += weights?.[i] || 1;
    if (threshold <= cumulativeWeight) {
      return variants[i];
    }
  }

  return variants[variants.length - 1];
}
