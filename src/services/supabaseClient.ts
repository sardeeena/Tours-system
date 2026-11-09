import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safely validate candidate URL
function sanitizeSupabaseUrl(url?: string): string | undefined {
  if (url && typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    try {
      new URL(url);
      return url;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Environment variables for Vite and Node.js testing
// Fail-closed principle: Do NOT silently fall back to production credentials if unconfigured
const envUrl =
  sanitizeSupabaseUrl(typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined) ||
  sanitizeSupabaseUrl(typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : undefined) ||
  undefined;

const rawAnonKeyCandidate =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_ANON_KEY || (process.env?.SUPABASE_ANON_KEY !== 'ok' ? process.env?.SUPABASE_ANON_KEY : undefined))) ||
  undefined;

// Helper to decode JWT role claim without external libraries
function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.role || null;
    }
  } catch {
    // not a standard base64 decodable JWT
  }
  return null;
}

/**
 * Validates whether a key is a Supabase Secret / Service-Role credential.
 * Supports:
 *  - Modern secret keys: starts with 'sb_secret_'
 *  - Legacy service-role tokens: JWT with claim role === 'service_role'
 */
export const isSupabaseSecretKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.startsWith('sb_secret_')) return true;
  if (trimmed.toLowerCase().includes('service_role')) return true;
  const role = decodeJwtRole(trimmed);
  return role === 'service_role';
};

/**
 * Validates whether a key is a safe Supabase Publishable / Anonymous key.
 * Supports:
 *  - Modern publishable keys: starts with 'sb_publishable_'
 *  - Legacy anonymous tokens: JWT with claim role === 'anon'
 */
export const isSupabasePublishableKey = (key: string): boolean => {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.startsWith('sb_publishable_')) return true;
  const role = decodeJwtRole(trimmed);
  return role === 'anon';
};

// Backwards-compatible alias
export const isSecretOrServiceRoleKey = (key: string): boolean => isSupabaseSecretKey(key);

const envAnonKey = (rawAnonKeyCandidate && !isSupabaseSecretKey(rawAnonKeyCandidate))
  ? rawAnonKeyCandidate
  : undefined;

// Safe retrieval from Admin Settings in browser storage (STRICTLY rejecting service_role keys)
const getStoredUrl = () => {
  try {
    return localStorage.getItem('rse_supabase_url') || envUrl || '';
  } catch {
    return envUrl || '';
  }
};

const getStoredKey = () => {
  try {
    const stored = localStorage.getItem('rse_supabase_anon_key');
    if (stored) {
      if (isSecretOrServiceRoleKey(stored)) {
        console.error('CRITICAL SECURITY: Blocked secret / service_role key found in browser storage. Purging immediately.');
        localStorage.removeItem('rse_supabase_anon_key');
        return envAnonKey || '';
      }
      return stored;
    }
    return envAnonKey || '';
  } catch {
    return envAnonKey || '';
  }
};

let activeUrl = getStoredUrl();
let activeKey = getStoredKey();

let schemaMissingDetected = false;
const schemaMissingListeners = new Set<(missing: boolean) => void>();

export const setSchemaMissing = (missing: boolean) => {
  if (schemaMissingDetected !== missing) {
    schemaMissingDetected = missing;
    schemaMissingListeners.forEach((fn) => {
      try {
        fn(missing);
      } catch {
        // ignore subscriber errors
      }
    });
  }
};

export const isSchemaMissing = () => schemaMissingDetected;

export const subscribeSchemaMissing = (listener: (missing: boolean) => void) => {
  schemaMissingListeners.add(listener);
  return () => {
    schemaMissingListeners.delete(listener);
  };
};

export const isSchemaMissingError = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof error === 'string') {
    return error.includes('PGRST205') || error.includes('Could not find the table') || error.includes('schema cache');
  }
  const err = error as { code?: string; message?: string; details?: string };
  const message = err.message || '';
  const code = err.code || '';
  return code === 'PGRST205' || message.includes('Could not find the table') || message.includes('schema cache');
};

// Helper to determine if valid safe client Supabase credentials exist
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    activeUrl &&
    activeKey &&
    activeUrl.startsWith('https://') &&
    activeUrl.includes('.supabase.co') &&
    activeKey.length > 20 &&
    !isSupabaseSecretKey(activeKey)
  );
};

