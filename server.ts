import express, { Request, Response, NextFunction } from 'express';
import { renderBrandedEmailHtml } from './src/utils/emailTemplate';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { CONCIERGE_SYSTEM_PROMPT, TOUR_CATALOG_SUMMARY } from './src/data/chatKnowledge';
import { STANDARD_PICKUP_LOCATIONS, GLOBAL_BOOKING_EXTRAS } from './src/data/bookingData';
import { startBookingNotificationWorker } from './src/server/bookingNotificationWorker';
import { INITIAL_STATIC_PAGES } from './src/data/staticPages';
import { EXPECTED_AWESOME_ADVENTURE_TOURS_SUPABASE_PROJECT_REF, isExpectedAwesomeAdventureToursSupabaseUrl } from './src/lib/supabaseProjectGuard';

dotenv.config();

const app = express();
// Hostinger serves this Node process behind one trusted reverse-proxy hop.
// Let Express resolve req.ip from the forwarded client address so per-IP API
// limits are not accidentally shared by every visitor behind the proxy.
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const SERVER_START_TIME = Date.now();

// ------------------------------------------------------------------------------
// Supabase Key & URL Resolution (Official Supabase Security Architecture)
// Distinguishes modern sb_secret_ / sb_publishable_ from legacy JWT service_role / anon
// Enforces fail-closed behavior: Never accepts publishable keys as server secrets,
// never silently falls back to live production databases, and never exposes keys.
// ------------------------------------------------------------------------------
function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isSupabaseSecretKey(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  // Modern Supabase secret keys start with 'sb_secret_'
  if (trimmed.startsWith('sb_secret_')) return true;
  // Legacy service_role JWT validation
  const payload = parseJwtPayload(trimmed);
  return payload?.role === 'service_role';
}

export function isSupabasePublishableKey(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  // Modern Supabase publishable keys start with 'sb_publishable_'
  if (trimmed.startsWith('sb_publishable_')) return true;
  // Legacy anon JWT validation
  const payload = parseJwtPayload(trimmed);
  return payload?.role === 'anon';
}

function validateSupabaseUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

interface ServerSupabaseConfig {
  url: string | null;
  key: string | null;
  keyType: 'service_role' | 'anon' | 'none';
  configError?: string;
}

function resolveServerSupabaseConfig(): ServerSupabaseConfig {
  // 1. Resolve URL with strict fail-closed validation
  let resolvedUrl: string | null = null;
  let configError: string | undefined;

  const rawServerUrl = process.env.SUPABASE_URL;
  const rawViteUrl = process.env.VITE_SUPABASE_URL;

  if (rawServerUrl !== undefined && rawServerUrl !== '') {
    const validated = validateSupabaseUrl(rawServerUrl);
    if (validated) {
      resolvedUrl = validated;
    } else {
      configError = 'Server environment variable SUPABASE_URL is defined but is not a valid HTTP/HTTPS URL.';
    }
  } else if (rawViteUrl !== undefined && rawViteUrl !== '') {
    const validated = validateSupabaseUrl(rawViteUrl);
    if (validated) {
      resolvedUrl = validated;
    } else {
      configError = 'Environment variable VITE_SUPABASE_URL is defined but is not a valid HTTP/HTTPS URL.';
    }
  }

  // 1A. Pin production to the Awesome Adventure Tours Supabase project. Local/staging
  // projects are permitted only when NODE_ENV explicitly marks development/test.
  if (resolvedUrl) {
    const allowNonProductionProject = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (!isExpectedAwesomeAdventureToursSupabaseUrl(resolvedUrl, allowNonProductionProject)) {
      configError = `CONFIGURATION ERROR: This production Awesome Adventure Tours server must use Supabase project ${EXPECTED_AWESOME_ADVENTURE_TOURS_SUPABASE_PROJECT_REF}.`;
      resolvedUrl = null;
    }
  }

  // 2. Resolve Server Credentials (strictly rejecting publishable keys as server secrets)
  const rawSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const rawAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  let resolvedKey: string | null = null;
  let keyType: 'service_role' | 'anon' | 'none' = 'none';

  if (rawSecret) {
    if (isSupabaseSecretKey(rawSecret)) {
      resolvedKey = rawSecret.trim();
      keyType = 'service_role';
    } else {
      const isAnon = isSupabasePublishableKey(rawSecret);
      configError = isAnon
        ? 'CONFIGURATION ERROR: An anonymous/publishable key was supplied to SUPABASE_SERVICE_ROLE_KEY. Service-role operations require a genuine secret key (sb_secret_... or service_role JWT).'
        : 'CONFIGURATION ERROR: SUPABASE_SERVICE_ROLE_KEY is not a valid Supabase secret key.';
    }
  } else if (rawAnon) {
    if (isSupabasePublishableKey(rawAnon)) {
      resolvedKey = rawAnon.trim();
      keyType = 'anon';
    } else {
      configError = 'CONFIGURATION ERROR: Configured Supabase anon key is invalid.';
    }
  }

  return {
    url: resolvedUrl,
    key: resolvedKey,
    keyType,
    configError,
  };
}

const supabaseConfig = resolveServerSupabaseConfig();
if (supabaseConfig.configError) {
  console.error(`[Supabase Config Error] ${supabaseConfig.configError}`);
}

const SUPABASE_URL = supabaseConfig.url;
const SUPABASE_KEY = supabaseConfig.key;
const SUPABASE_KEY_TYPE = supabaseConfig.keyType;
// Public key for user-scoped requests. Never run guest/customer RPCs with a service-role key.
const rawUserSupabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_USER_KEY = isSupabasePublishableKey(rawUserSupabaseKey) ? rawUserSupabaseKey!.trim() : null;

let serverSupabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    serverSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (initErr) {
    console.error('Server Supabase client initialization failure:', initErr);
    serverSupabase = null;
  }
}

// Public server-rendered pages use the publishable/anon key so Supabase RLS
// remains the authority for published catalogue and approved public settings.
// Never use the server secret/service-role client to render visitor-facing HTML.
let publicSupabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_USER_KEY) {
  try {
    publicSupabase = createClient(SUPABASE_URL, SUPABASE_USER_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (initErr) {
    console.error('[Public SEO Supabase] Client initialization failure:', initErr);
    publicSupabase = null;
  }
}



export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Per-process fixed-window limiter. Sensitive writes also have database-side
 * atomic limits; this layer protects expensive HTTP routes before they reach
 * Supabase or third-party providers. Hostinger deployments are single-process
 * by default, but these counters intentionally remain an additional layer,
 * not the only protection for security-sensitive operations.
 */
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_BUCKET_CAPACITY = 50_000;

function rateLimit(maxRequests = 60, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Express req.ip is derived from the explicitly configured trusted proxy.
    // Never trust a raw client-supplied X-Forwarded-For value as a fallback.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();
    let bucket = rateLimitBuckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateLimitBuckets.set(key, bucket);
    } else if (bucket.count >= maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('RateLimit-Limit', String(maxRequests));
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('RateLimit-Reset', String(Math.max(0, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait before trying again.',
        retryAfter,
      });
    } else {
      bucket.count += 1;
      // Refresh insertion order so capacity eviction removes the least-recently-used key.
      rateLimitBuckets.delete(key);
      rateLimitBuckets.set(key, bucket);
    }

    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.max(0, Math.ceil((bucket.resetAt - now) / 1000))));

    if (rateLimitBuckets.size > RATE_LIMIT_BUCKET_CAPACITY) {
      for (const [entryKey, entry] of rateLimitBuckets) {
        if (now >= entry.resetAt || rateLimitBuckets.size > RATE_LIMIT_BUCKET_CAPACITY) {
          rateLimitBuckets.delete(entryKey);
        }
      }
    }

    next();
  };
}

// Periodically remove expired counters so unique client addresses cannot grow the map indefinitely.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitBuckets) {
    if (now >= value.resetAt) rateLimitBuckets.delete(key);
  }
}, 60_000).unref();

// Server-side JWT Bearer token authentication middleware.
// A supplied but invalid Bearer token is never silently downgraded to a guest request.
// Authorization roles come from the caller's live database profile, not cached JWT metadata.
async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return next();
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'A valid access token is required.' });
  }
  if (!serverSupabase) {
    return res.status(503).json({ success: false, error: 'Authentication verification is temporarily unavailable.' });
  }

  try {
    const { data: { user }, error } = await serverSupabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'The access token is invalid or expired. Please sign in again.' });
    }

    let role = 'customer';
    // Read the authoritative role from the caller's own profile using their verified JWT.
    // If the lookup is unavailable or the profile is missing, retain the least-privileged role.
    if (SUPABASE_URL && SUPABASE_USER_KEY) {
      const userScopedSupabase = createClient(SUPABASE_URL, SUPABASE_USER_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: profile, error: profileError } = await userScopedSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('Server auth profile-role lookup failed; applying customer permissions:', profileError.message);
      } else if (profile?.role && ['customer', 'staff', 'manager', 'admin', 'super_admin'].includes(profile.role)) {
        role = profile.role;
      }

      const { data: accessContext, error: accessError } = await userScopedSupabase.rpc('get_my_access_context');
      if (!accessError && Array.isArray(accessContext?.roles)) {
        const assignedRoles = accessContext.roles.filter((item: unknown): item is string => typeof item === 'string');
        if (assignedRoles.includes('super_admin')) role = 'super_admin';
        else if (assignedRoles.includes('admin')) role = 'admin';
      }
    }

    req.user = { id: user.id, email: user.email, role };
    return next();
  } catch (err) {
    console.error('Server auth verification unavailable:', err);
    return res.status(503).json({ success: false, error: 'Authentication verification is temporarily unavailable.' });
  }
}

// ------------------------------------------------------------------------------
// Middleware & Security Headers
// ------------------------------------------------------------------------------
// Preserve the exact request bytes for Resend Svix signature verification.
app.use('/api/webhooks/resend', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  // Exact-origin allowlist only. Credentialed cross-origin cookies are not used by this API.
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || value === '*') return false;
      try {
        const parsed = new URL(value);
        return parsed.origin === value &&
          (parsed.protocol === 'https:' || (!isProduction && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)));
      } catch {
        return false;
      }
    });
  const allowedOrigins = new Set([
    'https://awesomeadventure.tours',
    'https://www.awesomeadventure.tours',
    ...(!isProduction ? ['http://localhost:3000', 'http://localhost:5173'] : []),
    ...configuredOrigins,
  ]);
  const origin = req.headers.origin as string | undefined;
  res.vary('Origin');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

// Apply a conservative per-IP ceiling to every API route before route-specific limits.
app.use('/api', rateLimit(300, 60_000));

// Authenticate caller tokens for all API routes
app.use('/api', authenticateToken as any);

app.use(['/api/admin', '/api/communications'], (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) return next();
  const token = (req.headers.authorization || '').replace(/^Bearer\\s+/i, '').trim();
  const claims = token ? parseJwtPayload(token) : null;
  if (claims?.aal !== 'aal2') {
    return res.status(403).json({
      success: false,
      error: 'A verified authenticator code is required before administrator access.',
      code: 'ADMIN_AAL2_REQUIRED',
    });
  }
  return next();
});

// Sanitized API telemetry. Never persist request bodies, query strings, headers,
// access tokens, passwords, email contents or provider responses.
app.use('/api', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  const requestId = randomUUID();
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => {
    if (!serverSupabase) return;
    const routePath = req.route?.path
      ? `${req.baseUrl}${String(req.route.path)}`
      : req.path;
    if (routePath.startsWith('/api/admin/technical') || routePath === '/api/health') return;
    const durationMs = Math.max(0, Date.now() - startedAt);
    const severity = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info';
    void Promise.resolve(serverSupabase.from('technical_events').insert({
      severity,
      event_type: 'api_request',
      source: 'http',
      message: `API request completed with status ${res.statusCode}`,
      request_method: req.method,
      request_path: routePath,
      status_code: res.statusCode,
      duration_ms: durationMs,
      actor_user_id: req.user?.id || null,
      metadata: { request_id: requestId },
    })).catch(() => undefined);
  });
  next();
});

// Initialize Google Gen AI client with required User-Agent
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ------------------------------------------------------------------------------
// In-Memory Fallback Registries for Backend Validation
// ------------------------------------------------------------------------------
interface ServerInquiry {
  id: string;
  ticketNumber: string;
  name: string;
  email: string;
  phone?: string;
  inquiryType: string;
  message: string;
  createdAt: string;
}

interface ServerNewsletterSubscriber {
  email: string;
  subscribedAt: string;
  language: string;
}

const serverInquiries: ServerInquiry[] = [];
const serverNewsletters: ServerNewsletterSubscriber[] = [];

// Helper email validator
function normalizeSenderEmail(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  const mailbox = trimmed.match(/<\s*([^<>]+)\s*>/);
  return (mailbox ? mailbox[1] : trimmed).trim();
}

function isValidEmail(email: string): boolean {
  const normalized = normalizeSenderEmail(email);
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(normalized) && normalized.length <= 254;
}

// ------------------------------------------------------------------------------
// 1. AI Chatbot Endpoint
// ------------------------------------------------------------------------------
app.post('/api/chat', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  const { messages, prompt } = req.body || {};
  const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  const cleanMessages = Array.isArray(messages) ? messages : [];

  if ((prompt !== undefined && typeof prompt !== 'string') ||
      (messages !== undefined && (!Array.isArray(messages) || messages.length > 20)) ||
      cleanPrompt.length > 2_000 ||
      cleanMessages.some((message: any) =>
        !message || !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || message.content.length > 2_000
      )) {
    return res.status(400).json({ error: 'Invalid chat payload. Limit each message to 2,000 characters and each conversation to 20 messages.' });
  }

  if (!cleanPrompt && cleanMessages.length === 0) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // If Gemini API is available, invoke gemini-3.8-flash
  if (ai) {
    try {
      // Only user/assistant roles and bounded content are accepted from the browser.
      const conversationHistory = cleanMessages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // Append latest prompt if not already present
      if (cleanPrompt && (!cleanMessages.length || cleanMessages[cleanMessages.length - 1]?.content !== cleanPrompt)) {
        conversationHistory.push({
          role: 'user',
          parts: [{ text: cleanPrompt }],
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: conversationHistory,
        config: {
          systemInstruction: CONCIERGE_SYSTEM_PROMPT,
          temperature: 0.7,
        },
      });

      const responseText = response.text || '';

      // Match recommended tour objects from catalog
      const lower = responseText.toLowerCase();
      const matchedTours = TOUR_CATALOG_SUMMARY.filter((tour) => {
        return (
          lower.includes(tour.title.toLowerCase()) ||
          lower.includes(tour.slug) ||
          (lower.includes('orange bay') && tour.slug.includes('orange-bay')) ||
          (lower.includes('dolphin house') && tour.slug.includes('dolphin')) ||
          (lower.includes('paradise island') && tour.slug.includes('paradise')) ||
          (lower.includes('quad') && tour.slug.includes('safari')) ||
          (lower.includes('scuba diving') && tour.slug.includes('diving')) ||
          (lower.includes('speedboat') && tour.slug.includes('speedboat')) ||
          (lower.includes('luxor') && tour.slug.includes('luxor')) ||
          (lower.includes('cairo') && tour.slug.includes('cairo')) ||
          (lower.includes('submarine') && tour.slug.includes('submarine')) ||
          (lower.includes('sharm el naga') && tour.slug.includes('sharm-el-naga'))
        );
      }).slice(0, 3);

      return res.json({
        text: responseText,
        recommendedTours: matchedTours,
      });
    } catch (err: any) {
      console.warn('Gemini generateContent error in /api/chat:', err);
    }
  }

  // Graceful fallback if no API key or API call issue
  return res.status(503).json({
    error: 'Gemini service temporarily unavailable',
    fallback: true,
  });
});

// ------------------------------------------------------------------------------
// 2. Health & System Diagnostics Endpoint
// ------------------------------------------------------------------------------
app.get('/api/health', rateLimit(120, 60_000), (_req: Request, res: Response) => {
  // Public liveness response only. Do not disclose project identifiers, key types,
  // provider configuration, process memory, or deployment environment.
  res.json({
    status: 'ok',
    version: '2.4.0',
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------------------
// 2A. Server-side communications status and delivery endpoints
// Provider secrets are read only from Hostinger/server environment variables.
// Browser-supplied API keys are never accepted.
// ------------------------------------------------------------------------------
function requireCommunicationsStaff(req: AuthenticatedRequest, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Sign in with an authorized staff account to send communications.' });
    return false;
  }

  if (!['staff', 'manager', 'admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ success: false, error: 'Administrative or staff permissions are required.' });
    return false;
  }

  return true;
}

app.get('/api/communications/status', rateLimit(60, 60_000), (req: AuthenticatedRequest, res: Response) => {
  if (!requireCommunicationsStaff(req, res)) return;

  const normalizedFromEmail = normalizeSenderEmail(process.env.RESEND_FROM_EMAIL || '');
  const apiKeyPresent = Boolean(process.env.RESEND_API_KEY?.trim());
  const fromEmailValid = isValidEmail(normalizedFromEmail);
  const emailConfigured = apiKeyPresent && fromEmailValid;
  const whatsappConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim()
    && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    && /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_API_VERSION || '')
  );

  res.json({
    email: {
      configured: emailConfigured,
      provider: 'Resend',
      fromEmail: normalizedFromEmail,
      configurationIssue: !apiKeyPresent ? 'missing_api_key' : !fromEmailValid ? 'invalid_from_email' : null,
      fromName: process.env.RESEND_FROM_NAME?.trim() || 'Awesome Adventure Tours',
      webhookConfigured: (process.env.RESEND_WEBHOOK_SECRET?.trim() || '').startsWith('whsec_'),
      bookingWorkerEnabled: process.env.BOOKING_NOTIFICATION_WORKER_ENABLED?.trim().toLowerCase() === 'true',
    },
    whatsapp: {
      configured: whatsappConfigured,
      provider: 'Meta Cloud API',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || '',
      fromNumber: process.env.WHATSAPP_FROM_NUMBER?.trim() || '',
    },
  });
});

app.post('/api/communications/email', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireCommunicationsStaff(req, res)) return;

  const to = typeof req.body?.to === 'string' ? req.body.to.trim().toLowerCase() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const textBody = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

  if (!isValidEmail(to) || !subject || subject.length > 200 || !textBody || textBody.length > 20_000) {
    return res.status(400).json({ success: false, error: 'A valid recipient, subject (max 200 characters), and message (max 20,000 characters) are required.' });
  }

  // Persist an audit row before dispatch. Never send an app email that cannot be
  // recorded in the production communications history.
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Secure server-side database logging is unavailable. Email was not sent.' });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromEmail = normalizeSenderEmail(process.env.RESEND_FROM_EMAIL || '');
  const fromName = (process.env.RESEND_FROM_NAME || 'Awesome Adventure Tours').replace(/[<>\r\n]/g, '').trim() || 'Awesome Adventure Tours';
  const senderReady = Boolean(apiKey && isValidEmail(fromEmail));
  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string'
    && /^[a-zA-Z0-9._:-]{8,128}$/.test(req.headers['idempotency-key'])
    ? req.headers['idempotency-key']
    : randomUUID();

  const { data: audit, error: auditError } = await serverSupabase
    .from('communication_messages')
    .insert({
      channel: 'Email',
      recipient_address: to,
      subject,
      content: textBody,
      status: senderReady ? 'queued' : 'failed',
      provider_name: senderReady ? 'Resend' : 'Not configured',
      failure_reason: senderReady ? null : 'Resend is not configured: a valid RESEND_API_KEY and RESEND_FROM_EMAIL are required.',
      staff_name: req.user?.email || 'Staff Dispatcher',
    })
    .select('id')
    .single();

  if (auditError || !audit?.id) {
    console.error('Communication email audit insert failed:', auditError?.message || 'Missing audit ID');
    return res.status(503).json({ success: false, error: 'Email was not sent because its audit record could not be stored.' });
  }

  const markFailed = async (reason: string) => {
    const { error } = await serverSupabase!
      .from('communication_messages')
      .update({ status: 'failed', provider_name: senderReady ? 'Resend' : 'Not configured', failure_reason: reason })
      .eq('id', audit.id);
    if (error) console.error('Communication email failure audit update failed:', error.message);
  };

  if (!senderReady) {
    return res.status(503).json({ success: false, error: 'Server-side email delivery is not configured. Set RESEND_API_KEY and a valid RESEND_FROM_EMAIL in Hostinger environment variables.', messageLogId: audit.id });
  }

  try {
    const providerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        ...(isValidEmail(process.env.RESEND_REPLY_TO?.trim() || '') ? { reply_to: process.env.RESEND_REPLY_TO!.trim() } : {}),
        subject,
        text: textBody,
        html: renderBrandedEmailHtml({ heading: subject, preheader: subject, bodyText: textBody }),
        tags: [{ name: 'communication_id', value: String(audit.id) }],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const providerBody = await providerResponse.json().catch(() => ({} as any));
    if (!providerResponse.ok || typeof providerBody?.id !== 'string') {
      const providerError = typeof providerBody?.message === 'string'
        ? providerBody.message
        : `Email provider rejected the request (HTTP ${providerResponse.status}).`;
      await markFailed(providerError);
      return res.status(502).json({ success: false, error: providerError, messageLogId: audit.id });
    }

    const sentAt = new Date().toISOString();
    const { error: updateError } = await serverSupabase
      .from('communication_messages')
      .update({ provider_name: 'Resend', provider_message_id: providerBody.id, sent_at: sentAt, failure_reason: null })
      .eq('id', audit.id);
    if (updateError) console.error('Communication email provider details could not be saved:', updateError.message);
    const { error: statusError } = await serverSupabase
      .from('communication_messages')
      .update({ status: 'sent' })
      .eq('id', audit.id)
      .eq('status', 'queued');
    if (statusError) console.error('Communication email sent status could not be saved:', statusError.message);

    return res.status(200).json({
      success: true,
      providerName: 'Resend',
      providerMessageId: providerBody.id,
      messageLogId: audit.id,
      status: 'sent',
    });
  } catch (error: any) {
    const message = error?.name === 'TimeoutError'
      ? 'Email provider request timed out. Delivery could not be confirmed.'
      : 'Email provider request failed. Please retry after checking the server logs.';
    await markFailed(message);
    return res.status(502).json({ success: false, error: message, messageLogId: audit.id });
  }
});

