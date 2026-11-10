import assert from 'node:assert/strict';
import {
  resolveBookingTourIdentifier,
  shouldUseLocalBookingCache,
} from '../src/lib/bookingIdentifiers';

const databaseId = '8f8c4f5a-1d21-4f1d-a2b8-9e1f4c6a2d10';

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
