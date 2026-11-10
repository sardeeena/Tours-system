BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(16);

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

SELECT ok(
  NOT has_function_privilege('anon', 'public.admin_resolve_booking_cancellation(text,text,text)', 'EXECUTE'),
  'guest role cannot approve or reject cancellations'
);

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

SELECT * FROM finish();

ROLLBACK;
