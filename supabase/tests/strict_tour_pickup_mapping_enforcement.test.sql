BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

SELECT ok(
  (SELECT prosecdef AND proconfig @> ARRAY['search_path=""']
   FROM pg_proc
   WHERE oid = 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'private booking implementation remains SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  NOT (SELECT prosecdef
       FROM pg_proc
       WHERE oid = 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure),
  'public booking RPC remains an invoker-rights wrapper'
);

SELECT ok(
  position('COALESCE(v_tour.pickup_available, FALSE)' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'pickup-enabled tours enter the strict pickup validation branch'
);

SELECT ok(
  position('Pickup is not configured for this excursion.' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'pickup-enabled tours with no active approved mapping are rejected'
);

SELECT ok(
  position('A pickup location is required for this excursion.' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'pickup-enabled tours require the customer to select an approved location'
);

SELECT ok(
  position('ELSIF p_pickup_location_id IS NOT NULL' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('This excursion does not offer hotel pickup.' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'tours with pickup disabled reject a supplied pickup location'
);

SELECT ok(
  position('AND is_active = TRUE' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'only active pickup locations can be selected'
);

SELECT ok(
  position('INNER JOIN public.pickup_locations AS pl' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('pickup_location_id = v_extra_record.id' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'the selected active pickup location must be explicitly mapped to this tour'
);

SELECT ok(
  position('v_pickup_location_id := v_extra_record.id' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0
  AND position('v_pickup_location_id,' IN pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )) > 0,
  'the validated pickup location ID is persisted to the booking'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)', 'EXECUTE'),
  'guest and authenticated booking RPC access is preserved'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_booking_atomic'
      AND p.prosecdef
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ),
  'strict pickup enforcement does not expose a client-callable public SECURITY DEFINER function'
);

-- Runtime integration checks: one pickup-enabled tour without mappings must fail,
-- while a tour with an explicitly mapped active zone must book and charge its configured fee.
INSERT INTO public.tours (title, slug, status, price, max_guests, pickup_available)
VALUES
  ('pgTAP Strict Pickup Unmapped Tour', 'pgtap-strict-pickup-unmapped', 'published', 100.00, 10, TRUE),
  ('pgTAP Strict Pickup Mapped Tour', 'pgtap-strict-pickup-mapped', 'published', 100.00, 10, TRUE);

INSERT INTO public.pickup_locations (
  code, name, area, fee_eur_per_person, fee_eur_flat, is_active, sort_order
)
VALUES (
  'pgtap-strict-pickup-zone', 'pgTAP Strict Pickup Zone', 'Test Area', 5.00, 0.00, TRUE, 999
);

INSERT INTO public.tour_pickup_locations (tour_id, pickup_location_id)
SELECT t.id, p.id
FROM public.tours t
CROSS JOIN public.pickup_locations p
WHERE t.slug = 'pgtap-strict-pickup-mapped'
  AND p.code = 'pgtap-strict-pickup-zone';

INSERT INTO public.tour_availability (tour_id, date, max_capacity, booked_count, status)
SELECT id, CURRENT_DATE + 45, 10, 0, 'available'
FROM public.tours
WHERE slug IN ('pgtap-strict-pickup-unmapped', 'pgtap-strict-pickup-mapped');

INSERT INTO public.departures (
  tour_id, date, start_time, end_time, capacity, booked_passengers, remaining_capacity, status
)
SELECT id, CURRENT_DATE + 45, '09:00', '12:00', 10, 0, 10, 'confirmed'
FROM public.tours
WHERE slug IN ('pgtap-strict-pickup-unmapped', 'pgtap-strict-pickup-mapped');

UPDATE public.tour_availability AS availability
SET departure_id = departure.id
FROM public.departures AS departure
WHERE availability.tour_id = departure.tour_id
  AND availability.date = departure.date
  AND departure.date = CURRENT_DATE + 45
  AND departure.tour_id IN (
    SELECT id FROM public.tours
    WHERE slug IN ('pgtap-strict-pickup-unmapped', 'pgtap-strict-pickup-mapped')
  );

CREATE TEMP TABLE strict_pickup_test_results (
  case_name TEXT PRIMARY KEY,
  result JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO strict_pickup_test_results (case_name, result)
SELECT 'unmapped', public.create_booking_atomic(
  'pgtap-strict-pickup-unmapped', CURRENT_DATE + 45, 1, 0, 0,
  'Strict', 'Unmapped', 'strict-unmapped@example.test', '+201000000071', 'Egypt',
  'Test Hotel', NULL, NULL, '[]'::jsonb, NULL,
  'pay_at_pickup', 'ROLLBACK TEST ONLY', 'idem_strict_pickup_unmapped_0001'
);

SELECT is(
  (SELECT (result->>'success')::boolean FROM strict_pickup_test_results WHERE case_name = 'unmapped'),
  FALSE,
  'a pickup-enabled tour with no explicit active mapping cannot create a booking'
);

SELECT is(
  (SELECT result->>'error' FROM strict_pickup_test_results WHERE case_name = 'unmapped'),
  'Pickup is not configured for this excursion. Please contact our booking team.',
  'unmapped tour booking returns a clear pickup configuration error'
);

INSERT INTO strict_pickup_test_results (case_name, result)
SELECT 'mapped', public.create_booking_atomic(
  'pgtap-strict-pickup-mapped', CURRENT_DATE + 45, 1, 0, 0,
  'Strict', 'Mapped', 'strict-mapped@example.test', '+201000000072', 'Egypt',
  'Test Hotel', 'pgtap-strict-pickup-zone', NULL, '[]'::jsonb, NULL,
  'pay_at_pickup', 'ROLLBACK TEST ONLY', 'idem_strict_pickup_mapped_0001'
);

SELECT is(
  (SELECT (result->>'success')::boolean FROM strict_pickup_test_results WHERE case_name = 'mapped'),
  TRUE,
  'a tour with an explicitly mapped active pickup zone can create a booking'
);

SELECT is(
  (SELECT (result->>'totalEur')::numeric FROM strict_pickup_test_results WHERE case_name = 'mapped'),
  105.00::numeric,
  'the booking charges the mapped zone fee using the authoritative database price'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.pickup_locations p ON p.id = b.pickup_location_id
    WHERE b.booking_reference = (
      SELECT result->>'bookingReference'
      FROM strict_pickup_test_results
      WHERE case_name = 'mapped'
    )
      AND p.code = 'pgtap-strict-pickup-zone'
  ),
  'the booking persists the exact mapped pickup location ID'
);

SELECT * FROM finish();
ROLLBACK;