app.post('/api/webhooks/resend', rateLimit(300, 60_000), async (req: Request, res: Response) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim() || '';
  if (!webhookSecret.startsWith('whsec_')) {
    return res.status(503).json({ success: false, error: 'Resend webhook verification is not configured.' });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const svixId = req.header('svix-id') || '';
  const svixTimestamp = req.header('svix-timestamp') || '';
  const svixSignature = req.header('svix-signature') || '';
  const timestamp = Number(svixTimestamp);

  if (!rawBody || !svixId || !svixTimestamp || !svixSignature ||
      !Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return res.status(400).json({ success: false, error: 'Invalid webhook headers or timestamp.' });
  }

  try {
    const secretBytes = Buffer.from(webhookSecret.slice('whsec_'.length), 'base64');
    const expected = createHmac('sha256', secretBytes).update(`${svixId}.${svixTimestamp}.${rawBody}`).digest();
    const signatureMatches = svixSignature.split(' ').some((entry) => {
      const [version, encoded] = entry.split(',');
      if (version !== 'v1' || !encoded) return false;
      const supplied = Buffer.from(encoded, 'base64');
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
    if (!signatureMatches) {
      return res.status(401).json({ success: false, error: 'Webhook signature verification failed.' });
    }
  } catch {
    return res.status(401).json({ success: false, error: 'Webhook signature verification failed.' });
  }

  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Secure webhook database storage is unavailable.' });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid webhook JSON.' });
  }

  const eventId = svixId.slice(0, 200);
  const eventType = typeof event?.type === 'string' ? event.type.slice(0, 100) : '';
  const data = event?.data && typeof event.data === 'object' ? event.data : {};
  if (!eventType || typeof data.email_id !== 'string') {
    return res.status(400).json({ success: false, error: 'Unsupported or incomplete Resend email event.' });
  }

  const recipients = Array.isArray(data.to) ? data.to.filter((value: unknown) => typeof value === 'string' && isValidEmail(value)).slice(0, 50) : [];
  const recipient = recipients[0]?.toLowerCase() || null;
  const occurredAt = typeof event.created_at === 'string' && !Number.isNaN(Date.parse(event.created_at))
    ? new Date(event.created_at).toISOString()
    : new Date().toISOString();

  const { error: eventInsertError } = await serverSupabase
    .from('email_provider_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      provider_message_id: String(data.email_id).slice(0, 200),
      recipient_address: recipient,
      occurred_at: occurredAt,
      payload: event,
    });

  if (eventInsertError && eventInsertError.code !== '23505') {
    console.error('Resend webhook event persistence failed:', eventInsertError.message);
    return res.status(503).json({ success: false, error: 'Webhook event could not be stored.' });
  }
  // A duplicate event still runs the idempotent message projection below. This
  // allows a provider retry to recover if the event row was saved but its
  // corresponding communications row could not be updated on the first attempt.

  const statusByEvent: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.opened': 'opened',
    'email.clicked': 'opened',
    'email.bounced': 'failed',
    'email.complained': 'failed',
    'email.failed': 'failed',
    'email.delivery_delayed': 'sent',
    'email.suppressed': 'failed',
  };
  const nextStatus = statusByEvent[eventType];
  if (nextStatus) {
    const failureReason = ['email.bounced', 'email.complained', 'email.failed', 'email.suppressed'].includes(eventType)
      ? `Resend event: ${eventType}`
      : null;
    const update: Record<string, unknown> = { status: nextStatus, provider_message_id: data.email_id, updated_at: new Date().toISOString() };
    if (nextStatus === 'delivered') update.delivered_at = occurredAt;
    if (nextStatus === 'opened') update.opened_at = occurredAt;
    if (failureReason) update.failure_reason = failureReason;
    const tagList = Array.isArray(data.tags) ? data.tags : [];
    const taggedCommunicationId = tagList.find((tag: any) => tag?.name === 'communication_id')?.value
      || (data.tags && typeof data.tags === 'object' && !Array.isArray(data.tags) ? data.tags.communication_id : null);
    const communicationId = typeof taggedCommunicationId === 'string' && /^[0-9a-f-]{36}$/i.test(taggedCommunicationId)
      ? taggedCommunicationId
      : null;
    let messageUpdateQuery = serverSupabase.from('communication_messages').update(update);
    messageUpdateQuery = communicationId
      ? messageUpdateQuery.eq('id', communicationId)
      : messageUpdateQuery.eq('provider_message_id', data.email_id);
    const { data: updatedMessages, error: messageUpdateError } = await messageUpdateQuery.select('id');
    if (messageUpdateError) {
      console.error('Resend webhook message status update failed:', messageUpdateError.message);
      return res.status(503).json({ success: false, error: 'Webhook was stored but the message status could not be updated.' });
    }

    // Supabase Auth and other Resend SMTP integrations do not originate from
    // our app dispatcher. Create an audit row so those emails also appear in
    // the same admin Communications History.
    if (!updatedMessages?.length) {
      const fallbackRecipient = recipient || 'unknown-recipient';
      const { error: externalLogError } = await serverSupabase
        .from('communication_messages')
        .insert({
          channel: 'Email',
          customer_name: fallbackRecipient,
          recipient_address: fallbackRecipient,
          subject: typeof data.subject === 'string' ? data.subject.slice(0, 500) : 'External email',
          content: `Email event ${eventType} received from Resend. Full provider payload is stored in email_provider_events.`,
          status: nextStatus,
          provider_name: 'Resend',
          provider_message_id: String(data.email_id).slice(0, 200),
          failure_reason: failureReason,
          sent_at: eventType === 'email.sent' ? occurredAt : null,
          delivered_at: eventType === 'email.delivered' ? occurredAt : null,
          opened_at: ['email.opened', 'email.clicked'].includes(eventType) ? occurredAt : null,
          staff_name: 'External Email Provider',
        });
      if (externalLogError && externalLogError.code !== '23505') {
        console.error('External Resend email audit insert failed:', externalLogError.message);
        return res.status(503).json({ success: false, error: 'Webhook was stored but its admin email record could not be created.' });
      }
    }
  }

  return res.status(200).json({ success: true, eventId, eventType });
});

app.post('/api/communications/whatsapp', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireCommunicationsStaff(req, res)) return;

  const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/[^0-9]/g, '') : '';
  const message = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

  if (phone.length < 8 || phone.length > 15 || !message || message.length > 4096) {
    return res.status(400).json({ success: false, error: 'A valid international phone number and message (max 4,096 characters) are required.' });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();

  if (!accessToken || !phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId) || !/^v\d+\.\d+$/.test(graphVersion || '')) {
    return res.status(503).json({ success: false, error: 'Server-side WhatsApp delivery is not configured. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_GRAPH_API_VERSION in Hostinger environment variables.' });
  }

  try {
    const providerResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { preview_url: false, body: message },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const providerBody = await providerResponse.json().catch(() => ({} as any));
    const providerMessageId = providerBody?.messages?.[0]?.id;
    if (!providerResponse.ok || typeof providerMessageId !== 'string') {
      const providerError = typeof providerBody?.error?.message === 'string'
        ? providerBody.error.message
        : `WhatsApp provider rejected the request (HTTP ${providerResponse.status}).`;
      return res.status(502).json({ success: false, error: providerError });
    }

    return res.status(200).json({
      success: true,
      providerName: 'Meta Cloud API',
      providerMessageId,
      status: 'sent',
    });
  } catch (error: any) {
    const message = error?.name === 'TimeoutError'
      ? 'WhatsApp provider request timed out. No delivery confirmation was received.'
      : 'WhatsApp provider request failed. Please retry after checking the server logs.';
    return res.status(502).json({ success: false, error: message });
  }
});

// ------------------------------------------------------------------------------
// 3. System Configuration Endpoint
// ------------------------------------------------------------------------------
app.get('/api/config', rateLimit(120, 60_000), (_req: Request, res: Response) => {
  res.json({
    brandName: 'Awesome Adventure Tours',
    hotline: '+20 151 5212741',
    whatsappUrl: 'https://wa.me/201515212741',
    operatingHours: '06:00 - 22:00 EET (Daily)',
    currencyDefault: 'EUR',
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'EGP'],
    supportedLanguages: ['en', 'de', 'ru', 'fr', 'ar', 'it', 'pl', 'nl'],
    depositRequired: false,
    cancellationFreeNoticeHours: 24,
  });
});

// ------------------------------------------------------------------------------
// 4. Tours Catalog Query API
// ------------------------------------------------------------------------------
// 4. Tours Catalog Query API (Truthful Supabase Retrieval)
// ------------------------------------------------------------------------------
app.get('/api/tours', rateLimit(120, 60_000), async (req: Request, res: Response) => {
  const { destination, category, search, limit } = req.query;
  const maxItems = Math.min(Math.max(1, parseInt(limit as string, 10) || 50), 100);

  if (!serverSupabase) {
    const tours = TOUR_CATALOG_SUMMARY.map((t) => ({
      id: t.slug,
      slug: t.slug,
      title: t.title,
      shortDescription: `${t.title} excursion in Red Sea`,
      destination: t.destination,
      category: t.category,
      categories: [t.category],
      priceEur: t.priceEur,
      durationLabel: t.durationLabel,
      durationHours: 7,
      rating: 4.8,
      reviewCount: 45,
      primaryImage: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
      badge: 'Popular',
    }));
    return res.json({
      success: true,
      count: tours.length,
      total: tours.length,
      tours,
    });
  }

  try {
    let query = serverSupabase
      .from('tours')
      .select(`
        id,
        title,
        slug,
        short_description,
        description,
        destination_id,
        duration,
        duration_type,
        duration_hours,
        tour_type,
        status,
        featured,
        price,
        child_price,
        infant_price,
        private_price,
        currency,
        max_guests,
        minimum_booking_notice_hours,
        pickup_available,
        pickup_info,
        cancellation_policy,
        departure_time,
        available_days,
        languages,
        difficulty,
        age_restrictions,
        badge,
        rating,
        review_count,
        sort_order,
        created_at,
        destinations (id, name, slug),
        tour_categories (categories (id, name, slug)),
        tour_images (id, image_url, is_primary, sort_order)
      `)
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .limit(maxItems);

    if (destination && typeof destination === 'string') {
      const cleanDest = destination.trim().replace(/[%_()]/g, '');
      if (cleanDest) {
        query = query.ilike('destination_id', `%${cleanDest}%`);
      }
    }

    if (search && typeof search === 'string') {
      const cleanSearch = search.trim().replace(/[%_()]/g, '');
      if (cleanSearch) {
        query = query.or(`title.ilike.%${cleanSearch}%,short_description.ilike.%${cleanSearch}%`);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('Supabase /api/tours query error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Database query failed when loading tour catalogue.',
        tours: [],
        count: 0,
        total: 0,
      });
    }

    const tours = (data || []).map((t: any) => {
      const primaryImg = t.tour_images?.find((img: any) => img.is_primary) || t.tour_images?.[0];
      const cats = t.tour_categories?.map((tc: any) => tc.categories?.name).filter(Boolean) || [];
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        shortDescription: t.short_description || '',
        destination: t.destinations?.name || 'Hurghada',
        category: cats[0] || 'Excursion',
        categories: cats,
        priceEur: Number(t.price) || 0,
        childPriceEur: t.child_price != null ? Number(t.child_price) : undefined,
        durationLabel: t.duration || `${t.duration_hours || 7} Hours`,
        durationHours: t.duration_hours || 7,
        rating: Number(t.rating) || 5.0,
        reviewCount: Number(t.review_count) || 0,
        primaryImage: primaryImg?.image_url || '',
        badge: t.badge || (t.featured ? 'Popular' : undefined),
      };
    });

    return res.json({
      success: true,
      count: tours.length,
      total: tours.length,
      tours,
    });
  } catch (err: any) {
    console.error('Unhandled exception in /api/tours:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing tour catalogue request.',
      tours: [],
      count: 0,
      total: 0,
    });
  }
});

// ------------------------------------------------------------------------------
// 5. Booking Creation & Authoritative Database Persistence
// ------------------------------------------------------------------------------
app.post('/api/bookings/create', rateLimit(10, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  const {
    tourSlug,
    date,
    guests,
    customer,
    pickupLocationId,
    hotelName,
    roomNumber,
    extras,
    paymentMethod = 'pay_at_pickup',
    specialRequests,
    couponCode,
  } = req.body || {};

  if (!serverSupabase || !SUPABASE_URL || !SUPABASE_USER_KEY) {
    return res.status(503).json({
      success: false,
      error: 'The reservation service is temporarily unavailable. Please try again later.',
    });
  }

  if (typeof tourSlug !== 'string' || !tourSlug.trim()) {
    return res.status(400).json({ success: false, error: 'A valid tour is required.' });
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: 'A valid excursion date (YYYY-MM-DD) is required.' });
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ success: false, error: 'The excursion date is invalid.' });
  }
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (date < todayUtc) {
    return res.status(400).json({ success: false, error: 'Selected excursion date cannot be in the past.' });
  }
  if (!customer || typeof customer.firstName !== 'string' || !customer.firstName.trim() ||
      typeof customer.lastName !== 'string' || !customer.lastName.trim() ||
      typeof customer.email !== 'string' || !isValidEmail(customer.email)) {
    return res.status(400).json({ success: false, error: 'Valid customer name and email are required.' });
  }

  const adults = guests?.adults;
  const children = guests?.children ?? 0;
  const infants = guests?.infants ?? 0;
  if (!Number.isInteger(adults) || adults < 1 || adults > 100 ||
      !Number.isInteger(children) || children < 0 || children > 100 ||
      !Number.isInteger(infants) || infants < 0 || infants > 50) {
    return res.status(400).json({ success: false, error: 'Passenger counts are outside the permitted ranges.' });
  }
  if (!['pay_at_pickup', 'pay_online'].includes(paymentMethod)) {
    return res.status(400).json({ success: false, error: 'Unsupported payment method.' });
  }
  if (extras !== undefined && !Array.isArray(extras)) {
    return res.status(400).json({ success: false, error: 'Invalid add-on selection.' });
  }

  const idempotencyKey = String(
    req.get('Idempotency-Key') || req.body?.idempotencyKey || ''
  ).trim();
  if (idempotencyKey.length < 16 || idempotencyKey.length > 200) {
    return res.status(400).json({ success: false, error: 'Invalid idempotency key.' });
  }

  try {
    // Use the verified caller JWT for the RPC when present so auth.uid() remains
    // the real customer identity. Guest checkout uses the configured public key.
    const authorization = req.get('Authorization');
    const requestClient = createClient(SUPABASE_URL, SUPABASE_USER_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: authorization ? { headers: { Authorization: authorization } } : undefined,
    });

    const { data, error } = await requestClient.rpc('create_booking_atomic', {
      p_tour_identifier: tourSlug.trim(),
      p_booking_date: date,
      p_adult_count: adults,
      p_child_count: children,
      p_infant_count: infants,
      p_customer_first_name: customer.firstName.trim(),
      p_customer_last_name: customer.lastName.trim(),
      p_customer_email: customer.email.trim().toLowerCase(),
      p_customer_phone: [customer.countryCode, customer.phoneNumber].filter(Boolean).join(' ').trim(),
      p_customer_country: customer.country || 'International',
      p_customer_hotel: hotelName || customer.hotelName || null,
      p_pickup_location_id: pickupLocationId || null,
      p_pickup_room_number: roomNumber || null,
      p_extras: (extras || []).map((item: any) => ({
        id: item.id || item.extraId || '',
        name: item.name || '',
        quantity: item.quantity ?? 1,
      })),
      p_coupon_code: typeof couponCode === 'string' && couponCode.trim() ? couponCode.trim() : null,
      p_payment_method: paymentMethod,
      p_special_requests: specialRequests || null,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      console.error('Atomic booking RPC failed:', error);
      return res.status(500).json({
        success: false,
        error: 'We could not complete the reservation. Please try again or contact our booking team.',
      });
    }

    const result = data as any;
    if (!result || result.success !== true || !result.bookingReference) {
      return res.status(400).json({
        success: false,
        error: result?.error || 'The reservation could not be validated.',
      });
    }

    const total = Number(result.totalEur || 0);
    return res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      bookingId: result.bookingId,
      bookingReference: result.bookingReference,
      idempotencyKey,
      tour: { slug: tourSlug.trim() },
      date,
      guests: { adults, children, infants, total: adults + children + infants },
      pricing: {
        totalEur: total,
        currency: 'EUR',
        formattedTotal: `€${total.toFixed(2)}`,
      },
      paymentMethod,
      status: result.status || 'pending',
      paymentStatus: result.paymentStatus || 'pending',
      isDuplicate: Boolean(result.isDuplicate),
    });
  } catch (err) {
    console.error('Unhandled exception during atomic booking creation:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while processing your reservation.',
    });
  }
});

// ------------------------------------------------------------------------------
// 6. Booking Lookup API (Supports POST body or GET query param)
// Rate limited to 10 requests / minute per IP to prevent reference enumeration and brute force.
// ------------------------------------------------------------------------------
app.all(['/api/bookings/lookup', '/api/booking/lookup'], rateLimit(10, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  const reference = (req.body?.reference || req.query?.ref || req.query?.reference) as string;
  const verification = String(
    req.body?.contactVerification ||
    req.body?.verification ||
    req.body?.emailOrPhone ||
    req.query?.verification ||
    req.query?.email ||
    req.query?.phone ||
    ''
  ).trim();

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ success: false, found: false, error: 'Booking reference is required.' });
  }

  const cleanRef = reference.trim().toUpperCase();
  if (!/^RST-\d{4}-[A-Z0-9]{4,32}$/.test(cleanRef)) {
    return res.status(400).json({ success: false, found: false, error: 'Invalid booking reference format.' });
  }

  if (!serverSupabase) {
    return res.status(503).json({ success: false, found: false, error: 'The reservation lookup service is temporarily unavailable.' });
  }

  const isStaff = Boolean(req.user && ['admin', 'super_admin', 'manager', 'staff'].includes(req.user.role));

  try {
    if (isStaff) {
      const { data, error } = await serverSupabase
        .from('bookings')
        .select('id, booking_reference, booking_date, status, payment_status, payment_method, subtotal, extras_total, discount, total, currency, special_requests, customers(*), tours(title, slug, primary_image, duration)')
        .eq('booking_reference', cleanRef)
        .maybeSingle();

      if (error) {
        console.error('Staff booking lookup failed:', error.message);
        return res.status(503).json({ success: false, found: false, error: 'The reservation lookup service is temporarily unavailable.' });
      }
      if (!data) {
        return res.status(404).json({ success: false, found: false, error: 'Booking not found or verification failed.' });
      }
      return res.json({ success: true, found: true, booking: data });
    }

    if (!verification || verification.length > 254) {
      return res.status(400).json({
        success: false,
        found: false,
        error: 'The email address or full phone number used during booking is required.',
      });
    }

    // Guest lookup has one verification path. Never query bookings directly as service_role
    // if this RPC fails or the supplied contact does not match.
    const { data: rpcResult, error: rpcError } = await serverSupabase.rpc('lookup_booking_secure', {
      p_reference: cleanRef,
      p_verification: verification,
    });

    if (rpcError) {
      console.error('Secure booking lookup RPC failed:', rpcError.message);
      if (rpcError.message?.toLowerCase().includes('too many')) {
        return res.status(429).json({ success: false, found: false, error: 'Too many verification attempts. Please wait before trying again.' });
      }
      return res.status(503).json({ success: false, found: false, error: 'The reservation lookup service is temporarily unavailable.' });
    }

    const rawBooking = rpcResult && typeof rpcResult === 'object' ? (rpcResult as any) : null;
    if (!rawBooking?.found || !rawBooking.bookingReference) {
      return res.status(404).json({ success: false, found: false, error: 'Booking not found or verification failed.' });
    }

    return res.json({
      success: true,
      found: true,
      booking: {
        bookingReference: rawBooking.bookingReference,
        status: rawBooking.status,
        paymentStatus: rawBooking.paymentStatus,
        paymentMethod: rawBooking.paymentMethod,
        bookingDate: rawBooking.bookingDate,
        createdAt: rawBooking.createdAt,
        guests: rawBooking.guests,
        tour: rawBooking.tour,
        pickup: rawBooking.pickup,
        pricing: rawBooking.pricing,
        customer: {
          firstName: rawBooking.customer?.firstName,
          lastName: rawBooking.customer?.lastName,
          emailMasked: rawBooking.customer?.emailMasked,
          phoneMasked: rawBooking.customer?.phoneMasked,
          country: rawBooking.customer?.country,
        },
        extras: rawBooking.extras,
        specialRequests: rawBooking.specialRequests,
      },
    });
  } catch (error) {
    console.error('Secure booking lookup exception:', error);
    return res.status(503).json({ success: false, found: false, error: 'The reservation lookup service is temporarily unavailable.' });
  }
});

