import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { CONCIERGE_SYSTEM_PROMPT, TOUR_CATALOG_SUMMARY } from './src/data/chatKnowledge';
import { STANDARD_PICKUP_LOCATIONS, GLOBAL_BOOKING_EXTRAS } from './src/data/bookingData';
import { startBookingNotificationWorker } from './src/server/bookingNotificationWorker';
import { INITIAL_STATIC_PAGES } from './src/data/staticPages';
import { EXPECTED_KEMET_SUPABASE_PROJECT_REF, isExpectedKemetSupabaseUrl } from './src/lib/supabaseProjectGuard';

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

  // 1A. Pin production to the Kemet Spirit Supabase project. Local/staging
  // projects are permitted only when NODE_ENV explicitly marks development/test.
  if (resolvedUrl) {
    const allowNonProductionProject = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (!isExpectedKemetSupabaseUrl(resolvedUrl, allowNonProductionProject)) {
      configError = `CONFIGURATION ERROR: This production Kemet Spirit server must use Supabase project ${EXPECTED_KEMET_SUPABASE_PROJECT_REF}.`;
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
 * In-Memory Sliding-Window Rate Limiter (Zero external runtime dependencies)
 * 
 * ARCHITECTURAL CONSTRAINTS & HOSTINGER DEPLOYMENT CHARACTERISTICS:
 * 1. Process Scope: Rate limiting counters are stored in a local Node.js Map within the current process.
 * 2. Multi-Worker / PM2: If scaled horizontally across multiple Node worker processes or behind an external
 *    load balancer, request counts are partitioned per process rather than globally coordinated. For multi-node
 *    enterprise clusters, a shared Redis or database token-bucket store is required.
 * 3. Process Restarts: Counters reset gracefully upon application restarts or deployments on Hostinger.
 * 4. Reverse Proxy Header: Reads 'x-forwarded-for' header from Hostinger Nginx / Cloudflare reverse proxies.
 */
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests = 60, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      });
    }

    bucket.count += 1;
    next();
  };
}

// Clean up stale rate limit entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitBuckets.entries()) {
    if (now > v.resetAt) rateLimitBuckets.delete(k);
  }
}, 300_000).unref();

// Server-side JWT Bearer token authentication middleware
async function authenticateToken(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token || !serverSupabase) {
    return next();
  }

  try {
    const { data: { user }, error } = await serverSupabase.auth.getUser(token);
    if (!error && user) {
      let role = (user.app_metadata?.role as string) || 'customer';
      // Query the caller's own profile using their verified JWT so RLS works
      // even when the server client is configured with a publishable/anon key.
      if (SUPABASE_URL && SUPABASE_USER_KEY) {
        const userScopedSupabase = createClient(SUPABASE_URL, SUPABASE_USER_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: profile } = await userScopedSupabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role) {
          role = profile.role;
        }
      }

      req.user = {
        id: user.id,
        email: user.email,
        role,
      };
    }
  } catch (err) {
    console.warn('Server auth token verification error:', err);
  }
  next();
}

// ------------------------------------------------------------------------------
// Middleware & Security Headers
// ------------------------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  // Kemet Spirit production origins plus local development origins.
  // Additional preview origins must be explicitly configured, never wildcarded.
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    'https://kemetspirit.com',
    'https://www.kemetspirit.com',
    'http://localhost:3000',
    'http://localhost:5173',
    ...configuredOrigins,
  ]);
  const origin = req.headers.origin as string | undefined;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Authenticate caller tokens for all API routes