// Create client instance safely
const createSafeClient = (): SupabaseClient => {
  if (isSupabaseConfigured()) {
    return createClient(activeUrl, activeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  // Fallback placeholder client (prevents immediate crashes on bootstrap if env not set)
  return createClient('https://placeholder-project.supabase.co', 'placeholder-anon-key-000000000000000000000000', {
    auth: { persistSession: false },
  });
};

export let supabase: SupabaseClient = createSafeClient();

/**
 * Re-initializes client when user updates keys in Admin Settings.
 * STRICT SECURITY: Rejects any attempt to enter a secret or service_role key into browser storage.
 */
export const updateSupabaseCredentials = (url: string, anonKey: string): boolean => {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (isSecretOrServiceRoleKey(cleanKey)) {
    throw new Error(
      'CRITICAL SECURITY VIOLATION: Supabase Secret / Service-Role keys must NEVER be supplied to browser clients or stored in browser storage. Please provide only the public publishable anon key (sb_publishable_... or public anon JWT).'
    );
  }

  activeUrl = cleanUrl;
  activeKey = cleanKey;
  try {
    localStorage.setItem('rse_supabase_url', activeUrl);
    localStorage.setItem('rse_supabase_anon_key', activeKey);
  } catch {
    // ignore local storage restrictions
  }
  setSchemaMissing(false);
  supabase = createSafeClient();
  return isSupabaseConfigured();
};

export const getSupabaseConfig = () => ({
  url: activeUrl,
  anonKey: activeKey ? `${activeKey.slice(0, 10)}...${activeKey.slice(-6)}` : '',
  isConfigured: isSupabaseConfigured(),
});

/**
 * Converts PostgreSQL / Supabase errors into clear, human-readable user messages
 */
export const formatSupabaseError = (error: unknown): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';

  if (typeof error === 'string') return error;

  const err = error as { code?: string; message?: string; details?: string };
  const message = err.message || '';
  const code = err.code || '';

  // Missing table in schema cache (PGRST205)
  if (code === 'PGRST205' || message.includes('Could not find the table') || message.includes('schema cache')) {
    return 'Database table was not found in the Supabase schema cache. Please execute the Phase 4 SQL migration in your Supabase SQL Editor.';
  }

  // Unique constraint violation (23505)
  if (code === '23505' || message.includes('duplicate key') || message.includes('unique constraint')) {
    if (message.includes('slug')) {
      return 'This URL slug is already being used by another item. Please choose a unique title or slug.';
    }
    if (message.includes('booking_reference')) {
      return 'A booking with this reference number already exists in the system.';
    }
    if (message.includes('email')) {
      return 'An account with this email address already exists.';
    }
    return 'A record with these unique details already exists.';
  }

  // Foreign key violation (23503)
  if (code === '23503' || message.includes('foreign key constraint')) {
    if (message.includes('bookings_tour_id_fkey')) {
      return 'Cannot delete this tour because historical customer bookings are associated with it. Please archive or unpublish the tour instead.';
    }
    return 'This operation cannot be completed because related data exists.';
  }

  // Row Level Security (42501 / new row violates row-level security)
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'Permission denied: Your current account role does not have authorization to perform this action. Administrator privileges required.';
  }

  // Invalid login credentials
  if (message.includes('Invalid login credentials') || message.includes('invalid_grant')) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }

  // Email not confirmed
  if (message.includes('Email not confirmed') || message.includes('email_not_confirmed')) {
    return 'Your email address has not been confirmed yet. Please check your inbox for the verification email, or request a new one.';
  }

  // User already registered
  if (message.includes('User already registered') || message.includes('user_already_exists') || message.includes('already registered')) {
    return 'An account with this email address already exists. Please sign in or use password reset.';
  }

  // Password requirements
  if (message.includes('Password should be at least') || message.includes('weak_password')) {
    return 'Password is too weak. It must be at least 6 characters long.';
  }

  // Server-side submission rate limiting from PostgreSQL triggers
  if (message.includes('Rate limit exceeded') || (code === 'P0001' && message)) {
    return message;
  }

  // Over email rate limit
  if (message.includes('rate limit') || message.includes('over_email_send_rate_limit')) {
    return 'Too many email requests sent. For security, please wait a minute before requesting another email.';
  }

  // Expired or invalid recovery/invite link
  if (message.includes('recovery link') || message.includes('token has expired') || message.includes('token is invalid')) {
    return 'This password reset link has expired or has already been used. Please request a new link.';
  }

  // JWT expired
  if (message.includes('JWT expired') || message.includes('token is expired')) {
    return 'Your session has expired. Please sign in again.';
  }

  return message || 'Request failed. Please check your connection and try again.';
};