// ------------------------------------------------------------------------------
// 6. Availability Check API (Supports POST or GET query)
// ------------------------------------------------------------------------------
app.all('/api/availability/check', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const tourSlug = String(req.body?.tourSlug || req.query?.tourSlug || req.query?.slug || '').trim();
  const date = String(req.body?.date || req.query?.date || '').trim();
  const adults = Number.parseInt(String(req.body?.adults || req.query?.adults || '1'), 10);
  const children = Number.parseInt(String(req.body?.children || req.query?.children || '0'), 10);

  if (!tourSlug || tourSlug.length > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      success: false,
      error: 'A valid tourSlug and date (YYYY-MM-DD) are required',
    });
  }

  const checkDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(checkDate.getTime()) || checkDate.toISOString().slice(0, 10) !== date) {
    return res.status(400).json({ success: false, error: 'The requested date is invalid.' });
  }

  if (!Number.isSafeInteger(adults) || adults < 1 || !Number.isSafeInteger(children) || children < 0 || adults + children > 100) {
    return res.status(400).json({ success: false, error: 'Guest counts are invalid.' });
  }

  const formatLocalDate = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const minimumNoticeHours = 12;
  const isPast = date < formatLocalDate(now);
  const noticeCutoff = new Date(now.getTime() + minimumNoticeHours * 60 * 60 * 1000);
  const noticeViolated = date < formatLocalDate(noticeCutoff);

  if (isPast || noticeViolated) {
    return res.json({
      success: true,
      tourSlug,
      date,
      isDateAvailable: false,
      isPastDate: isPast,
      isNoticeCutoffViolated: noticeViolated,
      minimumNoticeHours,
      remainingSeatsTotal: 0,
      slots: [],
      notes: isPast ? 'Cannot book past dates.' : 'The selected date does not meet the minimum booking notice.',
    });
  }

  // This legacy endpoint must use the same authoritative schedule as the
  // current booking flow. Missing schedules are unavailable; never fabricate
  // departure times or seat capacity.
  if (!publicSupabase) {
    return res.status(503).json({
      success: false,
      error: 'Live departure availability is temporarily unavailable.',
    });
  }

  try {
    const { data, error } = await publicSupabase.rpc('get_tour_availability_schedule', {
      p_tour_identifier: tourSlug,
      p_start_date: date,
      p_end_date: date,
    });

    if (error) {
      console.error('Authoritative availability lookup failed:', error);
      return res.status(503).json({
        success: false,
        error: 'Live departure availability is temporarily unavailable.',
      });
    }

    const slot = Array.isArray(data) ? data[0] : null;
    if (!slot) {
      return res.status(404).json({ success: false, error: 'Tour or scheduled date was not found.' });
    }

    const capacity = Math.max(0, Number(slot.max_capacity) || 0);
    const booked = Math.max(0, Number(slot.booked_count) || 0);
    const remaining = Math.max(0, Number(slot.remaining_capacity) || 0);
    const hasScheduledDeparture =
      slot.status === 'available' &&
      slot.is_available === true &&
      capacity > booked &&
      remaining > 0;
    const partyFits = remaining >= adults + children;
    const isDateAvailable = hasScheduledDeparture && partyFits;

    return res.json({
      success: true,
      tourSlug,
      date,
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][checkDate.getUTCDay()],
      isDateAvailable,
      isPastDate: false,
      isNoticeCutoffViolated: false,
      minimumNoticeHours,
      remainingSeatsTotal: remaining,
      maxGuestsPerGroup: capacity,
      slots: isDateAvailable
        ? [{
            slotId: `departure-${date}`,
            time: slot.departure_time || 'Scheduled departure',
            label: 'Scheduled departure',
            availableSeats: remaining,
            maxCapacity: capacity,
            status: 'available',
            privateAvailable: false,
          }]
        : [],
      notes: isDateAvailable
        ? undefined
        : hasScheduledDeparture
          ? 'The requested party size exceeds the remaining capacity.'
          : 'No confirmed departure is scheduled for this date.',
    });
  } catch (error) {
    console.error('Authoritative availability endpoint failed:', error);
    return res.status(503).json({
      success: false,
      error: 'Live departure availability is temporarily unavailable.',
    });
  }
});

// 7. Inquiries & Concierge Submissions API
// ------------------------------------------------------------------------------
async function sendInquiryNotificationEmail(params: {
  recipientEmail: string;
  customerName: string;
  subject: string;
  content: string;
  templateKey: string;
  replyTo?: string;
}): Promise<void> {
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    console.error('Inquiry email was not sent: secure communications audit database is unavailable.');
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromEmail = normalizeSenderEmail(process.env.RESEND_FROM_EMAIL || '');
  const fromName = (process.env.RESEND_FROM_NAME || 'Awesome Adventure Tours').replace(/[<>\r\n]/g, '').trim() || 'Awesome Adventure Tours';
  const configured = Boolean(apiKey && isValidEmail(fromEmail));
  const { data: log, error: logError } = await serverSupabase
    .from('communication_messages')
    .insert({
      channel: 'Email',
      customer_name: params.customerName,
      recipient_address: params.recipientEmail,
      template_key: params.templateKey,
      subject: params.subject,
      content: params.content,
      status: configured ? 'queued' : 'failed',
      provider_name: configured ? 'Resend' : 'Not configured',
      failure_reason: configured ? null : 'Resend is not configured: a valid RESEND_API_KEY and RESEND_FROM_EMAIL are required.',
      staff_name: 'Inquiry Notification Service',
    })
    .select('id')
    .single();

  if (logError || !log?.id) {
    console.error('Inquiry email audit insert failed:', logError?.message || 'Missing audit ID');
    return;
  }
  if (!configured) return;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `awesome-adventure-inquiry-${log.id}` },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [params.recipientEmail],
        ...(params.replyTo && isValidEmail(params.replyTo) ? { reply_to: params.replyTo } : {}),
        subject: params.subject,
        text: params.content,
        html: renderBrandedEmailHtml({ heading: params.subject, preheader: params.subject, bodyText: params.content }),
        tags: [{ name: 'communication_id', value: String(log.id) }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const providerBody = await response.json().catch(() => ({} as any));
    if (!response.ok || typeof providerBody?.id !== 'string') {
      throw new Error(typeof providerBody?.message === 'string' ? providerBody.message : `Resend rejected the request (HTTP ${response.status}).`);
    }
    const sentAt = new Date().toISOString();
    const { error } = await serverSupabase
      .from('communication_messages')
      .update({ provider_name: 'Resend', provider_message_id: providerBody.id, sent_at: sentAt, failure_reason: null })
      .eq('id', log.id);
    if (error) console.error('Inquiry email provider details update failed:', error.message);
    const { error: statusError } = await serverSupabase
      .from('communication_messages')
      .update({ status: 'sent' })
      .eq('id', log.id)
      .eq('status', 'queued');
    if (statusError) console.error('Inquiry email sent status update failed:', statusError.message);
  } catch (error: any) {
    const reason = error?.message || 'Resend inquiry email failed.';
    const { error: updateError } = await serverSupabase
      .from('communication_messages')
      .update({ status: 'failed', provider_name: 'Resend', failure_reason: reason })
      .eq('id', log.id);
    if (updateError) console.error('Inquiry email failure status update failed:', updateError.message);
    console.error('Inquiry email dispatch failed:', reason);
  }
}

app.post(['/api/inquiries', '/api/inquiries/submit', '/api/contact'], rateLimit(5, 10 * 60_000), async (req: Request, res: Response) => {
  const { name, email, phone, inquiryType = 'general_question', message, website_url_hp } = req.body;

  // Bot honeypot check
  if (website_url_hp && String(website_url_hp).trim() !== '') {
    return res.status(200).json({ success: true, status: 'received' });
  }

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      error: 'Name, valid email, and message are required',
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please enter a valid email address',
    });
  }

  const cleanName = String(name).trim().slice(0, 100);
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanMessage = String(message).trim().slice(0, 2000);
  const cleanPhone = phone ? String(phone).slice(0, 30) : null;
  const currentYear = new Date().getFullYear();
  const ticketNumber = `INQ-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}`;

  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from('inquiries')
        .insert({
          customer_name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          subject: inquiryType === 'general_question' ? 'General Excursion Question' : String(inquiryType),
          message: cleanMessage,
          status: 'new',
          source: 'web',
        })
        .select('id, created_at')
        .single();

      if (!error && data) {
        const inquirySubject = inquiryType === 'general_question' ? 'General Excursion Question' : String(inquiryType).slice(0, 120);
        const reservationEmail = process.env.BOOKING_NOTIFICATION_EMAIL?.trim() || 'reservation@awesomeadventure.tours';
        await Promise.all([
          sendInquiryNotificationEmail({
            recipientEmail: reservationEmail,
            customerName: cleanName,
            templateKey: 'inquiry_staff_notification',
            subject: `New website inquiry: ${inquirySubject}`,
            replyTo: cleanEmail,
            content: [
              'A new inquiry was submitted on Awesome Adventure Tours.',
              `Inquiry ID: ${data.id}`,
              `Name: ${cleanName}`,
              `Email: ${cleanEmail}`,
              `Phone: ${cleanPhone || 'Not provided'}`,
              `Subject: ${inquirySubject}`,
              '',
              'Message:',
              cleanMessage,
            ].join('\n'),
          }),
          sendInquiryNotificationEmail({
            recipientEmail: cleanEmail,
            customerName: cleanName,
            templateKey: 'inquiry_customer_confirmation',
            subject: 'We received your message — Awesome Adventure Tours',
            content: `Hello ${cleanName},\n\nThank you for contacting Awesome Adventure Tours. We have received your inquiry (reference ${data.id}) and our team will respond within 2 hours during Egypt Pier Desk hours.\n\nIf your question is urgent, you can contact our reservations team at reservation@awesomeadventure.tours.\n\nAwesome Adventure Tours`,
          }),
        ]);
        return res.status(201).json({
          success: true,
          inquiryId: data.id,
          ticketNumber,
          status: 'received',
          estimatedResponseTime: 'Within 2 hours (Egypt Pier Desk hours)',
          receivedAt: data.created_at,
        });
      }
      if (error) {
        console.error('Supabase inquiries insert error:', error.message);
      }
    } catch (dbErr) {
      console.warn('Supabase inquiries insert exception:', dbErr);
    }
  }

  return res.status(503).json({
    success: false,
    error: 'Inquiry service is currently unconfigured or database is unreachable.',
  });
});

// ------------------------------------------------------------------------------
// 8. Newsletter Subscription API
// ------------------------------------------------------------------------------
function createNewsletterUnsubscribeToken(subscriberId: string, email: string): string {
  const secret = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!secret) throw new Error('Newsletter unsubscribe signing is not configured.');
  const payload = Buffer.from(`${subscriberId}:${email}`).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyNewsletterUnsubscribeToken(token: string): { subscriberId: string; email: string } | null {
  const secret = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  const [payload, suppliedSignature] = token.split('.');
  if (!secret || !payload || !suppliedSignature) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(suppliedSignature, 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator <= 0) return null;
    const subscriberId = decoded.slice(0, separator);
    const email = decoded.slice(separator + 1).toLowerCase();
    if (!/^[0-9a-f-]{36}$/i.test(subscriberId) || !isValidEmail(email)) return null;
    return { subscriberId, email };
  } catch {
    return null;
  }
}

app.get('/api/newsletter/unsubscribe', rateLimit(30, 60_000), (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const verified = verifyNewsletterUnsubscribeToken(token);
  if (!verified || !serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(400).type('text').send('This unsubscribe link is invalid or expired. Please contact reservations for assistance.');
  }
  // GET requests only display confirmation. Mail-security scanners often prefetch links.
  const action = '/api/newsletter/unsubscribe?token=' + encodeURIComponent(token);
  return res.status(200).type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm unsubscribe</title><body style="font-family:Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#17212b"><h1>Unsubscribe from updates?</h1><p>Confirm below to stop newsletter and promotional emails from Awesome Adventure Tours.</p><form method="post" action="' + action + '"><button type="submit" style="background:#0a6c74;color:white;border:0;border-radius:8px;padding:12px 18px;font-weight:bold">Confirm unsubscribe</button></form><p><a href="https://awesomeadventure.tours/">Return to Awesome Adventure Tours</a></p></body></html>');
});

app.post('/api/newsletter/unsubscribe', rateLimit(20, 60_000), async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const verified = verifyNewsletterUnsubscribeToken(token);
  if (!verified || !serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(400).type('text').send('This unsubscribe link is invalid or expired. Please contact reservations for assistance.');
  }
  const { error } = await serverSupabase.from('newsletter_subscriptions')
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
    .eq('id', verified.subscriberId).eq('email', verified.email);
  if (error) {
    console.error('Newsletter unsubscribe update failed:', error.message);
    return res.status(503).type('text').send('We could not process your request right now. Please try again later.');
  }
  return res.status(200).type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><body style="font-family:Arial,sans-serif;max-width:560px;margin:12vh auto;padding:24px;color:#17212b"><h1>You have been unsubscribed</h1><p>You will no longer receive newsletter and promotional emails from Awesome Adventure Tours.</p><p>If this was a mistake, you can subscribe again from our website.</p><a href="https://awesomeadventure.tours/">Return to Awesome Adventure Tours</a></body></html>');
});

