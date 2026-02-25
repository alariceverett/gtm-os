/**
 * Server-side Supabase Client
 * 
 * For use in API routes and server-side code.
 * Uses service role key for admin access while respecting RLS via created_by filtering.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cache the client instance
let cachedClient: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Create a Supabase client for server-side use
 * 
 * Requires environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
export function createClient(): ReturnType<typeof createSupabaseClient> {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  // Create client with service role
  const client = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Cache for reuse
  cachedClient = client;
  return client;
}

/**
 * Create a Supabase client with user context
 * 
 * For authenticated API requests with user session.
 */
export async function createClientWithContext(
  authHeader: string
): Promise<ReturnType<typeof createSupabaseClient>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const client = createSupabaseClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  return client;
}

/**
 * Verify a user's access to a resource
 */
export async function verifyOwnership(
  table: string,
  id: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from(table)
    .select('created_by')
    .eq('id', id)
    .eq('created_by', userId)
    .maybeSingle();

  if (error) {
    console.error('Ownership verification error:', error);
    return false;
  }

  return !!data;
}

export default { createClient, createClientWithContext, verifyOwnership };
