import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatBookingReference,
  isValidBookingReference,
  resolveBookingTourIdentifier,
  shouldUseLocalBookingCache,
} from '../src/lib/bookingIdentifiers';

const databaseId = '8f8c4f5a-1d21-4f1d-a2b8-9e1f4c6a2d10';

assert.equal(formatBookingReference('2026-11-18', 123456), 'AA0002N9C');
assert.equal(formatBookingReference('2026-11-18', 123456).length, 9);
assert.equal(isValidBookingReference('AA0002N9C'), true);
assert.equal(isValidBookingReference('AA0002N9C'.toLowerCase()), true);
assert.equal(isValidBookingReference('AA0002N9'), false);
assert.equal(isValidBookingReference('AWE-20261118-123456'), true);
assert.equal(isValidBookingReference('RST-2026-AB1234'), true);
assert.equal(isValidBookingReference('RSE-12345'), true);
assert.equal(isValidBookingReference('not-a-reference'), false);
assert.throws(() => formatBookingReference('2026-11-18', 36 ** 7), /between 1 and/);

assert.equal(
  resolveBookingTourIdentifier('tour-1', 'orange-bay-island-snorkeling'),
  'orange-bay-island-snorkeling',
  'static catalogue IDs must resolve through the database slug'
);
assert.equal(
  resolveBookingTourIdentifier(databaseId, 'orange-bay-island-snorkeling'),
  databaseId,
  'valid database UUIDs take precedence over slugs'
);
assert.equal(
  resolveBookingTourIdentifier('', 'orange-bay-island-snorkeling'),
  'orange-bay-island-snorkeling',
  'slug is used when the ID is empty'
);
assert.equal(
  resolveBookingTourIdentifier('legacy-slug', ''),
  'legacy-slug',
  'a non-UUID ID remains a final fallback when no slug is supplied'
);

assert.equal(shouldUseLocalBookingCache(true, false, false), true);
assert.equal(shouldUseLocalBookingCache(true, true, true), true);
assert.equal(shouldUseLocalBookingCache(true, true, false), false);
assert.equal(shouldUseLocalBookingCache(false, false, false), false);
assert.equal(shouldUseLocalBookingCache(false, true, true), false);

console.log('Booking identifier and production fallback checks passed.');


const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const availabilityStart = serverSource.indexOf("app.all('/api/availability/check'");
const availabilityEnd = serverSource.indexOf('// 7. Inquiries & Concierge Submissions API', availabilityStart);
assert.notEqual(availabilityStart, -1, 'legacy availability route remains explicitly defined');
assert.notEqual(availabilityEnd, -1, 'availability route has a clear boundary');
const availabilityRoute = serverSource.slice(availabilityStart, availabilityEnd);
assert.match(
  availabilityRoute,
  /publicSupabase\.rpc\('get_tour_availability_schedule'/,
  'legacy availability endpoint must use the authoritative Supabase schedule'
);
assert.doesNotMatch(
  availabilityRoute,
  /availableSeats:\s*\d+|maxCapacity:\s*\d+/,
  'legacy availability endpoint must not return fabricated fixed capacity'
);

console.log('Legacy availability endpoint uses authoritative database capacity.');