app.post(['/api/newsletter', '/api/newsletter/subscribe'], rateLimit(3, 10 * 60_000), async (req: Request, res: Response) => {
  const { email, preferredLanguage = 'en', website_url_hp, consentAccepted } = req.body || {};
  if (website_url_hp && String(website_url_hp).trim() !== '') {
    return res.json({ success: true, subscribed: true, message: 'Thank you for subscribing.' });
  }
  if (typeof email !== 'string' || !isValidEmail(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }
  if (consentAccepted !== true) {
    return res.status(400).json({ success: false, error: 'Please confirm that you agree to receive newsletter updates before subscribing.' });
  }
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Newsletter database service is not configured. Please try again later.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 80) || 'website' : 'website';
  let subscriber: { id: string; created_at: string; updated_at: string } | null = null;
  let shouldSendWelcome = false;

  try {
    const { data: existing, error: lookupError } = await serverSupabase
      .from('newsletter_subscriptions')
      .select('id,email,status,created_at,updated_at')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.status === 'subscribed') {
      return res.json({
        success: true,
        subscribed: true,
        alreadySubscribed: true,
        subscriberId: existing.id,
        createdAt: existing.created_at,
        discountCode: 'REDSEA15',
        emailStatus: 'not_sent',
        message: 'You are already subscribed. Your REDSEA15 voucher is ready.',
      });
    }

    if (existing) {
      const { data, error } = await serverSupabase
        .from('newsletter_subscriptions')
        .update({
          status: 'subscribed',
          source,
          discount_code: 'REDSEA15',
          metadata: { preferredLanguage: String(preferredLanguage || 'en').slice(0, 20), reSubscribedAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('id,created_at,updated_at')
        .single();
      if (error) throw error;
      subscriber = data;
    } else {
      const { data, error } = await serverSupabase
        .from('newsletter_subscriptions')
        .insert({
          email: cleanEmail,
          source,
          status: 'subscribed',
          discount_code: 'REDSEA15',
          metadata: { preferredLanguage: String(preferredLanguage || 'en').slice(0, 20), consentSource: source, consentedAt: new Date().toISOString() },
        })
        .select('id,created_at,updated_at')
        .single();
      if (error) {
        if (error.code === '23505') {
          return res.json({ success: true, subscribed: true, alreadySubscribed: true, discountCode: 'REDSEA15', emailStatus: 'not_sent', message: 'You are already subscribed. Your REDSEA15 voucher is ready.' });
        }
        throw error;
      }
      subscriber = data;
    }
    shouldSendWelcome = true;
  } catch (error: any) {
    console.error('Supabase newsletter persistence failed:', error?.message || error);
    return res.status(503).json({ success: false, error: 'We could not save your subscription. Please try again later.' });
  }

  if (!subscriber || !shouldSendWelcome) {
    return res.status(500).json({ success: false, error: 'Newsletter subscription could not be confirmed.' });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || '';
  const fromEmail = normalizeSenderEmail(process.env.RESEND_FROM_EMAIL || '');
  const fromName = (process.env.RESEND_FROM_NAME || 'Awesome Adventure Tours').replace(/[<>\r\n]/g, '').trim() || 'Awesome Adventure Tours';
  const unsubscribeToken = createNewsletterUnsubscribeToken(subscriber.id, cleanEmail);
  const unsubscribeUrl = `https://awesomeadventure.tours/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const { data: welcomeTemplate, error: welcomeTemplateError } = await serverSupabase
    .from('communication_templates')
    .select('subject,body_text,is_active')
    .eq('template_key', 'newsletter_welcome')
    .maybeSingle();
  if (welcomeTemplateError) {
    console.error('Newsletter welcome template lookup failed:', welcomeTemplateError.message);
  }
  const templateVariables: Record<string, string> = {
    discount_code: 'REDSEA15',
    unsubscribe_url: unsubscribeUrl,
  };
  const renderNewsletterTemplate = (value: string) => value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(templateVariables, key) ? templateVariables[key] : match
  );
  const subject = renderNewsletterTemplate(String(welcomeTemplate?.subject || 'Welcome to Awesome Adventure Tours — your 15% voucher'));
  const content = renderNewsletterTemplate(String(welcomeTemplate?.body_text || 'Thank you for subscribing to Awesome Adventure Tours. Your 15% voucher code is {{discount_code}}. Use it when enquiring about your next excursion.\n\nYou can unsubscribe at any time: {{unsubscribe_url}}.'));

  let emailStatus: 'sent' | 'failed' = 'failed';
  let providerMessageId: string | null = null;
  const providerReady = Boolean(apiKey && isValidEmail(fromEmail));
  const templateEnabled = welcomeTemplate?.is_active !== false;
  const senderReady = providerReady && templateEnabled;
  const failureReason = !templateEnabled ? 'Newsletter welcome template is disabled.' : providerReady ? null : 'Resend is not configured: a valid RESEND_API_KEY and RESEND_FROM_EMAIL are required in Hostinger.';

  const { data: messageLog, error: logInsertError } = await serverSupabase
    .from('communication_messages')
    .insert({
      channel: 'Email',
      customer_name: cleanEmail,
      recipient_address: cleanEmail,
      template_key: 'newsletter_welcome',
      subject,
      content,
      status: senderReady ? 'queued' : 'failed',
      provider_name: providerReady ? 'Resend' : 'Not configured',
      failure_reason: failureReason,
      staff_name: 'Newsletter Subscription Service',
    })
    .select('id')
    .single();

  if (logInsertError || !messageLog?.id) {
    console.error('Newsletter email audit record could not be created:', logInsertError?.message || 'Missing log ID');
    return res.json({
      success: true,
      subscribed: true,
      subscriberId: subscriber.id,
      createdAt: subscriber.created_at,
      discountCode: 'REDSEA15',
      emailStatus: 'failed',
      message: 'Your subscription was saved, but we could not record the welcome email. Please contact reservations for your voucher.',
    });
  }

  if (senderReady) {
    try {
      const providerResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `awesome-adventure-newsletter-welcome-${subscriber.id}-${new Date(subscriber.updated_at).getTime()}`,
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [cleanEmail],
          ...(isValidEmail(process.env.RESEND_REPLY_TO?.trim() || '') ? { reply_to: process.env.RESEND_REPLY_TO!.trim() } : {}),
          subject,
          text: content,
          tags: [{ name: 'communication_id', value: String(messageLog.id) }],
          html: renderBrandedEmailHtml({ heading: 'Welcome aboard!', preheader: subject, bodyText: content, footerNote: 'You received this email because you subscribed to Awesome Adventure Tours. Use the unsubscribe link above if you no longer want updates.' }),
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const providerBody = await providerResponse.json().catch(() => ({} as any));
      if (!providerResponse.ok || typeof providerBody?.id !== 'string') {
        throw new Error(typeof providerBody?.message === 'string' ? providerBody.message : `Resend rejected the request (HTTP ${providerResponse.status}).`);
      }
      providerMessageId = providerBody.id;
      emailStatus = 'sent';
      const sentAt = new Date().toISOString();
      const { error: updateError } = await serverSupabase
        .from('communication_messages')
        .update({ provider_name: 'Resend', provider_message_id: providerMessageId, sent_at: sentAt, failure_reason: null })
        .eq('id', messageLog.id);
      if (updateError) console.error('Newsletter email provider details update failed:', updateError.message);
      const { error: statusError } = await serverSupabase
        .from('communication_messages')
        .update({ status: 'sent' })
        .eq('id', messageLog.id)
        .eq('status', 'queued');
      if (statusError) console.error('Newsletter email audit status update failed:', statusError.message);
    } catch (error: any) {
      const reason = error?.message || 'Resend email delivery failed.';
      const { error: updateError } = await serverSupabase
        .from('communication_messages')
        .update({ status: 'failed', provider_name: 'Resend', failure_reason: reason })
        .eq('id', messageLog.id);
      if (updateError) console.error('Newsletter email failure could not be recorded:', updateError.message);
      console.error('Newsletter welcome email failed:', reason);
    }
  }

  return res.json({
    success: true,
    subscribed: true,
    subscriberId: subscriber.id,
    createdAt: subscriber.created_at,
    discountCode: 'REDSEA15',
    emailStatus,
    message: emailStatus === 'sent'
      ? 'You are subscribed! Your REDSEA15 voucher has been sent to your email.'
      : 'Your subscription is saved, but the welcome email could not be sent yet. Please contact reservations for your voucher.',
  });
});

// 8.5. Super Admin account lifecycle API
// All privileged Auth Admin calls stay server-side and require a verified AAL2
// Super Admin session. No service-role credential is sent to the browser.
// ------------------------------------------------------------------------------
function requireSuperAdminAal2(req: AuthenticatedRequest, res: Response): boolean {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const claims = token ? parseJwtPayload(token) : null;
  if (!req.user || req.user.role !== 'super_admin') {
    res.status(403).json({ success: false, error: 'Super Admin access is required.' });
    return false;
  }
  if (claims?.aal !== 'aal2') {
    res.status(403).json({ success: false, error: 'A verified AAL2 multi-factor session is required for account administration.' });
    return false;
  }
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    res.status(503).json({ success: false, error: 'Secure Auth Admin service is not configured. Configure a server-only Supabase secret/service-role key.' });
    return false;
  }
  return true;
}

// Superadmin Technical Control Center APIs. Every request requires a live
// database-backed super_admin role and a verified AAL2 session.
app.get('/api/admin/technical/overview', rateLimit(30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Technical diagnostics require the server-side Supabase secret.' });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dbStartedAt = Date.now();
  try {
    const requestCount = await serverSupabase.from('technical_events').select('id', { count: 'exact', head: true }).gte('created_at', since);
    const dbLatencyMs = Date.now() - dbStartedAt;
    if (requestCount.error) throw requestCount.error;
    const [
      errorCount, warningCount, latencyRows, recentRows, auditRows, bucketResult,
    ] = await Promise.all([
      serverSupabase.from('technical_events').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('severity', 'error'),
      serverSupabase.from('technical_events').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('severity', 'warning'),
      serverSupabase.from('technical_events').select('duration_ms,status_code').gte('created_at', since).not('duration_ms', 'is', null).order('created_at', { ascending: false }).limit(5000),
      serverSupabase.from('technical_events').select('id,created_at,severity,event_type,source,message,request_method,request_path,status_code,duration_ms,actor_user_id,metadata').order('created_at', { ascending: false }).limit(100),
      serverSupabase.from('audit_logs').select('id,created_at,action,entity_type,entity_id,user_id').order('created_at', { ascending: false }).limit(100),
      serverSupabase.storage.listBuckets(),
    ]);

    const queryError = errorCount.error || warningCount.error || latencyRows.error || recentRows.error || auditRows.error;
    if (queryError) throw queryError;

    const durations = (latencyRows.data || []).map((row: any) => Number(row.duration_ms)).filter((value: number) => Number.isFinite(value)).sort((a: number, b: number) => a - b);
    const totalRequests = requestCount.count || 0;
    const totalErrors = errorCount.count || 0;
    const totalWarnings = warningCount.count || 0;
    const averageLatencyMs = durations.length ? Math.round(durations.reduce((sum: number, value: number) => sum + value, 0) / durations.length) : null;
    const p95LatencyMs = durations.length ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)] : null;
    const normalizedFromEmail = normalizeSenderEmail(process.env.RESEND_FROM_EMAIL || '');
    const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && isValidEmail(normalizedFromEmail));
    const whatsappConfigured = Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() && /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_API_VERSION || ''));

    return res.json({
      generatedAt: new Date().toISOString(),
      runtime: {
        status: 'ok',
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'unknown',
        uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
        appVersion: process.env.npm_package_version || 'unknown',
      },
      services: {
        database: { status: 'ok', latencyMs: dbLatencyMs },
        storage: { status: bucketResult.error ? 'error' : 'ok', bucketCount: bucketResult.error ? null : (bucketResult.data || []).length },
        email: { configured: emailConfigured, webhookConfigured: (process.env.RESEND_WEBHOOK_SECRET || '').startsWith('whsec_') },
        whatsapp: { configured: whatsappConfigured },
        bookingWorker: { enabled: process.env.BOOKING_NOTIFICATION_WORKER_ENABLED?.trim().toLowerCase() === 'true' },
      },
      metrics: {
        requests24h: totalRequests,
        errors24h: totalErrors,
        warnings24h: totalWarnings,
        errorRatePct: totalRequests ? Number(((totalErrors / totalRequests) * 100).toFixed(2)) : 0,
        averageLatencyMs,
        p95LatencyMs,
        latencySampleSize: durations.length,
      },
      recentEvents: recentRows.data || [],
      recentAuditEvents: auditRows.data || [],
    });
  } catch (error) {
    console.error('[Technical Control Center] Overview query failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Technical diagnostics are temporarily unavailable. Check the telemetry migration and server database connection.' });
  }
});

app.get('/api/admin/technical/audit-logs', rateLimit(60, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Audit history is unavailable.' });
  const requestedLimit = Number.parseInt(String(req.query.limit || '200'), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(500, Math.max(1, requestedLimit)) : 200;
  try {
    let query = serverSupabase.from('audit_logs')
      .select('id,created_at,action,entity_type,entity_id,user_id,old_data,new_data')
      .order('created_at', { ascending: false }).limit(limit);
    if (typeof req.query.action === 'string' && /^[A-Z0-9_]{1,100}$/.test(req.query.action)) query = query.eq('action', req.query.action);
    if (typeof req.query.entity_type === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(req.query.entity_type)) query = query.eq('entity_type', req.query.entity_type);
    if (typeof req.query.entity_id === 'string' && req.query.entity_id.length <= 120) query = query.eq('entity_id', req.query.entity_id);
    if (typeof req.query.user_id === 'string' && UUID_PATTERN.test(req.query.user_id)) query = query.eq('user_id', req.query.user_id);
    const fromDate = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const toDate = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    if (fromDate && Number.isFinite(fromDate.getTime())) query = query.gte('created_at', fromDate.toISOString());
    if (toDate && Number.isFinite(toDate.getTime())) query = query.lte('created_at', toDate.toISOString());
    const { data, error } = await query;
    if (error) throw error;
    const privateKey = /(email|phone|whatsapp|address|name|message|description|body|content|subject|notes?|password|token|secret|api.?key|authorization|headers|payload|metadata|user.?agent|cookies?|room|hotel|special.?requests?|contact|recipient|sender|customer|guest|user.?id|payment.?details?|card|cvv|ssn|passport|document|birth|dob|attachment|avatar|settings|config|form.?data|custom.?data|preferences|value|text|comment|question|answer|reason|details?|context|input|output|form|fields|actor.?id|profile.?id|visitor.?id|session.?id|ip_address|(^ip$|_ip$|^ip_))/i;
    const safeSnapshot = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key, item]) => {
        if (privateKey.test(key) || (item !== null && !['string','number','boolean'].includes(typeof item))) return false;
        if (typeof item === 'string' && (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(item) || /\+?\d[\d\s().-]{7,}\d/.test(item))) return false;
        return true;
      }).map(([key, item]) => [key, typeof item === 'string' ? item.slice(0, 160) : item]));
    };
    return res.json({ records: (data || []).map((record: any) => ({ ...record, old_data: safeSnapshot(record.old_data), new_data: safeSnapshot(record.new_data) })) });
  } catch (error) {
    console.error('[Technical Control Center] Audit log query failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Audit history is temporarily unavailable.' });
  }
});

app.get('/api/admin/technical/events', rateLimit(60, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Technical diagnostics require the server-side Supabase secret.' });
  }
  const requestedLimit = Number.parseInt(String(req.query.limit || '100'), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 100;
  const severity = String(req.query.severity || '');
  if (severity && !['info', 'warning', 'error'].includes(severity)) {
    return res.status(400).json({ success: false, error: 'Invalid severity filter.' });
  }
  try {
    let query = serverSupabase.from('technical_events')
      .select('id,created_at,severity,event_type,source,message,request_method,request_path,status_code,duration_ms,actor_user_id,metadata')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (severity) query = query.eq('severity', severity);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ events: data || [] });
  } catch (error) {
    console.error('[Technical Control Center] Event query failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Technical event log is temporarily unavailable.' });
  }
});


const VISITOR_EVENT_NAMES = new Set([
  'page_view','page_exit','navigation','tour_view','search',
  'booking_started','booking_step_completed','booking_submitted',
  'booking_confirmed','booking_cancelled','custom',
    'auth_sign_in',
    'auth_sign_in_failed',
    'auth_sign_up',
    'auth_sign_out',
    'password_reset_requested',
    'password_changed',
    'profile_updated',
    'inquiry_submitted',
    'newsletter_subscribed',
    'booking_lookup',
    'booking_cancellation_requested',
    'support_ticket_created',
    'support_reply_sent',
    'support_ticket_updated',
    'tour_search',
    'tour_filter_applied',
    'wishlist_updated',
    'comparison_updated',
    'chatbot_interaction',
    'contact_request_submitted',
    'booking_step_viewed',
    'review_submitted',
    'tour_shared',
    'language_changed',
    'currency_changed',
    'confirmation_email_resent',
    'email_confirmed',
    'mfa_verified',
]);
const VISITOR_EVENT_FIELDS = new Set([
  'tour_slug','category','destination','booking_step','result_count',
  'currency','sort_order','filter_count','form_name','interaction',
  'action','outcome','channel','role','source','ticket_category','priority','status','auth_method','search_type','language',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApproximateVisitorLocation = {
  country_code: string | null; country_name: string | null;
  region_code: string | null; region_name: string | null;
  city: string | null; location_source: 'ip_approximate';
};
const visitorGeoCache = new Map<string, { expiresAt: number; value: ApproximateVisitorLocation | null }>();

function isPrivateOrReservedIp(value: string, family: number): boolean {
  const ip = value.toLowerCase();
  if (family === 4) {
    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b, c] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113);
  }
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    return isPrivateOrReservedIp(mapped, isIP(mapped));
  }
  return ip === '::' || ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') ||
    ip.startsWith('fe80:') || ip.startsWith('ff') || ip.startsWith('2001:db8:');
}

/** Approximate GeoIP lookup only after analytics consent; never persists the raw IP. */
async function lookupApproximateVisitorLocation(rawIp?: string | null): Promise<ApproximateVisitorLocation | null> {
  const suppliedIp = (rawIp || '').trim();
  const ip = suppliedIp.toLowerCase().startsWith('::ffff:') ? suppliedIp.slice(7) : suppliedIp;
  const family = isIP(ip);
  if (!family || isPrivateOrReservedIp(ip, family)) return null;
  const cacheKey = createHash('sha256').update(ip).digest('hex');
  const cached = visitorGeoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) visitorGeoCache.delete(cacheKey);

  let value: ApproximateVisitorLocation | null = null;
  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,region_code,city`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      const body: any = await response.json().catch(() => null);
      if (body?.success === true) {
        const countryCode = typeof body.country_code === 'string' && /^[A-Z]{2}$/.test(body.country_code) ? body.country_code : null;
        const regionCode = safeShortText(body.region_code, 24);
        const countryName = safeShortText(body.country, 80);
        const regionName = safeShortText(body.region, 80);
        const city = safeShortText(body.city, 80);
        if (countryCode || countryName || regionName || city) {
          value = { country_code: countryCode, country_name: countryName, region_code: regionCode, region_name: regionName, city, location_source: 'ip_approximate' };
        }
      }
    }
  } catch {
    // Geolocation is best-effort and must never delay or block booking/consent.
  }
  visitorGeoCache.set(cacheKey, { expiresAt: Date.now() + (value ? 6 : 1) * 60 * 60 * 1000, value });
  if (visitorGeoCache.size > 2500) {
    const oldestKey = visitorGeoCache.keys().next().value;
    if (oldestKey) visitorGeoCache.delete(oldestKey);
  }
  return value;
}

function safeShortText(value: unknown, max = 120): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
  return cleaned || null;
}

function safePagePath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  // Store route paths only; never retain query parameters, fragments, or submitted form values.
  return value.split(/[?#]/, 1)[0].replace(/[\u0000-\u001f]/g, '').slice(0, 512) || '/';
}

function safeVisitorMetadata(value: any) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const device = ['desktop','mobile','tablet','other'].includes(source.device_type) ? source.device_type : null;
  const screen = typeof source.screen_bucket === 'string' && /^(small|medium|large|xlarge)$/.test(source.screen_bucket) ? source.screen_bucket : null;
  const localeCandidate = safeShortText(source.locale, 35);
  const locale = localeCandidate && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(localeCandidate) ? localeCandidate : null;
  const languagePreferences = Array.isArray(source.language_preferences)
    ? Array.from(new Set(source.language_preferences.slice(0, 8).filter((item: unknown): item is string =>
        typeof item === 'string' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(item)
      ))).slice(0, 8)
    : [];
  const platformFamily = ['Windows','macOS','Linux','Android','iOS','ChromeOS','Other'].includes(source.platform_family) ? source.platform_family : null;
  const viewportBucket = ['compact','standard','wide'].includes(source.viewport_bucket) ? source.viewport_bucket : null;
  const safeCampaignValue = (input: unknown, max: number) => {
    const candidate = safeShortText(input, max);
    if (!candidate || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(candidate) || /\+?\d[\d\s().-]{7,}\d/.test(candidate)) return null;
    return candidate;
  };
  return {
    device_type: device,
    browser_family: safeShortText(source.browser_family, 40),
    os_family: safeShortText(source.os_family, 40),
    screen_bucket: screen,
    language: safeShortText(source.language, 24),
    locale,
    language_preferences: languagePreferences,
    platform_family: platformFamily,
    is_mobile: typeof source.is_mobile === 'boolean' ? source.is_mobile : null,
    viewport_bucket: viewportBucket,
    timezone: safeShortText(source.timezone, 64),
    country_code: null,
    country_name: null,
    region_code: null,
    region_name: null,
    city: null,
    location_source: null,
    referrer_host: safeShortText(source.referrer_host, 120),
    utm_source: safeCampaignValue(source.utm_source, 100),
    utm_medium: safeCampaignValue(source.utm_medium, 100),
    utm_campaign: safeCampaignValue(source.utm_campaign, 120),
    utm_term: safeCampaignValue(source.utm_term, 120),
    utm_content: safeCampaignValue(source.utm_content, 120),
  };
}

function safeVisitorEventData(value: any): Record<string, string | number | boolean> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result: Record<string, string | number | boolean> = {};
  for (const key of Object.keys(source)) {
    if (!VISITOR_EVENT_FIELDS.has(key)) continue;
    const item = source[key];
    if (typeof item === 'string') {
      const safe = safeShortText(item, 120);
      if (safe) result[key] = safe;
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      result[key] = Math.max(-1_000_000, Math.min(1_000_000, item));
    } else if (typeof item === 'boolean') {
      result[key] = item;
    }
  }
  return result;
}

// Public ingestion accepts only explicit consent choices and allowlisted event fields.
// It deliberately does not record IP addresses, raw cookies, full user-agent strings,
// URL query strings, form contents, authentication tokens, or payment information.
app.post('/api/visitor/consent', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Privacy settings are temporarily unavailable.' });
  }
  const analytics = req.body?.analytics === true;
  const marketing = req.body?.marketing === true;
  const sessionId = typeof req.body?.session_id === 'string' && UUID_PATTERN.test(req.body.session_id) ? req.body.session_id : null;
  const visitorId = typeof req.body?.visitor_id === 'string' && UUID_PATTERN.test(req.body.visitor_id) ? req.body.visitor_id : null;
  const metadata = safeVisitorMetadata(req.body?.metadata);
  try {
    const location = analytics && sessionId && visitorId ? await lookupApproximateVisitorLocation(req.ip || null) : null;
    const sessionMetadata = { ...metadata, ...(location || {}) };
    if (analytics && sessionId && visitorId) {
      const now = new Date().toISOString();
      const { error: sessionError } = await serverSupabase.from('visitor_sessions').upsert({
        id: sessionId,
        visitor_id: visitorId,
        user_id: req.user?.id || null,
        started_at: now,
        last_seen_at: now,
        landing_path: safePagePath(req.body?.landing_path),
        ...sessionMetadata,
        analytics_consent: true,
        marketing_consent: marketing,
        consent_updated_at: now,
      }, { onConflict: 'id', ignoreDuplicates: true });
      if (sessionError) throw sessionError;
      const { error: updateError } = await serverSupabase.from('visitor_sessions').update({
        user_id: req.user?.id || null,
        last_seen_at: now,
        ...sessionMetadata,
        analytics_consent: true,
        marketing_consent: marketing,
        consent_updated_at: now,
      }).eq('id', sessionId);
      if (updateError) throw updateError;
    } else if (sessionId) {
      await serverSupabase.from('visitor_sessions').update({
        analytics_consent: false,
        marketing_consent: false,
        ended_at: new Date().toISOString(),
        consent_updated_at: new Date().toISOString(),
      }).eq('id', sessionId);
    }
    if (req.body?.source === 'session_restore') return res.status(200).json({ success: true, restored: true });
    const { error } = await serverSupabase.from('visitor_consent_records').insert({
      visitor_session_id: sessionId,
      visitor_id: analytics ? visitorId : null,
      user_id: req.user?.id || null,
      necessary: true,
      analytics,
      marketing,
      consent_version: '1',
      consent_source: ['cookie_banner','privacy_settings','account_settings'].includes(req.body?.source) ? req.body.source : 'cookie_banner',
    });
    if (error) throw error;
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('[Visitor privacy] Consent record failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Your privacy choice could not be saved to our records. Your browser choice remains active on this device.' });
  }
});

app.post('/api/visitor/events', rateLimit(90, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Visitor analytics are temporarily unavailable.' });
  }
  const sessionId = typeof req.body?.session_id === 'string' && UUID_PATTERN.test(req.body.session_id) ? req.body.session_id : null;
  const eventName = typeof req.body?.event_name === 'string' ? req.body.event_name : '';
  if (!sessionId || !VISITOR_EVENT_NAMES.has(eventName)) {
    return res.status(400).json({ success: false, error: 'Invalid visitor event.' });
  }
  try {
    const { data: session, error: sessionError } = await serverSupabase
      .from('visitor_sessions').select('id,analytics_consent').eq('id', sessionId).maybeSingle();
    if (sessionError) throw sessionError;
    if (!session?.analytics_consent) return res.status(204).end();
    const duration = Number(req.body?.duration_ms);
    const { error } = await serverSupabase.from('visitor_events').insert({
      session_id: sessionId,
      user_id: req.user?.id || null,
      event_name: eventName,
      page_path: safePagePath(req.body?.page_path),
      page_title: safeShortText(req.body?.page_title, 160),
      duration_ms: Number.isFinite(duration) ? Math.max(0, Math.min(86_400_000, Math.round(duration))) : null,
      event_data: safeVisitorEventData(req.body?.event_data),
    });
    if (error) throw error;
    await serverSupabase.from('visitor_sessions').update({
      last_seen_at: new Date().toISOString(),
      user_id: req.user?.id || null,
    }).eq('id', sessionId);
    return res.status(202).json({ success: true });
  } catch (error) {
    console.error('[Visitor analytics] Event ingestion failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Visitor activity could not be recorded.' });
  }
});