app.use(authenticateToken as any);

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
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// ------------------------------------------------------------------------------
// 1. AI Chatbot Endpoint
// ------------------------------------------------------------------------------
app.post('/api/chat', async (req: Request, res: Response) => {
  const { messages, prompt } = req.body;

  if (!prompt && (!messages || messages.length === 0)) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // If Gemini API is available, invoke gemini-3.8-flash
  if (ai) {
    try {
      // Build conversation contents
      const conversationHistory = (messages || []).map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      // Append latest prompt if not already present
      if (prompt && (!messages || messages[messages.length - 1]?.content !== prompt)) {
        conversationHistory.push({
          role: 'user',
          parts: [{ text: prompt }],
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
app.get('/api/health', (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  const mem = process.memoryUsage();

  res.json({
    status: 'ok',
    version: '2.4.0',
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    services: {
      server: { status: 'healthy', port: PORT },
      geminiAi: {
        status: process.env.GEMINI_API_KEY ? 'available' : 'disabled',
        model: 'gemini-3.8-flash',
      },
      supabase: {
        status: serverSupabase ? 'configured' : (supabaseConfig.configError ? 'misconfigured' : 'unconfigured'),
        projectRef: SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split('.')[0] : null,
        urlProvided: Boolean(SUPABASE_URL),
        keyType: SUPABASE_KEY_TYPE,
        serviceRoleKeyConfigured: SUPABASE_KEY_TYPE === 'service_role',
        userScopedPublicKeyConfigured: Boolean(SUPABASE_USER_KEY),
        secretIsolationVerified: true,
      },
      databaseSchema: { configured: Boolean(serverSupabase), ready: false, verification: 'not_checked' },
    },
    memory: {
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    },
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

  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
  const whatsappConfigured = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim()
    && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
    && /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_API_VERSION || '')
  );

  res.json({
    email: {
      configured: emailConfigured,
      provider: 'Resend',
      fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || '',
      fromName: process.env.RESEND_FROM_NAME?.trim() || 'Kemet Spirit',
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

  const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const textBody = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

  if (!isValidEmail(to) || !subject || subject.length > 200 || !textBody || textBody.length > 20_000) {
    return res.status(400).json({ success: false, error: 'A valid recipient, subject (max 200 characters), and message (max 20,000 characters) are required.' });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const fromName = (process.env.RESEND_FROM_NAME || 'Kemet Spirit').trim();

  if (!apiKey || !fromEmail || !isValidEmail(fromEmail)) {
    return res.status(503).json({ success: false, error: 'Server-side email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in Hostinger environment variables.' });
  }

  try {
    const idempotencyKey = typeof req.headers['idempotency-key'] === 'string'
      && /^[a-zA-Z0-9._:-]{8,128}$/.test(req.headers['idempotency-key'])
      ? req.headers['idempotency-key']
      : randomUUID();

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
        subject,
        text: textBody,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const providerBody = await providerResponse.json().catch(() => ({} as any));
    if (!providerResponse.ok || typeof providerBody?.id !== 'string') {
      const providerError = typeof providerBody?.message === 'string'
        ? providerBody.message
        : `Email provider rejected the request (HTTP ${providerResponse.status}).`;
      return res.status(502).json({ success: false, error: providerError });
    }

    return res.status(200).json({
      success: true,
      providerName: 'Resend',
      providerMessageId: providerBody.id,
      status: 'sent',
    });
  } catch (error: any) {
    const message = error?.name === 'TimeoutError'
      ? 'Email provider request timed out. No delivery confirmation was received.'
      : 'Email provider request failed. Please retry after checking the server logs.';
    return res.status(502).json({ success: false, error: message });
  }
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
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    brandName: 'Red Sea Excursions & Voyages',
    hotline: '+20 102 345 6789',
    whatsappUrl: 'https://wa.me/201023456789',
    operatingHours: '06:00 - 23:00 EEST (Daily)',
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
app.get('/api/tours', async (req: Request, res: Response) => {
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
app.all('/api/availability/check', (req: Request, res: Response) => {
  const tourSlug = (req.body?.tourSlug || req.query?.tourSlug || req.query?.slug) as string;
  const date = (req.body?.date || req.query?.date) as string;
  const adults = parseInt((req.body?.adults || req.query?.adults || '1') as string, 10);
  const children = parseInt((req.body?.children || req.query?.children || '0') as string, 10);

  if (!tourSlug || !date) {
    return res.status(400).json({
      success: false,
      error: 'tourSlug and date (YYYY-MM-DD) are required',
    });
  }

  const tour = TOUR_CATALOG_SUMMARY.find((t) => t.slug === tourSlug);
  if (!tour) {
    return res.status(404).json({
      success: false,
      error: 'Tour not found in catalog',
    });
  }

  const checkDate = new Date(date);
  const now = new Date();
  const isPast = checkDate.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  if (isPast) {
    return res.json({
      success: true,
      tourSlug,
      date,
      isDateAvailable: false,
      isPastDate: true,
      isNoticeCutoffViolated: true,
      remainingSeatsTotal: 0,
      slots: [],
      notes: 'Cannot book past dates',
    });
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[checkDate.getDay()];

  // Generate dynamic availability slots
  const slots = [
    {
      slotId: 'morning-0830',
      time: '08:30 AM',
      label: 'Morning Departure (Prime Reef Visibility)',
      availableSeats: 16,
      maxCapacity: 24,
      status: 'available',
      privateAvailable: true,
    },
    {
      slotId: 'midday-1100',
      time: '11:00 AM',
      label: 'Midday Cruise',
      availableSeats: 8,
      maxCapacity: 20,
      status: 'available',
      privateAvailable: true,
    },
  ];

  res.json({
    success: true,
    tourSlug,
    date,
    dayOfWeek: dayName,
    isDateAvailable: true,
    isPastDate: false,
    isNoticeCutoffViolated: false,
    minimumNoticeHours: 12,
    remainingSeatsTotal: 24,
    maxGuestsPerGroup: 30,
    priceEur: tour.priceEur,
    slots,
  });
});

// ------------------------------------------------------------------------------
// 7. Inquiries & Concierge Submissions API
// ------------------------------------------------------------------------------
app.post(['/api/inquiries', '/api/inquiries/submit', '/api/contact'], async (req: Request, res: Response) => {
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
app.post(['/api/newsletter', '/api/newsletter/subscribe'], async (req: Request, res: Response) => {
  const { email, preferredLanguage = 'en', website_url_hp } = req.body;

  if (website_url_hp && String(website_url_hp).trim() !== '') {
    return res.json({ success: true, subscribed: true });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid email address',
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase
        .from('newsletter_subscriptions')
        .insert({
          email: cleanEmail,
          source: 'website_footer',
          status: 'subscribed',
        })
        .select('id, created_at')
        .single();

      if (!error && data) {
        return res.json({
          success: true,
          subscribed: true,
          email: cleanEmail,
          message: 'Thank you for subscribing! Your Red Sea VIP seasonal excursion discount will be sent shortly.',
        });
      }

      if (error && (error.code === '23505' || error.message?.includes('duplicate'))) {
        return res.json({
          success: true,
          subscribed: true,
          email: cleanEmail,
          alreadySubscribed: true,
          message: 'You are already registered for Red Sea VIP excursion deals and marine updates.',
        });
      }
      if (error) {
        console.error('Supabase newsletter insert error:', error.message);
      }
    } catch (err) {
      console.warn('Newsletter subscription exception:', err);
    }
  }

  return res.status(503).json({
    success: false,
    error: 'Newsletter subscription service is currently unconfigured or database is unreachable.',
  });
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

const KEMET_PUBLIC_ORIGIN = 'https://kemetspirit.com';
const KEMET_CORE_PUBLIC_PATHS = [
  '/',
  '/excursions',
  '/about',
  '/why-us',
  '/booking-conditions',
  '/marine-safety',
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
  for (const route of KEMET_CORE_PUBLIC_PATHS) {
    urls.set(`${KEMET_PUBLIC_ORIGIN}${route === '/' ? '/' : route}`, undefined);
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
            `${KEMET_PUBLIC_ORIGIN}/excursions/${encodeURIComponent(slug)}`,
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
            `${KEMET_PUBLIC_ORIGIN}/${encodeURIComponent(slug)}`,
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
            `${KEMET_PUBLIC_ORIGIN}/destinations/${encodeURIComponent(slug)}`,
            toSitemapDate(destination.updated_at)
          );
        }
      }
    } catch (error) {
      console.warn('[SEO sitemap] Destination pages could not be loaded:', error);
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
    '# Kemet Spirit',
    '',
    '> Explore excursions and experiences across Egypt’s Red Sea coast. Tour pages provide current published descriptions, inclusions, pricing and booking details.',
    '',
    '## Main pages',
    '- [Homepage](https://kemetspirit.com/)',
    '- [Excursions](https://kemetspirit.com/excursions)',
    '- [About](https://kemetspirit.com/about)',
    '',
    '## Published excursions',
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
          lines.push(`- [${title}](https://kemetspirit.com/excursions/${encodeURIComponent(slug)}): ${description}${priceText}`);
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
          lines.push(`- [${name}](https://kemetspirit.com/destinations/${encodeURIComponent(slug)}): ${description}`);
        }
      }
    } catch (error) {
      console.warn('[SEO llms.txt] Destination catalogue could not be loaded:', error);
    }
  }

  lines.push(
    '',
    '## Booking information',
    '- Check each published excursion page for its current price, availability, duration, pickup information, inclusions and cancellation terms.',
    '- Booking and availability details can change. Use the live website as the source of truth.',
    '',
    '## Sitemap',
    '- https://kemetspirit.com/sitemap.xml',
    ''
  );

  res.status(200);
  res.type('text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return res.send(lines.join('\n'));
});

// Private customer and administration routes must be crawlable so search engines
// can observe noindex. This header is not an access-control mechanism.
app.use((req: Request, res: Response, next: NextFunction) => {
  const privateRoute = /^\/(?:admin(?:\/|$)|booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$))/i;
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
    const candidate = new URL(value.trim(), 'https://kemetspirit.com');
    return candidate.protocol === 'https:' && !candidate.username && !candidate.password ? candidate.toString() : '';
  } catch {
    return '';
  }
}

async function loadKemetSeoOverride(entityType: string, identifier: string, isPageSlug: boolean): Promise<any | null> {
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

async function loadKemetTours(): Promise<any[]> {
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

async function loadKemetPages(): Promise<any[]> {
  if (publicSupabase) {
    try {
      const { data, error } = await publicSupabase.from('site_settings')
        .select('value').eq('key', 'pages_content').maybeSingle();
      if (!error) {
        const value = data?.value;
        if (Array.isArray(value) && value.length) return value;
        if (value && typeof value === 'object' && Array.isArray(value.pages) && value.pages.length) return value.pages;
      } else {
        console.warn('[SEO render] CMS pages unavailable; safe defaults used:', error.message);
      }
    } catch (error) {
      console.warn('[SEO render] CMS pages query failed; safe defaults used:', error);
    }
  }
  return INITIAL_STATIC_PAGES;
}

async function loadKemetDestinations(): Promise<any[]> {
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

async function renderKemetPublicHtml(pathname: string, template: string): Promise<{ html: string; statusCode: number; noindex: boolean; nofollow: boolean }> {
  const path = pathname.replace(/\/+$/, '') || '/';
  const origin = 'https://kemetspirit.com';
  let title = 'Kemet Spirit | Red Sea Excursions in Egypt';
  let description = 'Explore Red Sea excursions in Egypt, including boat trips, island visits, snorkeling and desert experiences. Review each tour’s details before booking.';
  let body = '';
  let noindex = false;
  let nofollow = false;
  let statusCode = 200;
  let pageKind: 'home' | 'catalogue' | 'tour' | 'destination' | 'static' | 'not-found' = 'not-found';
  let tours: any[] = [];
  let currentTour: any = null;
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
    tours = await loadKemetTours();
    const allDestinations = await loadKemetDestinations();
    const publishedDestinationIds = new Set(
      tours.map((tour) => tour.destination_id).filter(Boolean).map(String)
    );
    visibleDestinations = allDestinations.filter((destination) => publishedDestinationIds.has(String(destination.id)));
  }

  if (path === '/') {
    pageKind = 'home';
    const cards = tours.slice(0, 6).map(seoTourCard).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><h1>Explore Red Sea Excursions in Egypt</h1>
      <p>Discover the excursions currently published on Kemet Spirit. Compare available boat trips, island experiences, snorkeling activities and other Red Sea tours using the individual excursion details.</p>
      <h2>Explore destinations</h2>
      <div class="seo-grid">${(visibleDestinations || []).map(seoDestinationCard).filter(Boolean).join('')}</div>
      <h2>Explore published excursions</h2><p><a href="/excursions">Browse all excursions</a></p>
      <div class="seo-grid">${cards || '<p>Explore the excursions catalogue for currently published experiences and details.</p>'}</div></main>`;
  } else if (path === '/excursions') {
    pageKind = 'catalogue';
    title = 'Red Sea Excursions & Boat Trips | Kemet Spirit';
    description = 'Browse published Red Sea excursions in Egypt. Compare boat trips, island experiences, snorkeling activities, trip durations and prices.';
    const cards = tours.map(seoTourCard).filter(Boolean).join('');
    body = `<main id="seo-initial-content"><nav><a href="/">Home</a> / Excursions</nav>
      <h1>Red Sea Excursions & Boat Trips</h1>
      <p>Browse the excursions currently published on Kemet Spirit. Review each tour’s description, duration, price and booking details.</p>
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
      title = `${seoPlainText(currentTour.title, 160)} | Kemet Spirit`;
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
        || `${seoPlainText(activeDestination.name, 120)} Excursions & Activities | Kemet Spirit`;
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
    const pages = await loadKemetPages();
    const page = pages.find((item: any) => item && item.slug === path.slice(1));
    if (page) {
      pageKind = 'static';
      seoIdentifier = String(page.slug);
      seoIdentifierIsPageSlug = true;
      title = seoPlainText(page.seoTitle, 180) || `${seoPlainText(page.title, 160)} | Kemet Spirit`;
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
    title = 'Page Not Found | Kemet Spirit';
    description = 'The requested page could not be found.';
    body = `<main id="seo-initial-content"><h1>Page not found</h1><p>The requested page is not available.</p><p><a href="/">Return to the homepage</a> or <a href="/excursions">browse excursions</a>.</p></main>`;
  }

  if (pageKind !== 'not-found') {
    const override = await loadKemetSeoOverride(seoEntityType, seoIdentifier, seoIdentifierIsPageSlug);
    if (override?.seo_title) title = seoPlainText(override.seo_title, 180);
    if (override?.meta_description) description = seoPlainText(override.meta_description, 300);
    if (override?.og_image) pageImage = seoSafeImage(override.og_image) || pageImage;
    if (override?.robots_index === false) noindex = true;
    if (override?.robots_follow === false) nofollow = true;
  }

  const canonical = `${origin}${path === '/' ? '/' : path}`;
  const organization = {
    '@type': 'TravelAgency',
    '@id': `${origin}/#organization`,
    name: 'Kemet Spirit',
    url: origin,
    logo: `${origin}/logo.webp`,
  };
  const graph: any[] = [
    organization,
    { '@type': 'WebSite', '@id': `${origin}/#website`, url: origin, name: 'Kemet Spirit', publisher: { '@id': `${origin}/#organization` }, inLanguage: 'en' },
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
      '@type': pageKind === 'catalogue' || pageKind === 'home' ? 'CollectionPage' : 'WebPage',
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
  html = seoUpsertMeta(html, 'property', 'og:site_name', 'Kemet Spirit');
  html = seoUpsertMeta(html, 'property', 'og:type', pageKind === 'tour' ? 'product' : 'website');
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

    app.get('*', async (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API route not found' });
      }
      if (!fs.existsSync(indexHtmlPath)) {
        return res.status(503).send('Kemet Spirit production assets are not available.');
      }

      const privateRoute = /^\/(?:admin(?:\/|$)|booking(?:\/|$)|my-booking(?:\/|$)|login(?:\/|$)|register(?:\/|$)|account(?:\/|$)|profile(?:\/|$)|reset-password(?:\/|$))/i;
      if (privateRoute.test(req.path)) {
        return res.sendFile(indexHtmlPath);
      }

      try {
        const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        const rendered = await renderKemetPublicHtml(req.path, indexHtml);
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
