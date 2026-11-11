-- Add action-level grants and enforce them independently in RLS and privileged RPCs.
BEGIN;
INSERT INTO public.access_permissions(permission_key,module,action,description)
SELECT module_name||'.'||action_name,module_name,action_name,
       initcap(action_name)||' access for the '||module_name||' module'
FROM unnest(ARRAY['tours','bookings','customers','crm','operations','finance','communications','content','analytics']::text[]) AS module_name
CROSS JOIN unnest(ARRAY['create','update','delete','approve','export']::text[]) AS action_name
ON CONFLICT(permission_key) DO UPDATE SET module=excluded.module,action=excluded.action,description=excluded.description;

CREATE OR REPLACE FUNCTION public.has_permission(required_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT COALESCE(
  (auth.jwt()->>'role')='service_role' OR public.has_role('super_admin') OR public.has_role('admin')
  OR EXISTS(
   SELECT 1 FROM public.user_roles ur
   JOIN public.access_roles r ON r.id=ur.role_id AND r.is_active
   JOIN public.role_permissions rp ON rp.role_id=r.id
   JOIN public.access_permissions p ON p.id=rp.permission_id
   WHERE ur.user_id=auth.uid()
    AND (
      p.permission_key=required_permission
      OR p.permission_key=split_part(required_permission,'.',1)||'.manage'
      OR (
        required_permission LIKE '%.read'
        AND p.permission_key=ANY(ARRAY[
          split_part(required_permission,'.',1)||'.create',
          split_part(required_permission,'.',1)||'.update',
          split_part(required_permission,'.',1)||'.delete',
          split_part(required_permission,'.',1)||'.approve',
          split_part(required_permission,'.',1)||'.export'
        ])
      )
    )
  ),false
 );
$function$;

DO $policies$
DECLARE item record; suffix text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('tours','tours'),
  ('bookings','bookings'),('booking_extras','bookings'),('booking_passengers','bookings'),
  ('tour_availability','operations'),('coupons','bookings'),
  ('customers','customers'),('inquiries','crm'),('leads','crm'),
  ('crm_activities','crm'),('crm_communications','crm'),('crm_conversations','crm'),
  ('crm_lead_stages','crm'),('crm_notes','crm'),('crm_segments','crm'),('crm_tags','crm'),('crm_tasks','crm'),
  ('departures','operations'),('guides','operations'),('operational_assignments','operations'),
  ('pickup_schedules','operations'),('pickup_locations','operations'),('vessels','operations'),
  ('tour_vessels','operations'),('weather_bulletins','operations'),
  ('invoices','finance'),('payment_providers','finance'),('payment_transactions','finance'),('refund_records','finance'),
  ('communication_messages','communications'),('communication_templates','communications'),
  ('staff_notifications','communications'),('automation_events','communications'),
  ('categories','content'),('destinations','content'),('faqs','content'),('media_assets','content'),
  ('newsletter_subscriptions','content'),('seo_metadata','content'),('site_settings','content'),
  ('tour_assigned_extras','content'),('tour_categories','content'),('tour_exclusions','content'),
  ('tour_extras','content'),('tour_faqs','content'),('tour_highlights','content'),('tour_images','content'),
  ('tour_inclusions','content'),('tour_itinerary','content'),('tour_pickup_locations','content'),('tour_videos','content'),
  ('reviews','content')
 ) AS v(table_name,module)
 LOOP
  IF to_regclass('public.'||item.table_name) IS NOT NULL THEN
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','rbac_'||item.table_name||'_manage',item.table_name);
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','rbac_'||item.table_name||'_read',item.table_name);
   FOREACH suffix IN ARRAY ARRAY['create','update','delete'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','rbac_'||item.table_name||'_'||suffix,item.table_name);
   END LOOP;
   EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_permission(%L))',
    'rbac_'||item.table_name||'_read',item.table_name,item.module||'.read');
   EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_permission(%L))',
    'rbac_'||item.table_name||'_create',item.table_name,item.module||'.create');
   EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_permission(%L)) WITH CHECK (public.has_permission(%L))',
    'rbac_'||item.table_name||'_update',item.table_name,item.module||'.update',item.module||'.update');
   EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_permission(%L))',
    'rbac_'||item.table_name||'_delete',item.table_name,item.module||'.delete');
  END IF;
 END LOOP;
END;
$policies$;

DO $rpc_guards$
DECLARE spec record; target_oid oid; definition text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
  ('admin_resolve_booking_cancellation','public.has_permission(''bookings.manage'')','public.has_permission(''bookings.approve'')'),
  ('next_invoice_number','public.has_permission(''finance.manage'')','public.has_permission(''finance.create'')'),
  ('protect_booking_customer_updates','public.has_permission(''bookings.manage'')','public.has_permission(''bookings.update'')'),
  ('recalculate_customer_stats','(public.has_permission(''customers.manage'') OR public.has_permission(''bookings.manage''))','(public.has_permission(''customers.update'') OR public.has_permission(''bookings.update''))'),
  ('record_payment_atomic','public.has_permission(''finance.manage'')','public.has_permission(''finance.create'')'),
  ('replace_extra_tour_assignments_atomic','public.has_permission(''content.manage'')','public.has_permission(''content.update'')'),
  ('replace_tour_extra_assignments_atomic','public.has_permission(''content.manage'')','public.has_permission(''content.update'')'),
  ('request_refund_atomic','public.has_permission(''finance.manage'')','public.has_permission(''finance.create'')'),
  ('transition_refund_atomic','public.has_permission(''finance.manage'')','public.has_permission(''finance.approve'')')
 ) AS v(function_name,old_guard,new_guard)
 LOOP
  SELECT p.oid INTO target_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=spec.function_name AND p.prokind='f' ORDER BY p.oid LIMIT 1;
  IF target_oid IS NULL THEN RAISE EXCEPTION 'Expected authorization function % was not found.',spec.function_name; END IF;
  definition:=pg_get_functiondef(target_oid);
  IF position(spec.old_guard in definition)=0 THEN RAISE EXCEPTION 'Expected permission guard was not found in %.',spec.function_name; END IF;
  EXECUTE replace(definition,spec.old_guard,spec.new_guard);
 END LOOP;
END;
$rpc_guards$;
COMMIT;