// Superadmin-only visitor analytics. All reads use the existing verified AAL2 guard.
app.get('/api/admin/technical/visitors/overview', rateLimit(30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Visitor analytics are unavailable.' });
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { data, error } = await serverSupabase.rpc('get_visitor_analytics_overview', { p_since: since });
    if (error) throw error;
    return res.json(data || {});
  } catch (error) {
    console.error('[Visitor analytics] Overview failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Visitor analytics summary is temporarily unavailable.' });
  }
});

app.get('/api/admin/technical/visitors/events', rateLimit(60, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Visitor analytics are unavailable.' });
  const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '200'), 10) || 200));
  try {
    let query = serverSupabase.from('visitor_events')
      .select('id,occurred_at,session_id,user_id,event_name,page_path,page_title,duration_ms,event_data')
      .order('occurred_at', { ascending: false }).limit(limit);
    if (typeof req.query.event_name === 'string' && VISITOR_EVENT_NAMES.has(req.query.event_name)) query = query.eq('event_name', req.query.event_name);
    if (typeof req.query.session_id === 'string' && UUID_PATTERN.test(req.query.session_id)) query = query.eq('session_id', req.query.session_id);
    if (typeof req.query.user_id === 'string' && UUID_PATTERN.test(req.query.user_id)) query = query.eq('user_id', req.query.user_id);
    if (typeof req.query.page_path === 'string' && req.query.page_path.startsWith('/')) query = query.eq('page_path', safePagePath(req.query.page_path));
    const fromDate = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const toDate = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    if (fromDate && Number.isFinite(fromDate.getTime())) query = query.gte('occurred_at', fromDate.toISOString());
    if (toDate && Number.isFinite(toDate.getTime())) query = query.lte('occurred_at', toDate.toISOString());
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ events: data || [] });
  } catch (error) {
    console.error('[Visitor analytics] Events query failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Visitor activity is temporarily unavailable.' });
  }
});

app.get('/api/admin/technical/visitors/sessions', rateLimit(60, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Visitor analytics are unavailable.' });
  const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '150'), 10) || 150));
  try {
    let query = serverSupabase.from('visitor_sessions')
      .select('id,visitor_id,user_id,started_at,last_seen_at,ended_at,landing_path,referrer_host,utm_source,utm_medium,utm_campaign,utm_term,utm_content,device_type,browser_family,os_family,screen_bucket,language,locale,language_preferences,platform_family,is_mobile,viewport_bucket,timezone,country_code,country_name,region_code,region_name,city,location_source,analytics_consent,marketing_consent')
      .order('last_seen_at', { ascending: false }).limit(limit);
    if (typeof req.query.search === 'string' && UUID_PATTERN.test(req.query.search)) query = query.or(`id.eq.${req.query.search},visitor_id.eq.${req.query.search},user_id.eq.${req.query.search}`);
    if (typeof req.query.device_type === 'string' && ['desktop','mobile','tablet','other'].includes(req.query.device_type)) query = query.eq('device_type', req.query.device_type);
    if (typeof req.query.user_id === 'string' && UUID_PATTERN.test(req.query.user_id)) query = query.eq('user_id', req.query.user_id);
    if (typeof req.query.page_path === 'string' && req.query.page_path.startsWith('/')) query = query.eq('landing_path', safePagePath(req.query.page_path));
    const fromDate = typeof req.query.from === 'string' ? new Date(req.query.from) : null;
    const toDate = typeof req.query.to === 'string' ? new Date(req.query.to) : null;
    if (fromDate && Number.isFinite(fromDate.getTime())) query = query.gte('started_at', fromDate.toISOString());
    if (toDate && Number.isFinite(toDate.getTime())) query = query.lte('last_seen_at', toDate.toISOString());
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ sessions: data || [] });
  } catch (error) {
    console.error('[Visitor analytics] Sessions query failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Visitor sessions are temporarily unavailable.' });
  }
});

app.get('/api/admin/technical/visitors/consent', rateLimit(30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Consent history is unavailable.' });
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit || '100'), 10) || 100));
  try {
    const { data, error } = await serverSupabase.from('visitor_consent_records')
      .select('id,visitor_session_id,visitor_id,user_id,necessary,analytics,marketing,consent_version,consent_source,recorded_at')
      .order('recorded_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return res.json({ records: data || [] });
  } catch (error) {
    console.error('[Visitor privacy] Consent history query failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Consent history is temporarily unavailable.' });
  }
});

app.post('/api/admin/technical/visitors/erase', rateLimit(5, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Visitor data controls are unavailable.' });
  const identifierType = req.body?.identifier_type;
  const identifier = typeof req.body?.identifier === 'string' && UUID_PATTERN.test(req.body.identifier) ? req.body.identifier : null;
  if (!['visitor_id','user_id'].includes(identifierType) || !identifier) return res.status(400).json({ success: false, error: 'Choose a visitor or user ID and enter a valid UUID.' });
  try {
    const { data, error } = await serverSupabase.rpc('erase_visitor_analytics', {
      p_identifier_type: identifierType,
      p_identifier: identifier,
      p_actor: req.user!.id,
    });
    if (error) throw error;
    return res.json({ success: true, ...(data || {}) });
  } catch (error) {
    console.error('[Visitor privacy] Erasure failed:', error instanceof Error ? error.message : 'unknown error');
    return res.status(503).json({ success: false, error: 'Visitor analytics could not be erased. No business bookings or payment records were changed.' });
  }
});

app.get('/api/admin/technical/visitors/settings', rateLimit(30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Retention settings are unavailable.' });
  const { data, error } = await serverSupabase.from('visitor_analytics_settings').select('*').eq('singleton', true).maybeSingle();
  if (error) return res.status(503).json({ success: false, error: 'Retention settings are unavailable.' });
  return res.json({ settings: data });
});

app.post('/api/admin/technical/visitors/settings', rateLimit(10, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return res.status(503).json({ success: false, error: 'Retention settings are unavailable.' });
  const eventDays = Number(req.body?.event_retention_days);
  const sessionDays = Number(req.body?.session_retention_days);
  const consentDays = Number(req.body?.consent_retention_days);
  const technicalDays = Number(req.body?.technical_event_retention_days);
  const auditDays = Number(req.body?.audit_log_retention_days);
  if (!Number.isInteger(eventDays) || eventDays < 7 || eventDays > 730 ||
      !Number.isInteger(sessionDays) || sessionDays < 7 || sessionDays > 1095 ||
      !Number.isInteger(consentDays) || consentDays < 90 || consentDays > 3650 ||
      !Number.isInteger(technicalDays) || technicalDays < 7 || technicalDays > 730 ||
      !Number.isInteger(auditDays) || auditDays < 365 || auditDays > 3650) {
    return res.status(400).json({ success: false, error: 'Retention periods are outside the allowed ranges.' });
  }
  const { data, error } = await serverSupabase.from('visitor_analytics_settings').update({
    event_retention_days: eventDays,
    session_retention_days: sessionDays,
    consent_retention_days: consentDays,
    technical_event_retention_days: technicalDays,
    audit_log_retention_days: auditDays,
    updated_at: new Date().toISOString(),
    updated_by: req.user!.id,
  }).eq('singleton', true).select('*').single();
  if (error) return res.status(503).json({ success: false, error: 'Retention settings could not be saved.' });
  await serverSupabase.from('audit_logs').insert({
    user_id: req.user!.id, action: 'VISITOR_ANALYTICS_RETENTION_UPDATED',
    entity_type: 'visitor_analytics_settings', entity_id: 'default',
    new_data: { event_retention_days: eventDays, session_retention_days: sessionDays, consent_retention_days: consentDays, technical_event_retention_days: technicalDays, audit_log_retention_days: auditDays },
  });
  return res.json({ success: true, settings: data });
});



async function pruneVisitorAnalytics(): Promise<void> {
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return;
  try {
    const { data: settings, error: settingsError } = await serverSupabase
      .from('visitor_analytics_settings')
      .select('event_retention_days,session_retention_days,consent_retention_days,technical_event_retention_days,audit_log_retention_days')
      .eq('singleton', true).maybeSingle();
    if (settingsError || !settings) return;
    const now = Date.now();
    const eventCutoff = new Date(now - settings.event_retention_days * 86400000).toISOString();
    const sessionCutoff = new Date(now - settings.session_retention_days * 86400000).toISOString();
    const consentCutoff = new Date(now - settings.consent_retention_days * 86400000).toISOString();
    const technicalCutoff = new Date(now - settings.technical_event_retention_days * 86400000).toISOString();
    const auditCutoff = new Date(now - settings.audit_log_retention_days * 86400000).toISOString();
    const [events, sessions, consents, technical, audit] = await Promise.all([
      serverSupabase.from('visitor_events').delete().lt('occurred_at', eventCutoff),
      serverSupabase.from('visitor_sessions').delete().lt('last_seen_at', sessionCutoff),
      serverSupabase.from('visitor_consent_records').delete().lt('recorded_at', consentCutoff),
      serverSupabase.from('technical_events').delete().lt('created_at', technicalCutoff),
      serverSupabase.from('audit_logs').delete().lt('created_at', auditCutoff),
    ]);
    if (events.error || sessions.error || consents.error || technical.error || audit.error) {
      console.error('[Visitor analytics retention] Cleanup did not fully complete.');
    }
  } catch (error) {
    console.error('[Visitor analytics retention] Cleanup failed:', error instanceof Error ? error.message : 'unknown error');
  }
}

function validAuthUserId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function writeAccountAudit(actorId: string, action: string, targetId: string, data: Record<string, unknown>) {
  if (!serverSupabase) return;
  const { error } = await serverSupabase.from('audit_logs').insert({
    user_id: actorId, action, entity_type: 'auth_user', entity_id: targetId, new_data: data,
  });
  if (error) console.error('[Admin account audit] Could not persist audit event:', error.message);
}

app.get('/api/admin/users', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  // Personal account data is restricted to a verified Super Admin + AAL2 session.
  if (!requireSuperAdminAal2(req, res)) return;
  try {
    const users: Array<{ id: string; email: string; full_name: string; created_at: string; last_sign_in_at: string | null; is_confirmed: boolean; is_suspended: boolean }> = [];
    let truncated = false;
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await serverSupabase!.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      const batch = data?.users || [];
      users.push(...batch.map((account: any) => {
        const bannedUntil = account.banned_until || null;
        return {
          id: account.id, email: account.email || '',
          full_name: account.user_metadata?.full_name || account.user_metadata?.name || '',
          created_at: account.created_at, last_sign_in_at: account.last_sign_in_at || null,
          is_confirmed: Boolean(account.email_confirmed_at || account.confirmed_at),
          is_suspended: Boolean(bannedUntil && Date.parse(bannedUntil) > Date.now()),
        };
      }));
      if (batch.length < 100) break;
      if (page === 20) truncated = true;
    }
    return res.json({ success: true, users, truncated });
  } catch (error) {
    console.error('[Admin Auth directory] Could not list Auth users:', error);
    return res.status(502).json({ success: false, error: 'Could not load the secure Auth directory. Please retry.' });
  }
});

app.post('/api/admin/users/invite', rateLimit(5, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim().slice(0, 120) : '';
  if (!isValidEmail(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });

  try {
    const { data, error } = await serverSupabase!.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : {},
      redirectTo: 'https://awesomeadventure.tours/',
    });
    if (error) {
      const status = /already|exists|registered/i.test(error.message) ? 409 : 400;
      return res.status(status).json({ success: false, error: status === 409 ? 'An account with this email already exists.' : 'The invitation could not be sent. Check Supabase Auth email configuration.' });
    }
    if (!data.user) return res.status(502).json({ success: false, error: 'Supabase did not return the invited account.' });
    await writeAccountAudit(req.user!.id, 'AUTH_USER_INVITED', data.user.id, { email, full_name: fullName || null });
    return res.status(201).json({ success: true, user_id: data.user.id, email, message: 'Invitation email sent.' });
  } catch (error) {
    console.error('[Admin account invite] Failed:', error);
    return res.status(500).json({ success: false, error: 'The invitation service failed. No success was reported.' });
  }
});

app.get('/api/admin/users/:userId/status', rateLimit(60, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!validAuthUserId(req.params.userId)) return res.status(400).json({ success: false, error: 'Invalid account identifier.' });
  try {
    const { data, error } = await serverSupabase!.auth.admin.getUserById(req.params.userId);
    if (error || !data.user) return res.status(404).json({ success: false, error: 'Account not found.' });
    const bannedUntil = data.user.banned_until || null;
    return res.json({ success: true, is_suspended: Boolean(bannedUntil && Date.parse(bannedUntil) > Date.now()), banned_until: bannedUntil });
  } catch (error) {
    console.error('[Admin account status] Failed:', error);
    return res.status(500).json({ success: false, error: 'Could not retrieve account status.' });
  }
});

