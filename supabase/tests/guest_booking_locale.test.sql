BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(5);

SELECT ok(
  has_function_privilege(
    'anon',
    'public.create_booking_atomic_with_locale(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'anonymous guests can execute the atomic booking entrypoint'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.bookings', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.bookings', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.bookings', 'SELECT'),
  'guest booking does not grant direct access to booking records'
);

INSERT INTO public.tours (title, slug, status, price, max_guests, pickup_available, languages)
VALUES ('pgTAP Guest Locale Test Tour', 'pgtap-guest-locale-test', 'published', 100.00, 10, FALSE, ARRAY['English']);

INSERT INTO public.tour_availability (tour_id, date, max_capacity, booked_count, status)
SELECT id, CURRENT_DATE + 30, 10, 0, 'available'
FROM public.tours
WHERE slug = 'pgtap-guest-locale-test';

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', TRUE);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', TRUE);
SELECT set_config(
  'pgtap.guest_booking_result',
  public.create_booking_atomic_with_locale(
    'pgtap-guest-locale-test',
    CURRENT_DATE + 30,
    1,
    0,
    0,
    'Guest',
    'Checkout',
    'pgtap-guest-locale@example.test',
    '+201000000002',
    'Egypt',
    NULL,
    NULL,
    NULL,
    '[]'::jsonb,
    NULL,
    'pay_at_pickup',
    NULL,
    'idem_pgtap_guest_locale_booking_0001',
    'English',
    'fr'
  )::text,
  TRUE
);
RESET ROLE;

SELECT ok(
  COALESCE((current_setting('pgtap.guest_booking_result', TRUE)::jsonb ->> 'success')::boolean, FALSE),
  'guest checkout creates a booking without an account'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.id = (current_setting('pgtap.guest_booking_result', TRUE)::jsonb ->> 'bookingId')::uuid
      AND b.user_id IS NULL
      AND b.customer_locale = 'fr'
  ),
  'guest booking remains unowned by an account and persists its selected customer locale'
);

SELECT is(
  (
    SELECT c.preferred_locale
    FROM public.bookings AS b
    JOIN public.customers AS c ON c.id = b.customer_id
    WHERE b.id = (current_setting('pgtap.guest_booking_result', TRUE)::jsonb ->> 'bookingId')::uuid
  ),
  'fr',
  'guest customer communication preference is persisted'
);

SELECT * FROM finish();
ROLLBACK;
