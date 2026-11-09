import { createCustomerInquiry } from '../src/services/inquiryService';
import { subscribeToNewsletter } from '../src/services/newsletterService';
import { bookingRepository } from '../src/services/bookingRepository';
import fs from 'fs';
import path from 'path';

/**
 * ==============================================================================
 * ABUSE PREVENTION & RATE LIMITING VERIFICATION SUITE
 * ==============================================================================
 */

async function runTests() {
  console.log('================================================================');
  console.log('  Running Abuse Prevention & Rate Limiting Verification Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`✓ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  // 1. Test Honeypot Suppression on Inquiries
  console.log('Test 1: Anti-Bot Honeypot Field on Customer Inquiry');
  const honeypotInquiryRes = await createCustomerInquiry({
    customer_name: 'Spam Bot 3000',
    email: 'spambot@example-seo-spam.com',
    subject: 'Buy Cheap Watches',
    message: 'Check out our spam website links here http://spam.xyz',
    source: 'web',
    website_url_hp: 'http://spam-link-filled-by-bot.com', // BOT FILLING HONEYPOT
  });

  assert(honeypotInquiryRes.success === true, 'Honeypot returns trapped success response to fool bot');
  assert(honeypotInquiryRes.inquiry?.admin_notes === 'Dropped honeypot bot trap', 'Honeypot marks internal drop flag');

  // 2. Test Legitimate Inquiry passes through client validation
  console.log('\nTest 2: Legitimate Customer Inquiry Validation');
  const legitimateInquiryRes = await createCustomerInquiry({
    customer_name: 'Hans Zimmer',
    email: 'hans.zimmer@example.com',
    phone: '+49 170 1234567',
    subject: 'Diving in Giftun Island',
    message: 'Hello, we would like to book a private boat trip for 4 adults next Tuesday.',
    source: 'web',
    website_url_hp: '', // EMPTY FOR REAL USERS
  });

  assert(legitimateInquiryRes.success === true, 'Legitimate inquiry passes validation and is accepted');
  assert(legitimateInquiryRes.inquiry?.email === 'hans.zimmer@example.com', 'Inquiry email is preserved and sanitized');

  // 3. Test Honeypot Suppression on Newsletter
  console.log('\nTest 3: Anti-Bot Honeypot Field on Newsletter');
  const honeypotNewsRes = await subscribeToNewsletter(
    'bot_harvester@spambot.net',
    'footer',
    'http://filled-by-automated-crawler.com'
  );

  assert(honeypotNewsRes.success === true, 'Newsletter honeypot returns trapped success response');
  assert(honeypotNewsRes.discountCode === 'REDSEA15', 'Newsletter honeypot provides static promotional code');

  // 4. Test SQL Migration & Trigger Parity
  console.log('\nTest 4: Database Trigger & Function Parity');
  const migration20261015Path = path.resolve('supabase/migrations/20261015000000_server_side_abuse_prevention.sql');
  const migration20261016Path = path.resolve('supabase/migrations/20261016000000_hardened_abuse_prevention_and_atomic_rate_limits.sql');
  const completePath = path.resolve('complete_schema.sql');
  const schemaPath = path.resolve('supabase/schema.sql');

  assert(fs.existsSync(migration20261015Path), 'Migration 20261015000000_server_side_abuse_prevention.sql exists');
  assert(fs.existsSync(migration20261016Path), 'Forward-only migration 20261016000000_hardened_abuse_prevention_and_atomic_rate_limits.sql exists');
  assert(fs.existsSync(completePath), 'complete_schema.sql exists');
  assert(fs.existsSync(schemaPath), 'supabase/schema.sql exists');

  const mig16Sql = fs.readFileSync(migration20261016Path, 'utf8');
  const completeSql = fs.readFileSync(completePath, 'utf8');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // 5. Test Atomic Rate Limiting Engine
  console.log('\nTest 5: Atomic Rate Limiter Architecture');
  assert(mig16Sql.includes('rate_limit_buckets'), 'Migration defines rate_limit_buckets table');
  assert(completeSql.includes('rate_limit_buckets'), 'complete_schema.sql defines rate_limit_buckets table');
  assert(schemaSql.includes('rate_limit_buckets'), 'supabase/schema.sql defines rate_limit_buckets table');

  assert(mig16Sql.includes('check_atomic_rate_limit'), 'Migration defines atomic check_atomic_rate_limit');
  assert(completeSql.includes('check_atomic_rate_limit'), 'complete_schema.sql defines atomic check_atomic_rate_limit');
  assert(schemaSql.includes('check_atomic_rate_limit'), 'supabase/schema.sql defines atomic check_atomic_rate_limit');

  assert(mig16Sql.includes('ON CONFLICT (bucket_key, bucket_window)'), 'Migration uses atomic ON CONFLICT row-level locking upsert');
  assert(completeSql.includes('ON CONFLICT (bucket_key, bucket_window)'), 'complete_schema.sql uses atomic ON CONFLICT row-level locking upsert');

  // 6. Test Database-Level Honeypot Verification
  console.log('\nTest 6: Database-Level Honeypot Enforcement');
  assert(mig16Sql.includes('website_url_hp IS NOT NULL'), 'Trigger verifies website_url_hp is not null/empty');
  assert(completeSql.includes('website_url_hp IS NOT NULL'), 'complete_schema.sql trigger checks website_url_hp');
  assert(schemaSql.includes('website_url_hp IS NOT NULL'), 'supabase/schema.sql trigger checks website_url_hp');

  // 7. Test Security Boundaries & Least Privilege
  console.log('\nTest 7: Security Boundaries & Privilege Revocations');
  assert(mig16Sql.includes("REVOKE ALL ON FUNCTION public.check_public_submission_rate_limit() FROM PUBLIC, anon, authenticated"), 'Direct trigger function execution revoked from unprivileged roles');
  assert(mig16Sql.includes("REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated"), 'Direct access to rate_limit_buckets revoked from unprivileged roles');
  assert(mig16Sql.includes("session_user IN ('postgres', 'service_role')"), 'Trigger explicitly permits administrative & test maintenance roles');
  assert(mig16Sql.includes("SET search_path = pg_catalog, public, pg_temp"), 'search_path hardened with pg_catalog first');

  // 8. Test Safe Booking Persistence Guarantees
  console.log('\nTest 8: Honest Booking Persistence (No Fake Success)');
  let bookingRejectedProperly = false;
  try {
    await bookingRepository.createBooking({
      bookingReference: 'RST-2026-TEST99',
      tourId: 'nonexistent-tour-uuid-0000-0000',
      tourTitle: 'Non-Existent Mystery Island',
      date: '2026-11-20',
      status: 'confirmed',
      paymentStatus: 'pending',
      paymentMethod: 'pay_at_pickup',
      customer: {
        firstName: 'Test',
        lastName: 'Traveler',
        email: 'test.traveler@example.com',
        phoneNumber: '+20 100 0000000',
        country: 'Germany',
      },
      guests: { adults: 2, children: 0, infants: 0 },
      pickup: { locationId: 'p1', hotelName: 'Steigenberger ALDAU Beach' },
      pricing: {
        basePricePerAdultEur: 50,
        basePricePerChildEur: 25,
        totalEur: 100,
        formattedTotal: '€100.00',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
  } catch (err: any) {
    if (
      err.message.includes('not registered') ||
      err.message.includes('not available') ||
      err.message.includes('unavailable') ||
      err.message.includes('not configured') ||
      err.message.includes('unconfigured') ||
      err.message.includes('cannot be accepted')
    ) {
      bookingRejectedProperly = true;
    }
  }

  assert(
    bookingRejectedProperly === true,
    'createBooking rejects unpersisted tour and throws explicit error instead of claiming false success'
  );

  console.log('\n================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