app.post('/api/admin/users/:userId/status', rateLimit(10, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  const targetId = req.params.userId;
  const action = req.body?.action;
  if (!validAuthUserId(targetId) || !['suspend', 'reactivate'].includes(action)) {
    return res.status(400).json({ success: false, error: 'A valid account and suspend/reactivate action are required.' });
  }
  if (targetId === req.user!.id && action === 'suspend') {
    return res.status(409).json({ success: false, error: 'You cannot suspend your own active administrator session.' });
  }

  try {
    const { data: target, error: targetError } = await serverSupabase!.auth.admin.getUserById(targetId);
    if (targetError || !target.user) return res.status(404).json({ success: false, error: 'Account not found.' });
    const { data: profile } = await serverSupabase!.from('profiles').select('role').eq('id', targetId).maybeSingle();
    const { data: roleRows } = await serverSupabase!.from('user_roles').select('access_roles!inner(slug)').eq('user_id', targetId);
    const assignedRoles = (roleRows || []).flatMap((row: any) => {
      const roles = row.access_roles;
      return Array.isArray(roles) ? roles.map((role: any) => role.slug) : roles?.slug ? [roles.slug] : [];
    });
    if (profile?.role === 'super_admin' || assignedRoles.includes('super_admin')) {
      return res.status(409).json({ success: false, error: 'Protected Super Admin accounts cannot be suspended or reactivated here.' });
    }

    if (!SUPABASE_URL || !SUPABASE_USER_KEY) {
      return res.status(503).json({ success: false, error: 'A publishable Supabase key is required for secure role synchronization.' });
    }
    const callerToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const callerSupabase = createClient(SUPABASE_URL, SUPABASE_USER_KEY, {
      global: { headers: { Authorization: 'Bearer ' + callerToken } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === 'suspend') {
      const savedRoles = assignedRoles.length ? assignedRoles : ['customer'];
      const nextMetadata = { ...(target.user.app_metadata || {}), suspended_roles: savedRoles };
      const { error: metadataError } = await serverSupabase!.auth.admin.updateUserById(targetId, { app_metadata: nextMetadata });
      if (metadataError) return res.status(502).json({ success: false, error: 'Could not securely preserve the account role assignments.' });
      const { data: roleResult, error: roleError } = await callerSupabase.rpc('admin_assign_user_roles', {
        p_user_id: targetId, p_role_slugs: ['customer'],
      });
      if (roleError || !roleResult?.success) {
        const rollbackMetadata = { ...(target.user.app_metadata || {}) };
        delete (rollbackMetadata as any).suspended_roles;
        await serverSupabase!.auth.admin.updateUserById(targetId, { app_metadata: rollbackMetadata });
        return res.status(502).json({ success: false, error: 'Could not remove privileged roles; the account was not suspended.' });
      }
    } else {
      const saved = target.user.app_metadata?.suspended_roles;
      const restoreRoles = Array.isArray(saved) && saved.length ? saved.filter((role: unknown) => typeof role === 'string') : ['customer'];
      const { data: roleResult, error: roleError } = await callerSupabase.rpc('admin_assign_user_roles', {
        p_user_id: targetId, p_role_slugs: restoreRoles,
      });
      if (roleError || !roleResult?.success) {
        return res.status(502).json({ success: false, error: 'Could not restore the account role assignments. The account remains suspended.' });
      }
      const nextMetadata = { ...(target.user.app_metadata || {}) };
      delete (nextMetadata as any).suspended_roles;
      const { error: metadataError } = await serverSupabase!.auth.admin.updateUserById(targetId, {
        app_metadata: nextMetadata, ban_duration: 'none',
      });
      if (metadataError) return res.status(502).json({ success: false, error: 'Roles were restored but Supabase Auth could not reactivate the account. Retry reactivation.' });
    }

    if (action === 'suspend') {
      const { data: banned, error: banError } = await serverSupabase!.auth.admin.updateUserById(targetId, { ban_duration: '876000h' });
      if (banError || !banned.user) {
        return res.status(502).json({ success: false, error: 'Privileged roles were removed, but Supabase Auth could not apply the account suspension. Retry after checking Auth status.' });
      }
      await writeAccountAudit(req.user!.id, 'AUTH_USER_SUSPENDED', targetId, { email: target.user.email || null, previous_roles: assignedRoles });
      const bannedUntil = banned.user.banned_until || null;
      return res.json({ success: true, is_suspended: Boolean(bannedUntil && Date.parse(bannedUntil) > Date.now()), banned_until: bannedUntil });
    }

    await writeAccountAudit(req.user!.id, 'AUTH_USER_REACTIVATED', targetId, { email: target.user.email || null });
    const { data: active, error: activeError } = await serverSupabase!.auth.admin.getUserById(targetId);
    if (activeError || !active.user) return res.status(502).json({ success: false, error: 'Roles were restored, but account status could not be verified.' });
    const bannedUntil = active.user.banned_until || null;
    return res.json({ success: true, is_suspended: Boolean(bannedUntil && Date.parse(bannedUntil) > Date.now()), banned_until: bannedUntil });
  } catch (error) {
    console.error('[Admin account status] Failed:', error);
    return res.status(500).json({ success: false, error: 'The account status change failed.' });
  }
});

app.post('/api/admin/users/:userId/password-reset', rateLimit(5, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  if (!validAuthUserId(req.params.userId)) return res.status(400).json({ success: false, error: 'Invalid account identifier.' });
  if (!publicSupabase) return res.status(503).json({ success: false, error: 'Supabase Auth email service is not configured.' });
  try {
    const { data, error: lookupError } = await serverSupabase!.auth.admin.getUserById(req.params.userId);
    if (lookupError || !data.user?.email) return res.status(404).json({ success: false, error: 'Account email was not found.' });
    const { error } = await publicSupabase.auth.resetPasswordForEmail(data.user.email, {
      redirectTo: 'https://awesomeadventure.tours/reset-password',
    });
    if (error) {
      console.error('[Admin password reset] Email request failed:', error.message);
      return res.status(502).json({ success: false, error: 'Supabase could not send the password-reset email. Verify Auth SMTP and redirect URL settings.' });
    }
    await writeAccountAudit(req.user!.id, 'AUTH_USER_PASSWORD_RESET_REQUESTED', req.params.userId, { email: data.user.email });
    return res.json({ success: true, message: 'Password-reset email requested.' });
  } catch (error) {
    console.error('[Admin password reset] Failed:', error);
    return res.status(500).json({ success: false, error: 'The password-reset request failed.' });
  }
});

// ------------------------------------------------------------------------------
// 9. Session Verification API (/api/auth/verify-session)
// Server-authoritative session and profile role check
// ------------------------------------------------------------------------------
app.get('/api/auth/verify-session', rateLimit(60, 60_000), (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      authenticated: false,
      user: null,
      error: 'No active session or valid Bearer token provided.',
    });
  }

  return res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// ------------------------------------------------------------------------------
// 10. Database Gateway API (/api/db/query)
// Strictly enforces allowlisted business operations, parameter validation,
// and server-side RBAC. Strictly rejects arbitrary tables, columns, filters, SQL fragments,
// and client-controlled write operations without relying on keyword filtering.
// ------------------------------------------------------------------------------
app.all('/api/db/query', rateLimit(60, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body || {};

  // 1. Structural security boundary: Reject any arbitrary database access parameters immediately
  if (
    body.table !== undefined ||
    body.tables !== undefined ||
    body.columns !== undefined ||
    body.fields !== undefined ||
    body.filters !== undefined ||
    body.filter !== undefined ||
    body.where !== undefined ||
    body.sql !== undefined ||
    body.rawSql !== undefined ||
    body.raw_sql !== undefined ||
    body.query !== undefined ||
    body.query_text !== undefined ||
    body.action !== undefined
  ) {
    return res.status(400).json({
      success: false,
      error: 'Direct table, column, filter, SQL, or arbitrary action queries are strictly prohibited. Use explicit allowlisted business operations.',
    });
  }

  const operation = typeof body.operation === 'string' ? body.operation.trim() : '';
  if (!operation) {
    return res.status(400).json({
      success: false,
      error: 'Missing required "operation" field.',
    });
  }

  // 2. Supported allowlisted business operations
  switch (operation) {
    case 'get_tours': {
      const destination = typeof body.destination === 'string' ? body.destination.trim().slice(0, 50) : undefined;
      const category = typeof body.category === 'string' ? body.category.trim().slice(0, 50) : undefined;
      const search = typeof body.search === 'string' ? body.search.trim().slice(0, 100) : undefined;
      const limit = Math.min(Math.max(1, parseInt(body.limit, 10) || 50), 100);

      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service is currently unconfigured or unavailable.',
          tours: [],
          count: 0,
        });
      }

      try {
        let q = serverSupabase
          .from('tours')
          .select('id, title, slug, price, child_price, duration_hours, duration, short_description, status, created_at')
          .eq('status', 'published')
          .limit(limit);

        if (destination) {
          const cleanDest = destination.replace(/[%_,()]/g, '');
          if (cleanDest) q = q.ilike('destination_id', `%${cleanDest}%`);
        }
        if (search) {
          const cleanSearch = search.replace(/[%_,()]/g, '');
          if (cleanSearch) {
            q = q.or(`title.ilike.%${cleanSearch}%,short_description.ilike.%${cleanSearch}%`);
          }
        }

        const { data, error } = await q;
        if (error) {
          console.error('Database error in get_tours operation:', error.message);
          return res.status(500).json({ success: false, error: 'Database query failed.', tours: [], count: 0 });
        }
        return res.json({ success: true, count: data?.length || 0, tours: data || [] });
      } catch (err) {
        console.warn('Database error in get_tours:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve tours.', tours: [], count: 0 });
      }
    }

    case 'get_destinations': {
      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service is currently unconfigured or unavailable.',
          destinations: [],
          count: 0,
        });
      }

      try {
        const { data, error } = await serverSupabase
          .from('destinations')
          .select('id, name, slug, description, main_image, sort_order')
          .order('sort_order', { ascending: true })
          .limit(50);

        if (error) {
          console.error('Database error in get_destinations:', error.message);
          return res.status(500).json({ success: false, error: 'Failed to retrieve destinations.', destinations: [], count: 0 });
        }
        return res.json({ success: true, count: data?.length || 0, destinations: data || [] });
      } catch (err) {
        console.warn('Database error in get_destinations:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve destinations.', destinations: [], count: 0 });
      }
    }

    case 'get_categories': {
      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service is currently unconfigured or unavailable.',
          categories: [],
          count: 0,
        });
      }

      try {
        const { data, error } = await serverSupabase
          .from('categories')
          .select('id, name, slug, description, icon, sort_order')
          .order('sort_order', { ascending: true })
          .limit(50);

        if (error) {
          console.error('Database error in get_categories:', error.message);
          return res.status(500).json({ success: false, error: 'Failed to retrieve categories.', categories: [], count: 0 });
        }
        return res.json({ success: true, count: data?.length || 0, categories: data || [] });
      } catch (err) {
        console.warn('Database error in get_categories:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve categories.', categories: [], count: 0 });
      }
    }

    case 'get_my_bookings': {
      // Enforce server-side authentication: Caller MUST have a verified JWT session
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED: Valid user authentication token required to access customer bookings.',
        });
      }

      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service is currently unconfigured or unavailable.',
        });
      }

      try {
        // Strictly scoped to the authenticated user's ID
        const { data, error } = await serverSupabase
          .from('bookings')
          .select('id, booking_reference, booking_date, status, payment_status, total, currency, created_at, tours(title, slug, primary_image)')
          .eq('user_id', req.user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Database query error in get_my_bookings:', error.message);
          return res.status(500).json({ success: false, error: 'Failed to retrieve bookings.' });
        }

        return res.json({ success: true, count: data?.length || 0, bookings: data || [] });
      } catch (err) {
        console.warn('Database error in get_my_bookings:', err);
        return res.status(500).json({ success: false, error: 'Database service error.' });
      }
    }

    case 'lookup_booking': {
      const reference = typeof body.reference === 'string' ? body.reference.trim().toUpperCase() : '';
      const verification = typeof body.contactVerification === 'string'
        ? body.contactVerification.trim()
        : (typeof body.emailOrPhone === 'string' ? body.emailOrPhone.trim() : '');

      if (!reference || !/^RST-\d{4}-[A-Z0-9]+$/.test(reference)) {
        return res.status(400).json({ success: false, error: 'A valid booking reference is required.' });
      }

      if (!serverSupabase) {
        return res.status(503).json({ success: false, error: 'The reservation lookup service is temporarily unavailable.' });
      }

      const isStaff = Boolean(req.user && ['admin', 'super_admin', 'manager', 'staff'].includes(req.user.role));

      try {
        // Staff may retrieve the full record only after the server has verified their JWT and DB role.
        if (isStaff) {
          const { data: staffBooking, error: staffError } = await serverSupabase
            .from('bookings')
            .select('id, booking_reference, booking_date, status, payment_status, payment_method, total, currency, customers(*), tours(*)')
            .eq('booking_reference', reference)
            .maybeSingle();

          if (staffError) {
            console.error('Staff booking lookup failed:', staffError.message);
            return res.status(503).json({ success: false, error: 'The reservation lookup service is temporarily unavailable.' });
          }
          if (!staffBooking) {
            return res.status(404).json({ success: false, error: 'Booking not found or verification failed.' });
          }
          return res.json({ success: true, booking: staffBooking });
        }

        if (!verification) {
          return res.status(400).json({
            success: false,
            error: 'The email address or full phone number used during booking is required.',
          });
        }

        // Guest lookup has one path only: the narrowly scoped, rate-limited SECURITY DEFINER RPC.
        // Never fall back to a service-role table query when verification fails or the RPC errors.
        const { data: rpcResult, error: rpcError } = await serverSupabase.rpc('lookup_booking_secure', {
          p_reference: reference,
          p_verification: verification,
        });

        if (rpcError) {
          console.error('Secure booking lookup RPC failed:', rpcError.message);
          if (rpcError.message?.toLowerCase().includes('too many')) {
            return res.status(429).json({ success: false, error: 'Too many verification attempts. Please wait before trying again.' });
          }
          return res.status(503).json({ success: false, error: 'The reservation lookup service is temporarily unavailable.' });
        }

        const rawBooking = rpcResult && typeof rpcResult === 'object' ? (rpcResult as any) : null;
        if (!rawBooking?.found || !rawBooking.bookingReference) {
          return res.status(404).json({ success: false, error: 'Booking not found or verification failed.' });
        }

        return res.json({
          success: true,
          booking: {
            bookingReference: rawBooking.bookingReference,
            status: rawBooking.status,
            paymentStatus: rawBooking.paymentStatus,
            paymentMethod: rawBooking.paymentMethod,
            bookingDate: rawBooking.bookingDate,
            createdAt: rawBooking.createdAt,
            guests: rawBooking.guests,
            tour: rawBooking.tour,
            pickup: rawBooking.pickup,
            pricing: rawBooking.pricing,
            customer: {
              firstName: rawBooking.customer?.firstName,
              lastName: rawBooking.customer?.lastName,
              emailMasked: rawBooking.customer?.emailMasked,
              phoneMasked: rawBooking.customer?.phoneMasked,
              country: rawBooking.customer?.country,
            },
            extras: rawBooking.extras,
            specialRequests: rawBooking.specialRequests,
          },
        });
      } catch (err) {
        console.error('Secure booking lookup exception:', err);
        return res.status(503).json({ success: false, error: 'The reservation lookup service is temporarily unavailable.' });
      }
    }

    case 'get_admin_overview': {
      if (!req.user || !['admin', 'super_admin', 'manager', 'staff'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN: Administrative authorization required to access operational metrics.',
        });
      }

      if (!serverSupabase) {
        return res.status(503).json({
          success: false,
          error: 'Database service is currently unconfigured or unavailable.',
        });
      }

      try {
        const [toursRes, bookingsRes, customersRes] = await Promise.all([
          serverSupabase.from('tours').select('id', { count: 'exact', head: true }),
          serverSupabase.from('bookings').select('id', { count: 'exact', head: true }),
          serverSupabase.from('customers').select('id', { count: 'exact', head: true }),
        ]);

        return res.json({
          success: true,
          metrics: {
            totalTours: toursRes.count || 0,
            totalBookings: bookingsRes.count || 0,
            totalCustomers: customersRes.count || 0,
            verifiedRole: req.user.role,
          },
        });
      } catch (err) {
        console.warn('Database error in get_admin_overview:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve administrative metrics.' });
      }
    }

    default:
      return res.status(400).json({
        success: false,
        error: `Unrecognized business operation "${operation}". Unrestricted table access is strictly prohibited.`,
      });
  }
});

// ------------------------------------------------------------------------------
// Search discovery endpoints: generated from published database records.
// These endpoints never publish admin-only data or draft catalogue entries.
// ------------------------------------------------------------------------------

const AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN = 'https://awesomeadventure.tours';
const AWESOME_ADVENTURE_TOURS_CORE_PUBLIC_PATHS = [
  '/',
  '/excursions',
  '/experiences',
  '/blog',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/cancellation-policy',
  '/cookie-policy',
];

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function toSitemapDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

function cleanPublicText(value: unknown, maxLength = 500): string {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

app.get('/sitemap.xml', async (_req: Request, res: Response) => {
  const urls = new Map<string, string | undefined>();
  for (const route of AWESOME_ADVENTURE_TOURS_CORE_PUBLIC_PATHS) {
    urls.set(`${AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN}${route === '/' ? '/' : route}`, undefined);
  }

  if (publicSupabase) {
    try {
      const { data: tours, error: toursError } = await publicSupabase
        .from('tours')
        .select('slug, updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(5000);

      if (toursError) {
        console.warn('[SEO sitemap] Published tour query failed:', toursError.message);
      } else {
        for (const tour of tours || []) {
          const slug = typeof tour.slug === 'string' ? tour.slug.trim() : '';
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          urls.set(
            `${AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN}/excursions/${encodeURIComponent(slug)}`,
            toSitemapDate(tour.updated_at)
          );
        }
      }
    } catch (error) {
      console.warn('[SEO sitemap] Tour catalogue could not be loaded:', error);
    }

    try {
      const { data: pageSetting, error: pagesError } = await publicSupabase
        .from('site_settings')
        .select('value')
        .eq('key', 'pages_content')
        .maybeSingle();

      if (pagesError) {
        console.warn('[SEO sitemap] CMS page query failed:', pagesError.message);
      } else {
        const rawPages = pageSetting?.value;
        const pages = Array.isArray(rawPages)
          ? rawPages
          : rawPages && typeof rawPages === 'object' && Array.isArray((rawPages as any).pages)
            ? (rawPages as any).pages
            : [];

        for (const page of pages) {
          const slug = typeof page?.slug === 'string' ? page.slug.trim() : '';
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          if (page?.published === false || page?.status === 'draft' || page?.status === 'unpublished' || page?.seoIndexable === false) continue;
          urls.set(
            `${AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN}/${encodeURIComponent(slug)}`,
            toSitemapDate(page?.updated_at || page?.lastUpdated)
          );
        }
      }
    } catch (error) {
      console.warn('[SEO sitemap] CMS pages could not be loaded:', error);
    }

    try {
      const [destinationResult, tourDestinationResult] = await Promise.all([
        publicSupabase.from('destinations').select('id,slug,updated_at,tagline,description').eq('status', 'published'),
        publicSupabase.from('tours').select('destination_id').eq('status', 'published'),
      ]);
      if (destinationResult.error) {
        console.warn('[SEO sitemap] Published destinations query failed:', destinationResult.error.message);
      } else if (tourDestinationResult.error) {
        console.warn('[SEO sitemap] Published destination-tours query failed:', tourDestinationResult.error.message);
      } else {
        const destinationTourCounts = new Map<string, number>();
        for (const row of tourDestinationResult.data || []) {
          if (!row.destination_id) continue;
          const key = String(row.destination_id);
          destinationTourCounts.set(key, (destinationTourCounts.get(key) || 0) + 1);
        }
        for (const destination of destinationResult.data || []) {
          const slug = typeof destination.slug === 'string' ? destination.slug.trim() : '';
          const tourCount = destinationTourCounts.get(String(destination.id)) || 0;
          const descriptionLength = cleanPublicText(destination.description, 4000).length
            + cleanPublicText(destination.tagline, 500).length;
          if (tourCount < 2 && descriptionLength < 300) continue;
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          urls.set(
            `${AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN}/destinations/${encodeURIComponent(slug)}`,
            toSitemapDate(destination.updated_at)
          );
        }
      }
    } catch (error) {
      console.warn('[SEO sitemap] Destination pages could not be loaded:', error);
    }
  }

  if (publicSupabase) {
    try {
      const { data: posts, error } = await publicSupabase
        .from('blog_posts')
        .select('slug, updated_at')
        .in('status', ['published', 'scheduled'])
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(2000);
      if (error) {
        console.warn('[SEO sitemap] Published blog query failed:', error.message);
      } else {
        for (const post of posts || []) {
          const slug = typeof post.slug === 'string' ? post.slug.trim() : '';
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          urls.set(`${AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN}/blog/${encodeURIComponent(slug)}`, toSitemapDate(post.updated_at));
        }
      }
    } catch (error) {
      console.warn('[SEO sitemap] Blog catalogue could not be loaded:', error);
    }
  }

  const entries = Array.from(urls.entries()).map(([loc, lastmod]) => (
    `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
  ));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n');

  res.status(200);
  res.type('application/xml');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return res.send(xml);
});

app.get('/llms.txt', async (_req: Request, res: Response) => {
  const lines = [
    '# Awesome Adventure Tours',
    '',
    '> Explore excursions and experiences across Egypt’s Red Sea coast. Tour pages provide current published descriptions, inclusions, pricing and booking details.',
    '',
    '## Main pages',
    '- [Homepage](https://awesomeadventure.tours/)',
    '- [Excursions](https://awesomeadventure.tours/excursions)',
    '- [Privacy Policy](https://awesomeadventure.tours/privacy)',
    '- [Terms & Conditions](https://awesomeadventure.tours/terms)',
    '- [Cancellation & Refund Policy](https://awesomeadventure.tours/cancellation-policy)',
    '- [Cookie Policy](https://awesomeadventure.tours/cookie-policy)',
    '',
    '## Published destinations and excursions',
  ];

  if (publicSupabase) {
    try {
      const { data: tours, error } = await publicSupabase
        .from('tours')
        .select('title, slug, short_description, price, currency')
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .limit(500);

      if (error) {
        console.warn('[SEO llms.txt] Published tour query failed:', error.message);
      } else {
        for (const tour of tours || []) {
          const slug = typeof tour.slug === 'string' ? tour.slug.trim() : '';
          const title = cleanPublicText(tour.title, 160);
          if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          const description = cleanPublicText(tour.short_description, 400);
          const price = Number(tour.price);
          const currency = typeof tour.currency === 'string' && /^[A-Z]{3}$/i.test(tour.currency) ? tour.currency.toUpperCase() : 'EUR';
          const priceText = Number.isFinite(price) && price > 0 ? ` Starting price: ${price} ${currency}.` : '';
          lines.push(`- [${title}](https://awesomeadventure.tours/excursions/${encodeURIComponent(slug)}): ${description}${priceText}`);
        }
      }
    } catch (error) {
      console.warn('[SEO llms.txt] Tour catalogue could not be loaded:', error);
    }
  }

  if (publicSupabase) {
    lines.push('', '## Published destinations');
    try {
      const [destinationResult, tourDestinationResult] = await Promise.all([
        publicSupabase.from('destinations').select('id,name,slug,description,tagline').eq('status', 'published').order('sort_order', { ascending: true }),
        publicSupabase.from('tours').select('destination_id').eq('status', 'published'),
      ]);
      if (destinationResult.error) {
        console.warn('[SEO llms.txt] Published destinations query failed:', destinationResult.error.message);
      } else if (tourDestinationResult.error) {
        console.warn('[SEO llms.txt] Destination tour links query failed:', tourDestinationResult.error.message);
      } else {
        const destinationTourCounts = new Map<string, number>();
        for (const row of tourDestinationResult.data || []) {
          if (!row.destination_id) continue;
          const key = String(row.destination_id);
          destinationTourCounts.set(key, (destinationTourCounts.get(key) || 0) + 1);
        }
        for (const destination of destinationResult.data || []) {
          const slug = typeof destination.slug === 'string' ? destination.slug.trim() : '';
          const name = cleanPublicText(destination.name, 120);
          const tourCount = destinationTourCounts.get(String(destination.id)) || 0;
          const descriptionLength = cleanPublicText(destination.description, 4000).length
            + cleanPublicText(destination.tagline, 500).length;
          if (!name || (tourCount < 2 && descriptionLength < 300)) continue;
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          const description = cleanPublicText(destination.description, 400);
          lines.push(`- [${name}](https://awesomeadventure.tours/destinations/${encodeURIComponent(slug)}): ${description}`);
        }
      }
    } catch (error) {
      console.warn('[SEO llms.txt] Destination catalogue could not be loaded:', error);
    }
  }

  if (publicSupabase) {
    lines.push('', '## Published travel journal articles');
    try {
      const { data: posts, error } = await publicSupabase
        .from('blog_posts')
        .select('title,slug,excerpt,published_at')
        .in('status', ['published', 'scheduled'])
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(100);
      if (error) {
        console.warn('[SEO llms.txt] Published blog query failed:', error.message);
      } else {
        for (const post of posts || []) {
          const slug = typeof post.slug === 'string' ? post.slug.trim() : '';
          const title = cleanPublicText(post.title, 160);
          if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
          lines.push(`- [${title}](https://awesomeadventure.tours/blog/${encodeURIComponent(slug)}): ${cleanPublicText(post.excerpt, 400)}`);
        }
      }
    } catch (error) {
      console.warn('[SEO llms.txt] Blog catalogue could not be loaded:', error);
    }
  }

  lines.push(
    '',
    '## Booking information',
    '- Check each published excursion page for its current price, availability, duration, pickup information, inclusions and cancellation terms.',
    '- Booking and availability details can change. Use the live website as the source of truth.',
    '',
    '## Sitemap',
    '- https://awesomeadventure.tours/sitemap.xml',
    ''
  );

  res.status(200);
  res.type('text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return res.send(lines.join('\n'));
});


const AWESOME_ADVENTURE_TOURS_MCP_TOOLS = [
  {
    name: 'search_published_excursions',
    description: 'Search published Awesome Adventure Tours excursions by words in the title or description. Returns public catalogue information only.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional search phrase, up to 120 characters.' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_published_excursion',
    description: 'Get public details for one published Awesome Adventure Tours excursion using its slug.',
    inputSchema: {
      type: 'object',
      properties: { slug: { type: 'string', minLength: 1, maxLength: 180 } },
      required: ['slug'],
      additionalProperties: false,
    },
  },
];

app.get('/.well-known/mcp/server-card.json', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.type('application/json');
  return res.json({
    '$schema': 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0',
    protocolVersion: '2025-06-18',
    serverInfo: {
      name: 'com.awesomeadventuretours/public-excursions',
      title: 'Awesome Adventure Tours Public Excursions',
      version: '1.0.0',
    },
    description: 'Read-only discovery and lookup of Awesome Adventure Tours published Red Sea excursions in Egypt. No booking, customer data, payments or administrative actions are exposed.',
    transport: { type: 'streamable-http', endpoint: '/mcp' },
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false, schemes: [] },
    instructions: 'Only published public excursion catalogue data is available. Confirm current prices and availability on the linked live excursion page before making travel decisions.',
    tools: AWESOME_ADVENTURE_TOURS_MCP_TOOLS,
  });
});

