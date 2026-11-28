BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

SELECT ok(
  to_regclass('public.booking_lifecycle_events') IS NOT NULL,
  'the operational booking lifecycle ledger exists'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.booking_lifecycle_events'::regclass),
  'the lifecycle ledger has row-level security enabled'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.booking_lifecycle_events', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.booking_lifecycle_events', 'SELECT'),
  'visitor roles cannot read operational lifecycle events'
);
SELECT ok(
  has_table_privilege('service_role', 'public.booking_lifecycle_events', 'SELECT')
  AND NOT has_table_privilege('service_role', 'public.booking_lifecycle_events', 'INSERT')
  AND NOT has_table_privilege('service_role', 'public.booking_lifecycle_events', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.booking_lifecycle_events', 'DELETE'),
  'trusted server workflows can read the append-only ledger but cannot mutate it directly'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_capture_booking_lifecycle_event'
      AND tgrelid = 'public.bookings'::regclass
      AND NOT tgisinternal
  )
  AND EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_capture_payment_lifecycle_event'
      AND tgrelid = 'public.payment_transactions'::regclass
      AND NOT tgisinternal
  )
  AND EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_capture_refund_lifecycle_event'
      AND tgrelid = 'public.refund_records'::regclass
      AND NOT tgisinternal
  ),
  'booking, payment and refund source tables all emit lifecycle events'
);

INSERT INTO public.tours (id, title, slug, status, price, max_guests)
VALUES (
  'f6500000-0000-4000-8000-000000000001',
  'Lifecycle Analytics Test Tour',
  'lifecycle-analytics-test-tour',
  'published',
  100,
  12
);
INSERT INTO public.tour_availability (tour_id, date, max_capacity, booked_count, status)
VALUES ('f6500000-0000-4000-8000-000000000001', CURRENT_DATE + 2, 12, 0, 'available');
INSERT INTO public.departures (
  tour_id, date, start_time, end_time, capacity, booked_passengers, remaining_capacity, status
)
VALUES (
  'f6500000-0000-4000-8000-000000000001',
  CURRENT_DATE + 2, '09:00', '12:00', 12, 0, 12, 'confirmed'
);

INSERT INTO public.bookings (
  id, booking_reference, tour_id, booking_date, total, currency, payment_status, status
)
VALUES (
  'f6600000-0000-4000-8000-000000000001',
  'LIFECYCLE-ANALYTICS-TEST',
  'f6500000-0000-4000-8000-000000000001',
  CURRENT_DATE + 2,
  100,
  'EUR',
  'pending',
  'pending'
);

SELECT is(
  (SELECT count(*)::integer FROM public.booking_lifecycle_events
   WHERE booking_id = 'f6600000-0000-4000-8000-000000000001' AND event_type = 'booking_submitted'),
  1,
  'a new booking creates exactly one submitted event'
);

SELECT private.record_booking_lifecycle_event(
  'f6600000-0000-4000-8000-000000000001',
  'booking_submitted',
  'bookings',
  'f6600000-0000-4000-8000-000000000001',
  'booking:f6600000-0000-4000-8000-000000000001:submitted',
  NULL,
  'pending',
  100,
  'EUR',
  '{}'::jsonb,
  now()
);
SELECT is(
  (SELECT count(*)::integer FROM public.booking_lifecycle_events
   WHERE booking_id = 'f6600000-0000-4000-8000-000000000001' AND event_type = 'booking_submitted'),
  1,
  'replaying the same source event is idempotent'
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'service_role')::text,
  true
);

UPDATE public.bookings
SET status = 'confirmed'
WHERE id = 'f6600000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::integer FROM public.booking_lifecycle_events
   WHERE booking_id = 'f6600000-0000-4000-8000-000000000001' AND event_type = 'booking_status_confirmed'),
  1,
  'an operational status transition to confirmed is recorded once'
);

INSERT INTO public.payment_transactions (
  id, booking_id, booking_reference, amount, currency, payment_method, status, transaction_reference
)
VALUES (
  'f6700000-0000-4000-8000-000000000001',
  'f6600000-0000-4000-8000-000000000001',
  'LIFECYCLE-ANALYTICS-TEST',
  100,
  'EUR',
  'Cash',
  'Paid',
  'LIFECYCLE-ANALYTICS-TEST-PAYMENT'
);

SELECT is(
  (SELECT count(*)::integer FROM public.booking_lifecycle_events
   WHERE booking_id = 'f6600000-0000-4000-8000-000000000001' AND event_type = 'payment_received'),
  1,
  'a ledger-settled payment creates a payment received event'
);

UPDATE public.bookings
SET payment_status = 'paid'
WHERE id = 'f6600000-0000-4000-8000-000000000001';

UPDATE public.bookings
SET status = 'completed'
WHERE id = 'f6600000-0000-4000-8000-000000000001';

SELECT is(
  (SELECT count(*)::integer FROM public.booking_lifecycle_events
   WHERE booking_id = 'f6600000-0000-4000-8000-000000000001' AND event_type = 'booking_completed'),
  1,
  'completion is recorded only when the booking is completed and ledger-paid'
);
SELECT is(
  (SELECT count(*)::integer FROM public.automation_events
   WHERE event_name = 'booking.completed' AND entity_id = 'f6600000-0000-4000-8000-000000000001'),
  1,
  'the existing completed-booking automation event is accepted and persisted'
);

INSERT INTO public.refund_records (
  id, booking_id, payment_id, amount, requested_amount, approved_amount,
  currency, reason, refund_method, status, booking_reference
)
VALUES (
  'f6800000-0000-4000-8000-000000000001',
  'f6600000-0000-4000-8000-000000000001',
  'f6700000-0000-4000-8000-000000000001',
  10, 10, 10, 'EUR',
  'Lifecycle analytics test refund',
  'Card Reversal',
  'processed',
  'LIFECYCLE-ANALYTICS-TEST'
);

SELECT is(
  (SELECT count(*)::integer FROM public.booking_lifecycle_events
   WHERE booking_id = 'f6600000-0000-4000-8000-000000000001' AND event_type = 'refund_processed'),
  1,
  'a processed refund creates one refund event'
);

SELECT is(
  (SELECT count(*)::integer FROM public.booking_lifecycle_events
   WHERE booking_id = 'f6600000-0000-4000-8000-000000000001'
     AND (metadata ? 'customer_email' OR metadata ? 'customer_name' OR metadata ? 'customer_phone')),
  0,
  'operational lifecycle metadata never contains customer contact fields'
);

SELECT ok(
  NOT has_function_privilege('anon', 'private.record_booking_lifecycle_event(uuid,text,text,uuid,text,text,text,numeric,text,jsonb,timestamp with time zone)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.record_booking_lifecycle_event(uuid,text,text,uuid,text,text,text,numeric,text,jsonb,timestamp with time zone)', 'EXECUTE'),
  'untrusted roles cannot invoke the lifecycle event writer'
);

SELECT * FROM finish();
ROLLBACK;
