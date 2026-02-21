const REQUIRED_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const SERVER_REQUIRED_KEYS = [...REQUIRED_KEYS, 'SUPABASE_SERVICE_ROLE_KEY'];

function hasValue(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeUrl(value) {
  if (!hasValue(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeSupabaseKey(value) {
  return hasValue(value) && value.split('.').length === 3;
}

export function validateSupabaseEnv(env = process.env) {
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    if (!hasValue(env[key])) {
      errors.push(`${key} is missing`);
    }
  }

  if (hasValue(env.SUPABASE_URL) && !looksLikeUrl(env.SUPABASE_URL)) {
    errors.push('SUPABASE_URL must be a valid http(s) URL');
  }

  if (hasValue(env.SUPABASE_ANON_KEY) && !looksLikeSupabaseKey(env.SUPABASE_ANON_KEY)) {
    errors.push('SUPABASE_ANON_KEY does not look like a valid JWT');
  }

  if (
    hasValue(env.SUPABASE_SERVICE_ROLE_KEY) &&
    !looksLikeSupabaseKey(env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY does not look like a valid JWT');
  }

  return {
    ok: errors.length === 0,
    errors,
    hasServiceRole: hasValue(env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function assertSupabaseEnv(env = process.env, { server = false } = {}) {
  const result = validateSupabaseEnv(env);

  if (server) {
    for (const key of SERVER_REQUIRED_KEYS) {
      if (!hasValue(env[key])) {
        result.errors.push(`${key} is missing`);
      }
    }
  }

  if (result.errors.length) {
    throw new Error(`Invalid Supabase env: ${result.errors.join('; ')}`);
  }

  return {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function resolveRuntimeMode(env = process.env) {
  const hasDatabaseUrl = hasValue(env.DATABASE_URL);
  const supabase = validateSupabaseEnv(env);

  if (supabase.ok && supabase.hasServiceRole) {
    return 'supabase';
  }

  if (hasDatabaseUrl) {
    return 'pg';
  }

  if (supabase.ok) {
    return 'supabase';
  }

  return 'none';
}
