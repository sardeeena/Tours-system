import fs from 'node:fs';
import path from 'node:path';
import { rateLimitNetworkKey } from '../src/server/rateLimitNetwork';

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

const ipv6A = rateLimitNetworkKey('2001:db8:abcd:1234::1');
const ipv6B = rateLimitNetworkKey('2001:db8:abcd:1234:ffff::abcd');
const ipv6OtherNetwork = rateLimitNetworkKey('2001:db8:abcd:1235::1');
assert(ipv6A === ipv6B, 'IPv6 privacy-address rotation within one /64 shares a rate-limit principal');
assert(ipv6A !== ipv6OtherNetwork, 'Different IPv6 /64 networks retain independent rate-limit principals');
assert(rateLimitNetworkKey('192.0.2.10') !== rateLimitNetworkKey('192.0.2.11'), 'IPv4 addresses remain individually rate-limited');
assert(rateLimitNetworkKey('::ffff:192.0.2.10') === rateLimitNetworkKey('192.0.2.10'), 'IPv4-mapped IPv6 addresses normalize to the corresponding IPv4 principal');
assert(rateLimitNetworkKey('0:0:0:0:0:ffff:c000:020a') === rateLimitNetworkKey('192.0.2.10'), 'Hexadecimal IPv4-mapped IPv6 addresses normalize to the corresponding IPv4 principal');
assert(rateLimitNetworkKey('fe80::1%eth0') === rateLimitNetworkKey('fe80::1'), 'IPv6 zone identifiers are stripped before network normalization');
assert(rateLimitNetworkKey('::ffff:192.0.2.10%eth0') === rateLimitNetworkKey('192.0.2.10'), 'Zone-indexed IPv4-mapped IPv6 addresses normalize to IPv4');



