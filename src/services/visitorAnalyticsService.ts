import { supabase, isSupabaseConfigured } from './supabaseClient';

export type VisitorEventName =
  | 'page_view' | 'page_exit' | 'navigation' | 'tour_view' | 'search'
  | 'booking_started' | 'booking_step_completed' | 'booking_submitted'
  | 'booking_confirmed' | 'booking_cancelled' | 'custom'
  | 'booking_step_viewed' | 'review_submitted' | 'tour_shared' | 'language_changed' | 'currency_changed'
  | 'auth_sign_in' | 'auth_sign_in_failed' | 'auth_sign_up' | 'auth_sign_out' | 'password_reset_requested' | 'password_changed' | 'profile_updated' | 'inquiry_submitted' | 'newsletter_subscribed' | 'booking_lookup' | 'booking_cancellation_requested' | 'support_ticket_created' | 'support_reply_sent' | 'support_ticket_updated' | 'tour_search' | 'tour_filter_applied' | 'wishlist_updated' | 'comparison_updated' | 'chatbot_interaction' | 'contact_request_submitted'
  | 'confirmation_email_resent' | 'email_confirmed' | 'mfa_verified';

export interface VisitorConsent {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
  version: string;
}

export interface VisitorMetadata {
  device_type: 'desktop' | 'mobile' | 'tablet' | 'other';
  browser_family: string;
  os_family: string;
  screen_bucket: 'small' | 'medium' | 'large' | 'xlarge';
  language: string;
  locale: string;
  language_preferences: string[];
  platform_family: 'Windows' | 'macOS' | 'Linux' | 'Android' | 'iOS' | 'ChromeOS' | 'Other';
  is_mobile: boolean;
  viewport_bucket: 'compact' | 'standard' | 'wide';
  timezone: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

const SESSION_KEY = 'aat_visitor_session_v1';
const VISITOR_KEY = 'aat_visitor_id_v1';
const SESSION_TTL_MS = 30 * 60 * 1000;
const VISITOR_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const CONSENT_VERSION = '2';

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function visitorId(): string {
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(VISITOR_KEY) || 'null') as { id?: string; createdAt?: number } | null;
    if (saved?.id && saved.createdAt && now - saved.createdAt < VISITOR_TTL_MS) return saved.id;
    const id = randomId();
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ id, createdAt: now }));
    return id;
  } catch { return randomId(); }
}

function sessionId(): string {
  const now = Date.now();
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as { id?: string; lastSeen?: number } | null;
    if (saved?.id && saved.lastSeen && now - saved.lastSeen < SESSION_TTL_MS) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: saved.id, lastSeen: now }));
      return saved.id;
    }
    const id = randomId();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }));
    return id;
  } catch {
    return randomId();
  }
}

export function readVisitorConsent(): VisitorConsent | null {
  try {
    const value = JSON.parse(localStorage.getItem('aat_cookie_consent_v1') || 'null');
    if (value?.version !== CONSENT_VERSION) {
      // Old consent did not disclose IP-derived approximate location. Remove
      // optional identifiers until the visitor makes a fresh choice.
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(VISITOR_KEY);
      return null;
    }
    if (value?.necessary !== true || typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean') return null;
    return { necessary: true, analytics: value.analytics, marketing: value.marketing, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '', version: CONSENT_VERSION };
  } catch {
    return null;
  }
}

function browserFamily(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

function osFamily(ua: string): string {
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Other';
}

export function visitorMetadata(): VisitorMetadata {
  const ua = navigator.userAgent || '';
  const width = window.innerWidth;
  const screenBucket = width < 480 ? 'small' : width < 768 ? 'medium' : width < 1280 ? 'large' : 'xlarge';
  const isIPadOS = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const device = isIPadOS || /Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet'
    : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'mobile'
    : /Windows|Macintosh|Linux|Mac OS|CrOS/i.test(ua) ? 'desktop' : 'other';
  let referrerHost: string | null = null;
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname.slice(0, 120) : null; } catch { referrerHost = null; }
  const platformSource = `${navigator.platform || ''} ${ua}`;
  const platformFamily: VisitorMetadata['platform_family'] = (isIPadOS || /iPhone|iPad|iPod/i.test(platformSource)) ? 'iOS'
    : /Android/i.test(platformSource) ? 'Android'
    : /Windows/i.test(platformSource) ? 'Windows'
    : /Mac/i.test(platformSource) ? 'macOS'
    : /CrOS/i.test(platformSource) ? 'ChromeOS'
    : /Linux/i.test(platformSource) ? 'Linux' : 'Other';
  const languagePreferences = Array.from(new Set([navigator.language, ...(navigator.languages || [])]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value))))
    .slice(0, 8);
  const params = new URLSearchParams(window.location.search);
  const clean = (key: string) => {
    const raw = params.get(key) || '';
    if (/@/.test(raw) || /\d{7,}/.test(raw)) return null;
    return raw.replace(/[^\w .-]/g, '').slice(0, 80) || null;
  };
  return {
    device_type: device, browser_family: browserFamily(ua), os_family: osFamily(ua),
    screen_bucket: screenBucket, language: (navigator.language || 'unknown').slice(0, 24),
    locale: (navigator.language || 'unknown').slice(0, 35),
    language_preferences: languagePreferences,
    platform_family: platformFamily,
    is_mobile: device === 'mobile' || device === 'tablet',
    viewport_bucket: width < 768 ? 'compact' : width < 1280 ? 'standard' : 'wide',
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 64); } catch { return 'unknown'; } })(),
    referrer_host: referrerHost, utm_source: clean('utm_source'), utm_medium: clean('utm_medium'), utm_campaign: clean('utm_campaign'),
    utm_term: clean('utm_term'), utm_content: clean('utm_content'),
  };
}

async function post(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isSupabaseConfigured()) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    }
    const response = await fetch(path, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify(body),
    });
    if (!response.ok && response.status !== 204) return;
  } catch {
    // Analytics is best-effort and must never interrupt booking or navigation.
  }
}

export async function recordVisitorConsent(choices: VisitorConsent, source = 'cookie_banner'): Promise<void> {
  const id = choices.analytics ? sessionId() : (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      return typeof saved?.id === 'string' ? saved.id : null;
    } catch { return null; }
  })();
  if (!choices.analytics) {
    try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(VISITOR_KEY); } catch { /* storage may be unavailable */ }
  }
  await post('/api/visitor/consent', {
    session_id: id, visitor_id: choices.analytics ? visitorId() : null, analytics: choices.analytics, marketing: choices.marketing,
    source, consent_version: choices.version, ...(choices.analytics ? { landing_path: window.location.pathname, metadata: visitorMetadata() } : {}),
  });
  window.dispatchEvent(new CustomEvent('awesome:visitor-consent-saved'));
}

export async function recordVisitorEvent(input: {
  event_name: VisitorEventName;
  page_path: string;
  page_title?: string;
  duration_ms?: number;
  event_data?: Record<string, string | number | boolean>;
}): Promise<void> {
  const consent = readVisitorConsent();
  if (!consent?.analytics) return;
  await post('/api/visitor/events', {
    session_id: sessionId(),
    event_name: input.event_name,
    page_path: input.page_path.split(/[?#]/, 1)[0],
    page_title: input.page_title?.slice(0, 160),
    duration_ms: input.duration_ms,
    event_data: input.event_data || {},
  });
}
