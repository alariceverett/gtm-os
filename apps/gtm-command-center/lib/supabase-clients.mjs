import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv } from './supabase-env.mjs';

export function createServerSupabaseClient(env = process.env) {
  const { url, anonKey, serviceRoleKey } = assertSupabaseEnv(env);

  return createClient(url, serviceRoleKey || anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createBrowserSupabaseClient(options = {}) {
  const {
    url = typeof window !== 'undefined' ? window.__SUPABASE_URL__ : undefined,
    anonKey = typeof window !== 'undefined' ? window.__SUPABASE_ANON_KEY__ : undefined,
  } = options;

  if (!url || !anonKey) {
    throw new Error('Browser Supabase client requires url and anonKey');
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
