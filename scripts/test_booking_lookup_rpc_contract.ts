import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('../src/services/bookingRepository.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/20261110000000_booking_lookup_cancellation_hardening.sql', import.meta.url),
  'utf8',
);
const departureMigration = readFileSync(
  new URL('../supabase/migrations/20261119162000_secure_lookup_departure_details.sql', import.meta.url),
  'utf8',
);

assert.match(
  service,
  /supabase\.rpc\(['"]lookup_booking_secure['"]/,
  'Customer booking lookup must call the deployed public.lookup_booking_secure RPC.',
);
assert.doesNotMatch(
  service,
  /lookup_booking_secure_with_language/,
  'Customer booking lookup must not call an RPC absent from the migration history.',
);
assert.match(
  migration,
  /CREATE OR REPLACE FUNCTION public\.lookup_booking_secure\s*\(/,
  'The migration history must define the public secure booking lookup RPC.',
);
assert.match(
  migration,
  /p_reference\s+TEXT[\s\S]*p_verification\s+TEXT/,
  'The secure lookup RPC must accept the booking reference and verification contact.',
);
assert.match(
  departureMigration,
  /COMMENT ON FUNCTION private\.lookup_booking_secure\(TEXT,TEXT\)/,
  'The departure migration must document the private secure lookup implementation.',
);
assert.match(
  service,
  /this\.mapSecureBookingToBooking\(rawBooking\)/,
  'The verified RPC response must be mapped into the customer booking model.',
);

console.log('Secure customer booking lookup RPC matches the applied migration contract.');
