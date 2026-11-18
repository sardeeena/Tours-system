-- Align booking finance authorization with the database-backed Finance Manager role.
-- Finance Manager has finance.manage, which grants finance.create through
-- private.has_permission(). The previous is_admin() gate rejected this role
-- even though the admin UI correctly exposed the payment action.
--
-- Also require a meaningful reason for rejecting a customer cancellation request.
-- Keep both changes inside the existing SECURITY DEFINER implementations with
-- their empty search_path and preserve all ledger/capacity transaction logic.

BEGIN;

DO $finance_permission_fix$
DECLARE
  v_definition TEXT;
  v_old_guard TEXT := $old$
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
$old$;
  v_new_guard TEXT := $new$
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.has_permission('finance.create'))
  ) THEN
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'private.record_payment_atomic(text,numeric,text,text,text,text,text,text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_guard IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected payment authorization guard was not found; refusing to alter the finance function.';
  END IF;

  v_definition := replace(v_definition, v_old_guard, v_new_guard);

  IF position('public.has_permission(''finance.create'')' IN v_definition) = 0
     OR position('public.is_admin()' IN v_definition) > 0 THEN
    RAISE EXCEPTION 'Finance Manager payment authorization postconditions failed.';
  END IF;

  EXECUTE v_definition;
END;
$finance_permission_fix$;

DO $cancellation_rejection_reason$
DECLARE
  v_definition TEXT;
  v_old_block TEXT := $old$
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Decision must be approve or reject.');
  END IF;
$old$;
  v_new_block TEXT := $new$
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'Decision must be approve or reject.');
  END IF;

  IF p_decision = 'reject'
     AND length(btrim(coalesce(p_reason, ''))) < 5 THEN
    RETURN JSONB_BUILD_OBJECT('success', FALSE, 'error', 'A rejection reason of at least 5 characters is required.');
  END IF;
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'private.admin_resolve_booking_cancellation(text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_block IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected cancellation decision validation was not found; refusing to alter the booking workflow.';
  END IF;

  v_definition := replace(v_definition, v_old_block, v_new_block);

  IF position('A rejection reason of at least 5 characters is required.' IN v_definition) = 0
     OR position('booked_count = ta.booked_count - v_guest_count' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Cancellation rejection validation postconditions failed.';
  END IF;

  EXECUTE v_definition;
END;
$cancellation_rejection_reason$;

NOTIFY pgrst, 'reload schema';
COMMIT;
