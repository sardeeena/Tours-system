import express, { Request, Response, NextFunction } from 'express';
import { renderBrandedEmailHtml } from './src/utils/emailTemplate';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { GoogleGenAI } from '@google/genai';
import { generateOpenAITranslationBatch } from './src/server/openAiTranslation';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { CONCIERGE_SYSTEM_PROMPT } from './src/data/chatKnowledge';
import { STANDARD_PICKUP_LOCATIONS, GLOBAL_BOOKING_EXTRAS } from './src/data/bookingData';
import { startBookingNotificationWorker } from './src/server/bookingNotificationWorker';
import { startStaffNotificationWorker } from './src/server/staffNotificationWorker';
import { INITIAL_STATIC_PAGES } from './src/data/staticPages';
import { EXPECTED_AWESOME_ADVENTURE_TOURS_SUPABASE_PROJECT_REF, isExpectedAwesomeAdventureToursSupabaseUrl } from './src/lib/supabaseProjectGuard';
import { parseLocalePath, ROUTABLE_LOCALE_CODES } from './src/i18n/localeRouting';
import { EUROPEAN_LOCALE_ROLLOUT } from './src/types/i18n';
import { TRANSLATIONS } from './src/i18n/translations';
import { PRIVATE_UI_SOURCE_CATALOG } from './src/i18n/privateUiCatalog.generated';
import { resolveWhatsAppLocaleLanguageMap, selectWhatsAppTemplateLanguage } from './src/lib/whatsappLocaleMapping';

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
  roles: string[];
  permissions: string[];
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
    let accessContext: any = null;
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

      const { data: fetchedAccessContext, error: accessError } = await userScopedSupabase.rpc('get_my_access_context');
      if (!accessError && fetchedAccessContext) accessContext = fetchedAccessContext;
      if (!accessError && Array.isArray(accessContext?.roles)) {
        const assignedRoles = accessContext.roles.filter((item: unknown): item is string => typeof item === 'string');
        if (assignedRoles.includes('super_admin')) role = 'super_admin';
        else if (assignedRoles.includes('admin')) role = 'admin';
      }
    }

    const roles = Array.isArray(accessContext?.roles)
      ? accessContext.roles.filter((item: unknown): item is string => typeof item === 'string')
      : [];
    const permissions = Array.isArray(accessContext?.permissions)
      ? accessContext.permissions.filter((item: unknown): item is string => typeof item === 'string')
      : [];
    req.user = { id: user.id, email: user.email, role, roles, permissions };
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
// Meta signs the exact request bytes; parse WhatsApp JSON only after verification.
app.use('/api/webhooks/whatsapp', express.raw({ type: 'application/json', limit: '1mb' }));
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
  const hasAdministratorRole = Boolean(req.user && (
    ['admin', 'super_admin'].includes(req.user.role)
    || req.user.roles?.some(role => role === 'admin' || role === 'super_admin')
  ));
  if (!hasAdministratorRole) return next();
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
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
    // technical_events is service-role-only in PostgreSQL. Do not attempt writes
    // with a publishable/anon client when server secrets are unavailable.
    if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return;
    const routePath = req.route?.path
      ? `${req.baseUrl}${String(req.route.path)}`
      : req.path;
    if (routePath.startsWith('/api/admin/technical') || routePath === '/api/health') return;
    const durationMs = Math.max(0, Date.now() - startedAt);
    const severity = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info';
    void serverSupabase.from('technical_events').insert({
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
    }).then(({ error }) => {
      if (error) console.warn('[API telemetry] Sanitized event could not be persisted.');
    }, () => {
      console.warn('[API telemetry] Sanitized event could not be persisted.');
    });
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

  // The concierge must have both Gemini and the public RLS-scoped catalogue.
  // It never falls back to the legacy static tour list.
  if (!ai || !publicSupabase) {
    return res.status(503).json({
      error: 'Live concierge is not configured. Please browse the published excursions or contact our team.',
      fallback: true,
    });
  }

  try {
    const { data: catalogueRows, error: catalogueError } = await publicSupabase
      .from('tours')
      .select('id,title,slug,short_description,duration,duration_hours,price,child_price,currency,tour_type,pickup_available,pickup_info,cancellation_policy,departure_time,available_days,destinations(name),tour_images(image_url,is_primary,sort_order)')
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .limit(60);

    if (catalogueError) {
      console.warn('[AI Concierge] Live published catalogue query failed:', catalogueError.message);
      return res.status(503).json({ error: 'The live excursion catalogue is temporarily unavailable.', fallback: true });
    }

    const liveCatalogue = (catalogueRows || []).map((tour: any) => {
      const destination = Array.isArray(tour.destinations) ? tour.destinations[0] : tour.destinations;
      return {
        id: tour.id,
        title: tour.title,
        slug: tour.slug,
        destination: destination?.name || 'Not specified',
        summary: tour.short_description || '',
        duration: tour.duration || null,
        durationHours: tour.duration_hours == null ? null : Number(tour.duration_hours),
        startingPrice: tour.price == null ? null : Number(tour.price),
        childPrice: tour.child_price == null ? null : Number(tour.child_price),
        currency: tour.currency || 'EUR',
        tourType: tour.tour_type || null,
        pickupAvailable: Boolean(tour.pickup_available),
        primaryImage: (Array.isArray(tour.tour_images) ? [...tour.tour_images].sort((a: any,b: any) => Number(Boolean(b.is_primary))-Number(Boolean(a.is_primary)) || Number(a.sort_order || 0)-Number(b.sort_order || 0))[0]?.image_url : '') || '',
        pickupInformation: tour.pickup_info || null,
        cancellationPolicy: tour.cancellation_policy || null,
        publishedDepartureLabel: tour.departure_time || null,
        operatingDays: Array.isArray(tour.available_days) ? tour.available_days : [],
      };
    });

    if (liveCatalogue.length === 0) {
      return res.status(503).json({ error: 'No published excursions are currently available to the concierge.', fallback: true });
    }

    // Only user/assistant roles and bounded content are accepted from the browser.
    const conversationHistory = cleanMessages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    if (cleanPrompt && (!cleanMessages.length || cleanMessages[cleanMessages.length - 1]?.content !== cleanPrompt)) {
      conversationHistory.push({ role: 'user', parts: [{ text: cleanPrompt }] });
    }

    const liveSystemInstruction = `${CONCIERGE_SYSTEM_PROMPT}

CURRENT PUBLISHED CATALOGUE — retrieved from the public database for this request:
${JSON.stringify(liveCatalogue)}

The catalogue above is current published content, not date-specific inventory. Do not claim a date is available or quote a confirmed departure time. Tell the traveler to check the excursion page for live date availability and exact booking details.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: conversationHistory,
      config: {
        systemInstruction: liveSystemInstruction,
        temperature: 0.35,
      },
    });

    const responseText = response.text || '';
    const lower = responseText.toLocaleLowerCase();
    const matchedTours = liveCatalogue
      .filter((tour) => tour.title && lower.includes(tour.title.toLocaleLowerCase()))
      .slice(0, 3)
      .map((tour) => ({
        id: tour.id,
        slug: tour.slug,
        title: tour.title,
        primaryImage: tour.primaryImage,
        priceEur: tour.startingPrice,
      }));

    return res.json({ text: responseText, recommendedTours: matchedTours });
  } catch (err: any) {
    console.warn('Gemini generateContent error in /api/chat:', err?.message || 'Unknown error');
    return res.status(503).json({
      error: 'The live concierge is temporarily unavailable. Please browse the published excursions or contact our team.',
      fallback: true,
    });
  }
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

// Readiness is separate from liveness: it verifies that the public application
// can reach its RLS-scoped production catalogue without disclosing credentials.
app.get('/api/health/ready', rateLimit(30, 60_000), async (_req: Request, res: Response) => {
  if (!publicSupabase) {
    return res.status(503).json({
      status: 'not_ready',
      checks: { database: 'unavailable' },
      timestamp: new Date().toISOString(),
    });
  }

  const { error } = await publicSupabase
    .from('tours')
    .select('id', { head: true, count: 'exact' })
    .eq('status', 'published');

  if (error) {
    return res.status(503).json({
      status: 'not_ready',
      checks: { database: 'unavailable' },
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    status: 'ready',
    checks: { database: 'ok' },
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------------------
// 2A. Server-side communications status and delivery endpoints
// Provider secrets are read only from Hostinger/server environment variables.
// Browser-supplied API keys are never accepted.
// ------------------------------------------------------------------------------
function userHasPermission(req: AuthenticatedRequest, permission: string): boolean {
  if (!req.user) return false;
  // Only the live, caller-scoped normalized RBAC context may grant access.
  // profiles.role is a compatibility field and must never become an authorization
  // fallback when get_my_access_context is unavailable or returns no assignments.
  const roles = req.user.roles || [];
  if (roles.includes('super_admin') || roles.includes('admin')) return true;
  const moduleName = permission.split('.')[0];
  const permissions = req.user.permissions || [];
  return permissions.includes(permission) || permissions.includes(moduleName + '.manage');
}

function requireCommunicationsStaff(
  req: AuthenticatedRequest,
  res: Response,
  permission: 'communications.read' | 'communications.manage' = 'communications.read'
): boolean {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Sign in with an authorized staff account to access communications.' });
    return false;
  }
  if (!userHasPermission(req, permission)) {
    res.status(403).json({ success: false, error: 'Your account does not have permission for this communications action.' });
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
  const whatsappTemplateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en';
  const whatsappLanguageConfig = resolveWhatsAppLocaleLanguageMap(process.env.WHATSAPP_TEMPLATE_LANGUAGE_MAP, whatsappTemplateLanguage);
  const whatsappConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim()
    && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    && /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_API_VERSION || '')
    && /^[a-z0-9_]{1,512}$/.test(process.env.WHATSAPP_TEMPLATE_NAME?.trim() || '')
    && whatsappLanguageConfig.valid
    && whatsappLanguageConfig.approvedLanguageCodes.includes(whatsappTemplateLanguage)
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
      templateName: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || '',
      templateLanguage: whatsappTemplateLanguage,
      languageMappingValid: whatsappLanguageConfig.valid,
      localeLanguageMap: whatsappLanguageConfig.mapping,
      availableCustomerLocales: Object.keys(whatsappLanguageConfig.mapping),
    },
  });
});

app.post('/api/communications/email', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireCommunicationsStaff(req, res, 'communications.manage')) return;

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

function normalizeConsentPhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

async function verifyConsentCustomerPhone(customerId: string, phone: string): Promise<{ valid: boolean; error?: string }> {
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') return { valid: false, error: 'Secure consent storage is unavailable.' };
  const { data: customer, error } = await serverSupabase.from('customers').select('id,phone').eq('id', customerId).maybeSingle();
  if (error) {
    console.error('[WhatsApp consent] Customer lookup failed:', error.message);
    return { valid: false, error: 'The customer record could not be verified.' };
  }
  if (!customer) return { valid: false, error: 'Select a valid customer record before recording consent.' };
  if (normalizeConsentPhone(customer.phone) !== phone) {
    return { valid: false, error: 'The phone number must match the selected customer record. Update the customer contact details first if it has changed.' };
  }
  return { valid: true };
}

app.get('/api/communications/whatsapp/consent', rateLimit(60, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireCommunicationsStaff(req, res)) return;
  const customerId = typeof req.query.customerId === 'string' ? req.query.customerId.trim() : '';
  const phone = normalizeConsentPhone(req.query.phone);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerId) || phone.length < 8 || phone.length > 15) {
    return res.status(400).json({ success: false, error: 'A valid customer and international phone number are required.' });
  }
  const verified = await verifyConsentCustomerPhone(customerId, phone);
  if (!verified.valid) return res.status(verified.error?.includes('unavailable') ? 503 : 400).json({ success: false, error: verified.error });
  try {
    const { data, error } = await serverSupabase!.from('customer_communication_consent_events')
      .select('id,purpose,phone_e164,consent_action,consent_text_version,consent_source,recorded_by,recorded_at,evidence_reference')
      .eq('customer_id', customerId).eq('channel', 'WhatsApp').eq('phone_e164', phone)
      .order('recorded_at', { ascending: false }).limit(50);
    if (error) {
      console.error('[WhatsApp consent] History lookup failed:', error.message);
      return res.status(503).json({ success: false, error: 'Consent history is temporarily unavailable.' });
    }
    return res.json({ success: true, events: data || [] });
  } catch (error) {
    console.error('[WhatsApp consent] History request failed:', error);
    return res.status(503).json({ success: false, error: 'Consent history is temporarily unavailable.' });
  }
});

app.post('/api/communications/whatsapp/consent', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireCommunicationsStaff(req, res, 'communications.manage')) return;
  const customerId = typeof req.body?.customerId === 'string' ? req.body.customerId.trim() : '';
  const phone = normalizeConsentPhone(req.body?.phone);
  const purpose = req.body?.purpose;
  const action = req.body?.action;
  const evidenceReference = typeof req.body?.evidenceReference === 'string' ? req.body.evidenceReference.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerId) ||
      phone.length < 8 || phone.length > 15 || !['transactional', 'marketing'].includes(purpose) ||
      !['grant', 'revoke'].includes(action) || req.body?.explicitConfirmation !== true ||
      evidenceReference.length > 200 || (action === 'grant' && evidenceReference.length < 4)) {
    return res.status(400).json({ success: false, error: 'Provide a valid customer, phone, purpose, action, explicit customer-choice confirmation, and evidence reference (required for a grant).' });
  }
  const verified = await verifyConsentCustomerPhone(customerId, phone);
  if (!verified.valid) return res.status(verified.error?.includes('unavailable') ? 503 : 400).json({ success: false, error: verified.error });
  try {
    const { data, error } = await serverSupabase!.from('customer_communication_consent_events').insert({
      customer_id: customerId, channel: 'WhatsApp', purpose, phone_e164: phone,
      consent_action: action === 'grant' ? 'granted' : 'revoked',
      consent_text_version: purpose === 'transactional' ? 'wa-transactional-v1' : 'wa-marketing-v1',
      consent_source: 'staff_verified_record', recorded_by: req.user!.id,
      evidence_reference: evidenceReference || null,
    }).select('id,purpose,phone_e164,consent_action,consent_text_version,consent_source,recorded_by,recorded_at,evidence_reference').single();
    if (error || !data) {
      console.error('[WhatsApp consent] Append failed:', error?.message || 'No row returned');
      return res.status(503).json({ success: false, error: 'Consent evidence could not be saved. No permission was changed.' });
    }
    return res.status(201).json({ success: true, event: data });
  } catch (error) {
    console.error('[WhatsApp consent] Record request failed:', error);
    return res.status(503).json({ success: false, error: 'Consent evidence could not be saved. No permission was changed.' });
  }
});

app.post('/api/communications/whatsapp', rateLimit(20, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireCommunicationsStaff(req, res, 'communications.manage')) return;
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.replace(/[^0-9]/g, '') : '';
  const customerId = typeof req.body?.customerId === 'string' ? req.body.customerId.trim() : '';
  const bodyParameter = typeof req.body?.bodyParameter === 'string' ? req.body.bodyParameter.trim() : '';
  if (phone.length < 8 || phone.length > 15 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customerId) || !bodyParameter || bodyParameter.length > 1024) {
    return res.status(400).json({ success: false, error: 'A valid customer, international phone number, and template body parameter are required.' });
  }
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim();
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || '';
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'en';
  const whatsappLanguageConfig = resolveWhatsAppLocaleLanguageMap(process.env.WHATSAPP_TEMPLATE_LANGUAGE_MAP, templateLanguage);
  if (!accessToken || !phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId) || !/^v\d+\.\d+$/.test(graphVersion || '') ||
      !/^[a-z0-9_]{1,512}$/.test(templateName) || !whatsappLanguageConfig.valid || !whatsappLanguageConfig.approvedLanguageCodes.includes(templateLanguage)) {
    return res.status(503).json({ success: false, error: 'Meta WhatsApp is not fully configured. Configure the access token, phone number ID, Graph API version, approved template name, fallback language, and valid WHATSAPP_TEMPLATE_LANGUAGE_MAP on the server.' });
  }
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Secure WhatsApp consent verification is unavailable. No message was sent.' });
  }
  try {
    const { data: consent, error: consentError } = await serverSupabase
      .from('customer_communication_consent_events')
      .select('consent_action,phone_e164,recorded_at')
      .eq('customer_id', customerId)
      .eq('channel', 'WhatsApp')
      .eq('purpose', 'transactional')
      .eq('phone_e164', phone)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (consentError) {
      console.error('[WhatsApp] Consent verification failed:', consentError.message);
      return res.status(503).json({ success: false, error: 'WhatsApp consent could not be verified. No message was sent.' });
    }
    if (!consent || consent.consent_action !== 'granted') {
      return res.status(403).json({ success: false, error: 'The customer has not granted active WhatsApp transactional consent for this phone number. No message was sent.' });
    }
    let selectedTemplateLanguage = templateLanguage;
    const { data: customerPreference, error: customerPreferenceError } = await serverSupabase
      .from('customers').select('preferred_locale').eq('id', customerId).maybeSingle();
    if (customerPreferenceError) {
      console.error('[WhatsApp] Customer locale lookup failed:', customerPreferenceError.message);
      return res.status(503).json({ success: false, error: 'Customer language preference could not be verified. No message was sent.' });
    }
    const preferredLocale = typeof customerPreference?.preferred_locale === 'string'
      ? customerPreference.preferred_locale.trim().toLowerCase()
      : '';
    if (Object.prototype.hasOwnProperty.call(whatsappLanguageConfig.mapping, preferredLocale)) {
      selectedTemplateLanguage = selectWhatsAppTemplateLanguage(preferredLocale, templateLanguage, whatsappLanguageConfig.mapping);
    }

    const providerResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: selectedTemplateLanguage },
          components: [{ type: 'body', parameters: [{ type: 'text', text: bodyParameter }] }],
        },
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
    return res.status(200).json({ success: true, providerName: 'Meta Cloud API', providerMessageId, status: 'sent' });
  } catch (error: any) {
    const message = error?.name === 'TimeoutError'
      ? 'WhatsApp provider request timed out. Delivery could not be confirmed.'
      : 'WhatsApp provider request failed. Please retry after checking the server logs.';
    return res.status(502).json({ success: false, error: message });
  }
});


function constantTimeStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeWhatsAppFailureReason(errors: any[]): { code: string | null; reason: string | null } {
  const first = Array.isArray(errors) ? errors[0] : null;
  if (!first || typeof first !== 'object') return { code: null, reason: null };
  const code = first.code === undefined || first.code === null ? null : String(first.code).slice(0, 40);
  const raw = typeof first.title === 'string' ? first.title : typeof first.message === 'string' ? first.message : '';
  const reason = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 500) || null;
  return { code, reason };
}

// Public GET handshake. The verify token is distinct from the Meta app secret.
app.get('/api/webhooks/whatsapp', rateLimit(30, 60_000), (req: Request, res: Response) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() || '';
  if (!verifyToken) return res.status(503).type('text').send('WhatsApp webhook verification is not configured.');
  const mode = req.query['hub.mode'];
  const suppliedToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode !== 'subscribe' || typeof suppliedToken !== 'string' || typeof challenge !== 'string' ||
      challenge.length < 1 || challenge.length > 256 || !constantTimeStringEqual(suppliedToken, verifyToken)) {
    return res.status(403).type('text').send('Webhook verification failed.');
  }
  return res.status(200).type('text/plain').send(challenge);
});

// Public POST callback. Verify HMAC against the raw bytes before parsing or trusting JSON.
app.post('/api/webhooks/whatsapp', rateLimit(180, 60_000), async (req: Request, res: Response) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || '';
  const configuredPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  if (!appSecret || !/^\d{5,30}$/.test(configuredPhoneNumberId)) return res.status(503).json({ success: false, error: 'WhatsApp webhook signature verification and phone-number configuration are required.' });
  if (!serverSupabase || SUPABASE_KEY_TYPE !== 'service_role') {
    return res.status(503).json({ success: false, error: 'Secure WhatsApp status storage is unavailable.' });
  }
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ success: false, error: 'Invalid webhook body.' });
  const signature = req.header('x-hub-signature-256') || '';
  const suppliedHex = signature.startsWith('sha256=') ? signature.slice(7) : '';
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) {
    return res.status(401).json({ success: false, error: 'Invalid webhook signature.' });
  }
  const expected = createHmac('sha256', appSecret).update(req.body).digest();
  const supplied = Buffer.from(suppliedHex, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    return res.status(401).json({ success: false, error: 'Invalid webhook signature.' });
  }

  let payload: any;
  try { payload = JSON.parse(req.body.toString('utf8')); }
  catch { return res.status(400).json({ success: false, error: 'Invalid webhook JSON.' }); }
  if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    return res.status(400).json({ success: false, error: 'Invalid WhatsApp webhook envelope.' });
  }

  let received = 0;
  try {
    for (const entry of payload.entry) {
      if (!Array.isArray(entry?.changes)) continue;
      for (const change of entry.changes) {
        if (change?.field !== 'messages' || change?.value?.metadata?.phone_number_id !== configuredPhoneNumberId || !Array.isArray(change?.value?.statuses)) continue;
        for (const event of change.value.statuses) {
          const providerMessageId = typeof event?.id === 'string' ? event.id.trim() : '';
          const status = typeof event?.status === 'string' ? event.status.toLowerCase() : '';
          const seconds = typeof event?.timestamp === 'string' || typeof event?.timestamp === 'number'
            ? Number(event.timestamp) : Number.NaN;
          if (!providerMessageId || providerMessageId.length > 255 ||
              !['sent', 'delivered', 'read', 'failed'].includes(status) ||
              !Number.isSafeInteger(seconds) || seconds <= 0 || seconds > Math.floor(Date.now() / 1000) + 86400) continue;
          const eventAt = new Date(seconds * 1000).toISOString();
          const failure = status === 'failed' ? safeWhatsAppFailureReason(event.errors) : { code: null, reason: null };
          const eventKey = createHash('sha256')
            .update([providerMessageId, status, String(seconds), failure.code || '', failure.reason || ''].join('\0'))
            .digest('hex');
          const { error } = await serverSupabase.rpc('record_whatsapp_provider_status', {
            p_event_key: eventKey,
            p_provider_message_id: providerMessageId,
            p_status: status,
            p_event_at: eventAt,
            p_error_code: failure.code,
            p_failure_reason: failure.reason,
          });
          if (error) {
            console.error('[WhatsApp webhook] Status persistence failed:', error.message);
            return res.status(503).json({ success: false, error: 'WhatsApp delivery status could not be stored. Meta may retry this event.' });
          }
          received++;
        }
      }
    }
    // This endpoint tracks outbound delivery only; inbound customer messages are not ingested.
    return res.status(200).json({ success: true, received });
  } catch (error) {
    console.error('[WhatsApp webhook] Event processing failed:', error);
    return res.status(503).json({ success: false, error: 'WhatsApp delivery status processing failed. Meta may retry this event.' });
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
    // Publicly advertise English until another locale passes the full publication gate.
    supportedLanguages: ['en'],
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

  // The public catalogue must use the publishable/anon client so RLS remains
  // authoritative. Never return static/sample tours when Supabase is unavailable.
  if (!publicSupabase) {
    return res.status(503).json({
      success: false,
      error: 'The tour catalogue is temporarily unavailable. Please try again later.',
      tours: [],
      count: 0,
      total: 0,
    });
  }

  try {
    let query = publicSupabase
      .from('tours')
      .select(`
        id,
        title,
        slug,
        short_description,
        destination_id,
        duration,
        duration_hours,
        featured,
        price,
        child_price,
        badge,
        rating,
        review_count,
        sort_order,
        destinations (id, name, slug),
        tour_categories (categories (name)),
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
      return res.status(503).json({
        success: false,
        error: 'The tour catalogue is temporarily unavailable. Please try again later.',
        tours: [],
        count: 0,
        total: 0,
      });
    }

    const tours = (data || []).map((t: any) => {
      const primaryImg = t.tour_images?.find((img: any) => img.is_primary) || t.tour_images?.[0];
      const cats = t.tour_categories?.map((tc: any) => tc.categories?.name).filter(Boolean) || [];
      const rating = Number(t.rating);
      const reviewCount = Number(t.review_count);
      const durationHours = t.duration_hours != null ? Number(t.duration_hours) : undefined;
      return {
        id: t.id,
        slug: t.slug,
        title: t.title,
        shortDescription: t.short_description || '',
        destination: t.destinations?.name || '',
        category: cats[0] || '',
        categories: cats,
        priceEur: Number(t.price) || 0,
        childPriceEur: t.child_price != null ? Number(t.child_price) : undefined,
        durationLabel: t.duration || (durationHours != null ? `${durationHours} Hours` : ''),
        ...(durationHours != null ? { durationHours } : {}),
        rating: Number.isFinite(rating) ? rating : 0,
        reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
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
      error: 'Unable to load the tour catalogue right now.',
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

  const isStaff = userHasPermission(req, 'bookings.read');

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
  const requestedLocale = typeof preferredLanguage === 'string' ? preferredLanguage.trim().toLowerCase() : 'en';
  const customerLocale = TRANSLATION_LOCALES.has(requestedLocale) ? requestedLocale : 'en';
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
          metadata: { preferredLanguage: customerLocale, reSubscribedAt: new Date().toISOString() },
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
          metadata: { preferredLanguage: customerLocale, consentSource: source, consentedAt: new Date().toISOString() },
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
  let welcomeTemplate: { subject: string | null; body_text: string | null; is_active: boolean | null } | null = null;
  const { data: localizedWelcomeTemplate, error: localizedWelcomeTemplateError } = await serverSupabase
    .from('communication_templates')
    .select('subject,body_text,is_active')
    .eq('template_key', 'newsletter_welcome')
    .eq('locale', customerLocale)
    .maybeSingle();
  if (localizedWelcomeTemplateError) {
    console.error('Localized newsletter welcome template lookup failed:', localizedWelcomeTemplateError.message);
  } else {
    welcomeTemplate = localizedWelcomeTemplate;
  }
  if (!welcomeTemplate && customerLocale !== 'en') {
    const { data: englishWelcomeTemplate, error: englishWelcomeTemplateError } = await serverSupabase
      .from('communication_templates')
      .select('subject,body_text,is_active')
      .eq('template_key', 'newsletter_welcome')
      .eq('locale', 'en')
      .maybeSingle();
    if (englishWelcomeTemplateError) {
      console.error('English newsletter welcome template fallback lookup failed:', englishWelcomeTemplateError.message);
    } else {
      welcomeTemplate = englishWelcomeTemplate;
    }
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
  if (!req.user || !req.user.roles?.includes('super_admin')) {
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
  const consentVersion = req.body?.consent_version === '2' ? '2' : '1';
  const analytics = consentVersion === '2' && req.body?.analytics === true;
  const marketing = consentVersion === '2' && req.body?.marketing === true;
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
        ended_at: null,
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
      consent_version: consentVersion,
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

// Reviewed translation workflow. Translation content is never read directly by browser
// Supabase clients; all access is mediated by the AAL2 Super Admin API.
const ENGLISH_UI_CATALOG: Record<string, string> = { ...(TRANSLATIONS.en || {}), ...PRIVATE_UI_SOURCE_CATALOG };
const TRANSLATION_LOCALES = new Set<string>(ROUTABLE_LOCALE_CODES);
const TRANSLATION_ENTITY_TYPES = new Set([
  'tour','tour_itinerary','tour_highlight','tour_inclusion','tour_exclusion',
  'tour_faq','destination','blog_post','static_page','communication_template','ui_catalog',
]);

const TRANSLATION_SOURCE_TABLES: Record<string, string> = {
  tour: 'tours',
  tour_itinerary: 'tour_itinerary',
  tour_highlight: 'tour_highlights',
  tour_inclusion: 'tour_inclusions',
  tour_exclusion: 'tour_exclusions',
  tour_faq: 'tour_faqs',
  destination: 'destinations',
  blog_post: 'blog_posts',
  communication_template: 'communication_templates',
};

function stableTranslationJson(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(stableTranslationJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableTranslationJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

async function getTranslationSource(entityType: string, entityKey: string): Promise<any | null> {
  if (entityType === 'ui_catalog') return entityKey === 'site-ui' ? { id: 'site-ui', slug: 'site-ui', title: 'Interface messages', content: ENGLISH_UI_CATALOG } : null;
  if (!serverSupabase) return null;
  if (entityType === 'static_page') {
    if (entityKey === 'home') return { id: 'home', slug: 'home', title: 'Explore Egypt’s Red Sea Coast', heroHeadline: 'Explore Egypt’s Red Sea Coast', heroSubtitle: 'Boat trips, island visits, snorkeling, diving and desert safaris across Egypt’s Red Sea coast.', sections: [] };
    if (serverSupabase) {
      const { data: setting, error } = await serverSupabase.from('site_settings').select('value').eq('key', 'pages_content').maybeSingle();
      if (error) throw error;
      const raw = setting?.value;
      const pages = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as any).pages) ? (raw as any).pages : [];
      const page = pages.find((item: any) => (item?.slug === entityKey || item?.id === entityKey) && item?.published !== false && item?.status !== 'draft' && item?.status !== 'unpublished');
      if (page) return page;
    }
    return INITIAL_STATIC_PAGES.find((page) => page.slug === entityKey || page.id === entityKey) || null;
  }
  const table = TRANSLATION_SOURCE_TABLES[entityType];
  if (!table) return null;
  let query = serverSupabase.from(table).select('*');
  if (entityType === 'communication_template') query = query.eq('locale', 'en');
  if (entityType === 'blog_post') query = query.in('status', ['published', 'scheduled']).lte('published_at', new Date().toISOString());
  else if (entityType === 'tour' || entityType === 'destination') query = query.eq('status', 'published');
  const { data, error } = await query.eq('id', entityKey).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (entityType.startsWith('tour_') && data.tour_id) {
    const { data: parentTour, error: parentError } = await serverSupabase.from('tours').select('id').eq('id', data.tour_id).eq('status', 'published').maybeSingle();
    if (parentError) throw parentError;
    if (!parentTour) return null;
  }
  if (entityType === 'tour') {
    const relatedTables = [
      ['tour_itinerary', 'itinerary'],
      ['tour_highlights', 'highlights'],
      ['tour_inclusions', 'included'],
      ['tour_exclusions', 'excluded'],
      ['tour_faqs', 'faqs'],
    ] as const;
    const related = await Promise.all(relatedTables.map(async ([table, key]) => {
      const result = await serverSupabase!.from(table).select('*').eq('tour_id', entityKey);
      if (result.error) throw result.error;
      const rows = (result.data || []).slice().sort((a: any, b: any) =>
        Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.id || '').localeCompare(String(b.id || ''))
      );
      return [key, rows] as const;
    }));
    return { ...data, ...Object.fromEntries(related) };
  }
  return data;
}

async function getCurrentTranslationSourceChecksum(entityType: string, entityKey: string): Promise<{ checksum: string; source: any } | null> {
  const source = await getTranslationSource(entityType, entityKey);
  if (!source) return null;
  return { checksum: createHash('sha256').update(stableTranslationJson(source)).digest('hex'), source };
}

// Returns only a reviewed translation whose source checksum still matches the
// current published source record. A stale translation fails closed.
app.get('/api/content-translations/ui', rateLimit(60, 60_000), async (req: Request, res: Response) => {
  const locale = typeof req.query.locale === 'string' ? req.query.locale : '';
  if (!TRANSLATION_LOCALES.has(locale)) return res.status(400).json({ success: false, error: 'Unsupported locale.' });
  if (locale === 'en') return res.json({ success: true, locale, messages: ENGLISH_UI_CATALOG });
  try {
    if (!serverSupabase) return res.status(503).json({ success: false, error: 'Translation service unavailable.' });
    const { data, error } = await serverSupabase.from('content_translations')
      .select('content,source_checksum,reviewed_at,published_at')
      .eq('entity_type', 'ui_catalog').eq('entity_key', 'site-ui')
      .eq('locale', locale).eq('translation_state', 'published').maybeSingle();
    if (error) throw error;
    const current = await getCurrentTranslationSourceChecksum('ui_catalog', 'site-ui');
    const messages = data?.content && typeof data.content === 'object' && !Array.isArray(data.content) ? data.content as Record<string, unknown> : {};
    const englishKeys = Object.keys(ENGLISH_UI_CATALOG);
    const complete = englishKeys.every((key) => typeof messages[key] === 'string' && String(messages[key]).trim().length > 0);
    if (!data?.reviewed_at || !data?.published_at || !current || current.checksum !== data.source_checksum || !complete) {
      return res.status(404).json({ success: false, error: 'A complete, current, reviewed interface catalog is not available.' });
    }
    return res.json({ success: true, locale, messages });
  } catch (error) {
    console.error('[UI translation catalog] Lookup failed:', error);
    return res.status(503).json({ success: false, error: 'Interface translation service temporarily unavailable.' });
  }
});

app.get('/api/content-translations/locales', rateLimit(30, 60_000), async (_req: Request, res: Response) => {
  try {
    if (!serverSupabase) return res.status(503).json({ success: false, error: 'Translation service unavailable.' });
    const { data, error } = await serverSupabase.from('content_translations')
      .select('locale,content,source_checksum,reviewed_at,published_at')
      .eq('entity_type', 'ui_catalog').eq('entity_key', 'site-ui')
      .eq('translation_state', 'published').not('locale', 'is', null).limit(100);
    if (error) throw error;
    const current = await getCurrentTranslationSourceChecksum('ui_catalog', 'site-ui');
    const englishKeys = Object.keys(ENGLISH_UI_CATALOG);
    const uiComplete = (data || []).filter((row) => {
      const messages = row.content && typeof row.content === 'object' && !Array.isArray(row.content) ? row.content as Record<string, unknown> : {};
      return Boolean(row.reviewed_at && row.published_at && current && current.checksum === row.source_checksum &&
        englishKeys.every((key) => typeof messages[key] === 'string' && String(messages[key]).trim().length > 0));
    }).map((row) => row.locale).filter((locale): locale is string => typeof locale === 'string');
    const candidates = await getBulkTranslationCandidates();
    const candidateKeys = candidates.map((item) => item.entity_type + ':' + item.entity_key);
    const completeLocales: string[] = [];
    if (uiComplete.length && candidateKeys.length) {
      const [{ data: publishedRows, error: publishedError }, { data: sourceTemplates, error: sourceTemplateError }, { data: localizedTemplates, error: localizedTemplateError }] = await Promise.all([
        serverSupabase.from('content_translations').select('locale,entity_type,entity_key,source_checksum,reviewed_at,published_at')
          .in('locale', uiComplete).eq('translation_state', 'published')
          .not('reviewed_at', 'is', null).not('published_at', 'is', null).limit(5000),
        serverSupabase.from('communication_templates').select('*').eq('locale', 'en'),
        serverSupabase.from('communication_templates').select('template_key,locale').in('locale', uiComplete),
      ]);
      if (publishedError || sourceTemplateError || localizedTemplateError) throw publishedError || sourceTemplateError || localizedTemplateError;
      const coverage = new Map<string, Set<string>>();
      const communicationChecksums = new Map<string, Map<string, string>>();
      for (const item of publishedRows || []) {
        if (!item.source_checksum) continue;
        if (!coverage.has(item.locale)) coverage.set(item.locale, new Set());
        coverage.get(item.locale)!.add(item.entity_type + ':' + item.entity_key);
        if (item.entity_type === 'communication_template') {
          if (!communicationChecksums.has(item.locale)) communicationChecksums.set(item.locale, new Map());
          communicationChecksums.get(item.locale)!.set(item.entity_key, item.source_checksum);
        }
      }
      const englishTemplateKeys = (sourceTemplates || []).map((item) => item.template_key).filter(Boolean);
      const sourceTemplateChecksums = new Map((sourceTemplates || []).map((item) => [String(item.id), createHash('sha256').update(stableTranslationJson(item)).digest('hex')]));
      const templatesByLocale = new Map<string, Set<string>>();
      for (const item of localizedTemplates || []) {
        if (!templatesByLocale.has(item.locale)) templatesByLocale.set(item.locale, new Set());
        templatesByLocale.get(item.locale)!.add(item.template_key);
      }
      for (const locale of uiComplete) {
        const keys = coverage.get(locale);
        const localizedKeys = templatesByLocale.get(locale);
        const allTemplatesPresent = englishTemplateKeys.every((key) => localizedKeys?.has(key));
        const approvedChecksums = communicationChecksums.get(locale);
        const allTemplateSourcesCurrent = Array.from(sourceTemplateChecksums.entries()).every(([entityKey, checksum]) => approvedChecksums?.get(entityKey) === checksum);
        if (keys && candidateKeys.every((key) => keys.has(key)) && allTemplatesPresent && allTemplateSourcesCurrent) completeLocales.push(locale);
      }
    }
    return res.json({ success: true, locales: completeLocales });
  } catch (error) {
    console.error('[UI translation locales] Lookup failed:', error);
    return res.status(503).json({ success: false, error: 'Interface translation availability is temporarily unavailable.' });
  }
});

async function getTranslationSourceBySlug(entityType: string, slug: string): Promise<any | null> {
  if (entityType === 'static_page') return getTranslationSource(entityType, slug);
  const table = TRANSLATION_SOURCE_TABLES[entityType];
  if (!table || !serverSupabase) return null;
  let query = serverSupabase.from(table).select('id,slug');
  if (entityType === 'blog_post') query = query.in('status', ['published', 'scheduled']).lte('published_at', new Date().toISOString());
  else query = query.eq('status', 'published');
  const { data, error } = await query.eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data || null;
}

app.get('/api/content-translations/target', rateLimit(90, 60_000), async (req: Request, res: Response) => {
  const locale = typeof req.query.locale === 'string' ? req.query.locale : '';
  const requestedPath = typeof req.query.pathname === 'string' ? req.query.pathname : '';
  if (!TRANSLATION_LOCALES.has(locale) || !requestedPath.startsWith('/') || requestedPath.length > 512) {
    return res.status(400).json({ success: false, error: 'A supported locale and valid page path are required.' });
  }
  try {
    const currentLocalePath = parseLocalePath(requestedPath);
    const pathname = currentLocalePath?.pathname || requestedPath;
    const privateRoute = /^\/(?:booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$)|admin(?:\/|$)|support(?:\/|$))/i.test(pathname);
    if (privateRoute) {
      if (locale === 'en') return res.json({ success: true, path: pathname });
      if (/^\/admin(?:\/|$)/i.test(pathname)) return res.status(404).json({ success: false, error: 'The staff admin interface remains English-only.' });
      const current = await getCurrentTranslationSourceChecksum('ui_catalog', 'site-ui');
      const { data, error } = await serverSupabase!.from('content_translations')
        .select('content,source_checksum,reviewed_at,published_at')
        .eq('entity_type', 'ui_catalog').eq('entity_key', 'site-ui')
        .eq('locale', locale).eq('translation_state', 'published').maybeSingle();
      if (error) throw error;
      const messages = data?.content && typeof data.content === 'object' && !Array.isArray(data.content) ? data.content as Record<string, unknown> : {};
      const complete = Object.keys(ENGLISH_UI_CATALOG).every((key) => typeof messages[key] === 'string' && String(messages[key]).trim().length > 0);
      if (!data?.reviewed_at || !data?.published_at || !current || current.checksum !== data.source_checksum || !complete) {
        return res.status(404).json({ success: false, error: 'A complete interface catalog is required for this language.' });
      }
      return res.json({ success: true, path: '/' + locale + (pathname === '/' ? '' : pathname) });
    }

    const parts = pathname.split('/').filter(Boolean);
    const route = parts.length === 2 && parts[0] === 'excursions'
      ? { entityType: 'tour', prefix: '/excursions/' }
      : parts.length === 2 && parts[0] === 'destinations'
        ? { entityType: 'destination', prefix: '/destinations/' }
        : parts.length === 2 && parts[0] === 'blog'
          ? { entityType: 'blog_post', prefix: '/blog/' }
          : parts.length === 1 || parts.length === 0
            ? { entityType: 'static_page', prefix: '/' }
            : null;
    if (!route) return res.status(404).json({ success: false, error: 'This page does not have a translatable route.' });

    const currentSlug = parts[parts.length - 1] || 'home';
    let entityKey = '';
    let source: any = null;
    if (currentLocalePath) {
      const { data: currentTranslation, error } = await serverSupabase!.from('content_translations')
        .select('entity_key,source_checksum')
        .eq('entity_type', route.entityType).eq('locale', currentLocalePath.locale)
        .eq('translated_slug', currentSlug).eq('translation_state', 'published').maybeSingle();
      if (error) throw error;
      if (!currentTranslation) return res.status(404).json({ success: false, error: 'Current page translation not found.' });
      const current = await getCurrentTranslationSourceChecksum(route.entityType, currentTranslation.entity_key);
      if (!current || current.checksum !== currentTranslation.source_checksum) return res.status(409).json({ success: false, error: 'Current page translation is outdated.' });
      entityKey = currentTranslation.entity_key;
      source = current.source;
    } else {
      source = await getTranslationSourceBySlug(route.entityType, currentSlug);
      if (!source) return res.status(404).json({ success: false, error: 'Source page not found.' });
      entityKey = String(source.id || source.slug);
    }

    const sourceSlug = typeof source?.slug === 'string' ? source.slug : currentSlug;
    if (locale === 'en') {
      const englishPath = route.entityType === 'static_page' ? (sourceSlug === 'home' ? '/' : '/' + sourceSlug) : route.prefix + sourceSlug;
      return res.json({ success: true, path: englishPath });
    }

    const { data: target, error: targetError } = await serverSupabase!.from('content_translations')
      .select('translated_slug,source_checksum,reviewed_at,published_at')
      .eq('entity_type', route.entityType).eq('entity_key', entityKey)
      .eq('locale', locale).eq('translation_state', 'published').maybeSingle();
    if (targetError) throw targetError;
    const current = await getCurrentTranslationSourceChecksum(route.entityType, entityKey);
    if (!target?.translated_slug || !target.reviewed_at || !target.published_at || !current || current.checksum !== target.source_checksum) {
      return res.status(404).json({ success: false, error: 'A current reviewed translation is not available for this page.' });
    }
    const targetPath = route.entityType === 'static_page' && target.translated_slug === 'home'
      ? '/' + locale
      : '/' + locale + route.prefix + encodeURIComponent(target.translated_slug);
    return res.json({ success: true, path: targetPath });
  } catch (error) {
    console.error('[Locale route target] Resolution failed:', error);
    return res.status(503).json({ success: false, error: 'Localized route lookup temporarily unavailable.' });
  }
});

app.get('/api/content-translations/resolve', rateLimit(90, 60_000), async (req: Request, res: Response) => {
  const locale = typeof req.query.locale === 'string' ? req.query.locale : '';
  const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type : '';
  const entityKey = typeof req.query.entity_key === 'string' ? req.query.entity_key : '';
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  if (!TRANSLATION_LOCALES.has(locale) || !TRANSLATION_ENTITY_TYPES.has(entityType) || (!entityKey && !slug)) {
    return res.status(400).json({ success: false, error: 'A supported locale, content type, and record key or translated slug are required.' });
  }
  try {
    if (!serverSupabase) return res.status(503).json({ success: false, error: 'Translation service unavailable.' });
    let query = serverSupabase.from('content_translations')
      .select('id,entity_type,entity_key,locale,translated_slug,title,summary,content,seo_title,seo_description,source_checksum,translation_state,reviewed_at,published_at')
      .eq('locale', locale).eq('entity_type', entityType).eq('translation_state', 'published');
    query = entityKey ? query.eq('entity_key', entityKey) : query.eq('translated_slug', slug);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data || !data.reviewed_at || !data.published_at) {
      return res.status(404).json({ success: false, error: 'Reviewed translation not found.' });
    }
    const current = await getCurrentTranslationSourceChecksum(entityType, data.entity_key);
    if (!current || !data.source_checksum || current.checksum !== data.source_checksum) {
      return res.status(409).json({ success: false, error: 'This translation is outdated and requires review.' });
    }
    return res.json({ success: true, translation: data, source: { id: current.source.id || current.source.slug, slug: current.source.slug || null } });
  } catch (error) {
    console.error('[Public translation resolver] Failed:', error);
    return res.status(503).json({ success: false, error: 'Translation service temporarily unavailable.' });
  }
});

// Super Admin + AAL2 bulk translation generation. Every generated row is a draft;
// this endpoint never marks content reviewed or publishes it.
const BULK_TRANSLATION_LOCALES: Record<string, string> = Object.fromEntries(
  EUROPEAN_LOCALE_ROLLOUT.filter((locale) => locale.code !== 'en')
    .map((locale) => [locale.code, locale.englishName]),
);
async function getBulkTranslationCandidates(): Promise<Array<{ entity_type: string; entity_key: string }>> {
  if (!serverSupabase) throw new Error('Translation database unavailable.');
  const results = await Promise.all([
    serverSupabase.from('tours').select('id').eq('status','published').order('sort_order').order('id'),
    serverSupabase.from('destinations').select('id').eq('status','published').order('name').order('id'),
    serverSupabase.from('blog_posts').select('id').in('status',['published','scheduled']).lte('published_at',new Date().toISOString()).order('published_at',{ascending:false}).order('id'),
    serverSupabase.from('site_settings').select('value').eq('key','pages_content').maybeSingle(),
    serverSupabase.from('communication_templates').select('id').eq('locale','en').order('template_key').order('id'),
  ]);
  for (const result of results) if (result.error) throw result.error;
  const out: Array<{entity_type:string;entity_key:string}> = [];
  for (const row of results[0].data || []) out.push({entity_type:'tour',entity_key:String(row.id)});
  for (const row of results[1].data || []) out.push({entity_type:'destination',entity_key:String(row.id)});
  for (const row of results[2].data || []) out.push({entity_type:'blog_post',entity_key:String(row.id)});
  for (const row of results[4].data || []) out.push({entity_type:'communication_template',entity_key:String(row.id)});
  out.push({entity_type:'static_page',entity_key:'home'});
  const raw = results[3].data?.value;
  const pages = Array.isArray(raw) ? raw : raw && Array.isArray(raw.pages) ? raw.pages : [];
  for (const page of pages) if (page?.slug && page.published !== false && page.status !== 'draft' && page.status !== 'unpublished') out.push({entity_type:'static_page',entity_key:String(page.id || page.slug)});
  for (const page of INITIAL_STATIC_PAGES) if (!out.some(x=>x.entity_type==='static_page' && x.entity_key===String(page.id || page.slug))) out.push({entity_type:'static_page',entity_key:String(page.id || page.slug)});
  out.push({entity_type:'ui_catalog',entity_key:'site-ui'});
  return out;
}
function bulkTranslationPayload(type: string, source: any): Record<string, any> {
  if (type==='ui_catalog') return {content:source.content || {}};
  if (type==='tour') return {title:source.title,summary:source.short_description || source.description || '',content:{
    title:source.title,description:source.description || source.short_description || '',durationLabel:source.duration || '',
    highlights:(source.highlights || []).map((x:any)=>x.item || x),itinerary:source.itinerary || [],included:source.included || [],
    excluded:source.excluded || [],faqs:source.faqs || [],pickupInfo:source.pickup_info || '',
    cancellationPolicy:source.cancellation_policy || '',ageRestrictions:source.age_restrictions || '',
    labels:{highlights:'Highlights',itinerary:'Itinerary',included:'Included',excluded:'Not included',faqs:'Frequently asked questions',pickupInfo:'Pickup information',cancellationPolicy:'Cancellation policy',ageRestrictions:'Age restrictions',bookNow:'Book now',browseMore:'Browse more tours'}
  }};
  if (type==='destination') return {title:source.name || source.title,summary:source.tagline || source.description || '',content:{title:source.name || source.title,description:source.description || '',tagline:source.tagline || '',paragraphs:[],labels:{browseMore:'Explore more destinations'}}};
  if (type==='blog_post') return {title:source.title,summary:source.excerpt || source.meta_description || '',content:{title:source.title,excerpt:source.excerpt || '',content:source.content || source.body || ''}};
  if (type==='communication_template') return {title:source.name,summary:source.subject || '',content:{name:source.name,subject:source.subject || '',body_text:source.body_text || '',variables:source.variables || {},channel:source.channel,template_key:source.template_key}};
  return {title:source.title || source.name || 'Explore the Red Sea',summary:source.heroSubtitle || source.description || source.excerpt || '',content:{heroHeadline:source.heroHeadline || source.title || '',heroSubtitle:source.heroSubtitle || source.description || '',sections:source.sections || [],paragraphs:source.paragraphs || [],labels:{browseMore:'Explore more',bookNow:'Book now'}}};
}
function translationStructureMatches(source: any, translated: any): boolean {
  if (typeof source === 'string') {
    if (typeof translated !== 'string') return false;
    if (!source.trim()) return !translated.trim();
    const protectedTokens = source.match(/\{\{[^{}]+\}\}|https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{4,}\d|\b\d+(?:[.,]\d+)?\b/g) || [];
    return Boolean(translated.trim()) && protectedTokens.every((token) => translated.includes(token));
  }
  if (Array.isArray(source)) {
    return Array.isArray(translated) && source.length === translated.length
      && source.every((value, index) => translationStructureMatches(value, translated[index]));
  }
  if (source && typeof source === 'object') {
    if (!translated || typeof translated !== 'object' || Array.isArray(translated)) return false;
    const sourceKeys = Object.keys(source).sort();
    const translatedKeys = Object.keys(translated).sort();
    return sourceKeys.length === translatedKeys.length
      && sourceKeys.every((key, index) => key === translatedKeys[index] && translationStructureMatches(source[key], translated[key]));
  }
  return source === translated;
}
function normalizedTranslationSlug(value: unknown, fallback: string): string {
  const raw = typeof value==='string' ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase() : '';
  return raw.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,160) || fallback.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,160) || 'page';
}
app.post('/api/admin/translations/generate-batch', rateLimit(10,60000), async (req: AuthenticatedRequest,res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  const locale = typeof req.body?.locale==='string' ? req.body.locale : '';
  const offset = Number.isInteger(req.body?.offset) && req.body.offset>=0 ? req.body.offset : 0;
  const limit = Number.isInteger(req.body?.limit) ? Math.min(10,Math.max(1,req.body.limit)) : 10;
  if (!Object.prototype.hasOwnProperty.call(BULK_TRANSLATION_LOCALES,locale)) return res.status(400).json({success:false,error:'Bulk generation supports the configured non-English locales.'});
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({success:false,error:'Server-side OpenAI translation is not configured.'});
  if (!serverSupabase) return res.status(503).json({success:false,error:'Translation database unavailable.'});
  try {
    const candidates = await getBulkTranslationCandidates();
    const page = candidates.slice(offset,offset+limit);
    const prepared: Array<{type:string;key:string;checksum:string;source:any;payload:any}> = [];
    for (const candidate of page) {
      const current = await getCurrentTranslationSourceChecksum(candidate.entity_type,candidate.entity_key);
      if (current) prepared.push({type:candidate.entity_type,key:candidate.entity_key,checksum:current.checksum,source:current.source,payload:bulkTranslationPayload(candidate.entity_type,current.source)});
    }
    const {data:existing,error:existingError} = await serverSupabase.from('content_translations').select('entity_type,entity_key,translated_slug,translation_state,reviewed_at,published_at').eq('locale',locale).limit(2000);
    if (existingError) throw existingError;
    const known = new Map((existing || []).map((x:any)=>[x.entity_type+':'+x.entity_key,x]));
    const work = prepared.filter(x=>{const old:any=known.get(x.type+':'+x.key);return !old || (old.translation_state==='draft' && !old.reviewed_at && !old.published_at);});
    const workKeys = new Set(work.map((x)=>x.type+':'+x.key));
    const usedSlugs = new Set((existing || []).filter((x:any)=>!workKeys.has(x.entity_type+':'+x.entity_key)).map((x:any)=>x.translated_slug).filter(Boolean));
    let saved=0, skipped=prepared.length-work.length;
    if (work.length) {
      const prompt = [
        'You are a professional tourism translator localizing Awesome Adventure Tours, a licensed operator in Hurghada, Egypt.',
        'Translate every human-facing string recursively into '+BULK_TRANSLATION_LOCALES[locale]+' ('+locale+').',
        'Return only valid JSON: {"translations":[{"entity_type":"...","entity_key":"...","title":"...","translated_slug":"...","summary":"...","seo_title":"...","seo_description":"...","content":{...}}]}. Return exactly one item per input and preserve entity_type and entity_key exactly.',
        'Preserve all JSON keys, arrays, order, object shapes and non-string values. Translate all prose, labels, headings, FAQs, itinerary and UI message values.',
        'Never invent or change prices, currencies, numbers, dates, times, durations, pickup details, age limits, safety requirements, inclusions, exclusions, cancellation terms, legal claims, contacts, URLs, emails, phone numbers, IDs or brand/place names. Copy factual values exactly. In communication templates preserve every {{placeholder}} token byte-for-byte and do not translate variable names.',
        'translated_slug must be a natural short lowercase ASCII slug using only a-z, 0-9 and hyphens. For ui_catalog use site-ui. For communication templates, preserve template_key and variables exactly; preserve every {{placeholder}} in both subject and body_text exactly. Keep empty source strings empty. Do not omit fields or add commentary.',
        locale === 'ar'
          ? 'For Arabic, use clear Modern Standard Arabic suitable for international visitors to Egypt. Preserve official place, vessel and brand names accurately; do not invent local claims. The UI will render right-to-left, so return natural Arabic text without manual visual reordering.'
          : 'Use natural, locally fluent language for the target locale. SEO title should be concise; SEO description accurate. No unsupported claims.',
        'INPUT: '+JSON.stringify(work.map(x=>({entity_type:x.type,entity_key:x.key,source:x.payload})))
      ].join('\n');
      const generatedText = await generateOpenAITranslationBatch(prompt, process.env.OPENAI_API_KEY, process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4o-mini');
      const parsed = JSON.parse(generatedText.replace(/^\\x60{3}(?:json)?\\s*/i,'').replace(/\\s*\\x60{3}$/,''));
      if (!Array.isArray(parsed?.translations)) throw new Error('AI returned an invalid translation batch.');
      const byKey = new Map(parsed.translations.map((x:any)=>[x.entity_type+':'+x.entity_key,x]));
      for (const item of work) {
        const translated:any = byKey.get(item.type+':'+item.key);
        if (!translated || !translated.content || typeof translated.content!=='object' || Array.isArray(translated.content) || !translationStructureMatches(item.payload.content, translated.content)) {skipped++;continue;}
        if (item.type !== 'ui_catalog' && item.payload.title && !String(translated.title || '').trim()) {skipped++;continue;}
        if (item.type === 'communication_template' && (translated.content.template_key !== item.source.template_key || translated.content.channel !== item.source.channel || JSON.stringify(translated.content.variables || {}) !== JSON.stringify(item.source.variables || {}))) {skipped++;continue;}
        const latest = await getCurrentTranslationSourceChecksum(item.type,item.key);
        if (!latest || latest.checksum!==item.checksum) {skipped++;continue;}
        const isUi = item.type==='ui_catalog';
        if (isUi) {
          const keys=Object.keys(ENGLISH_UI_CATALOG);
          if (!keys.every(key=>typeof translated.content[key]==='string' && String(translated.content[key]).trim())) {skipped++;continue;}
        }
        let translatedSlug = isUi ? 'site-ui' : (item.type==='static_page' && item.key==='home' ? 'home' : item.type==='communication_template' ? 'template-'+String(item.source.template_key || item.key) : normalizedTranslationSlug(translated.translated_slug,item.source.slug || item.source.title || item.source.name || item.key));
        if (usedSlugs.has(translatedSlug)) translatedSlug = translatedSlug.slice(0,140) + '-' + createHash('sha256').update(item.type + ':' + item.key).digest('hex').slice(0,8);
        usedSlugs.add(translatedSlug);
        const record = {entity_type:item.type,entity_key:item.key,locale,translated_slug:translatedSlug,
          title:isUi?'Interface messages':String(translated.title || '').trim().slice(0,300),
          summary:String(translated.summary || '').trim().slice(0,2000),
          seo_title:isUi?null:String(translated.seo_title || translated.title || '').trim().slice(0,300),
          seo_description:isUi?null:String(translated.seo_description || translated.summary || '').trim().slice(0,500),
          content:translated.content,source_checksum:item.checksum,translation_state:'draft',reviewed_by:null,reviewed_at:null,published_at:null,updated_at:new Date().toISOString()};
        const {error}=await serverSupabase.from('content_translations').upsert(record,{onConflict:'entity_type,entity_key,locale'});
        if(error) throw error;
        saved++;
      }
    }
    const { error: auditError } = await serverSupabase.from('audit_logs').insert({ user_id: req.user!.id, action: 'CONTENT_TRANSLATION_BULK_DRAFT_GENERATED', entity_type: 'content_translation_batch', entity_id: null, new_data: { locale, offset, requested: page.length, saved, skipped, total: candidates.length } });
    if (auditError) console.warn('[Bulk translation generation] Audit event could not be persisted.');
    return res.json({success:true,locale,processed:saved,skipped,total:candidates.length,next_offset:Math.min(offset+limit,candidates.length),done:offset+limit>=candidates.length});
  } catch(error) {
    console.error('[Bulk translation generation] Failed:',error);
    return res.status(502).json({success:false,error:'Translation generation failed for this batch. No translations were published; retry this batch.'});
  }
});

// Authoring helper: return the authoritative source checksum from the server,
// not a checksum typed or calculated by the browser.
app.get('/api/admin/translations/source', rateLimit(30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type : '';
  const entityKey = typeof req.query.entity_key === 'string' ? req.query.entity_key.trim() : '';
  if (!TRANSLATION_ENTITY_TYPES.has(entityType) || !entityKey) return res.status(400).json({ success: false, error: 'A valid content type and source record key are required.' });
  try {
    const current = await getCurrentTranslationSourceChecksum(entityType, entityKey);
    if (!current) return res.status(404).json({ success: false, error: 'Source record not found or not published.' });
    const source = current.source;
    return res.json({
      success: true, source_checksum: current.checksum,
      source: {
        id: source.id || source.slug, slug: source.slug || null,
        title: source.title || source.name || null,
        summary: source.short_description || source.description || source.tagline || source.excerpt || null,
        content: entityType === 'static_page'
          ? { heroHeadline: source.heroHeadline, heroSubtitle: source.heroSubtitle, sections: source.sections }
          : entityType === 'blog_post'
            ? { title: source.title, excerpt: source.excerpt, content: source.content }
            : entityType === 'ui_catalog'
          ? (source.content || {})
          : entityType === 'communication_template'
            ? { name: source.name, subject: source.subject, body_text: source.body_text, variables: source.variables || {}, channel: source.channel, template_key: source.template_key }
            : entityType === 'tour'
              ? {
                  title: source.title, description: source.description || source.short_description, durationLabel: source.duration,
                  highlights: (source.highlights || []).map((item: any) => item.item || item), itinerary: source.itinerary || [],
                  included: source.included || [], excluded: source.excluded || [], faqs: source.faqs || [],
                  pickup_info: source.pickup_info || null, cancellation_policy: source.cancellation_policy || null,
                  age_restrictions: source.age_restrictions || null,
                }
              : { title: source.title || source.name, description: source.description || source.short_description, tagline: source.tagline || null, distance_from_airport: source.distance_from_airport || null },
      },
    });
  } catch (error) {
    console.error('[Translation source] Failed:', error);
    return res.status(503).json({ success: false, error: 'Could not retrieve the current source record.' });
  }
});

app.get('/api/admin/translations', rateLimit(30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  const locale = typeof req.query.locale === 'string' ? req.query.locale : '';
  const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type : '';
  if (locale && !TRANSLATION_LOCALES.has(locale)) return res.status(400).json({ success: false, error: 'Unsupported locale.' });
  if (entityType && !TRANSLATION_ENTITY_TYPES.has(entityType)) return res.status(400).json({ success: false, error: 'Unsupported content type.' });
  try {
    let query = serverSupabase!.from('content_translations')
      .select('id,entity_type,entity_key,locale,translated_slug,title,summary,content,seo_title,seo_description,source_checksum,translation_state,reviewed_by,reviewed_at,published_at,updated_at')
      .order('updated_at', { ascending: false }).limit(200);
    if (locale) query = query.eq('locale', locale);
    if (entityType) query = query.eq('entity_type', entityType);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ success: true, translations: data || [] });
  } catch (error) {
    console.error('[Translation editor] Could not list translations:', error);
    return res.status(503).json({ success: false, error: 'Translation records are temporarily unavailable.' });
  }
});

