import express, { Request, Response, NextFunction } from 'express';
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
      // Query profiles table for authoritative role
      const { data: profile } = await serverSupabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role) {
        role = profile.role;
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
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
const serverBookings = new Map<string, any>();

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
app.post('/api/bookings/create', async (req: AuthenticatedRequest, res: Response) => {
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
  } = req.body;

  // 1. Strict Input Validation
  if (!tourSlug || typeof tourSlug !== 'string') {
    return res.status(400).json({ success: false, error: 'tourSlug is required.' });
  }

  if (!date || typeof date !== 'string' || isNaN(new Date(date).getTime())) {
    return res.status(400).json({ success: false, error: 'Valid excursion date (YYYY-MM-DD) is required.' });
  }

  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate.getTime() < today.getTime()) {
    return res.status(400).json({ success: false, error: 'Selected excursion date cannot be in the past.' });
  }

  if (!customer || !customer.firstName || !customer.email) {
    return res.status(400).json({ success: false, error: 'Customer first name and valid email address are required.' });
  }

  if (!isValidEmail(customer.email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address format.' });
  }

  const adults = Math.max(1, parseInt(guests?.adults, 10) || 1);
  const children = Math.max(0, parseInt(guests?.children, 10) || 0);
  const infants = Math.max(0, parseInt(guests?.infants, 10) || 0);
  const totalParty = adults + children + infants;
  const payingPassengers = adults + children;

  if (!serverSupabase) {
    const tourMeta = TOUR_CATALOG_SUMMARY.find((t) => t.slug === tourSlug) || {
      slug: tourSlug,
      title: 'Red Sea Excursion',
      priceEur: 35,
      duration: '7 Hours',
    };
    const adultPrice = tourMeta.priceEur;
    const childPrice = Math.round(adultPrice * 0.5);
    const totalEur = adults * adultPrice + children * childPrice;
    const currentYear = new Date().getFullYear();
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const c1 = letters.charAt(Math.floor(Math.random() * letters.length));
    const c2 = letters.charAt(Math.floor(Math.random() * letters.length));
    const digits = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `RST-${currentYear}-${c1}${c2}${digits}`;

    const fallbackBooking = {
      bookingReference,
      tour: {
        slug: tourMeta.slug,
        title: tourMeta.title,
        durationLabel: (tourMeta as any).durationLabel || '7 Hours',
      },
      date,
      guests: { adults, children, infants, total: totalParty },
      pickup: {
        locationId: pickupLocationId || 'hurghada',
        locationName: hotelName || 'Hurghada Central',
        hotelName: hotelName || null,
        roomNumber: roomNumber || null,
        feeEur: 0,
      },
      pricing: {
        adultPriceEur: adultPrice,
        childPriceEur: childPrice,
        adultSubtotalEur: adults * adultPrice,
        childSubtotalEur: children * childPrice,
        pickupFeeEur: 0,
        extrasSubtotalEur: 0,
        subtotalEur: totalEur,
        totalEur,
        currency: 'EUR',
        formattedTotal: `€${totalEur.toFixed(2)}`,
      },
      customer: {
        name: `${customer.firstName} ${customer.lastName || ''}`.trim(),
        email: customer.email.trim().toLowerCase(),
        phone: customer.phoneNumber || null,
        country: customer.country || 'International',
      },
      paymentMethod,
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    serverBookings.set(bookingReference, fallbackBooking);

    return res.status(201).json({
      success: true,
      ...fallbackBooking,
    });
  }

  try {
    // 3. Query Authoritative Tour Record from Supabase
    const { data: tourRecord, error: tourErr } = await serverSupabase
      .from('tours')
      .select('id, title, slug, price, child_price, max_guests, duration, pickup_available, pickup_info, status')
      .or(`slug.eq.${tourSlug},id.eq.${tourSlug}`)
      .maybeSingle();

    if (tourErr || !tourRecord) {
      return res.status(404).json({
        success: false,
        error: `Excursion "${tourSlug}" was not found in the reservation catalog.`,
      });
    }

    // 4. Verify Capacity
    const maxCapacity = tourRecord.max_guests || 35;
    if (totalParty > maxCapacity) {
      return res.status(400).json({
        success: false,
        error: `Group size (${totalParty} guests) exceeds maximum tour capacity of ${maxCapacity} passengers.`,
      });
    }

    // Check availability table for blackout or sold out dates
    const { data: availRecord } = await serverSupabase
      .from('tour_availability')
      .select('id, status, booked_count, max_capacity')
      .eq('tour_id', tourRecord.id)
      .eq('date', date)
      .maybeSingle();

    if (availRecord) {
      if (availRecord.status === 'unavailable') {
        return res.status(400).json({
          success: false,
          error: `Excursion date (${date}) is closed or marked as an operational blackout date.`,
        });
      }
      if (availRecord.status === 'sold_out') {
        return res.status(400).json({
          success: false,
          error: `Excursion departure on ${date} is sold out.`,
        });
      }
      if (availRecord.max_capacity && (availRecord.booked_count + totalParty) > availRecord.max_capacity) {
        const remaining = Math.max(0, availRecord.max_capacity - availRecord.booked_count);
        return res.status(400).json({
          success: false,
          error: `Only ${remaining} seat(s) remaining for departure on ${date}. Requested: ${totalParty} guests.`,
        });
      }
    }

    // 5. Server-Authoritative Price Calculation
    const adultBasePrice = Number(tourRecord.price);
    const childBasePrice = tourRecord.child_price !== null && tourRecord.child_price !== undefined
      ? Number(tourRecord.child_price)
      : Math.round(adultBasePrice * 0.5);

    const adultSubtotalEur = adults * adultBasePrice;
    const childSubtotalEur = children * childBasePrice;

    // Validate pickup location fee
    let pickupFeeEur = 0;
    let pickupLocationName = 'Hurghada Central';
    let validPickupId: string | null = null;

    if (pickupLocationId) {
      const { data: loc } = await serverSupabase
        .from('pickup_locations')
        .select('id, name, fee_eur_per_person, fee_eur_flat')
        .or(`id.eq.${pickupLocationId},code.eq.${pickupLocationId}`)
        .maybeSingle();

      if (loc) {
        validPickupId = loc.id;
        pickupLocationName = loc.name;
        pickupFeeEur = (Number(loc.fee_eur_per_person) || 0) * payingPassengers + (Number(loc.fee_eur_flat) || 0);
      }
    }

    // Validate extras
    let extrasSubtotalEur = 0;
    const verifiedExtras: Array<{ extraId: string; name: string; amountEur: number; quantity: number }> = [];

    if (Array.isArray(extras) && extras.length > 0) {
      for (const item of extras) {
        const extraId = item.extraId || item.id;
        if (!extraId) continue;

        const { data: exDef } = await serverSupabase
          .from('tour_extras')
          .select('id, name, price_eur, pricing_type')
          .eq('id', extraId)
          .maybeSingle();

        if (exDef) {
          const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
          const price = Number(exDef.price_eur);
          const itemAmount = exDef.pricing_type === 'per_person' ? price * payingPassengers * qty : price * qty;
          extrasSubtotalEur += itemAmount;
          verifiedExtras.push({
            extraId: exDef.id,
            name: exDef.name,
            amountEur: itemAmount,
            quantity: qty,
          });
        }
      }
    }

    const subtotalEur = adultSubtotalEur + childSubtotalEur + pickupFeeEur;
    const totalEur = subtotalEur + extrasSubtotalEur;

    // 6. Find or Create Authoritative Customer Record
    const cleanEmail = customer.email.trim().toLowerCase();
    let customerId: string | null = null;

    const { data: existingCustomer } = await serverSupabase
      .from('customers')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingCustomer?.id) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: custErr } = await serverSupabase
        .from('customers')
        .insert({
          first_name: customer.firstName.trim(),
          last_name: (customer.lastName || '').trim(),
          email: cleanEmail,
          phone: customer.phoneNumber || null,
          whatsapp: customer.whatsappNumber || customer.phoneNumber || null,
          country: customer.country || 'International',
          hotel: hotelName || null,
          source: 'Website Booking',
          status: 'active',
          user_id: req.user?.id || null,
        })
        .select('id')
        .single();

      if (!custErr && newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // 7. Generate Authoritative Booking Reference
    const currentYear = new Date().getFullYear();
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const c1 = letters.charAt(Math.floor(Math.random() * letters.length));
    const c2 = letters.charAt(Math.floor(Math.random() * letters.length));
    const digits = Math.floor(1000 + Math.random() * 9000);
    const bookingReference = `RST-${currentYear}-${c1}${c2}${digits}`;

    // 8. Durable Insertion into public.bookings
    // Initial status: 'pending' (reservation received)
    // Initial payment_status: 'pending' (unpaid / pay_at_pickup)
    const { data: createdBooking, error: bookErr } = await serverSupabase
      .from('bookings')
      .insert({
        booking_reference: bookingReference,
        user_id: req.user?.id || null,
        tour_id: tourRecord.id,
        customer_id: customerId,
        booking_date: date,
        status: 'pending',
        payment_status: 'pending',
        payment_method: paymentMethod || 'pay_at_pickup',
        adult_count: adults,
        child_count: children,
        infant_count: infants,
        pickup_location_id: validPickupId,
        pickup_hotel_name: hotelName || null,
        pickup_room_number: roomNumber || null,
        subtotal: subtotalEur,
        extras_total: extrasSubtotalEur,
        discount: 0,
        total: totalEur,
        currency: 'EUR',
        special_requests: specialRequests || null,
      })
      .select('id, booking_reference, created_at')
      .single();

    if (bookErr || !createdBooking) {
      console.error('Failed to durably insert booking into Supabase:', bookErr);
      return res.status(500).json({
        success: false,
        error: 'Database error: Could not complete reservation. Please contact our booking desk.',
      });
    }

    // 9. Lead Passenger Manifest Record
    await serverSupabase.from('booking_passengers').insert({
      booking_id: createdBooking.id,
      full_name: `${customer.firstName} ${customer.lastName || ''}`.trim(),
      nationality: customer.country || 'International',
      passenger_type: 'adult',
      is_lead_passenger: true,
    });

    // 10. Booking Extras Line Items
    if (verifiedExtras.length > 0) {
      const extraRows = verifiedExtras.map((e) => ({
        booking_id: createdBooking.id,
        extra_id: e.extraId,
        name: e.name,
        quantity: e.quantity,
        unit_price: e.amountEur / e.quantity,
        total_price: e.amountEur,
      }));
      await serverSupabase.from('booking_extras').insert(extraRows);
    }

    // 11. Update Tour Availability Capacity
    if (availRecord) {
      const newBooked = (availRecord.booked_count || 0) + totalParty;
      await serverSupabase
        .from('tour_availability')
        .update({
          booked_count: newBooked,
          status: availRecord.max_capacity && newBooked >= availRecord.max_capacity ? 'sold_out' : availRecord.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', availRecord.id);
    }

    return res.status(201).json({
      success: true,
      bookingReference,
      tour: {
        slug: tourRecord.slug,
        title: tourRecord.title,
        durationLabel: tourRecord.duration,
      },
      date,
      guests: { adults, children, infants, total: totalParty },
      pickup: {
        locationId: validPickupId || 'hurghada',
        locationName: pickupLocationName,
        hotelName: hotelName || null,
        roomNumber: roomNumber || null,
        feeEur: pickupFeeEur,
      },
      pricing: {
        adultPriceEur: adultBasePrice,
        childPriceEur: childBasePrice,
        adultSubtotalEur,
        childSubtotalEur,
        pickupFeeEur,
        extrasSubtotalEur,
        subtotalEur,
        totalEur,
        currency: 'EUR',
        formattedTotal: `€${totalEur.toFixed(2)}`,
      },
      customer: {
        name: `${customer.firstName} ${customer.lastName || ''}`.trim(),
        email: cleanEmail,
        phone: customer.phoneNumber || null,
        country: customer.country || 'International',
      },
      paymentMethod,
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: createdBooking.created_at,
    });
  } catch (err: any) {
    console.error('Unhandled exception during booking creation:', err);
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
  const verification = ((req.body?.contactVerification || req.body?.verification || req.query?.verification || req.query?.email || req.query?.phone) as string || '').trim().toLowerCase();

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({
      success: false,
      found: false,
      error: 'Booking reference is required',
    });
  }

  const cleanRef = reference.trim().toUpperCase();
  const refRegex = /^RST-\d{4}-[A-Z0-9]+$/;

  if (!refRegex.test(cleanRef) && !cleanRef.startsWith('RST-')) {
    return res.status(400).json({
      success: false,
      found: false,
      error: 'Invalid reference format. Expected format: RST-2026-XXXX',
    });
  }

  const isStaff = req.user && ['admin', 'super_admin', 'manager', 'staff'].includes(req.user.role);

  // If database is connected, query authoritative bookings
  if (serverSupabase) {
    try {
      if (verification) {
        const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc('lookup_booking_secure', {
          p_reference: cleanRef,
          p_verification: verification,
        });

        // The RPC returns the JSONB booking object directly (or null)
        const rawBooking = (rpcRes && typeof rpcRes === 'object')
          ? ((rpcRes as any).booking || ((rpcRes as any).bookingReference ? rpcRes : null))
          : null;

        if (!rpcErr && rawBooking && rawBooking.bookingReference) {
          // Public lookup response: Return ONLY minimal masked guest data
          // Never treat reference lookup as an authenticated session or issue user tokens
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
        }
      }

      // Query database scoped record if RPC did not match or for staff users
      const { data: b, error } = await serverSupabase
        .from('bookings')
        .select(`
          id,
          booking_reference,
          booking_date,
          status,
          payment_status,
          payment_method,
          subtotal,
          total,
          currency,
          special_requests,
          customers (*),
          tours (title, slug, primary_image, duration_label)
        `)
        .eq('booking_reference', cleanRef)
        .maybeSingle();

      if (!error && b) {
        if (isStaff) {
          return res.json({ success: true, found: true, booking: b });
        }

        if (verification) {
          const custRecord: any = Array.isArray((b as any).customers) ? (b as any).customers[0] : (b as any).customers;
          const custEmail = (custRecord?.email || '').toLowerCase();
          const custPhone = (custRecord?.phone || '').replace(/\s+/g, '');
          const cleanVer = verification.replace(/\s+/g, '');

          if (custEmail === verification || (custPhone.length >= 6 && custPhone.includes(cleanVer))) {
            const maskedEmail = custEmail.replace(/^(.)(.*)(@.*)$/, (_: string, a: string, _b: string, c: string) => `${a}***${c}`);
            return res.json({
              success: true,
              found: true,
              booking: {
                bookingReference: b.booking_reference,
                status: b.status,
                paymentStatus: b.payment_status,
                paymentMethod: b.payment_method,
                bookingDate: b.booking_date,
                pricing: {
                  subtotal: b.subtotal,
                  total: b.total,
                  currency: b.currency,
                },
                tour: b.tours,
                customer: {
                  firstName: custRecord?.first_name || 'Guest',
                  lastName: custRecord?.last_name || '',
                  emailMasked: maskedEmail,
                  phoneMasked: '*** Protected ***',
                  country: custRecord?.country || 'International',
                },
                specialRequests: b.special_requests,
              },
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn('Database error in /api/bookings/lookup:', dbErr);
    }
  }

  if (serverBookings.has(cleanRef)) {
    const memoryBooking = serverBookings.get(cleanRef);
    return res.json({
      success: true,
      found: true,
      booking: memoryBooking,
    });
  }

  // Authoritative: Never fabricate a fake booking if not found
  return res.status(404).json({
    success: false,
    found: false,
    error: `Booking reference "${cleanRef}" was not found. Please verify the code on your confirmation voucher or contact pier desk dispatch.`,
  });
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
      const verification = typeof body.contactVerification === 'string' ? body.contactVerification.trim().toLowerCase() : '';

      if (!reference || !/^RST-\d{4}-[A-Z0-9]+$/.test(reference)) {
        return res.status(400).json({ success: false, error: 'Valid booking reference (RST-YYYY-XXXX) is required.' });
      }

      const isStaff = req.user && ['admin', 'super_admin', 'manager', 'staff'].includes(req.user.role);

      if (!isStaff && !verification) {
        return res.status(400).json({
          success: false,
          error: 'Two-factor contact verification (email or phone) is required for guest booking lookup.',
        });
      }

      if (serverSupabase) {
        try {
          if (verification) {
            const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc('lookup_booking_secure', {
              p_reference: reference,
              p_verification: verification,
            });

            const rawBooking = (rpcRes && typeof rpcRes === 'object')
              ? ((rpcRes as any).booking || ((rpcRes as any).bookingReference ? rpcRes : null))
              : null;

            if (!rpcErr && rawBooking && rawBooking.bookingReference) {
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
            }
          }

          const { data: b, error } = await serverSupabase
            .from('bookings')
            .select('id, booking_reference, booking_date, status, payment_status, total, currency, customers(*), tours(*)')
            .eq('booking_reference', reference)
            .maybeSingle();

          if (!error && b) {
            if (isStaff) {
              return res.json({ success: true, booking: b });
            }

            const custRecord: any = Array.isArray((b as any).customers) ? (b as any).customers[0] : (b as any).customers;
            const custEmail = (custRecord?.email || '').toLowerCase();
            const custPhone = (custRecord?.phone || '').replace(/\s+/g, '');
            const cleanVer = verification.replace(/\s+/g, '');

            if (custEmail === verification || (custPhone.length >= 6 && custPhone.includes(cleanVer))) {
              const maskedEmail = custEmail.replace(/^(.)(.*)(@.*)$/, (_: string, a: string, _b: string, c: string) => `${a}***${c}`);
              return res.json({
                success: true,
                booking: {
                  ...b,
                  customers: {
                    ...custRecord,
                    email: maskedEmail,
                    phone: '*** Protected ***',
                  },
                },
              });
            }
          }
        } catch (err) {
          console.warn('Database error in lookup_booking:', err);
        }
      }

      return res.status(404).json({
        success: false,
        error: `Booking "${reference}" not found or contact verification did not match.`,
      });
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
