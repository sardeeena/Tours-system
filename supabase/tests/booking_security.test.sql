BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(57);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.bookings'::regclass
      AND relrowsecurity
  ),
  'bookings has row-level security enabled'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'idempotency_payload'
      AND data_type = 'jsonb'
  ),
  'booking idempotency payload is persisted as JSONB'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'cancellation_previous_status'
  ),
  'booking cancellation preserves the prior state'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'cancellation_requested_at'
  ),
  'booking cancellation requests are timestamped'
);

SELECT ok(
  to_regprocedure('public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)') IS NOT NULL,
  'atomic booking RPC with idempotency key is installed'
);

SELECT ok(
  to_regprocedure('public.lookup_booking_secure(text,text)') IS NOT NULL,
  'secure booking lookup RPC is installed'
);

SELECT ok(
  to_regprocedure('public.request_booking_cancellation_secure(text,text,text)') IS NOT NULL,
  'verified cancellation request RPC is installed'
);

SELECT ok(
  to_regprocedure('public.admin_resolve_booking_cancellation(text,text,text)') IS NOT NULL,
  'admin cancellation resolution RPC is installed'
);

SELECT ok(
  has_function_privilege('anon', 'public.lookup_booking_secure(text,text)', 'EXECUTE'),
  'guest role can execute the narrow verified lookup RPC'
);

SELECT ok(
  has_function_privilege('anon', 'public.request_booking_cancellation_secure(text,text,text)', 'EXECUTE'),
  'guest role can submit a verified cancellation request'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', TRUE);
SELECT throws_ok(
  'SELECT public.admin_resolve_booking_cancellation(''RST-2026-TEST1234'', ''approve'', NULL)',
  '42501',
  'Administrator authorization is required to resolve cancellation requests.',
  'anonymous users cannot approve or reject cancellations'
);
RESET ROLE;

SELECT ok(
  has_function_privilege('authenticated', 'public.admin_resolve_booking_cancellation(text,text,text)', 'EXECUTE'),
  'authenticated role can invoke the admin RPC subject to its internal role check'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.bookings', 'SELECT'),
  'anonymous role cannot read bookings directly'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.bookings', 'INSERT'),
  'anonymous role cannot bypass the atomic booking RPC with direct inserts'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.bookings', 'INSERT'),
  'authenticated role cannot bypass the atomic booking RPC with direct inserts'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bookings'::regclass
      AND tgname = 'protect_booking_customer_updates_trigger'
      AND NOT tgisinternal
  ),
  'customer updates are protected by a database trigger'
);


SELECT ok(
  COALESCE((
    SELECT POSITION('idempotency_payload IS DISTINCT FROM v_idempotency_payload' IN pg_get_functiondef(p.oid)) > 0
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'create_booking_atomic'
      AND p.pronargs = 18
    LIMIT 1
  ), FALSE),
  'atomic booking rejects reuse of an idempotency key for different request data'
);

SELECT ok(
  COALESCE((
    SELECT POSITION('FOR UPDATE' IN pg_get_functiondef(p.oid)) > 0
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'create_booking_atomic'
      AND p.pronargs = 18
    LIMIT 1
  ), FALSE),
  'coupon and availability checks use database row locks'
);

SELECT ok(
  COALESCE((
    SELECT POSITION('times_used = times_used + 1' IN pg_get_functiondef(p.oid)) > 0
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'create_booking_atomic'
      AND p.pronargs = 18
    LIMIT 1
  ), FALSE),
  'coupon redemption usage is incremented in the booking transaction'
);

SELECT ok(
  POSITION('booked_count = ta.booked_count - v_guest_count' IN
    PG_GET_FUNCTIONDEF(to_regprocedure('public.admin_resolve_booking_cancellation(text,text,text)'))) > 0,
  'capacity is released only inside the admin cancellation approval RPC'
);

SELECT ok(
  POSITION('TO_JSONB(NEW)' IN
    PG_GET_FUNCTIONDEF(to_regprocedure('public.protect_booking_customer_updates()'))) > 0,
  'customer update trigger rejects changes to protected booking columns'
);


