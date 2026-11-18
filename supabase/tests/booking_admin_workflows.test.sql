BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

SELECT ok(
  to_regprocedure('private.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)') IS NOT NULL,
  'private atomic payment implementation exists'
);
SELECT ok(
  POSITION('public.has_permission(''finance.create'')' IN
    pg_get_functiondef('private.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)'::regprocedure)) > 0,
  'payment recording authorization uses the database-backed finance.create permission'
);
SELECT ok(
  POSITION('public.is_admin()' IN
    pg_get_functiondef('private.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)'::regprocedure)) = 0,
  'Finance Manager payment access is not incorrectly restricted to administrator roles'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.access_roles r ON r.id = rp.role_id
    JOIN public.access_permissions p ON p.id = rp.permission_id
    WHERE r.slug = 'finance_manager'
      AND r.is_active
      AND p.permission_key = 'finance.manage'
  ),
  'Finance Manager retains its intended finance.manage permission'
);
SELECT ok(
  NOT has_function_privilege('anon',
    'public.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)', 'EXECUTE'),
  'anonymous callers cannot execute the payment RPC'
);
SELECT ok(
  has_function_privilege('authenticated',
    'public.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)', 'EXECUTE'),
  'authenticated callers can reach the payment RPC subject to its internal permission check'
);
SELECT ok(
  POSITION('A rejection reason of at least 5 characters is required.' IN
    pg_get_functiondef('private.admin_resolve_booking_cancellation(text,text,text)'::regprocedure)) > 0,
  'the database rejects cancellation decisions without a meaningful rejection reason'
);
SELECT ok(
  POSITION('booked_count = ta.booked_count - v_guest_count' IN
    pg_get_functiondef('private.admin_resolve_booking_cancellation(text,text,text)'::regprocedure)) > 0,
  'cancellation approval continues to release capacity transactionally'
);
SELECT ok(
  POSITION('cancellation_previous_status = NULL' IN
    pg_get_functiondef('private.admin_resolve_booking_cancellation(text,text,text)'::regprocedure)) > 0,
  'cancellation rejection restores the original booking status and clears the pending request marker'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.booking_passengers'::regclass AND relrowsecurity
  ),
  'passenger manifests remain protected by row-level security'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.booking_passengers', 'SELECT'),
  'anonymous users cannot directly read passenger manifests'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.bookings', 'SELECT'),
  'anonymous users cannot directly read booking records'
);

SELECT * FROM finish();
ROLLBACK;
