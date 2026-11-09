/**
 * Comprehensive Security Utilities
 * Includes input sanitization, regex validations, rate limiting, and safe storage
 */

import { ValidationResult, RateLimitState } from '../types/security';

/**
 * Strips script tags, HTML event handlers, and dangerous characters to prevent XSS
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Strip <script> and dangerous HTML tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|applet|meta|link|style)[^>]*>/gi, '')
    // Strip inline JavaScript handlers like onload=, onerror=, onclick=
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    // Normalize and trim whitespace
    .trim();
}

/**
 * Escapes characters for safe usage in search RegExp queries (prevents ReDoS)
 */
export function sanitizeSearchQuery(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
}

/**
 * Validates Email Address according to RFC 5322 compliant structure
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  // Strict standard email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates international phone numbers (E.164 and local formats)
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  // Allows optional +, digits, spaces, hyphens, parentheses (7 to 20 chars)
  const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Validates Red Sea Excursions booking reference format
 * Accepts RST-YYYY-XXXX (where XXXX is letters+digits) or RSE-XXXXX
 */
export function isValidBookingReference(ref: string): boolean {
  if (!ref) return false;
  const clean = ref.trim().toUpperCase();
  const format1 = /^RST-\d{4}-[A-Z0-9]{4,6}$/;
  const format2 = /^RSE-\d{4,8}$/;
  return format1.test(clean) || format2.test(clean);
}

/**
 * Validates that an excursion date is within a reasonable future window (today up to 180 days)
 */
export function isValidExcursionDate(dateStr: string): ValidationResult {
  if (!dateStr) {
    return { isValid: false, error: 'Departure date is required.' };
  }

  const selected = new Date(dateStr);
  if (isNaN(selected.getTime())) {
    return { isValid: false, error: 'Invalid date format.' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selected < today) {
    return { isValid: false, error: 'Departure date cannot be in the past.' };
  }

  const maxDate = new Date();
  maxDate.setDate(today.getDate() + 365);
  if (selected > maxDate) {
    return { isValid: false, error: 'Excursions can only be booked up to 1 year in advance.' };
  }

  return { isValid: true };
}

/**
 * Masks an email address for privacy and security on public confirmation screens
 * e.g. "marcus.weber@example.com" -> "m***r@example.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Masks a phone number for privacy
 * e.g. "+49 170 1234567" -> "+49 170 *** 4567"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return '***';
  const clean = phone.trim();
  const visibleStart = clean.slice(0, 7);
  const visibleEnd = clean.slice(-4);
  return `${visibleStart} *** ${visibleEnd}`;
}

/**
 * Client-Side Rate Limiter for Authentication & Form Submissions
 * Defends against brute-force attacks and automated bots
 */
export class ClientRateLimiter {
  private key: string;
  private maxAttempts: number;
  private lockoutDurationMs: number;

  constructor(key: string, maxAttempts = 5, lockoutDurationMs = 60000) {
    this.key = `rse_ratelimit_${key}`;
    this.maxAttempts = maxAttempts;
    this.lockoutDurationMs = lockoutDurationMs;
  }

  private getData(): { attempts: number; lockExpiresAt: number | null } {
    try {
      const stored = sessionStorage.getItem(this.key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return { attempts: 0, lockExpiresAt: null };
  }

  private saveData(data: { attempts: number; lockExpiresAt: number | null }) {
    try {
      sessionStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }

  public check(): RateLimitState {
    const data = this.getData();
    const now = Date.now();

    if (data.lockExpiresAt && data.lockExpiresAt > now) {
      const remainingSeconds = Math.ceil((data.lockExpiresAt - now) / 1000);
      return {
        attempts: data.attempts,
        maxAttempts: this.maxAttempts,
        isLocked: true,
        lockExpiresAt: data.lockExpiresAt,
        remainingSeconds,
      };
    }

    // Lock has expired, reset attempts
    if (data.lockExpiresAt && data.lockExpiresAt <= now) {
      this.reset();
      return {
        attempts: 0,
        maxAttempts: this.maxAttempts,
        isLocked: false,
        lockExpiresAt: null,
        remainingSeconds: 0,
      };
    }

    return {
      attempts: data.attempts,
      maxAttempts: this.maxAttempts,
      isLocked: false,
      lockExpiresAt: null,
      remainingSeconds: 0,
    };
  }

  public recordFailedAttempt(): RateLimitState {
    const data = this.getData();
    data.attempts += 1;

    if (data.attempts >= this.maxAttempts) {
      data.lockExpiresAt = Date.now() + this.lockoutDurationMs;
    }

    this.saveData(data);
    return this.check();
  }

  public reset(): void {
    try {
      sessionStorage.removeItem(this.key);
    } catch {
      // Ignore
    }
  }
}

/**
 * Safe Local/Session Storage Manager with Quota and Error Protection
 */
export const safeStorage = {
  get<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return fallback;
      return JSON.parse(item) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(`[safeStorage] Failed to save key "${key}":`, err);
      return false;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};

/**
 * Escapes characters for HTML text nodes to prevent XSS in dynamic rendering
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes redirect URLs to guard against Open Redirect vulnerabilities
 * Ensures target is a relative path starting with '/' and not '//'
 */
export function sanitizeRedirectUrl(targetUrl: string | undefined | null, fallback = '/'): string {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return fallback;
  }
  const trimmed = targetUrl.trim();
  // Disallow absolute protocol URLs (http:, https:, javascript:, data:) and protocol-relative (//)
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
  ) {
    return fallback;
  }
  return trimmed;
}

/**
 * Validates password strength for registration and security updates
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  errors: string[];
} {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 1;

  if (!/[a-zA-Z]/.test(password)) {
    errors.push('Password must include at least one letter.');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must include at least one number.');
  }

  return {
    isValid: errors.length === 0,
    score,
    errors,
  };
}

/**
 * Pre-configured Application Rate Limiters
 */
export const authRateLimiter = new ClientRateLimiter('auth_actions', 5, 60000);
export const bookingRateLimiter = new ClientRateLimiter('booking_submissions', 6, 60000);
export const inquiryRateLimiter = new ClientRateLimiter('inquiry_submissions', 4, 60000);
export const newsletterRateLimiter = new ClientRateLimiter('newsletter_signups', 5, 60000);
export const reviewRateLimiter = new ClientRateLimiter('tour_reviews', 3, 60000);