app.post('/api/admin/translations', rateLimit(30, 60_000), async (req: AuthenticatedRequest, res: Response) => {
  if (!requireSuperAdminAal2(req, res)) return;
  const body = req.body || {};
  const entityType = typeof body.entity_type === 'string' ? body.entity_type : '';
  const entityKey = typeof body.entity_key === 'string' ? body.entity_key.trim().slice(0, 180) : '';
  const locale = typeof body.locale === 'string' ? body.locale : '';
  const state = typeof body.translation_state === 'string' ? body.translation_state : 'draft';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : '';
  const translatedSlug = typeof body.translated_slug === 'string' ? body.translated_slug.trim().toLowerCase().slice(0, 180) : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 2000) : '';
  const seoTitle = typeof body.seo_title === 'string' ? body.seo_title.trim().slice(0, 300) : '';
  const seoDescription = typeof body.seo_description === 'string' ? body.seo_description.trim().slice(0, 500) : '';
  const sourceChecksum = typeof body.source_checksum === 'string' ? body.source_checksum.trim().slice(0, 128) : '';
  const translationContent = body.content && typeof body.content === 'object' && !Array.isArray(body.content) ? body.content : null;
  if (!TRANSLATION_ENTITY_TYPES.has(entityType) || !entityKey || !TRANSLATION_LOCALES.has(locale)) {
    return res.status(400).json({ success: false, error: 'Choose a valid content type, source record key, and locale.' });
  }
  if (!['draft','review','published','outdated'].includes(state)) {
    return res.status(400).json({ success: false, error: 'Invalid translation lifecycle state.' });
  }
  if (!translationContent || !/^[a-f0-9]{64}$/i.test(sourceChecksum)) {
    return res.status(400).json({ success: false, error: 'Translation content and a 64-character SHA-256 source checksum are required.' });
  }
  if (state === 'published') {
    if (body.confirm_publish !== true) return res.status(400).json({ success: false, error: 'Publishing requires explicit confirmation.' });
    if (entityType === 'ui_catalog') {
      const source = await getTranslationSource('ui_catalog', entityKey);
      const keys = Object.keys(source?.content || {});
      const complete = keys.length > 0 && keys.every((key) => typeof translationContent[key] === 'string' && String(translationContent[key]).trim().length > 0);
      if (!complete) return res.status(400).json({ success: false, error: 'The interface catalog must translate every source UI message before publication.' });
    } else if (entityType === 'communication_template') {
      const source = await getTranslationSource(entityType, entityKey);
      const translatedBody = typeof translationContent.body_text === 'string' ? translationContent.body_text : '';
      const sourceTokens = (String(source?.subject || '') + '\\n' + String(source?.body_text || '')).match(/\{\{[^{}]+\}\}/g) || [];
      const translatedTokens = (String(translationContent.subject || '') + '\\n' + translatedBody).match(/\{\{[^{}]+\}\}/g) || [];
      if (!source || !translatedBody.trim() || sourceTokens.sort().join('|') !== translatedTokens.sort().join('|')) {
        return res.status(400).json({ success: false, error: 'Publishing a communication template requires a body and every original {{placeholder}} token unchanged.' });
      }
    } else if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(translatedSlug) || !seoTitle || !seoDescription) {
      return res.status(400).json({ success: false, error: 'Publishing requires a translated title and slug, SEO title and description, and a source checksum.' });
    }
  }
  if (state !== 'outdated') {
    try {
      const currentSource = await getCurrentTranslationSourceChecksum(entityType, entityKey);
      if (!currentSource) return res.status(404).json({ success: false, error: 'The source record does not exist or is not published.' });
      if (currentSource.checksum !== sourceChecksum) return res.status(409).json({ success: false, error: 'The source content changed. Reload the source snapshot before saving this translation.' });
    } catch (error) {
      console.error('[Translation editor] Source verification failed:', error);
      return res.status(503).json({ success: false, error: 'Could not verify the current source record.' });
    }
  }
  if (state === 'published' && Object.keys(translationContent).length === 0) {
    return res.status(400).json({ success: false, error: 'Published translations must contain translated content.' });
  }
  const now = new Date().toISOString();
  const record = {
    entity_type: entityType, entity_key: entityKey, locale, translated_slug: translatedSlug || null,
    title: title || null, summary: summary || null, content: translationContent,
    seo_title: seoTitle || null, seo_description: seoDescription || null, source_checksum: sourceChecksum,
    translation_state: state,
    reviewed_by: state === 'published' ? req.user!.id : null,
    reviewed_at: state === 'published' ? now : null,
    published_at: state === 'published' ? now : null,
    updated_at: now,
  };
  try {
    const { data, error } = await serverSupabase!.from('content_translations')
      .upsert(record, { onConflict: 'entity_type,entity_key,locale' })
      .select('id,entity_type,entity_key,locale,translated_slug,title,summary,content,seo_title,seo_description,source_checksum,translation_state,reviewed_by,reviewed_at,published_at,updated_at')
      .single();
    if (error) throw error;
    if (state === 'published' && entityType === 'communication_template') {
      const sourceTemplate = await getTranslationSource(entityType, entityKey);
      if (!sourceTemplate) throw new Error('The English communication template source is no longer available.');
      const { error: templateError } = await serverSupabase!.from('communication_templates').upsert({
        template_key: sourceTemplate.template_key, name: String(translationContent.name || title || sourceTemplate.name),
        channel: sourceTemplate.channel, subject: String(translationContent.subject || ''),
        body_text: String(translationContent.body_text), variables: sourceTemplate.variables || {},
        is_active: Boolean(sourceTemplate.is_active), locale,
        updated_at: now,
      }, { onConflict: 'template_key,locale' });
      if (templateError) throw templateError;
    }
    await writeAccountAudit(req.user!.id, state === 'published' ? 'CONTENT_TRANSLATION_PUBLISHED' : 'CONTENT_TRANSLATION_SAVED', data.id, {
      entity_type: entityType, entity_key: entityKey, locale, translation_state: state,
    });
    return res.status(200).json({ success: true, translation: data });
  } catch (error) {
    console.error('[Translation editor] Could not save translation:', error);
    return res.status(409).json({ success: false, error: 'The translation could not be saved. Check for a duplicate translated slug or retry.' });
  }
});

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
      roles: req.user.roles,
      permissions: req.user.permissions,
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

      const isStaff = userHasPermission(req, 'bookings.read');

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
      if (!userHasPermission(req, 'analytics.read')) {
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
            verifiedRole: req.user?.role || 'unknown',
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
  '/destinations',
  '/experiences',
  '/blog',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/cancellation-policy',
  '/cookie-policy',
];

