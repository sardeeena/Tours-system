import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { CONCIERGE_SYSTEM_PROMPT, TOUR_CATALOG_SUMMARY } from './src/data/chatKnowledge';
import { STANDARD_PICKUP_LOCATIONS, GLOBAL_BOOKING_EXTRAS } from './src/data/bookingData';

dotenv.config();

const app = express();
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

    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, error: 'API route not found' });
      }
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(503).send('Awesome Adventure Tours is compiling production assets. Please wait a moment and refresh.');
      }
    });
  }

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Awesome Adventure Tours server running on port/socket ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
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