-- End-to-end transactional booking, coupon, lookup, and cancellation lifecycle checks.
INSERT INTO public.tours (title, slug, status, price, max_guests)
VALUES ('pgTAP Booking Test Tour', 'pgtap-booking-test', 'published', 100.00, 10);

INSERT INTO public.coupons (
  code, description, discount_type, discount_value, min_spend,
  valid_from, usage_limit, times_used, is_active
)
VALUES (
  'PGTAPONCE', 'Single-use pgTAP coupon', 'percentage', 10.00, 0,
  NOW() - INTERVAL '1 minute', 1, 0, TRUE
);

CREATE TEMP TABLE pgtap_booking_results (
  case_name TEXT PRIMARY KEY,
  result JSONB
) ON COMMIT DROP;

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'first_booking', public.create_booking_atomic(
  'pgtap-booking-test', CURRENT_DATE + 30, 1, 0, 0,
  'PgTAP', 'Guest', 'pgtap-booking@example.test', '+201000000001', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, 'PGTAPONCE',
  'pay_at_pickup', NULL, 'idem_pgtap_coupon_booking_0001'
);

SELECT ok(
  (SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'a valid booking with a valid coupon is created'
);

SELECT ok(
  (SELECT (result->>'discountEur')::numeric = 10.00 AND (result->>'totalEur')::numeric = 90.00
   FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'coupon discount and final total are calculated by the database'
);

SELECT ok(
  (SELECT times_used = 1 FROM public.coupons WHERE code = 'PGTAPONCE'),
  'successful booking redeems the coupon exactly once'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'duplicate_booking', public.create_booking_atomic(
  'pgtap-booking-test', CURRENT_DATE + 30, 1, 0, 0,
  'PgTAP', 'Guest', 'pgtap-booking@example.test', '+201000000001', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, 'PGTAPONCE',
  'pay_at_pickup', NULL, 'idem_pgtap_coupon_booking_0001'
);

SELECT ok(
  (SELECT (result->>'isDuplicate')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'duplicate_booking'),
  'retrying the identical request returns the original booking'
);

SELECT ok(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'duplicate_booking')
  =
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'idempotent replay returns the original booking reference'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'changed_payload', public.create_booking_atomic(
  'pgtap-booking-test', CURRENT_DATE + 30, 2, 0, 0,
  'PgTAP', 'Guest', 'pgtap-booking@example.test', '+201000000001', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, 'PGTAPONCE',
  'pay_at_pickup', NULL, 'idem_pgtap_coupon_booking_0001'
);

SELECT ok(
  COALESCE((SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'changed_payload'), FALSE) = FALSE,
  'reusing an idempotency key with changed booking details is rejected'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'exhausted_coupon', public.create_booking_atomic(
  'pgtap-booking-test', CURRENT_DATE + 30, 1, 0, 0,
  'PgTAP', 'Guest', 'pgtap-booking@example.test', '+201000000001', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, 'PGTAPONCE',
  'pay_at_pickup', NULL, 'idem_pgtap_coupon_booking_0002'
);

SELECT ok(
  COALESCE((SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'exhausted_coupon'), TRUE) = FALSE,
  'a coupon at its usage limit cannot be redeemed again'
);

SELECT ok(
  (SELECT times_used = 1 FROM public.coupons WHERE code = 'PGTAPONCE'),
  'rejected coupon attempts do not increment redemption count'
);

SELECT ok(
  (SELECT COUNT(*) = 1 FROM public.bookings WHERE idempotency_key = 'idem_pgtap_coupon_booking_0001'),
  'idempotent retries do not create duplicate booking rows'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'lookup_email', public.lookup_booking_secure(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'pgtap-booking@example.test'
);

SELECT ok(
  (SELECT (result->>'found')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'lookup_email'),
  'secure lookup verifies the exact booking email'
);

SELECT ok(
  (SELECT result->'customer'->>'emailMasked' IS NOT NULL
   AND result->'customer'->>'phoneMasked' IS NOT NULL
   AND result->'tour'->>'id' IS NOT NULL
   FROM pg_temp.pgtap_booking_results WHERE case_name = 'lookup_email'),
  'secure lookup returns masked contact data and the tour identifier'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'lookup_wrong_contact', public.lookup_booking_secure(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'not-the-customer@example.test'
);

SELECT ok(
  (SELECT result IS NULL FROM pg_temp.pgtap_booking_results WHERE case_name = 'lookup_wrong_contact'),
  'secure lookup rejects a mismatched contact address'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'lookup_egypt_phone', public.lookup_booking_secure(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  '01000000001'
);

SELECT ok(
  (SELECT (result->>'found')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'lookup_egypt_phone'),
  'secure lookup exactly matches Egyptian domestic and +20 phone formats'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'cancel_request', public.request_booking_cancellation_secure(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'pgtap-booking@example.test', 'pgTAP cancellation request'
);

SELECT ok(
  (SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'cancel_request'),
  'verified customer can request cancellation'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'cancel_request_repeat', public.request_booking_cancellation_secure(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'pgtap-booking@example.test', 'duplicate pgTAP cancellation request'
);

SELECT ok(
  (SELECT (result->>'alreadyRequested')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'cancel_request_repeat'),
  'repeated cancellation request is idempotent'
);

SELECT ok(
  (SELECT status = 'cancellation_requested' FROM public.bookings
   WHERE booking_reference = (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking')),
  'customer cancellation request moves booking into review state'
);

SELECT ok(
  (SELECT booked_count = 1 FROM public.tour_availability
   WHERE tour_id = (SELECT id FROM public.tours WHERE slug = 'pgtap-booking-test')
     AND date = CURRENT_DATE + 30),
  'capacity remains reserved while cancellation awaits approval'
);

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'cancel_approved', public.admin_resolve_booking_cancellation(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'approve', 'pgTAP approval'
);

SELECT ok(
  (SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'cancel_approved'),
  'authorized admin cancellation approval succeeds'
);

SELECT ok(
  (SELECT status = 'cancelled' FROM public.bookings
   WHERE booking_reference = (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking')),
  'approved cancellation marks the booking cancelled'
);

SELECT ok(
  (SELECT booked_count = 0 AND status = 'available' FROM public.tour_availability
   WHERE tour_id = (SELECT id FROM public.tours WHERE slug = 'pgtap-booking-test')
     AND date = CURRENT_DATE + 30),
  'approved cancellation releases inventory atomically'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'cancel_approved_repeat', public.admin_resolve_booking_cancellation(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'first_booking'),
  'approve', 'repeat pgTAP approval'
);

SELECT ok(
  (SELECT (result->>'alreadyResolved')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'cancel_approved_repeat'),
  'repeated approval is idempotent'
);

SELECT ok(
  (SELECT booked_count = 0 FROM public.tour_availability
   WHERE tour_id = (SELECT id FROM public.tours WHERE slug = 'pgtap-booking-test')
     AND date = CURRENT_DATE + 30),
  'repeated approval does not release capacity twice'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'second_booking', public.create_booking_atomic(
  'pgtap-booking-test', CURRENT_DATE + 30, 1, 0, 0,
  'PgTAP', 'Second', 'pgtap-second@example.test', '+201000000002', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, NULL,
  'pay_at_pickup', NULL, 'idem_pgtap_second_booking_0001'
);

SELECT ok(
  (SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'second_booking'),
  'a new booking can use capacity released by an approved cancellation'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'second_cancel_request', public.request_booking_cancellation_secure(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'second_booking'),
  'pgtap-second@example.test', 'pgTAP rejection test'
);

SELECT ok(
  (SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'second_cancel_request'),
  'second booking can enter cancellation review'
);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'cancel_rejected', public.admin_resolve_booking_cancellation(
  (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'second_booking'),
  'reject', 'pgTAP rejection'
);

SELECT ok(
  (SELECT (result->>'status') = 'pending' FROM pg_temp.pgtap_booking_results WHERE case_name = 'cancel_rejected'),
  'rejected cancellation restores the booking prior status'
);

SELECT ok(
  (SELECT status = 'pending' FROM public.bookings
   WHERE booking_reference = (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'second_booking')),
  'rejected cancellation leaves the booking active'
);

SELECT ok(
  (SELECT booked_count = 1 FROM public.tour_availability
   WHERE tour_id = (SELECT id FROM public.tours WHERE slug = 'pgtap-booking-test')
     AND date = CURRENT_DATE + 30),
  'rejected cancellation does not release reserved capacity'
);

SELECT ok(
  (SELECT COUNT(*) = 2 FROM public.automation_events WHERE event_name = 'booking.cancellation_requested'),
  'cancellation request events are persisted transactionally'
);

SELECT ok(
  (SELECT COUNT(*) = 1 FROM public.automation_events WHERE event_name = 'booking.cancelled'),
  'approved cancellation publishes one completed-cancellation event'
);

SELECT ok(
  (SELECT COUNT(*) = 1 FROM public.automation_events WHERE event_name = 'booking.updated'),
  'rejected cancellation publishes a booking-updated event'
);


-- Exercise customer-level RLS and the BEFORE UPDATE protection trigger using a real
-- Auth user/profile and a booking owned by that user.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous
)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'pgtap-auth@example.test', 'test-only',
  NOW(), '{}'::jsonb, '{"full_name":"pgTAP Auth User"}'::jsonb, NOW(), NOW(), FALSE, FALSE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, role)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pgtap-auth@example.test', 'customer')
ON CONFLICT (id) DO UPDATE SET role = 'customer';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","email":"pgtap-auth@example.test"}',
  TRUE
);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', TRUE);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);

INSERT INTO pg_temp.pgtap_booking_results (case_name, result)
SELECT 'authenticated_booking', public.create_booking_atomic(
  'pgtap-booking-test', CURRENT_DATE + 31, 1, 0, 0,
  'pgTAP', 'Auth', 'pgtap-auth@example.test', '+201000000003', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, NULL,
  'pay_at_pickup', NULL, 'idem_pgtap_authenticated_booking_0001'
);

SELECT ok(
  (SELECT (result->>'success')::boolean FROM pg_temp.pgtap_booking_results WHERE case_name = 'authenticated_booking'),
  'authenticated customer can create a booking through the atomic RPC'
);

SELECT ok(
  (SELECT user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
   FROM public.bookings
   WHERE booking_reference = (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'authenticated_booking')),
  'atomic booking binds the authenticated user id to the reservation'
);

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  'UPDATE public.bookings SET status = ''cancelled'' WHERE booking_reference = (SELECT result->>''bookingReference'' FROM pg_temp.pgtap_booking_results WHERE case_name = ''authenticated_booking'')',
  '42501',
  'Customers may only update pickup details and special requests. Booking status, payment, price, guest counts, and inventory are protected.',
  'customer cannot change booking status directly through the Data API'
);

UPDATE public.bookings
SET pickup_room_number = '501'
WHERE booking_reference = (
  SELECT result->>'bookingReference'
  FROM pg_temp.pgtap_booking_results
  WHERE case_name = 'authenticated_booking'
);

SELECT ok(
  (SELECT pickup_room_number = '501' FROM public.bookings
   WHERE booking_reference = (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'authenticated_booking')),
  'customer can update permitted pickup details'
);

UPDATE public.bookings
SET
  status = 'cancellation_requested',
  cancellation_previous_status = 'pending',
  cancellation_requested_at = NOW(),
  cancellation_reason = 'Customer requested cancellation'
WHERE booking_reference = (
  SELECT result->>'bookingReference'
  FROM pg_temp.pgtap_booking_results
  WHERE case_name = 'authenticated_booking'
);

SELECT ok(
  (SELECT status = 'cancellation_requested' FROM public.bookings
   WHERE booking_reference = (SELECT result->>'bookingReference' FROM pg_temp.pgtap_booking_results WHERE case_name = 'authenticated_booking')),
  'authenticated customer may request cancellation without cancelling the booking'
);

SELECT ok(
  (SELECT booked_count = 1 FROM public.tour_availability
   WHERE tour_id = (SELECT id FROM public.tours WHERE slug = 'pgtap-booking-test')
     AND date = CURRENT_DATE + 31),
  'customer cancellation request through RLS does not release capacity'
);

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
