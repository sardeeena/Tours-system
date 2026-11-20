import fs from 'node:fs';
import path from 'node:path';

/**
 * Static, side-effect-free security regression checks.
 *
 * These tests deliberately do not call public submission or booking services:
 * those services may be connected to a real Supabase project in CI or a developer
 * environment. No customer, booking, newsletter or CRM rows are created here.
 */

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.resolve(root, relativePath), 'utf8');

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`✓ PASS: ${description}`);
    passed += 1;
  } else {
    console.error(`✗ FAIL: ${description}`);
    failed += 1;
  }
}

console.log('Abuse prevention, rate limiting and booking fail-closed source checks');

// Inquiry honeypot must short-circuit before rate-limit, CRM and database work.
const inquiry = read('src/services/inquiryService.ts');
const inquiryTrap = inquiry.indexOf("if (input.website_url_hp && input.website_url_hp.trim() !== '')");
const inquiryRateLimit = inquiry.indexOf('const limit = inquiryRateLimiter.check()');
const inquiryCreateStart = inquiry.indexOf('export async function createCustomerInquiry');
const inquiryCreateEnd = inquiry.indexOf('export async function listInquiries', inquiryCreateStart);
const inquiryCreate = inquiry.slice(inquiryCreateStart, inquiryCreateEnd);
const inquiryApiFetch = inquiryCreate.indexOf("fetch('/api/inquiries'");
assert(inquiryTrap >= 0 && inquiryRateLimit > inquiryTrap, 'Inquiry honeypot short-circuits before rate-limit and persistence work');
assert(inquiryApiFetch > inquiryTrap, 'Inquiry persistence uses the same-origin server API after the honeypot and rate-limit guards');
assert(!inquiryCreate.includes(".from('inquiries')"), 'Public inquiry creation never writes directly to the exposed table');
assert(inquiry.slice(inquiryTrap, inquiryRateLimit).includes("admin_notes: 'Dropped honeypot bot trap'"), 'Inquiry honeypot produces a trapped internal marker');
const server = read('server.ts');
assert(server.includes("p_action: 'public_inquiry_email'"), 'Inquiry API enforces a database-backed per-email rate limit');
assert(server.includes("p_action: 'public_newsletter_email'"), 'Newsletter API enforces a database-backed per-email rate limit');
assert(server.includes('tour_title: cleanTourTitle'), 'Inquiry API persists the referenced tour title separately from internal notes');

// Newsletter honeypot must short-circuit before the network request.
const newsletter = read('src/services/newsletterService.ts');
const newsletterTrap = newsletter.indexOf('if (honeypot?.trim())');
const newsletterFetch = newsletter.indexOf("fetch('/api/newsletter/subscribe'");
assert(newsletterTrap >= 0 && newsletterFetch > newsletterTrap, 'Newsletter honeypot returns before the server request');
assert(newsletter.slice(newsletterTrap, newsletterFetch).includes('success: true'), 'Newsletter honeypot uses a non-disclosing success response');

// Database rate limiter and trigger protections must exist in the forward migration.
const migration = read('supabase/migrations/20261016000000_hardened_abuse_prevention_and_atomic_rate_limits.sql');
const completeSchema = read('complete_schema.sql');
const schema = read('supabase/schema.sql');
for (const [name, sql] of [
  ['forward migration', migration],
  ['complete schema snapshot', completeSchema],
  ['Supabase schema snapshot', schema],
] as const) {
  assert(sql.includes('rate_limit_buckets'), `${name} defines the atomic rate-limit table`);
  assert(sql.includes('check_atomic_rate_limit'), `${name} defines the atomic rate-limit function`);
  assert(sql.includes('website_url_hp IS NOT NULL'), `${name} includes database honeypot enforcement`);
}
assert(migration.includes('ON CONFLICT (bucket_key, bucket_window)'), 'Rate limiting uses an atomic conflict-safe upsert');
assert(migration.includes('SET search_path = pg_catalog, public, pg_temp'), 'Rate-limit trigger uses a hardened search path');
assert(migration.includes('REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated'), 'Unprivileged roles cannot directly access rate-limit buckets');

// Booking test is source-only: never create a test booking against a configured database.
const booking = read('src/services/bookingRepository.ts');
assert(booking.includes("supabase.rpc('create_booking_atomic_with_departure'") && booking.includes('p_departure_id: booking.departureId'), 'Booking creation uses the authoritative atomic database RPC with an explicitly selected departure');
assert(booking.includes("if (res.success === false)"), 'A database rejection cannot be treated as a successful booking');
assert(booking.includes("if (!import.meta.env.DEV)"), 'Offline browser booking fallback is restricted to development');
assert(booking.includes("bookingId: booking.bookingId || `dev_bk_${Date.now()}`"), 'Development-only bookings are unmistakably marked as local sandbox records');
assert(!booking.includes(".from('bookings')\n        .insert("), 'Booking creation has no direct client-side table-insert fallback');

console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
