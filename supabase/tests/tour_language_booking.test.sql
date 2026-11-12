BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'tour_language'
      AND data_type = 'text'
  ),
  'bookings stores the selected tour language as a text snapshot'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('create_booking_atomic_with_language', 'lookup_booking_secure_with_language')
      AND p.prosecdef
  ),
  'public tour-language RPCs are invoker-rights wrappers'
);

SELECT ok(
  (
    SELECT count(*) = 2
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('create_booking_atomic_with_language', 'lookup_booking_secure_with_language')
      AND p.prosecdef
      AND COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
  ),
  'private tour-language implementations are SECURITY DEFINER with an empty search_path'
);

SELECT ok(
  has_function_privilege('anon', 'public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('anon', 'public.lookup_booking_secure_with_language(text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.lookup_booking_secure_with_language(text,text)', 'EXECUTE'),
  'anonymous and authenticated customers can call the public invoker-rights booking RPCs'
);


SELECT ok(
  to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)') IS NOT NULL,
  'private atomic booking implementation accepts tour language as an input'
);

SELECT ok(
  (
    SELECT prosecdef
      AND COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
      AND POSITION('idempotency_payload, tour_language' IN pg_get_functiondef(p.oid)) > 0
      AND POSITION('NULLIF(BTRIM(p_tour_language)' IN pg_get_functiondef(p.oid)) > 0
    FROM pg_proc p
    WHERE p.oid = to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)')
  ),
  'tour language is persisted by the SECURITY DEFINER booking INSERT function'
);

SELECT ok(
  POSITION('UPDATE public.bookings' IN
    pg_get_functiondef('private.create_booking_atomic_with_language(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure)) = 0,
  'tour-language wrapper never performs a post-create booking UPDATE'
);

SELECT ok(
  has_function_privilege('anon', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)', 'EXECUTE'),
  'guest and authenticated roles can reach the private implementation only through the invoker-rights public RPC'
);

SELECT ok(
  to_regprocedure('private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)') IS NOT NULL,
  'the legacy atomic booking signature remains available for existing internal callers'
);


-- Exercise the public RPC as a guest and as a signed-in customer. The entire
-- test runs in this file's transaction and is rolled back at the end.
INSERT INTO public.tours (title, slug, status, price, max_guests, languages)
VALUES ('pgTAP Language Test Tour', 'pgtap-language-test-tour', 'published', 100.00, 10, ARRAY['English', 'Arabic']::text[]);

INSERT INTO public.tour_availability (tour_id, date, max_capacity, booked_count, status)
SELECT id, CURRENT_DATE + 40, 10, 0, 'available'
FROM public.tours
WHERE slug = 'pgtap-language-test-tour';

SET LOCAL request.jwt.claims = '{"role":"anon"}';
SET LOCAL request.jwt.claim.role = 'anon';
SET LOCAL ROLE anon;

SELECT set_config(
  'pgtap.language_guest_result',
  public.create_booking_atomic_with_language(
    'pgtap-language-test-tour', CURRENT_DATE + 40, 1, 0, 0,
    'Guest', 'Language', 'pgtap-language-guest@example.test', '+201000000010', 'Egypt',
    NULL, NULL, NULL, '[]'::jsonb, NULL, 'pay_at_pickup', NULL,
    'idem_pgtap_language_guest_0001', 'Arabic'
  )::text,
  TRUE
);

RESET ROLE;
SET LOCAL request.jwt.claims = '{}';
SET LOCAL request.jwt.claim.role = 'postgres';

SELECT ok(
  (current_setting('pgtap.language_guest_result')::jsonb->>'success')::boolean,
  'guest checkout creates a booking through the public atomic RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = (current_setting('pgtap.language_guest_result')::jsonb->>'bookingId')::uuid
      AND user_id IS NULL
      AND tour_language = 'Arabic'
  ),
  'guest booking stores its selected language in the original booking row'
);

SELECT set_config('pgtap.language_auth_user_id', gen_random_uuid()::text, TRUE);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  current_setting('pgtap.language_auth_user_id')::uuid,
  'authenticated', 'authenticated', 'pgtap-language-auth@example.test', '',
  NULL, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW()
);

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('pgtap.language_auth_user_id'),
    'role', 'authenticated',
    'aud', 'authenticated'
  )::text,
  TRUE
);
SET LOCAL request.jwt.claim.role = 'authenticated';
SELECT set_config('request.jwt.claim.sub', current_setting('pgtap.language_auth_user_id'), TRUE);
SET LOCAL ROLE authenticated;

SELECT set_config(
  'pgtap.language_auth_result',
  public.create_booking_atomic_with_language(
    'pgtap-language-test-tour', CURRENT_DATE + 40, 1, 0, 0,
    'Signed', 'Customer', 'pgtap-language-auth@example.test', '+201000000011', 'Egypt',
    NULL, NULL, NULL, '[]'::jsonb, NULL, 'pay_at_pickup', NULL,
    'idem_pgtap_language_auth_0001', 'English'
  )::text,
  TRUE
);

RESET ROLE;
SET LOCAL request.jwt.claims = '{}';
SET LOCAL request.jwt.claim.role = 'postgres';

SELECT ok(
  (current_setting('pgtap.language_auth_result')::jsonb->>'success')::boolean,
  'authenticated customer checkout creates a booking through the same atomic RPC'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = (current_setting('pgtap.language_auth_result')::jsonb->>'bookingId')::uuid
      AND user_id = current_setting('pgtap.language_auth_user_id')::uuid
      AND tour_language = 'English'
  ),
  'authenticated booking stores its selected language in the original booking row and retains account ownership'
);


SELECT ok(
  (SELECT booked_count = 2 FROM public.tour_availability
   WHERE tour_id = (SELECT id FROM public.tours WHERE slug = 'pgtap-language-test-tour')
     AND date = CURRENT_DATE + 40),
  'both successful checkouts increment departure capacity exactly once'
);

SELECT * FROM finish();
ROLLBACK;