app.post('/mcp', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const request = req.body;
  if (!request || typeof request !== 'object' || Array.isArray(request)
    || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return res.status(400).json({ jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32600, message: 'Invalid JSON-RPC request.' } });
  }

  const id = Object.prototype.hasOwnProperty.call(request, 'id') ? request.id : null;
  const reply = (result: unknown) => res.status(200).type('application/json').json({ jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string) => res.status(200).type('application/json').json({ jsonrpc: '2.0', id, error: { code, message } });

  if (request.method === 'notifications/initialized' || request.method.startsWith('notifications/')) {
    return res.status(202).end();
  }

  if (request.method === 'initialize') {
    const requestedVersion = typeof request.params?.protocolVersion === 'string'
      ? request.params.protocolVersion : '2025-06-18';
    const supported = ['2025-06-18', '2025-03-26'];
    return reply({
      protocolVersion: supported.includes(requestedVersion) ? requestedVersion : '2025-06-18',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'com.awesomeadventuretours/public-excursions', title: 'Awesome Adventure Tours Public Excursions', version: '1.0.0' },
      instructions: 'Read-only public excursion catalogue. No bookings, personal data, payments or admin actions.',
    });
  }

  if (request.method === 'ping') return reply({});
  if (request.method === 'tools/list') return reply({ tools: AWESOME_ADVENTURE_TOURS_MCP_TOOLS });
  if (request.method !== 'tools/call') return fail(-32601, 'Method not found.');

  const toolName = request.params?.name;
  const args = request.params?.arguments && typeof request.params.arguments === 'object'
    ? request.params.arguments : {};
  if (!publicSupabase) {
    return reply({ content: [{ type: 'text', text: 'The public excursion catalogue is temporarily unavailable.' }], isError: true });
  }

  try {
    if (toolName === 'search_published_excursions') {
      const queryText = typeof args.query === 'string' ? args.query.trim().slice(0, 120) : '';
      const limit = Number.isInteger(args.limit) ? Math.max(1, Math.min(20, args.limit)) : 10;
      let query = publicSupabase.from('tours')
        .select('title,slug,short_description,price,currency,duration')
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .limit(limit);
      if (queryText) query = query.ilike('title', `%${queryText.replace(/[%_]/g, '')}%`);
      const { data, error } = await query;
      if (error) throw error;
      const tours = (data || []).map((tour: any) => ({
        title: cleanPublicText(tour.title, 160),
        slug: cleanPublicText(tour.slug, 180),
        description: cleanPublicText(tour.short_description, 400),
        price: Number.isFinite(Number(tour.price)) ? Number(tour.price) : null,
        currency: typeof tour.currency === 'string' ? tour.currency : 'EUR',
        duration: cleanPublicText(tour.duration, 100),
        url: `https://awesomeadventure.tours/excursions/${encodeURIComponent(String(tour.slug || ''))}`,
      }));
      return reply({ content: [{ type: 'text', text: JSON.stringify(tours) }], structuredContent: { tours } });
    }

    if (toolName === 'get_published_excursion') {
      const slug = typeof args.slug === 'string' ? args.slug.trim() : '';
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return fail(-32602, 'A valid excursion slug is required.');
      const { data, error } = await publicSupabase.from('tours')
        .select('title,slug,short_description,description,price,currency,duration,pickup_info,cancellation_policy')
        .eq('slug', slug).eq('status', 'published').maybeSingle();
      if (error) throw error;
      if (!data) return reply({ content: [{ type: 'text', text: 'Published excursion not found.' }], isError: true });
      const tour = {
        title: cleanPublicText(data.title, 160),
        slug: cleanPublicText(data.slug, 180),
        description: cleanPublicText(data.short_description || data.description, 1000),
        details: cleanPublicText(data.description, 4000),
        price: Number.isFinite(Number(data.price)) ? Number(data.price) : null,
        currency: typeof data.currency === 'string' ? data.currency : 'EUR',
        duration: cleanPublicText(data.duration, 100),
        pickupInformation: cleanPublicText(data.pickup_info, 1000),
        cancellationInformation: cleanPublicText(data.cancellation_policy, 1000),
        url: `https://awesomeadventure.tours/excursions/${encodeURIComponent(slug)}`,
      };
      return reply({ content: [{ type: 'text', text: JSON.stringify(tour) }], structuredContent: { tour } });
    }
    return fail(-32602, 'Unknown tool. Use tools/list to discover available tools.');
  } catch (error) {
    console.warn('[MCP] Public excursion tool failed:', error);
    return reply({ content: [{ type: 'text', text: 'The public excursion catalogue is temporarily unavailable.' }], isError: true });
  }
});

app.all('/mcp', (_req: Request, res: Response) => {
  res.setHeader('Allow', 'POST');
  return res.status(405).json({ error: 'Method not allowed. Use POST with a JSON-RPC request.' });
});

// Private customer and administration routes must be crawlable so search engines
// can observe noindex. This header is not an access-control mechanism.
app.use((req: Request, res: Response, next: NextFunction) => {
  const privateRoute = /^\/(?:admin(?:\/|$)|booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$)|support(?:\/|$))/i;
  if ((req.method === 'GET' || req.method === 'HEAD') && privateRoute.test(req.path)) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  }
  next();
});

// ------------------------------------------------------------------------------
// API 404 Handler
// ------------------------------------------------------------------------------
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API route not found',
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------------------
// Global Error Handler
// ------------------------------------------------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------------------
// Public route HTML rendering. The current React SPA remains interactive; this
// server output supplies meaningful, route-specific HTML before JavaScript runs.
// ------------------------------------------------------------------------------

function seoHtmlEscape(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function seoPlainText(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return '';
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ')
    .trim().slice(0, maxLength);
}

function seoSafeImage(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const candidate = new URL(value.trim(), 'https://awesomeadventure.tours');
    return candidate.protocol === 'https:' && !candidate.username && !candidate.password ? candidate.toString() : '';
  } catch {
    return '';
  }
}

async function loadAwesomeAdventureToursSeoOverride(entityType: string, identifier: string, isPageSlug: boolean): Promise<any | null> {
  if (!publicSupabase || !identifier) return null;
  try {
    let query = publicSupabase.from('seo_metadata')
      .select('seo_title,meta_description,og_image,robots_index,robots_follow')
      .eq('entity_type', entityType);
    query = isPageSlug ? query.eq('page_slug', identifier) : query.eq('entity_id', identifier);
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn('[SEO render] Metadata override unavailable:', error.message);
      return null;
    }
    return data || null;
  } catch (error) {
    console.warn('[SEO render] Metadata override query failed:', error);
    return null;
  }
}

