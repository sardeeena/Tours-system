import assert from 'node:assert/strict';

const baseUrl = (process.env.API_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
assert.ok(baseUrl, 'Supabase local API_URL must be provided by supabase status -o env');
assert.ok(serviceKey, 'Supabase local SERVICE_ROLE_KEY must be provided by supabase status -o env');

async function request(path, { method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}) for ${path}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const suffix = `${Date.now()}_${process.pid}`;
const slug = `race_capacity_${suffix}`;
const bookingDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const [tour] = await request('tours?select=id', {
  method: 'POST',
  prefer: 'return=representation',
  body: [{
    title: 'Isolated concurrent booking regression',
    slug,
    status: 'published',
    price: 100,
    child_price: 50,
    max_guests: 10,
    pickup_available: false,
    minimum_booking_notice_hours: 0,
  }],
});
assert.ok(tour?.id, 'test tour must be created');

const [departure] = await request('departures?select=id', {
  method: 'POST',
  prefer: 'return=representation',
  body: [{
    tour_id: tour.id,
    date: bookingDate,
    start_time: '09:00:00',
    end_time: '12:00:00',
    capacity: 1,
    booked_passengers: 0,
    remaining_capacity: 1,
    status: 'confirmed',
  }],
});
assert.ok(departure?.id, 'single-seat departure must be created');

await request('tour_availability', {
  method: 'POST',
  prefer: 'return=minimal',
  body: [{
    tour_id: tour.id,
    date: bookingDate,
    max_capacity: 1,
    booked_count: 0,
    status: 'available',
    is_blackout: false,
    departure_id: departure.id,
  }],
});

function bookingPayload(index) {
  return {
    p_tour_identifier: slug,
    p_booking_date: bookingDate,
    p_adult_count: 1,
    p_child_count: 0,
    p_infant_count: 0,
    p_customer_first_name: 'Race',
    p_customer_last_name: `Guest${index}`,
    p_customer_email: `race-${index}-${suffix}@example.test`,
    p_customer_phone: `+20100000${String(index).padStart(4, '0')}`,
    p_customer_country: 'Egypt',
    p_customer_hotel: 'Isolated CI Test',
    p_pickup_location_id: null,
    p_pickup_room_number: null,
    p_extras: [],
    p_coupon_code: null,
    p_payment_method: 'pay_at_pickup',
    p_special_requests: 'Automated isolated concurrency test',
    p_idempotency_key: `race_booking_${index}_${suffix}`,
    p_tour_language: 'English',
    p_customer_locale: 'en',
    p_departure_id: departure.id,
  };
}

// Launch independent PostgREST requests together. Each request is handled by
// its own database transaction/connection; neither call shares a SQL session.
const results = await Promise.all([
  request('rpc/create_booking_atomic_with_departure', {
    method: 'POST',
    body: bookingPayload(1),
  }),
  request('rpc/create_booking_atomic_with_departure', {
    method: 'POST',
    body: bookingPayload(2),
  }),
]);

const successes = results.filter(result => result?.success === true);
const failures = results.filter(result => result?.success === false);
assert.equal(successes.length, 1, `exactly one competing booking must succeed; got ${JSON.stringify(results)}`);
assert.equal(failures.length, 1, `exactly one competing booking must be rejected; got ${JSON.stringify(results)}`);

const [slot] = await request(
  `departures?id=eq.${departure.id}&select=capacity,booked_passengers,remaining_capacity`,
);
assert.equal(slot.capacity, 1);
assert.equal(slot.booked_passengers, 1, 'departure ledger must contain exactly one passenger');
assert.equal(slot.remaining_capacity, 0, 'the only seat must be fully consumed');

const bookings = await request(
  `bookings?departure_id=eq.${departure.id}&status=neq.cancelled&select=id,adult_count,child_count,infant_count`,
);
assert.equal(bookings.length, 1, 'exactly one active booking may reference the one-seat departure');
const [daily] = await request(
  `tour_availability?tour_id=eq.${tour.id}&date=eq.${bookingDate}&select=max_capacity,booked_count,status`,
);
assert.equal(daily.max_capacity, 1);
assert.equal(daily.booked_count, 1, 'daily summary must agree with the departure ledger');
assert.equal(daily.status, 'sold_out');

console.log('Concurrent booking capacity regression passed: one winner, one rejection, no oversell.');