// Inquiry honeypot must short-circuit before rate-limit, CRM and database work.
const inquiry = read('src/services/inquiryService.ts');
const inquiryTrap = inquiry.indexOf("if (input.website_url_hp && input.website_url_hp.trim() !== '')");
const inquiryRateLimit = inquiry.indexOf('const limit = inquiryRateLimiter.check()');
const inquiryEndpoint = inquiry.indexOf("fetch('/api/inquiries/submit'");
assert(inquiryTrap >= 0 && inquiryRateLimit > inquiryTrap, 'Inquiry honeypot short-circuits before rate-limit and persistence work');
assert(inquiryEndpoint > inquiryTrap, 'Inquiry persistence uses the server endpoint downstream of the honeypot guard');
assert(!/\.from\('inquiries'\)[\s\S]*?\.insert\(/.test(inquiry), 'Public inquiry service has no direct client-side insert bypass');
assert(inquiry.slice(inquiryTrap, inquiryRateLimit).includes("admin_notes: 'Dropped honeypot bot trap'"), 'Inquiry honeypot produces a trapped internal marker');

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

// Public API validation must reject hostile JSON types before string operations.
const server = read('server.ts');
assert(server.includes("(req.ip || req.socket.remoteAddress || 'unknown').trim()"), 'Shared rate limiter trims proxy-derived client addresses before validation');
const emailHelper = server.slice(server.indexOf('function normalizeSenderEmail'), server.indexOf('// ------------------------------------------------------------------------------', server.indexOf('function normalizeSenderEmail')));
assert(emailHelper.includes("if (typeof value !== 'string') return ''"), 'Email normalization safely rejects non-string input');
assert(emailHelper.includes("if (typeof email !== 'string' || email.length > 254) return false"), 'Email validation safely rejects non-string and oversized input');
const inquiryRouteStart = server.indexOf("app.post(['/api/inquiries', '/api/inquiries/submit', '/api/contact']");
const inquiryRouteEnd = server.indexOf('// 8. Newsletter Subscription API', inquiryRouteStart);
const inquiryRoute = server.slice(inquiryRouteStart, inquiryRouteEnd);
assert(inquiryRoute.includes("req.body && typeof req.body === 'object' && !Array.isArray(req.body)"), 'Inquiry endpoint normalizes malformed request bodies');
assert(inquiryRoute.includes("typeof email !== 'string'"), 'Inquiry endpoint rejects non-string email values before validation');
assert(inquiryRoute.includes("typeof phone !== 'undefined' && phone !== null && typeof phone !== 'string'"), 'Inquiry endpoint rejects non-string phone values');
assert(inquiryRoute.includes(String.raw`inquiryType.trim().replace(/[\u0000-\u001f\u007f]/g, '')`), 'Inquiry subject strips control characters before outbound email headers');
assert(inquiryRoute.includes("isIP(resolvedClientIp)"), 'Inquiry endpoint requires a valid resolved client IP');
assert(server.includes('rateLimitNetworkKey(resolvedIp)'), 'Shared HTTP rate limits normalize IPv6 addresses to a /64 network key');
assert(server.includes('rateLimitNetworkKey(resolvedClientIp)'), 'Public review database rate limits normalize IPv6 addresses to a /64 network key');
assert(inquiryRoute.includes('rateLimitNetworkKey(resolvedClientIp)'), 'Public inquiry database rate limits normalize IPv6 addresses to a /64 network key');
assert(server.includes("p_action: 'public_review_tour'"), 'Review submissions have an independent per-tour network budget');
assert(server.includes("p_action: 'public_review_account'"), 'Signed-in review submissions have an independent per-account budget');
assert(inquiryRoute.includes("p_action: 'public_inquiry_email'"), 'Inquiry endpoint applies a database-backed per-email rate limit');
assert(inquiryRoute.includes("createHash('sha256').update(cleanEmail).digest('hex')"), 'Inquiry email rate-limit identifiers are hashed before persistence');
assert(inquiryRoute.includes("p_max_hits: 5"), 'Inquiry email rate limit caps submissions at five per ten-minute window');
assert(inquiryRoute.includes('tour_title: cleanTourTitle'), 'Inquiry endpoint persists referenced tour context separately');
assert(inquiry.includes('tour_title: input.tour_title || null'), 'Inquiry client forwards referenced tour title to the server');
assert(inquiryRoute.includes("p_action: 'public_inquiry_ip'"), 'Inquiry endpoint applies a database-backed per-IP rate limit');
assert(inquiryRoute.includes("createHash('sha256').update(clientIp).digest('hex')"), 'Inquiry IP rate-limit identifiers are hashed before persistence');
assert(inquiryRoute.includes("p_max_hits: 30"), 'Inquiry endpoint caps submissions at thirty per IPv6 network per ten-minute window');
assert(inquiryRoute.includes("if (ipRateLimitError.code === 'P0001')"), 'Inquiry endpoint returns a rate-limit response when the database limit is reached');
assert(inquiryRoute.includes("catch (error: any)"), 'Inquiry endpoint catches asynchronous failures and returns a controlled response');

// Spreadsheet exports must use the central formula-neutralizing serializer.
const communicationsCsv = read('src/components/admin/communications/CommunicationsHistory.tsx');
const spreadsheetSerializer = read('src/utils/spreadsheetExport.ts');
assert(communicationsCsv.includes("import { serializeSpreadsheetRows } from '../../../utils/spreadsheetExport'"), 'Communications CSV uses the shared spreadsheet serializer');
assert(communicationsCsv.includes('serializeSpreadsheetRows([headers, ...rows])'), 'Every communications export column passes through the shared serializer');
assert(!communicationsCsv.includes('const csvCell'), 'Communications export does not maintain a divergent cell serializer');
assert(spreadsheetSerializer.includes("/^[\\s\\u0000-\\u001f\\u007f-\\u009f\\ufeff]*[=+\\-@]/.test(raw)"), 'Shared serializer neutralizes formula prefixes after Unicode whitespace and control characters');
assert(spreadsheetSerializer.includes("safe.replace(/\"/g, '\"\"')"), 'Shared serializer escapes embedded quotes using RFC 4180 doubling');

// Booking test is source-only: never create a test booking against a configured database.
const booking = read('src/services/bookingRepository.ts');
assert(booking.includes("supabase.rpc('create_booking_atomic_with_departure'") && booking.includes('p_departure_id: booking.departureId'), 'Booking creation uses the authoritative atomic database RPC with an explicitly selected departure');
assert(booking.includes("if (res.success === false)"), 'A database rejection cannot be treated as a successful booking');
assert(booking.includes("if (!import.meta.env.DEV)"), 'Offline browser booking fallback is restricted to development');
assert(booking.includes("bookingId: booking.bookingId || `dev_bk_${Date.now()}`"), 'Development-only bookings are unmistakably marked as local sandbox records');
assert(!booking.includes(".from('bookings')\n        .insert("), 'Booking creation has no direct client-side table-insert fallback');

console.log(`Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