function seoPrice(priceValue: unknown, currencyValue: unknown): string {
  const price = Number(priceValue);
  if (!Number.isFinite(price) || price <= 0) return '';
  const currency = typeof currencyValue === 'string' && /^[A-Z]{3}$/i.test(currencyValue)
    ? currencyValue.toUpperCase() : 'EUR';
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

async function loadAwesomeAdventureToursTours(): Promise<any[]> {
  if (!publicSupabase) return [];
  try {
    const { data, error } = await publicSupabase.from('tours')
      .select('id,slug,title,short_description,description,price,currency,duration,duration_hours,destination_id,pickup_info,cancellation_policy,departure_time,updated_at,sort_order')
      .eq('status', 'published').order('sort_order', { ascending: true }).limit(500);
    if (error) {
      console.warn('[SEO render] Published tours unavailable:', error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[SEO render] Published tours query failed:', error);
    return [];
  }
}

async function loadAwesomeAdventureToursPages(): Promise<any[]> {
  let publishedPages: any[] = [];
  if (publicSupabase) {
    try {
      const { data, error } = await publicSupabase.from('site_settings')
        .select('value').eq('key', 'pages_content').maybeSingle();
      if (!error) {
        const value = data?.value;
        if (Array.isArray(value)) publishedPages = value;
        else if (value && typeof value === 'object' && Array.isArray(value.pages)) publishedPages = value.pages;
      } else {
        console.warn('[SEO render] CMS pages unavailable; safe defaults used:', error.message);
      }
    } catch (error) {
      console.warn('[SEO render] CMS pages query failed; safe defaults used:', error);
    }
  }
  // Keep baseline public trust pages available even when the CMS contains a
  // partial page list. Explicit CMS content always wins for matching slugs.
  const cmsSlugs = new Set(publishedPages
    .map((page: any) => typeof page?.slug === 'string' ? page.slug : '')
    .filter(Boolean));
  return [
    ...publishedPages,
    ...INITIAL_STATIC_PAGES.filter((page) => !cmsSlugs.has(page.slug)),
  ];
}

async function loadAwesomeAdventureToursDestinations(): Promise<any[]> {
  if (!publicSupabase) return [];
  try {
    const { data, error } = await publicSupabase.from('destinations')
      .select('id,name,slug,tagline,description,main_image,seo_title,seo_description,updated_at')
      .eq('status', 'published').order('sort_order', { ascending: true }).limit(100);
    if (error) {
      console.warn('[SEO render] Published destinations unavailable:', error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[SEO render] Published destinations query failed:', error);
    return [];
  }
}

function seoDestinationCard(destination: any): string {
  const slug = typeof destination?.slug === 'string' ? destination.slug.trim() : '';
  const name = seoPlainText(destination?.name, 120);
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return '';
  const description = seoPlainText(destination?.seo_description || destination?.description || destination?.tagline, 400);
  return `<article class="seo-tour-card"><h2><a href="/destinations/${encodeURIComponent(slug)}">${seoHtmlEscape(name)}</a></h2>
    ${description ? `<p>${seoHtmlEscape(description)}</p>` : ''}
    <p><a href="/destinations/${encodeURIComponent(slug)}">Explore ${seoHtmlEscape(name)}</a></p></article>`;
}

function seoTourCard(tour: any): string {
  const slug = typeof tour?.slug === 'string' ? tour.slug.trim() : '';
  const title = seoPlainText(tour?.title, 160);
  if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return '';
  const description = seoPlainText(tour?.short_description || tour?.description, 400);
  const duration = seoPlainText(tour?.duration, 80);
  const price = seoPrice(tour?.price, tour?.currency);
  return `<article class="seo-tour-card"><h2><a href="/excursions/${encodeURIComponent(slug)}">${seoHtmlEscape(title)}</a></h2>
    ${description ? `<p>${seoHtmlEscape(description)}</p>` : ''}
    ${duration ? `<p>Duration: ${seoHtmlEscape(duration)}</p>` : ''}
    ${price ? `<p><strong>From ${seoHtmlEscape(price)}</strong></p>` : ''}
    <p><a href="/excursions/${encodeURIComponent(slug)}">View excursion details</a></p></article>`;
}

function seoInitialStyles(): string {
  return `<style id="seo-initial-style">
  #seo-initial-content{max-width:1180px;margin:0 auto;padding:32px 20px 56px;color:#18212b;font-family:Arial,sans-serif;line-height:1.65}
  #seo-initial-content h1{font-size:clamp(2rem,4vw,3rem);line-height:1.15;margin:0 0 16px}
  #seo-initial-content h2{font-size:1.35rem;margin:22px 0 8px}
  #seo-initial-content a{color:#08757d;text-decoration:underline}
  #seo-initial-content .seo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin-top:24px}
  #seo-initial-content .seo-tour-card{background:#fff;border:1px solid #e6e7e8;border-radius:14px;padding:16px}
  #seo-initial-content .seo-muted{color:#58636f}
  #seo-initial-content .seo-list{padding-left:22px}
  </style>`;
}

function seoUpsertMeta(html: string, kind: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp('<meta\\s+' + kind + '="' + key + '"[^>]*>', 'i');
  const tag = `<meta ${kind}="${seoHtmlEscape(key)}" content="${seoHtmlEscape(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `${tag}</head>`);
}

async function renderAwesomeAdventureToursPublicHtml(pathname: string, template: string): Promise<{ html: string; statusCode: number; noindex: boolean; nofollow: boolean }> {
  const path = pathname.replace(/\/+$/, '') || '/';
  const origin = 'https://awesomeadventure.tours';
  let title = 'Awesome Adventure Tours | Red Sea Excursions in Egypt';
  let description = 'Explore Red Sea excursions in Egypt, including boat trips, island visits, snorkeling and desert experiences. Review each tour’s details before booking.';
  let body = '';
  let noindex = false;
  let nofollow = false;
  let statusCode = 200;
  let pageKind: 'home' | 'catalogue' | 'experiences' | 'tour' | 'destination' | 'static' | 'blog-index' | 'blog' | 'not-found' = 'not-found';
  let tours: any[] = [];
  let currentTour: any = null;
  let currentBlogPost: any = null;
  let activeDestination: any = null;
  let destinationTours: any[] = [];
  let currentHighlights: any[] = [];
  let currentInclusions: any[] = [];
  let currentExclusions: any[] = [];
  let currentItinerary: any[] = [];
  let pageImage = `${origin}/logo.webp`;
  let visibleDestinations: any[] = [];
  let seoEntityType = 'page';
  let seoIdentifier = 'home';
  let seoIdentifierIsPageSlug = true;

  if (path === '/' || path === '/excursions') {
    // These catalogue reads are independent; run them concurrently so public
    // HTML rendering is bounded by the slower query rather than their sum.
    const [publishedTours, allDestinations] = await Promise.all([
      loadAwesomeAdventureToursTours(),
      loadAwesomeAdventureToursDestinations(),
    ]);
    tours = publishedTours;
    const publishedDestinationIds = new Set(
      tours.map((tour) => tour.destination_id).filter(Boolean).map(String)
    );
    visibleDestinations = allDestinations.filter((destination) => publishedDestinationIds.has(String(destination.id)));
  }

  if (path === '/') {
    pageKind = 'home';
    const cards = tours.slice(0, 6).map(seoTourCard).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><h1>Explore Red Sea Excursions in Egypt</h1>
      <p>Discover the excursions currently published on Awesome Adventure Tours. Compare available boat trips, island experiences, snorkeling activities and other Red Sea tours using the individual excursion details.</p>
      <h2>Explore destinations</h2>
      <div class="seo-grid">${(visibleDestinations || []).map(seoDestinationCard).filter(Boolean).join('')}</div>
      <h2>Explore published excursions</h2><p><a href="/excursions">Browse all excursions</a></p>
      <div class="seo-grid">${cards || '<p>Explore the excursions catalogue for currently published experiences and details.</p>'}</div>
      <h2>About Awesome Adventure Tours</h2><p>Explore our <a href="/about">about page</a>, learn about <a href="/booking-conditions">booking terms and conditions</a>, or <a href="/contact">contact our Hurghada team</a>.</p>
      <p>Phone: <a href="tel:+201515212741">+20 151 5212741</a></p></main>`;
  } else if (path === '/experiences') {
    pageKind = 'experiences';
    seoIdentifier = 'experiences';
    title = 'Red Sea Experiences & Excursion Categories | Awesome Adventure Tours';
    description = 'Discover boat trips, island escapes, snorkeling, diving and desert adventures across Egypt’s Red Sea coast.';
    let categories: any[] = [];
    if (publicSupabase) {
      try {
        const { data, error } = await publicSupabase.from('categories')
          .select('name,slug,description')
          .eq('status', 'published')
          .order('sort_order', { ascending: true });
        if (error) console.warn('[SEO render] Published experience categories unavailable:', error.message);
        categories = Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn('[SEO render] Experience category query failed:', error);
      }
    }
    const cards = categories.map((category: any) => {
      const name = seoPlainText(category.name, 120);
      const summary = seoPlainText(category.description, 400);
      return name ? `<article class="seo-tour-card"><h2>${seoHtmlEscape(name)}</h2>${summary ? `<p>${seoHtmlEscape(summary)}</p>` : ''}</article>` : '';
    }).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / Experiences</nav>
      <h1>Explore Experiences on Egypt’s Red Sea Coast</h1>
      <p>Choose from published excursion categories, from island and boat trips to snorkeling, diving and desert adventures. Explore current tours and review each itinerary before booking.</p>
      <div class="seo-grid">${cards || '<p>Experience categories are being updated. Please browse our published excursions.</p>'}</div>
      <p><a href="/excursions">Browse all excursions</a></p></main>`;
  } else if (path === '/excursions') {
    pageKind = 'catalogue';
    title = 'Red Sea Excursions & Boat Trips | Awesome Adventure Tours';
    description = 'Browse published Red Sea excursions in Egypt. Compare boat trips, island experiences, snorkeling activities, trip durations and prices.';
    const cards = tours.map(seoTourCard).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / Excursions</nav>
      <h1>Red Sea Excursions & Boat Trips</h1>
      <p>Browse the excursions currently published on Awesome Adventure Tours. Review each tour’s description, duration, price and booking details.</p>
      <div class="seo-grid">${cards || '<p>There are currently no published excursions to display.</p>'}</div>
      <h2>Explore by destination</h2>
      <div class="seo-grid">${(visibleDestinations || []).map(seoDestinationCard).filter(Boolean).join('')}</div></main>`;
  } else if (path.startsWith('/excursions/')) {
    let slug = '';
    try { slug = decodeURIComponent(path.slice('/excursions/'.length)); } catch { slug = ''; }
    if (publicSupabase && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
      try {
        const { data, error } = await publicSupabase.from('tours').select('*')
          .eq('slug', slug).eq('status', 'published').maybeSingle();
        if (error) console.warn('[SEO render] Tour detail unavailable:', error.message);
        currentTour = data || null;
      } catch (error) {
        console.warn('[SEO render] Tour detail query failed:', error);
      }
    }
    if (currentTour) {
      pageKind = 'tour';
      seoEntityType = 'tour';
      seoIdentifier = String(currentTour.id);
      seoIdentifierIsPageSlug = false;
      title = `${seoPlainText(currentTour.title, 160)} | Awesome Adventure Tours`;
      const summary = seoPlainText(currentTour.short_description || currentTour.description, 300);
      description = summary || `Review details and booking information for ${seoPlainText(currentTour.title, 160)}.`;
      const relationQueries = await Promise.all([
        publicSupabase!.from('tour_images').select('image_url,alt_text,is_primary').eq('tour_id', currentTour.id).order('sort_order', { ascending: true }),
        publicSupabase!.from('tour_highlights').select('item').eq('tour_id', currentTour.id).order('sort_order', { ascending: true }),
        publicSupabase!.from('tour_inclusions').select('item').eq('tour_id', currentTour.id).order('sort_order', { ascending: true }),
        publicSupabase!.from('tour_exclusions').select('item').eq('tour_id', currentTour.id).order('sort_order', { ascending: true }),
        publicSupabase!.from('tour_itinerary').select('time,title,description').eq('tour_id', currentTour.id).order('sort_order', { ascending: true }),
      ]);
      const tourImages = relationQueries[0].error ? [] : relationQueries[0].data || [];
      const primaryImage = tourImages.find((image: any) => image.is_primary) || tourImages[0];
      pageImage = seoSafeImage(primaryImage?.image_url) || pageImage;
      currentHighlights = relationQueries[1].error ? [] : relationQueries[1].data || [];
      currentInclusions = relationQueries[2].error ? [] : relationQueries[2].data || [];
      currentExclusions = relationQueries[3].error ? [] : relationQueries[3].data || [];
      currentItinerary = relationQueries[4].error ? [] : relationQueries[4].data || [];

      const price = seoPrice(currentTour.price, currentTour.currency);
      const duration = seoPlainText(currentTour.duration, 100);
      const list = (heading: string, rows: any[]) => rows.length
        ? `<section><h2>${heading}</h2><ul class="seo-list">${rows.map(row => `<li>${seoHtmlEscape(seoPlainText(row.item || row.title, 400))}</li>`).join('')}</ul></section>`
        : '';
      const itinerary = currentItinerary.length
        ? `<section><h2>Itinerary</h2><ol class="seo-list">${currentItinerary.map(row => `<li><strong>${seoHtmlEscape(seoPlainText(row.time, 40))} ${seoHtmlEscape(seoPlainText(row.title, 180))}</strong> ${seoHtmlEscape(seoPlainText(row.description, 400))}</li>`).join('')}</ol></section>`
        : '';
      body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / <a href="/excursions">Excursions</a></nav><article>
        <h1>${seoHtmlEscape(seoPlainText(currentTour.title, 160))}</h1>
        ${pageImage !== `${origin}/logo.webp` ? `<figure><img src="${seoHtmlEscape(pageImage)}" alt="${seoHtmlEscape(seoPlainText(currentTour.title, 160))}" loading="eager" style="width:100%;max-height:420px;object-fit:cover;border-radius:14px" /></figure>` : ''}
        ${summary ? `<p>${seoHtmlEscape(summary)}</p>` : ''}
        ${price ? `<p><strong>Starting price: ${seoHtmlEscape(price)}</strong></p>` : ''}
        ${duration ? `<p>Duration: ${seoHtmlEscape(duration)}</p>` : ''}
        ${currentTour.description ? `<section><h2>About this excursion</h2><p>${seoHtmlEscape(seoPlainText(currentTour.description, 4000))}</p></section>` : ''}
        ${list('Highlights', currentHighlights)}${itinerary}${list('Included', currentInclusions)}${list('Not included', currentExclusions)}
        ${currentTour.pickup_info ? `<section><h2>Pickup and departure</h2><p>${seoHtmlEscape(seoPlainText(currentTour.pickup_info, 1000))}</p></section>` : ''}
        ${currentTour.cancellation_policy ? `<section><h2>Cancellation information</h2><p>${seoHtmlEscape(seoPlainText(currentTour.cancellation_policy, 1000))}</p></section>` : ''}
        <p><a href="/booking?tour=${encodeURIComponent(slug)}">Continue to booking</a></p>
      </article></main>`;
    }
  } else if (path === '/blog') {
    pageKind = 'blog-index';
    seoEntityType = 'page';
    seoIdentifier = 'blog';
    seoIdentifierIsPageSlug = true;
    title = 'Awesome Adventure Tours Travel Journal | Red Sea Guides & Egypt Travel Stories';
    description = 'Discover Red Sea travel guides, local insights and inspiration for exploring Hurghada and Egypt with Awesome Adventure Tours.';
    if (publicSupabase) {
      try {
        const { data, error } = await publicSupabase.from('blog_posts')
          .select('title,slug,excerpt,cover_image_url,published_at,blog_categories(name)')
          .in('status', ['published', 'scheduled']).lte('published_at', new Date().toISOString())
          .order('published_at', { ascending: false }).limit(30);
        if (error) console.warn('[SEO render] Blog index query failed:', error.message);
        const posts = data || [];
        const cards = posts.map((post: any) => {
          const slug = typeof post.slug === 'string' ? post.slug.trim() : '';
          const postTitle = seoPlainText(post.title, 160);
          if (!postTitle || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return '';
          const excerpt = seoPlainText(post.excerpt, 400);
          const image = seoSafeImage(post.cover_image_url);
          if (!pageImage || pageImage === `${origin}/logo.webp`) pageImage = image || pageImage;
          return `<article class="seo-tour-card">${image ? `<img src="${seoHtmlEscape(image)}" alt="${seoHtmlEscape(postTitle)}" loading="lazy" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:10px;margin-bottom:12px" />` : ''}<p class="seo-muted">${seoHtmlEscape(seoPlainText(post.blog_categories?.name, 80) || 'Travel guide')}</p><h2><a href="/blog/${encodeURIComponent(slug)}">${seoHtmlEscape(postTitle)}</a></h2>${excerpt ? `<p>${seoHtmlEscape(excerpt)}</p>` : ''}<p><a href="/blog/${encodeURIComponent(slug)}">Read story</a></p></article>`;
        }).filter(Boolean).join('');
        body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / Travel Journal</nav><h1>The Awesome Adventure Tours Travel Journal</h1><p>${seoHtmlEscape(description)}</p><div class="seo-grid">${cards || '<p>New travel guides and local stories are on their way.</p>'}</div></main>`;
      } catch (error) {
        console.warn('[SEO render] Blog index render failed:', error);
      }
    }
  } else if (path.startsWith('/blog/')) {
    let slug = '';
    try { slug = decodeURIComponent(path.slice('/blog/'.length)); } catch { slug = ''; }
    if (publicSupabase && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
      try {
        const { data, error } = await publicSupabase.from('blog_posts')
          .select('title,slug,excerpt,content,cover_image_url,author_name,seo_title,seo_description,published_at,updated_at,blog_categories(name)')
          .eq('slug', slug).in('status', ['published', 'scheduled'])
          .lte('published_at', new Date().toISOString()).maybeSingle();
        if (error) console.warn('[SEO render] Blog article lookup failed:', error.message);
        currentBlogPost = data || null;
      } catch (error) {
        console.warn('[SEO render] Blog article query failed:', error);
      }
    }
    if (currentBlogPost) {
      pageKind = 'blog';
      seoEntityType = 'page';
      seoIdentifier = String(currentBlogPost.slug);
      seoIdentifierIsPageSlug = true;
      title = seoPlainText(currentBlogPost.seo_title, 180) || `${seoPlainText(currentBlogPost.title, 160)} | Awesome Adventure Tours Journal`;
      description = seoPlainText(currentBlogPost.seo_description || currentBlogPost.excerpt, 300)
        || 'Travel inspiration and local guides from Awesome Adventure Tours in Hurghada, Egypt.';
      pageImage = seoSafeImage(currentBlogPost.cover_image_url) || pageImage;
      const contentLines = String(currentBlogPost.content || '').split(/\r?\n/);
      const blocks: string[] = [];
      let paragraph: string[] = [];
      let listItems: string[] = [];
      const flushParagraph = () => {
        if (paragraph.length) {
          blocks.push(`<p>${paragraph.map(line => seoHtmlEscape(seoPlainText(line, 2000))).join(' ')}</p>`);
          paragraph = [];
        }
      };
      const flushList = () => {
        if (listItems.length) {
          blocks.push(`<ul class="seo-list">${listItems.map(item => `<li>${seoHtmlEscape(seoPlainText(item, 500))}</li>`).join('')}</ul>`);
          listItems = [];
        }
      };
      for (const rawLine of contentLines) {
        const line = rawLine.trim();
        if (!line) { flushParagraph(); flushList(); continue; }
        const heading = line.match(/^#{1,3}\s+(.+)$/);
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (heading) {
          flushParagraph(); flushList();
          blocks.push(`<h2>${seoHtmlEscape(seoPlainText(heading[1], 180))}</h2>`);
        } else if (bullet) {
          flushParagraph();
          listItems.push(bullet[1]);
        } else {
          flushList();
          paragraph.push(line);
        }
      }
      flushParagraph(); flushList();
      body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / <a href="/blog">Travel Journal</a> / ${seoHtmlEscape(seoPlainText(currentBlogPost.title, 160))}</nav><article><h1>${seoHtmlEscape(seoPlainText(currentBlogPost.title, 160))}</h1>${pageImage !== `${origin}/logo.webp` ? `<figure><img src="${seoHtmlEscape(pageImage)}" alt="${seoHtmlEscape(seoPlainText(currentBlogPost.title, 160))}" loading="eager" style="width:100%;max-height:520px;object-fit:cover;border-radius:14px" /></figure>` : ''}<p class="seo-muted">${seoHtmlEscape(seoPlainText(currentBlogPost.blog_categories?.name, 80) || 'Awesome Adventure Tours Journal')} · ${seoHtmlEscape(seoPlainText(currentBlogPost.author_name, 120) || 'Awesome Adventure Tours Editorial Team')}</p>${currentBlogPost.excerpt ? `<p><strong>${seoHtmlEscape(seoPlainText(currentBlogPost.excerpt, 600))}</strong></p>` : ''}${blocks.join('')}<p><a href="/excursions">Explore Awesome Adventure Tours excursions</a></p></article></main>`;
    }
  } else if (path.startsWith('/destinations/')) {
    let slug = '';
    try { slug = decodeURIComponent(path.slice('/destinations/'.length)); } catch { slug = ''; }
    if (publicSupabase && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
      try {
        const { data, error } = await publicSupabase.from('destinations').select('*')
          .eq('slug', slug).eq('status', 'published').maybeSingle();
        if (error) console.warn('[SEO render] Destination lookup failed:', error.message);
        activeDestination = data || null;
      } catch (error) {
        console.warn('[SEO render] Destination query failed:', error);
      }
    }
    if (activeDestination && publicSupabase) {
      try {
        const { data, error } = await publicSupabase.from('tours').select('*')
          .eq('destination_id', activeDestination.id).eq('status', 'published')
          .order('sort_order', { ascending: true }).limit(100);
        if (error) console.warn('[SEO render] Destination tours query failed:', error.message);
        destinationTours = Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn('[SEO render] Destination tours query exception:', error);
      }
    }
    if (activeDestination && destinationTours.length > 0) {
      pageKind = 'destination';
      seoEntityType = 'destination';
      seoIdentifier = String(activeDestination.id);
      seoIdentifierIsPageSlug = false;
      title = seoPlainText(activeDestination.seo_title, 180)
        || `${seoPlainText(activeDestination.name, 120)} Excursions & Activities | Awesome Adventure Tours`;
      const destinationDescription = seoPlainText(activeDestination.description, 4000);
      const destinationTagline = seoPlainText(activeDestination.tagline, 500);
      description = seoPlainText(activeDestination.seo_description || destinationDescription || destinationTagline, 300);
      noindex = destinationTours.length < 2 && (destinationDescription.length + destinationTagline.length) < 300;
      pageImage = seoSafeImage(activeDestination.main_image) || pageImage;
      const cards = destinationTours.map(seoTourCard).filter(Boolean).join('');
      body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / <a href="/excursions">Excursions</a> / ${seoHtmlEscape(seoPlainText(activeDestination.name, 120))}</nav>
        <article><h1>Excursions in ${seoHtmlEscape(seoPlainText(activeDestination.name, 120))}</h1>
        ${activeDestination.tagline ? `<p><strong>${seoHtmlEscape(seoPlainText(activeDestination.tagline, 300))}</strong></p>` : ''}
        ${description ? `<p>${seoHtmlEscape(description)}</p>` : ''}
        <h2>Published excursions in ${seoHtmlEscape(seoPlainText(activeDestination.name, 120))}</h2>
        <div class="seo-grid">${cards}</div></article></main>`;
    }
  } else {
    const pages = await loadAwesomeAdventureToursPages();
    const page = pages.find((item: any) => item && item.slug === path.slice(1));
    if (page) {
      pageKind = 'static';
      seoIdentifier = String(page.slug);
      seoIdentifierIsPageSlug = true;
      title = seoPlainText(page.seoTitle, 180) || `${seoPlainText(page.title, 160)} | Awesome Adventure Tours`;
      description = seoPlainText(page.seoDescription, 300) || seoPlainText(page.heroSubtitle, 300);
      noindex = page.seoIndexable === false;
      nofollow = noindex;
      const sections = Array.isArray(page.sections) ? page.sections.map((section: any) => {
        const h = seoPlainText(section?.title, 180);
        const p = seoPlainText(section?.content, 3000);
        return `<section>${h ? `<h2>${seoHtmlEscape(h)}</h2>` : ''}${p ? `<p>${seoHtmlEscape(p)}</p>` : ''}</section>`;
      }).join('') : '';
      body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / ${seoHtmlEscape(seoPlainText(page.title, 160))}</nav>
        <article><h1>${seoHtmlEscape(seoPlainText(page.heroHeadline, 240) || seoPlainText(page.title, 160))}</h1>
        ${page.heroSubtitle ? `<p>${seoHtmlEscape(seoPlainText(page.heroSubtitle, 1000))}</p>` : ''}${sections}</article></main>`;
    }
  }

  if (pageKind === 'not-found') {
    statusCode = 404;
    noindex = true;
    nofollow = true;
    title = 'Page Not Found | Awesome Adventure Tours';
    description = 'The requested page could not be found.';
    body = `<main id="seo-initial-content"><h1>Page not found</h1><p>The requested page is not available.</p><p><a href="/">Return to the homepage</a> or <a href="/excursions">browse excursions</a>.</p></main>`;
  }

  if (pageKind !== 'not-found') {
    const override = await loadAwesomeAdventureToursSeoOverride(seoEntityType, seoIdentifier, seoIdentifierIsPageSlug);
    if (override?.seo_title) title = seoPlainText(override.seo_title, 180);
    if (override?.meta_description) description = seoPlainText(override.meta_description, 300);
    if (override?.og_image) pageImage = seoSafeImage(override.og_image) || pageImage;
    if (override?.robots_index === false) noindex = true;
    if (override?.robots_follow === false) nofollow = true;
  }

  const canonical = `${origin}${path === '/' ? '/' : path}`;
  const cmsSocialProfiles: string[] = [];
  if (publicSupabase) {
    try {
      const { data, error } = await publicSupabase.from('site_settings')
        .select('value').eq('key', 'social_links').maybeSingle();
      if (!error && data?.value && typeof data.value === 'object') {
        const social = data.value as Record<string, unknown>;
        for (const key of ['facebook', 'instagram', 'youtube', 'tiktok', 'tripadvisor']) {
          if (typeof social[key] === 'string') cmsSocialProfiles.push(social[key] as string);
        }
      }
    } catch (error) {
      console.warn('[SEO schema] Social profile settings unavailable:', error);
    }
  }
  const configuredSameAs = [
    ...(process.env.BRAND_SAME_AS_URLS || '').split(','),
    ...cmsSocialProfiles,
  ]
    .map((value) => value.trim())
    .filter((value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && [
          'facebook.com', 'www.facebook.com', 'instagram.com', 'www.instagram.com',
          'linkedin.com', 'www.linkedin.com', 'youtube.com', 'www.youtube.com',
          'tiktok.com', 'www.tiktok.com', 'tripadvisor.com', 'www.tripadvisor.com',
          'x.com', 'www.x.com',
        ].includes(url.hostname.toLowerCase());
      } catch {
        return false;
      }
    });
  const organization: Record<string, any> = {
    '@type': ['TravelAgency', 'Organization'],
    '@id': `${origin}/#organization`,
    name: 'Awesome Adventure Tours',
    url: origin,
    logo: `${origin}/logo.webp`,
    description: 'Excursions and experiences along Egypt’s Red Sea coast, based in Hurghada, Egypt.',
    telephone: '+201515212741',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Hurghada New Marina, Berth B-14',
      addressLocality: 'Hurghada',
      addressRegion: 'Red Sea Governorate',
      addressCountry: 'EG',
    },
    contactPoint: [{
      '@type': 'ContactPoint',
      telephone: '+201515212741',
      contactType: 'customer service',
      availableLanguage: ['English', 'German', 'Russian'],
      url: `${origin}/contact`,
    }],
  };
  if (configuredSameAs.length) organization.sameAs = Array.from(new Set(configuredSameAs));
  const graph: any[] = [
    organization,
    { '@type': 'WebSite', '@id': `${origin}/#website`, url: origin, name: 'Awesome Adventure Tours', publisher: { '@id': `${origin}/#organization` }, inLanguage: 'en' },
  ];
  if (pageKind === 'tour' && currentTour) {
    const price = Number(currentTour.price);
    const currency = typeof currentTour.currency === 'string' && /^[A-Z]{3}$/i.test(currentTour.currency)
      ? currentTour.currency.toUpperCase() : 'EUR';
    graph.push({
      '@type': 'TouristTrip',
      '@id': `${canonical}#touristtrip`,
      name: seoPlainText(currentTour.title, 160),
      description,
      url: canonical,
      image: pageImage !== `${origin}/logo.webp` ? [pageImage] : undefined,
      provider: { '@id': `${origin}/#organization` },
      ...(Number.isFinite(price) && price > 0 ? {
        subjectOf: { '@type': 'Product', name: seoPlainText(currentTour.title, 160),
          offers: { '@type': 'Offer', url: canonical, price, priceCurrency: currency, seller: { '@id': `${origin}/#organization` } } },
      } : {}),
    });
  } else if (pageKind === 'blog' && currentBlogPost) {
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${canonical}#blogposting`,
      headline: seoPlainText(currentBlogPost.title, 160),
      description,
      url: canonical,
      image: pageImage !== `${origin}/logo.webp` ? [pageImage] : undefined,
      datePublished: currentBlogPost.published_at,
      dateModified: currentBlogPost.updated_at || currentBlogPost.published_at,
      author: { '@type': 'Organization', name: seoPlainText(currentBlogPost.author_name, 120) || 'Awesome Adventure Tours Editorial Team' },
      publisher: { '@id': `${origin}/#organization` },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      isPartOf: { '@id': `${origin}/#website` },
    });
  } else if (pageKind === 'destination' && activeDestination) {
    const destinationItems = destinationTours.map((tour, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: seoPlainText(tour.title, 160),
      url: `${origin}/excursions/${encodeURIComponent(String(tour.slug || ''))}`,
    })).filter((item) => item.name && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(item.url.split('/').pop() || ''));
    graph.push({
      '@type': 'TouristDestination',
      '@id': `${canonical}#destination`,
      name: seoPlainText(activeDestination.name, 120),
      description,
      url: canonical,
      image: pageImage !== `${origin}/logo.webp` ? pageImage : undefined,
      subjectOf: { '@type': 'ItemList', itemListElement: destinationItems },
    });
  } else {
    graph.push({
      '@type': pageKind === 'catalogue' || pageKind === 'experiences' || pageKind === 'home' || pageKind === 'blog-index' ? 'CollectionPage' : 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: title,
      description,
      isPartOf: { '@id': `${origin}/#website` },
    });
  }

  const schema = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  let html = template.replace(/<title>[\s\S]*?<\/title>/i, `<title>${seoHtmlEscape(title)}</title>`);
  html = seoUpsertMeta(html, 'name', 'description', description);
  html = seoUpsertMeta(html, 'name', 'robots', noindex ? `noindex, ${nofollow ? 'nofollow' : 'follow'}` : 'index, follow, max-image-preview:large');
  html = seoUpsertMeta(html, 'property', 'og:title', title);
  html = seoUpsertMeta(html, 'property', 'og:description', description);
  html = seoUpsertMeta(html, 'property', 'og:site_name', 'Awesome Adventure Tours');
  html = seoUpsertMeta(html, 'property', 'og:type', pageKind === 'tour' ? 'product' : pageKind === 'blog' ? 'article' : 'website');
  html = seoUpsertMeta(html, 'property', 'og:url', canonical);
  html = seoUpsertMeta(html, 'property', 'og:image', pageImage);
  html = seoUpsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
  html = seoUpsertMeta(html, 'name', 'twitter:title', title);
  html = seoUpsertMeta(html, 'name', 'twitter:description', description);
  html = seoUpsertMeta(html, 'name', 'twitter:image', pageImage);
  html = html.replace(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${seoHtmlEscape(canonical)}" />`);
  html = html.replace(/<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace('</head>', `<script type="application/ld+json">${schema}</script>${seoInitialStyles()}</head>`);
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${body}</div>`);
  return { html, statusCode, noindex, nofollow };
}

// ------------------------------------------------------------------------------
// Server Lifecycle
// ------------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const indexHtmlPath = path.resolve(distPath, 'index.html');

    if (!fs.existsSync(indexHtmlPath)) {
      console.warn(`WARNING: Production build not found at ${distPath}. Running "npm run build" is required for production.`);
    }

    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    app.get('/', async (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Link',
        '<https://awesomeadventure.tours/llms.txt>; rel="alternate"; type="text/plain"; title="Awesome Adventure Tours LLMs index", <https://awesomeadventure.tours/sitemap.xml>; rel="sitemap"');
      const acceptsMarkdown = (req.get('accept') || '').split(',').some((value) => value.trim().toLowerCase().startsWith('text/markdown'));
      if (!acceptsMarkdown) return next();

      const tours = await loadAwesomeAdventureToursTours();
      const lines = [
        '# Awesome Adventure Tours',
        '',
        'Explore published excursions and experiences along Egypt’s Red Sea coast.',
        '',
        '## Main pages',
        '- Homepage: https://awesomeadventure.tours/',
        '- Excursions catalogue: https://awesomeadventure.tours/excursions',
        '- About: https://awesomeadventure.tours/about',
        '- Contact: https://awesomeadventure.tours/contact',
        '- Booking terms: https://awesomeadventure.tours/booking-conditions',
        '- Full agent index: https://awesomeadventure.tours/llms.txt',
        '',
        '## Contact',
        '- Phone: +20 151 5212741',
        '- Office: Hurghada New Marina, Berth B-14, Red Sea, Egypt',
        '',
        '## Published excursions',
      ];
      for (const tour of tours) {
        const slug = typeof tour.slug === 'string' ? tour.slug.trim() : '';
        const title = cleanPublicText(tour.title, 160);
        if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
        const summary = cleanPublicText(tour.short_description || tour.description, 300);
        lines.push(`- [${title}](https://awesomeadventure.tours/excursions/${encodeURIComponent(slug)}): ${summary}`);
      }
      res.status(200);
      res.type('text/markdown; charset=utf-8');
      res.setHeader('Vary', 'Accept');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      return res.send(lines.join('\\n'));
    });

    app.get('*', async (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API route not found' });
      }
      if (!fs.existsSync(indexHtmlPath)) {
        return res.status(503).send('Awesome Adventure Tours production assets are not available.');
      }

      const privateRoute = /^\/(?:admin(?:\/|$)|booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$)|support(?:\/|$))/i;
      if (privateRoute.test(req.path)) {
        return res.sendFile(indexHtmlPath);
      }

      try {
        const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        const rendered = await renderAwesomeAdventureToursPublicHtml(req.path, indexHtml);
        res.status(rendered.statusCode);
        res.type('html');
        if (rendered.noindex) {
          res.setHeader('X-Robots-Tag', `noindex, ${rendered.nofollow ? 'nofollow' : 'follow'}`);
        }
        res.setHeader('Cache-Control', rendered.statusCode === 200
          ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=30'
          : 'no-store');
        return res.send(rendered.html);
      } catch (error) {
        console.error('[Public SEO render] Failed to render route:', req.path, error);
        res.setHeader('Cache-Control', 'no-store');
        return res.sendFile(indexHtmlPath);
      }
    });
  }

  let stopBookingNotificationWorker: (() => void) | null = null;

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Awesome Adventure Tours server running on port/socket ${PORT} [${process.env.NODE_ENV || 'development'}]`);

    // Apply configured visitor-data retention once at startup and daily thereafter.
    void pruneVisitorAnalytics();
    const visitorRetentionTimer = setInterval(() => { void pruneVisitorAnalytics(); }, 24 * 60 * 60 * 1000);
    visitorRetentionTimer.unref();

    // The durable queue consumer must use a server-only Supabase secret key.
    // It never starts with an anon/publishable key or in local development.
    if (process.env.NODE_ENV === 'production' && serverSupabase && SUPABASE_KEY_TYPE === 'service_role') {
      stopBookingNotificationWorker = startBookingNotificationWorker(serverSupabase);
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[Booking Notification Worker] Not started: a valid server-side Supabase secret key is required.');
    }
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    stopBookingNotificationWorker?.();
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Forceful shutdown timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (!process.env.VERCEL) {
  startServer();
}

export { app };
export default app;