async function loadAwesomeAdventureToursSeoIndexExclusions(): Promise<{ pageSlugs: Set<string>; entityIds: Set<string> }> {
  const pageSlugs = new Set<string>();
  const entityIds = new Set<string>();
  if (!publicSupabase) return { pageSlugs, entityIds };
  try {
    const { data, error } = await publicSupabase.from('seo_metadata').select('entity_type,entity_id,page_slug').eq('robots_index', false);
    if (error) { console.warn('[SEO discovery] Index exclusion lookup failed:', error.message); return { pageSlugs, entityIds }; }
    for (const row of data || []) {
      const type = typeof row.entity_type === 'string' ? row.entity_type.trim() : '';
      const id = row.entity_id == null ? '' : String(row.entity_id).trim();
      const slug = typeof row.page_slug === 'string' ? row.page_slug.trim() : '';
      // The About page is explicitly kept indexable by the public HTML renderer; keep discovery files aligned.
      if (type === 'page' && slug && slug !== 'about') pageSlugs.add(slug);
      else if (type && id) entityIds.add(type + ':' + id);
    }
  } catch (error) { console.warn('[SEO discovery] Index exclusion lookup failed:', error); }
  return { pageSlugs, entityIds };
}

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
  const alternatesByUrl = new Map<string, Map<string, string>>();
  const seoExclusions = await loadAwesomeAdventureToursSeoIndexExclusions();
  for (const route of AWESOME_ADVENTURE_TOURS_CORE_PUBLIC_PATHS) {
    const pageSlug = route === '/' ? 'home' : route.slice(1);
    if (seoExclusions.pageSlugs.has(pageSlug)) continue;
    urls.set(`${AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN}${route === '/' ? '/' : route}`, undefined);
  }

  if (publicSupabase) {
    try {
      const { data: tours, error: toursError } = await publicSupabase
        .from('tours')
        .select('id,slug,updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .limit(5000);

      if (toursError) {
        console.warn('[SEO sitemap] Published tour query failed:', toursError.message);
      } else {
        for (const tour of tours || []) {
          const slug = typeof tour.slug === 'string' ? tour.slug.trim() : '';
          if (seoExclusions.entityIds.has('tour:' + String(tour.id))) continue;
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
          if (page?.published === false || page?.status === 'draft' || page?.status === 'unpublished' || page?.seoIndexable === false || seoExclusions.pageSlugs.has(slug)) continue;
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
        publicSupabase.from('destinations').select('id,name,slug,updated_at,tagline,description').eq('status', 'published'),
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
          const name = cleanPublicText(destination.name, 120);
          const tourCount = destinationTourCounts.get(String(destination.id)) || 0;
          const descriptionLength = cleanPublicText(destination.description, 4000).length
            + cleanPublicText(destination.tagline, 500).length;
          if (!name || seoExclusions.entityIds.has('destination:' + String(destination.id)) || (tourCount < 2 && descriptionLength < 650)) continue;
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
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) || seoExclusions.pageSlugs.has(slug)) continue;
          urls.set(`${AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN}/blog/${encodeURIComponent(slug)}`, toSitemapDate(post.updated_at));
        }
      }
    } catch (error) {
      console.warn('[SEO sitemap] Blog catalogue could not be loaded:', error);
    }
  }

  // Include only locale URLs whose translation is published, reviewed and still matches its source.
  if (serverSupabase) {
    try {
      const { data: translations, error } = await serverSupabase.from('content_translations')
        .select('entity_type,entity_key,locale,translated_slug,source_checksum,published_at,reviewed_at')
        .eq('translation_state', 'published').not('translated_slug', 'is', null).limit(5000);
      if (error) throw error;
      const sourceCache = new Map<string, { checksum: string; source: any } | null>();
      const alternatesByEntity = new Map<string, Map<string, string>>();
      for (const item of translations || []) {
        if (!item.translated_slug || !item.locale || !item.reviewed_at || !item.published_at) continue;
        const routePrefix = item.entity_type === 'tour' ? '/excursions/'
          : item.entity_type === 'destination' ? '/destinations/'
            : item.entity_type === 'blog_post' ? '/blog/'
              : item.entity_type === 'static_page' ? '/' : null;
        if (!routePrefix) continue;
        const cacheKey = item.entity_type + ':' + item.entity_key;
        if (!sourceCache.has(cacheKey)) {
          sourceCache.set(cacheKey, await getCurrentTranslationSourceChecksum(item.entity_type, item.entity_key));
        }
        const current = sourceCache.get(cacheKey);
        if (!current || current.checksum !== item.source_checksum) continue;
        const sourceSlug = typeof current.source?.slug === 'string' ? current.source.slug : '';
        if (!sourceSlug) continue;
        const englishPath = item.entity_type === 'static_page'
          ? (sourceSlug === 'home' ? '/' : '/' + encodeURIComponent(sourceSlug))
          : routePrefix + encodeURIComponent(sourceSlug);
        const translatedPath = item.entity_type === 'static_page' && item.translated_slug === 'home'
          ? '/' + item.locale
          : '/' + item.locale + routePrefix + encodeURIComponent(item.translated_slug);
        const englishUrl = AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN + englishPath;
        const translatedUrl = AWESOME_ADVENTURE_TOURS_PUBLIC_ORIGIN + translatedPath;
        urls.set(translatedUrl, toSitemapDate(item.published_at));
        let alternates = alternatesByEntity.get(cacheKey);
        if (!alternates) {
          alternates = new Map<string, string>();
          alternates.set('en', englishUrl);
          alternates.set('x-default', englishUrl);
          alternatesByEntity.set(cacheKey, alternates);
        }
        alternates.set(item.locale, translatedUrl);
      }
      for (const alternates of alternatesByEntity.values()) {
        for (const url of alternates.values()) alternatesByUrl.set(url, alternates);
      }
    } catch (error) {
      console.warn('[SEO sitemap] Reviewed localized pages could not be loaded:', error);
    }
  }

  const entries = Array.from(urls.entries()).map(([loc, lastmod]) => {
    const alternates = alternatesByUrl.get(loc);
    const hreflangLinks = alternates
      ? Array.from(alternates.entries()).map(([hreflang, href]) =>
          `<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`
        ).join('')
      : '';
    return `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}${hreflangLinks}</url>`;
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
  ].join('\n');

  res.status(200);
  res.type('application/xml');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return res.send(xml);
});

