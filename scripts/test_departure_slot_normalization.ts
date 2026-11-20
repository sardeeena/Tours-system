import assert from 'node:assert/strict';
import { mapDepartureSlotFromServer } from '../src/lib/departureSlots';

const base = {
  departure_id: 'departure-1',
  tour_id: 'tour-1',
  date: '2026-12-01',
  start_time: '09:00',
  end_time: '13:00',
  status: 'confirmed',
  capacity: 20,
  booked_count: 12,
  remaining_capacity: 8,
  is_available: true,
  minimum_notice_hours: 12,
};

assert.equal(mapDepartureSlotFromServer(base).isAvailable, true, 'consistent confirmed slot with seats is bookable');
assert.equal(mapDepartureSlotFromServer({ ...base, is_available: false }).isAvailable, false, 'database unavailable flag always wins');
assert.equal(mapDepartureSlotFromServer({ ...base, remaining_capacity: 0 }).isAvailable, false, 'zero remaining seats fail closed');
assert.equal(mapDepartureSlotFromServer({ ...base, capacity: 12, booked_count: 12, remaining_capacity: 8 }).isAvailable, false, 'fully booked capacity fails closed');
assert.equal(mapDepartureSlotFromServer({ ...base, capacity: 10, booked_count: 12, remaining_capacity: 2 }).isAvailable, false, 'overbooked counters fail closed');
assert.equal(mapDepartureSlotFromServer({ ...base, remaining_capacity: 9 }).isAvailable, false, 'remaining seats cannot exceed calculated capacity');
assert.equal(mapDepartureSlotFromServer({ ...base, status: 'cancelled' }).isAvailable, false, 'cancelled departures cannot be booked');
assert.equal(mapDepartureSlotFromServer({ ...base, status: 'completed' }).isAvailable, false, 'completed departures cannot be booked');
assert.equal(mapDepartureSlotFromServer({ ...base, status: 'in_progress' }).isAvailable, false, 'in-progress departures cannot be booked');
assert.equal(mapDepartureSlotFromServer({ ...base, capacity: -5, booked_count: -2, remaining_capacity: -3 }).isAvailable, false, 'negative counters are normalized and fail closed');

const normalized = mapDepartureSlotFromServer({ ...base, capacity: '20', booked_count: '12', remaining_capacity: '8' });
assert.equal(normalized.capacity, 20);
assert.equal(normalized.bookedCount, 12);
assert.equal(normalized.remainingCapacity, 8);
assert.equal(normalized.departureId, 'departure-1');

console.log('Departure slot normalization and fail-closed capacity checks passed.');
