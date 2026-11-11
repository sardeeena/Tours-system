-- Replace broad admin-only checks in privileged module RPCs with the
-- corresponding RBAC permission. Full admins retain every permission.
BEGIN;
DO $rbac_function_guards$
DECLARE spec record; target_oid oid; definition text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('admin_resolve_booking_cancellation','public.is_admin()','public.has_permission(''bookings.manage'')'),
  ('get_executive_bi_metrics','public.is_admin()','public.has_permission(''analytics.read'')'),
  ('get_tour_availability_schedule','public.is_admin()','(public.has_permission(''operations.read'') OR public.has_permission(''bookings.read''))'),
  ('next_invoice_number','public.is_admin()','public.has_permission(''finance.manage'')'),
  ('protect_booking_customer_updates','public.is_admin()','public.has_permission(''bookings.manage'')'),
  ('query_custom_bi_report','public.is_admin()','public.has_permission(''analytics.read'')'),
  ('recalculate_customer_stats','public.is_admin()','(public.has_permission(''customers.manage'') OR public.has_permission(''bookings.manage''))'),
  ('record_payment_atomic','public.is_admin()','public.has_permission(''finance.manage'')'),
  ('replace_extra_tour_assignments_atomic','public.is_admin()','public.has_permission(''content.manage'')'),
  ('replace_tour_extra_assignments_atomic','public.is_admin()','public.has_permission(''content.manage'')'),
  ('request_refund_atomic','public.is_admin()','public.has_permission(''finance.manage'')'),
  ('transition_refund_atomic','public.is_admin()','public.has_permission(''finance.manage'')')
 ) AS v(function_name,old_guard,new_guard)
 LOOP
  SELECT p.oid INTO target_oid FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=spec.function_name AND p.prokind='f'
  ORDER BY p.oid LIMIT 1;
  IF target_oid IS NULL THEN RAISE EXCEPTION 'Expected authorization function % was not found.',spec.function_name; END IF;
  definition:=pg_get_functiondef(target_oid);
  IF position(spec.old_guard in definition)=0 THEN
   RAISE EXCEPTION 'Expected legacy authorization guard was not found in %.',spec.function_name;
  END IF;
  EXECUTE replace(definition,spec.old_guard,spec.new_guard);
 END LOOP;
END;
$rbac_function_guards$;
COMMIT;