app.get('/llms.txt', async (_req: Request, res: Response) => {
  const seoExclusions = await loadAwesomeAdventureToursSeoIndexExclusions();
  const lines = [
    '# Awesome Adventure Tours',
    '',
    '> Explore excursions and experiences across Egypt’s Red Sea coast. Tour pages provide current published descriptions, inclusions, pricing and booking details.',
    '',
    '## Business identity',
    '- Operator: Awesome Adventure Tours',
    '- Telephone: +20 151 5212741',
    '- Office: 2nd floor, Bostan Cafe, Madres, Hurghada, Red Sea Governorate, Egypt',
    '- Service area: Hurghada and Egypt’s Red Sea coast',
    '- Customer-service languages: Multilingual support for international travellers; contact us in your preferred language',
    '- TripAdvisor listing and traveller feedback: https://www.tripadvisor.co.uk/Attraction_Review-g297549-d34759384-Reviews-Awesome_Adventure_Tours-Hurghada_Red_Sea_and_Sinai.html',
    '',
    '## Main pages',
    '- [Homepage](https://awesomeadventure.tours/)',
    '- [About](https://awesomeadventure.tours/about)',
    '- [Contact](https://awesomeadventure.tours/contact)',
    '- [Experiences](https://awesomeadventure.tours/experiences)',
    '- [Destinations](https://awesomeadventure.tours/destinations)',
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
        .select('id,title,slug,short_description,price,currency')
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .limit(500);

      if (error) {
        console.warn('[SEO llms.txt] Published tour query failed:', error.message);
      } else {
        for (const tour of tours || []) {
          const slug = typeof tour.slug === 'string' ? tour.slug.trim() : '';
          const title = cleanPublicText(tour.title, 160);
          if (!title || seoExclusions.entityIds.has('tour:' + String(tour.id)) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
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
          if (!name || seoExclusions.entityIds.has('destination:' + String(destination.id)) || (tourCount < 2 && descriptionLength < 650)) continue;
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
          if (!title || seoExclusions.pageSlugs.has(slug) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
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
    description: 'Read-only discovery and lookup of published Awesome Adventure Tours tours and experiences across Egypt. No booking, customer data, payments or administrative actions are exposed.',
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
  const privateRoute = /^\/(?:[a-z]{2}\/)?(?:admin(?:\/|$)|booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$)|support(?:\/|$))/i;
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

function seoBoundedTitle(value: unknown): string {
  const clean = seoPlainText(value, 240);
  if (clean.length <= 60) return clean;
  const withoutBrand = clean
    .replace(/^Awesome Adventure Tours\s*[|:–—-]\s*/i, '')
    .replace(/\s*[|:–—-]\s*Awesome Adventure Tours(?: Journal)?$/i, '')
    .trim();
  if (withoutBrand.length <= 60) return withoutBrand;
  const shortened = withoutBrand.slice(0, 57).replace(/\s+\S*$/, '').trim();
  return shortened ? shortened + '…' : withoutBrand.slice(0, 60);
}

function seoBoundedDescription(value: unknown): string {
  const clean = seoPlainText(value, 1200);
  if (clean.length <= 160) return clean;
  const firstSentence = clean.match(/^.{70,160}?[.!?](?:\s|$)/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= 160) return firstSentence;
  const shortened = clean.slice(0, 157).replace(/\s+\S*$/, '').trim();
  return shortened ? shortened + '…' : clean.slice(0, 160);
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
  // partial page list. CMS content wins, while missing SEO metadata and hero
  // fields inherit safe, reviewed defaults from the matching static page.
  const staticPageBySlug = new Map<string, typeof INITIAL_STATIC_PAGES[number]>(INITIAL_STATIC_PAGES.map((page) => [page.slug, page] as const));
  const mergedPages = publishedPages.map((page: any) => {
    const fallback = typeof page?.slug === 'string' ? staticPageBySlug.get(page.slug) : undefined;
    if (!fallback) return page;
    return {
      ...fallback,
      ...page,
      title: page.title || fallback.title,
      heroHeadline: page.heroHeadline || page.hero_headline || fallback.heroHeadline,
      heroSubtitle: page.heroSubtitle || page.hero_subtitle || fallback.heroSubtitle,
      seoTitle: page.seoTitle || page.seo_title || fallback.seoTitle,
      seoDescription: page.seoDescription || page.seo_description || fallback.seoDescription,
      seoIndexable: page.seoIndexable ?? page.seo_indexable ?? fallback.seoIndexable,
    };
  });
  const cmsSlugs = new Set(mergedPages
    .map((page: any) => typeof page?.slug === 'string' ? page.slug : '')
    .filter(Boolean));
  return [
    ...mergedPages,
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
  const requestedPath = pathname.replace(/\/+$/, '') || '/';
  const localePath = parseLocalePath(requestedPath);
  let path = localePath?.pathname || requestedPath;
  let localizedTranslation: any = null;
  if (localePath) {
    const parts = path.split('/').filter(Boolean);
    const route = parts.length === 2 && parts[0] === 'excursions'
      ? { entityType: 'tour', prefix: '/excursions/' }
      : parts.length === 2 && parts[0] === 'destinations'
        ? { entityType: 'destination', prefix: '/destinations/' }
        : parts.length === 2 && parts[0] === 'blog'
          ? { entityType: 'blog_post', prefix: '/blog/' }
          : parts.length === 1 || parts.length === 0
            ? { entityType: 'static_page', prefix: '/' }
            : null;
    if (route && serverSupabase) {
      try {
        const { data, error } = await serverSupabase.from('content_translations')
          .select('id,entity_type,entity_key,locale,translated_slug,title,summary,content,seo_title,seo_description,source_checksum,translation_state,reviewed_at,published_at')
          .eq('entity_type', route.entityType).eq('locale', localePath.locale)
          .eq('translated_slug', parts[parts.length - 1] || 'home').eq('translation_state', 'published').maybeSingle();
        if (error) throw error;
        if (data?.reviewed_at && data?.published_at) {
          const current = await getCurrentTranslationSourceChecksum(route.entityType, data.entity_key);
          if (current && current.checksum === data.source_checksum) {
            localizedTranslation = data;
            const sourceSlug = typeof current.source.slug === 'string' ? current.source.slug : '';
            path = route.entityType === 'static_page' ? (sourceSlug === 'home' ? '/' : '/' + sourceSlug) : route.prefix + sourceSlug;
          }
        }
      } catch (error) {
        console.error('[Localized SSR] Translation resolution failed:', error);
      }
    }
    if (!localizedTranslation) path = '/__localized_translation_unavailable__';
  }
  const origin = 'https://awesomeadventure.tours';
  let title = 'Awesome Adventure Tours | Boat Trips, Island Tours & Safaris';
  let description = 'Discover boat trips, island experiences, snorkeling, diving and desert safaris across Egypt. Compare tour details and book with confidence.';
  let body = '';
  let noindex = false;
  let nofollow = false;
  let statusCode = 200;
  let pageKind: 'home' | 'catalogue' | 'destinations' | 'experiences' | 'tour' | 'destination' | 'static' | 'blog-index' | 'blog' | 'not-found' = 'not-found';
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

  if (localePath && !localizedTranslation) {
    statusCode = 404;
    noindex = true;
    nofollow = false;
    title = 'This translation is unavailable | Awesome Adventure Tours';
    description = 'A current reviewed translation for this page is not available.';
    body = '<main id="seo-initial-content"><h1>This translation is unavailable</h1><p>This page has no current reviewed translation. Browse the original page instead.</p><p><a href="/excursions">Browse excursions</a></p></main>';
  } else if (path === '/' || path === '/excursions' || path === '/destinations') {
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
    visibleDestinations = path === '/destinations'
      ? allDestinations
      : allDestinations.filter((destination) => publishedDestinationIds.has(String(destination.id)));
  }

  if (path === '/') {
    pageKind = 'home';
    const cards = tours.slice(0, 6).map(seoTourCard).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><h1>Explore Egypt’s Boat Trips, Island Tours & Safaris</h1>
      <p>Discover the excursions currently published on Awesome Adventure Tours. Compare available boat trips, island experiences, snorkeling activities and other Red Sea tours using the individual excursion details.</p>
      <h2>Explore destinations</h2>
      <div class="seo-grid">${(visibleDestinations || []).map(seoDestinationCard).filter(Boolean).join('')}</div>
      <h2>Explore published excursions</h2><p><a href="/excursions">Browse all excursions</a></p>
      <div class="seo-grid">${cards || '<p>Explore the excursions catalogue for currently published experiences and details.</p>'}</div>
      <h2>About Awesome Adventure Tours</h2><p>Explore our <a href="/about">about page</a>, learn about <a href="/booking-conditions">booking terms and conditions</a>, or <a href="/contact">contact our Hurghada team</a>.</p>
      <p>Phone: <a href="tel:+201515212741">+20 151 5212741</a></p></main>`;
  } else if (path === '/destinations') {
    pageKind = 'destinations';
    seoIdentifier = 'destinations';
    title = 'Explore Egypt Destinations & Excursions | Awesome Adventure Tours';
    description = 'Explore the destinations served by Awesome Adventure Tours across Egypt. Discover each location and browse available boat trips, island experiences and adventures.';
    const cards = visibleDestinations.map(seoDestinationCard).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / Destinations</nav>
      <h1>Explore Our Destinations in Egypt</h1>
      <p>Discover the destinations served by Awesome Adventure Tours. Explore each location, compare available excursions and choose the experiences that suit your trip.</p>
      <div class="seo-grid">${cards || '<p>Destination information is being updated. Please browse our <a href="/excursions">published excursions</a>.</p>'}</div>
      <p><a href="/excursions">Browse all excursions</a></p></main>`;
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
    title = 'Boat Trips & Island Tours in Egypt | Awesome Adventure Tours';
    description = 'Browse boat trips, island experiences, snorkeling activities and desert adventures across Egypt. Compare durations, inclusions and prices.';
    const cards = tours.map(seoTourCard).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / Excursions</nav>
      <h1>Boat Trips & Island Tours in Egypt</h1>
      <p>Browse the excursions currently published on Awesome Adventure Tours. Review each tour’s description, duration, price and booking details.</p>
      <div class="seo-grid">${cards || '<p>There are currently no published excursions to display.</p>'}</div>
      <h2>Explore by destination</h2>
      <div class="seo-grid">${(visibleDestinations || []).map(seoDestinationCard).filter(Boolean).join('')}</div></main>`;
  } else if (path.startsWith('/excursions/')) {
    let slug = '';
    try { slug = decodeURIComponent(path.slice('/excursions/'.length)); } catch { slug = ''; }
    if (publicSupabase && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
      try {
        // Fetch the tour and all SEO-visible child content in one PostgREST request.
        // This avoids six separate database round trips for every public detail page.
        const { data, error } = await publicSupabase.from('tours')
          .select(`
            id,slug,title,short_description,description,price,currency,duration,duration_hours,
            pickup_info,cancellation_policy,
            tour_images(image_url,alt_text,is_primary,sort_order),
            tour_highlights(item,sort_order),
            tour_inclusions(item,sort_order),
            tour_exclusions(item,sort_order),
            tour_itinerary(time,title,description,sort_order)
          `)
          .eq('slug', slug)
          .eq('status', 'published')
          .order('sort_order', { ascending: true, referencedTable: 'tour_images' })
          .order('sort_order', { ascending: true, referencedTable: 'tour_highlights' })
          .order('sort_order', { ascending: true, referencedTable: 'tour_inclusions' })
          .order('sort_order', { ascending: true, referencedTable: 'tour_exclusions' })
          .order('sort_order', { ascending: true, referencedTable: 'tour_itinerary' })
          .maybeSingle();
        if (error) console.warn('[SEO render] Tour detail unavailable:', error.message);
        // Never allow a mismatched PostgREST result to become the page body.
        currentTour = data && data.slug === slug ? data : null;
        if (data && data.slug !== slug) {
          console.error('[SEO render] Tour slug mismatch; refusing to render:', { requested: slug, returned: data.slug });
        }
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
      const tourImages = Array.isArray(currentTour.tour_images) ? currentTour.tour_images : [];
      const primaryImage = tourImages.find((image: any) => image.is_primary) || tourImages[0];
      pageImage = seoSafeImage(primaryImage?.image_url) || pageImage;
      currentHighlights = Array.isArray(currentTour.tour_highlights) ? currentTour.tour_highlights : [];
      currentInclusions = Array.isArray(currentTour.tour_inclusions) ? currentTour.tour_inclusions : [];
      currentExclusions = Array.isArray(currentTour.tour_exclusions) ? currentTour.tour_exclusions : [];
      currentItinerary = Array.isArray(currentTour.tour_itinerary) ? currentTour.tour_itinerary : [];

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
    // A published destination is a valid public landing page even when it has no
    // published excursions yet. Keep the route consistent with sitemap and
    // llms.txt eligibility; thin destinations remain noindex below.
    if (activeDestination) {
      pageKind = 'destination';
      seoEntityType = 'destination';
      seoIdentifier = String(activeDestination.id);
      seoIdentifierIsPageSlug = false;
      title = seoPlainText(activeDestination.seo_title, 180)
        || `${seoPlainText(activeDestination.name, 120)} Excursions & Activities | Awesome Adventure Tours`;
      const destinationDescription = seoPlainText(activeDestination.description, 4000);
      const destinationTagline = seoPlainText(activeDestination.tagline, 500);
      description = seoPlainText(activeDestination.seo_description || destinationDescription || destinationTagline, 300);
      noindex = destinationTours.length < 2 && (destinationDescription.length + destinationTagline.length) < 650;
      pageImage = seoSafeImage(activeDestination.main_image) || pageImage;
      const cards = destinationTours.map(seoTourCard).filter(Boolean).join('');
      body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / <a href="/excursions">Excursions</a> / ${seoHtmlEscape(seoPlainText(activeDestination.name, 120))}</nav>
        <article><h1>Excursions in ${seoHtmlEscape(seoPlainText(activeDestination.name, 120))}</h1>
        ${activeDestination.tagline ? `<p><strong>${seoHtmlEscape(seoPlainText(activeDestination.tagline, 300))}</strong></p>` : ''}
        ${description ? `<p>${seoHtmlEscape(description)}</p>` : ''}
        <h2>Published excursions in ${seoHtmlEscape(seoPlainText(activeDestination.name, 120))}</h2>
        ${cards ? `<div class="seo-grid">${cards}</div>` : '<p>There are no published excursions for this destination yet. Browse the full excursions catalogue for currently available trips.</p><p><a href="/excursions">Browse all excursions</a></p>'}
        </article></main>`;
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
    if (override?.robots_index === false && !(pageKind === 'static' && seoIdentifier === 'about')) noindex = true;
    if (override?.robots_follow === false && !(pageKind === 'static' && seoIdentifier === 'about')) nofollow = true;
  }

  if (localizedTranslation) {
    title = localizedTranslation.seo_title || localizedTranslation.title || title;
    description = localizedTranslation.seo_description || localizedTranslation.summary || description;
    noindex = false;
    nofollow = false;
    const content = localizedTranslation.content && typeof localizedTranslation.content === 'object' ? localizedTranslation.content : {};
    const safeParagraphs = Array.isArray(content.paragraphs) ? content.paragraphs.filter((v: any) => typeof v === 'string') : [];
    const safeSections = Array.isArray(content.sections) ? content.sections.filter((v: any) => v && typeof v.title === 'string' && typeof v.content === 'string') : [];
    const safeFaqs = Array.isArray(content.faqs) ? content.faqs.filter((v: any) => v && typeof v.question === 'string' && typeof v.answer === 'string') : [];
    const safeLists = ['highlights','itinerary','included','excluded'].map((key) => {
      const values = Array.isArray(content[key]) ? content[key].filter((v: any) => typeof v === 'string' || (v && typeof v === 'object')) : [];
      return values.length ? '<ul>' + values.map((item: any) => '<li>' + seoHtmlEscape(typeof item === 'string' ? item : (item.title || '') + ' ' + (item.description || '')) + '</li>').join('') + '</ul>' : '';
    }).join('');
    const prose = typeof content.content === 'string' ? content.content : typeof content.description === 'string' ? content.description : '';
    body = '<main id="seo-initial-content"><h1>' + seoHtmlEscape(localizedTranslation.title || title) + '</h1>' +
      (localizedTranslation.summary ? '<p>' + seoHtmlEscape(localizedTranslation.summary) + '</p>' : '') +
      (prose ? '<p>' + seoHtmlEscape(prose) + '</p>' : '') +
      safeParagraphs.map((item: string) => '<p>' + seoHtmlEscape(item) + '</p>').join('') +
      safeSections.map((section: any) => '<section><h2>' + seoHtmlEscape(section.title) + '</h2><p>' + seoHtmlEscape(section.content) + '</p></section>').join('') +
      safeFaqs.map((faq: any) => '<section><h2>' + seoHtmlEscape(faq.question) + '</h2><p>' + seoHtmlEscape(faq.answer) + '</p></section>').join('') +
      ['pickupInfo','cancellationPolicy','ageRestrictions'].map((key) => typeof content[key] === 'string' ? '<p>' + seoHtmlEscape(content[key]) + '</p>' : '').join('') + safeLists + '</main>';
  }
  title = seoBoundedTitle(title) || 'Awesome Adventure Tours';
  description = seoBoundedDescription(description) || 'Explore published excursions and experiences across Egypt’s Red Sea coast.';
  const canonicalPath = localePath ? requestedPath : path;
  const canonical = `${origin}${canonicalPath === '/' ? '/' : canonicalPath}`;
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
      streetAddress: '2nd floor, Bostan Cafe, Madres',
      addressLocality: 'Hurghada',
      addressRegion: 'Red Sea Governorate',
      addressCountry: 'EG',
    },
    areaServed: [
      { '@type': 'City', name: 'Hurghada' },
      { '@type': 'AdministrativeArea', name: 'Red Sea Governorate' },
      { '@type': 'Country', name: 'Egypt' },
    ],
    knowsAbout: ['Red Sea coastal experiences', 'Boat trips', 'Island day trips', 'Snorkeling', 'Scuba diving', 'Desert safaris', 'Hurghada travel experiences'],
    contactPoint: [{
      '@type': 'ContactPoint',
      telephone: '+201515212741',
      contactType: 'customer service',
      availableLanguage: 'Multilingual',
      url: `${origin}/contact`,
    }],
  };
  organization.sameAs = Array.from(new Set([...configuredSameAs, 'https://www.tripadvisor.co.uk/Attraction_Review-g297549-d34759384-Reviews-Awesome_Adventure_Tours-Hurghada_Red_Sea_and_Sinai.html']));
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
  }

  if (pageKind !== 'not-found') {
    const mainEntityId = pageKind === 'tour' ? `${canonical}#touristtrip` : pageKind === 'destination' ? `${canonical}#destination` : pageKind === 'blog' ? `${canonical}#blogposting` : undefined;
    const breadcrumbItems: Array<{ name: string; url: string }> = [{ name: 'Home', url: `${origin}/` }];
    if (path.startsWith('/excursions/')) { breadcrumbItems.push({ name: 'Excursions', url: `${origin}/excursions` }); breadcrumbItems.push({ name: seoPlainText(currentTour?.title, 160) || title, url: canonical }); }
    else if (path.startsWith('/destinations/')) { breadcrumbItems.push({ name: 'Excursions', url: `${origin}/excursions` }); breadcrumbItems.push({ name: seoPlainText(activeDestination?.name, 120) || title, url: canonical }); }
    else if (path.startsWith('/blog/')) { breadcrumbItems.push({ name: 'Travel Journal', url: `${origin}/blog` }); breadcrumbItems.push({ name: seoPlainText(currentBlogPost?.title, 160) || title, url: canonical }); }
    else if (path === '/blog') breadcrumbItems.push({ name: 'Travel Journal', url: canonical });
    else if (path !== '/') breadcrumbItems.push({ name: seoPlainText(title.replace(/ \\| Awesome Adventure Tours.*$/, ''), 160) || title, url: canonical });
    const hasBreadcrumb = breadcrumbItems.length > 1;
    graph.push({ '@type': pageKind === 'catalogue' || pageKind === 'destinations' || pageKind === 'experiences' || pageKind === 'home' || pageKind === 'blog-index' ? 'CollectionPage' : 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, isPartOf: { '@id': `${origin}/#website` }, ...(mainEntityId ? { mainEntity: { '@id': mainEntityId } } : {}), ...(pageImage !== `${origin}/logo.webp` ? { primaryImageOfPage: { '@type': 'ImageObject', url: pageImage } } : {}), ...(hasBreadcrumb ? { breadcrumb: { '@id': `${canonical}#breadcrumb` } } : {}) });
    if (hasBreadcrumb) graph.push({ '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`, itemListElement: breadcrumbItems.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.url })) });
  }

  if (localizedTranslation) {
    for (const node of graph) {
      if (node && typeof node === 'object' && node['@type'] === 'WebPage') {
        node.name = title;
        node.description = description;
      }
      if (node && typeof node === 'object' && typeof node['@id'] === 'string' && node['@id'].startsWith(canonical + '#') && node.name) {
        node.name = localizedTranslation.title || title;
        node.description = localizedTranslation.summary || description;
      }
    }
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
  if (localePath) {
    html = html.replace(/<html\b([^>]*)>/i, (_match, attrs) => '<html' + String(attrs).replace(/\s+lang=["'][^"']*["']/i, '').replace(/\s+dir=["'][^"']*["']/i, '') + ' lang="' + localePath.locale + '" dir="' + (localePath.locale === 'ar' ? 'rtl' : 'ltr') + '">');
    const alternateLinks: string[] = [];
    alternateLinks.push('<link rel="alternate" hreflang="en" href="' + origin + path + '">');
    alternateLinks.push('<link rel="alternate" hreflang="x-default" href="' + origin + path + '">');
    if (localizedTranslation) {
      alternateLinks.push('<link rel="alternate" hreflang="' + localePath.locale + '" href="' + origin + requestedPath + '">');
      if (serverSupabase) {
        try {
          const { data: alternatives } = await serverSupabase.from('content_translations')
            .select('locale,translated_slug,source_checksum,reviewed_at,published_at')
            .eq('entity_type', localizedTranslation.entity_type)
            .eq('entity_key', localizedTranslation.entity_key)
            .eq('translation_state', 'published').not('translated_slug', 'is', null);
          const current = await getCurrentTranslationSourceChecksum(localizedTranslation.entity_type, localizedTranslation.entity_key);
          for (const alternative of alternatives || []) {
            if (!alternative.locale || !alternative.translated_slug || !alternative.reviewed_at || !alternative.published_at) continue;
            if (!current || current.checksum !== alternative.source_checksum) continue;
            const routePrefix = localizedTranslation.entity_type === 'tour' ? '/excursions/'
              : localizedTranslation.entity_type === 'destination' ? '/destinations/'
                : localizedTranslation.entity_type === 'blog_post' ? '/blog/' : '/';
            const alternatePath = localizedTranslation.entity_type === 'static_page' && alternative.translated_slug === 'home'
              ? '/' + alternative.locale
              : '/' + alternative.locale + routePrefix + encodeURIComponent(alternative.translated_slug);
            if (alternative.locale !== localePath.locale) alternateLinks.push('<link rel="alternate" hreflang="' + alternative.locale + '" href="' + origin + alternatePath + '">');
          }
        } catch (error) {
          console.warn('[Localized SSR] Reciprocal hreflang lookup failed:', error);
        }
      }
    }
    html = html.replace('</head>', alternateLinks.join('') + '<script type="application/ld+json">' + schema + '</script>' + seoInitialStyles() + '</head>');
  } else {
    html = html.replace('</head>', `<script type="application/ld+json">${schema}</script>${seoInitialStyles()}</head>`);
  }
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
        '- Terms & Conditions: https://awesomeadventure.tours/terms',
        '- Cancellation & Refund Policy: https://awesomeadventure.tours/cancellation-policy',
        '- Full agent index: https://awesomeadventure.tours/llms.txt',
        '',
        '## Contact',
        '- Phone: +20 151 5212741',
        '- Office: 2nd floor, Bostan Cafe, Madres, Hurghada, Red Sea Governorate, Egypt',
        '',
        '## Published excursions',
      ];
      for (const tour of tours) {
        const slug = typeof tour.slug === 'string' ? tour.slug.trim() : '';
        const title = cleanPublicText(tour.title, 160);
        if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
        const summary = cleanPublicText(tour.short_description || tour.description, 300);
        const duration = cleanPublicText(tour.duration, 80);
        const price = seoPrice(tour.price, tour.currency);
        const details = [summary, duration ? `Duration: ${duration}` : '', price ? `Starting price: ${price}` : ''].filter(Boolean).join(' | ');
        lines.push(`- [${title}](https://awesomeadventure.tours/excursions/${encodeURIComponent(slug)}): ${details}`);
      }
      res.status(200);
      res.type('text/markdown; charset=utf-8');
      res.setHeader('Vary', 'Accept');
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      return res.send(lines.join('\n'));
    });

    app.get('*', async (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API route not found' });
      }
      if (!fs.existsSync(indexHtmlPath)) {
        return res.status(503).send('Awesome Adventure Tours production assets are not available.');
      }

      const privateRoute = /^\/(?:[a-z]{2}\/)?(?:admin(?:\/|$)|booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$)|support(?:\/|$))/i;
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
        const isTourDetailRoute = /^\/(?:[a-z]{2}\/)?excursions\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/i.test(req.path);
        if (isTourDetailRoute) {
          // Prevent an intermediary cache from serving one excursion's HTML under another
          // excursion URL. Tour pages contain route-specific title, body and booking links.
          res.setHeader('Cache-Control', 'private, no-store, max-age=0');
          res.setHeader('CDN-Cache-Control', 'no-store');
          res.setHeader('Surrogate-Control', 'no-store');
        } else {
          res.setHeader('Cache-Control', rendered.statusCode === 200
            ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=30'
            : 'no-store');
        }
        return res.send(rendered.html);
      } catch (error) {
        console.error('[Public SEO render] Failed to render route:', req.path, error);
        res.setHeader('Cache-Control', 'no-store');
        return res.sendFile(indexHtmlPath);
      }
    });
  }

  let stopBookingNotificationWorker: (() => void) | null = null;
  let stopStaffNotificationWorker: (() => void) | null = null;

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

    // Durable staff inbox scan runs in the same server process and uses the
    // server-only Supabase client. It is idempotent and can be disabled explicitly.
    if (process.env.NODE_ENV === 'production' && serverSupabase && SUPABASE_KEY_TYPE === 'service_role') {
      stopStaffNotificationWorker = startStaffNotificationWorker(serverSupabase);
    } else if (process.env.NODE_ENV === 'production') {
      console.warn('[Staff Notification Worker] Not started: a valid server-side Supabase secret key is required.');
    }
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    stopBookingNotificationWorker?.();
    stopStaffNotificationWorker?.();
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
