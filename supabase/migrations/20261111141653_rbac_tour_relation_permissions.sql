-- Tour-specific relational data follows the tours module's action grants.
BEGIN;
DO $tour_relation_policies$
DECLARE table_name text; suffix text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY[
  'tour_assigned_extras','tour_categories','tour_exclusions','tour_extras','tour_faqs',
  'tour_highlights','tour_images','tour_inclusions','tour_itinerary','tour_pickup_locations','tour_videos'
 ] LOOP
  IF to_regclass('public.'||table_name) IS NOT NULL THEN
   FOREACH suffix IN ARRAY ARRAY['read','create','update','delete','manage'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','rbac_'||table_name||'_'||suffix,table_name);
   END LOOP;
   EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_permission(%L))',
    'rbac_'||table_name||'_read',table_name,'tours.read');
   EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_permission(%L))',
    'rbac_'||table_name||'_create',table_name,'tours.create');
   EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_permission(%L)) WITH CHECK (public.has_permission(%L))',
    'rbac_'||table_name||'_update',table_name,'tours.update','tours.update');
   EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_permission(%L))',
    'rbac_'||table_name||'_delete',table_name,'tours.delete');
  END IF;
 END LOOP;
END;
$tour_relation_policies$;
DO $tour_rpc_guards$
DECLARE function_name text; target_oid oid; definition text;
BEGIN
 FOREACH function_name IN ARRAY ARRAY['replace_extra_tour_assignments_atomic','replace_tour_extra_assignments_atomic'] LOOP
  SELECT p.oid INTO target_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=function_name AND p.prokind='f' ORDER BY p.oid LIMIT 1;
  IF target_oid IS NULL THEN RAISE EXCEPTION 'Expected function % was not found.',function_name; END IF;
  definition:=pg_get_functiondef(target_oid);
  IF position('public.has_permission(''content.update'')' in definition)=0 THEN
   RAISE EXCEPTION 'Expected content.update guard was not found in %.',function_name;
  END IF;
  EXECUTE replace(definition,'public.has_permission(''content.update'')','public.has_permission(''tours.update'')');
 END LOOP;
END;
$tour_rpc_guards$;
COMMIT;