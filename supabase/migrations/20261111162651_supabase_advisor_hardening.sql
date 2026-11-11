-- Supabase advisor hardening:
-- 1) Keep SECURITY DEFINER implementation functions outside the exposed public API schema.
--    Public RPC names remain as SECURITY INVOKER wrappers with the original grants.
-- 2) Consolidate legacy and RBAC RLS policies without changing effective access.
-- 3) Add the missing user_roles.assigned_by foreign-key index.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

DO $move_rpc_implementations$
DECLARE
  f record;
  v_types text;
  v_args text;
  v_body text;
  v_volatility text;
  v_parallel text;
  v_strict text;
  v_anon boolean;
  v_authenticated boolean;
  v_service boolean;
  v_signature text;
  v_wrapper_sql text;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, p.proargtypes, p.pronargs, p.proargmodes,
           pg_get_function_arguments(p.oid) AS arg_declarations,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments,
           pg_get_function_result(p.oid) AS result_declaration,
           p.provolatile, p.proparallel, p.proisstrict
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
    ORDER BY p.proname, p.oid
  LOOP
    -- Preserve the original effective RPC grants before moving the implementation.
    v_anon := has_function_privilege('anon', f.oid, 'EXECUTE');
    v_authenticated := has_function_privilege('authenticated', f.oid, 'EXECUTE');
    v_service := has_function_privilege('service_role', f.oid, 'EXECUTE');
    v_types := pg_catalog.oidvectortypes(f.proargtypes);
    v_signature := format('public.%I(%s)', f.proname, v_types);

    SELECT string_agg('$' || g.n::text, ', ' ORDER BY g.n)
      INTO v_args
    FROM generate_series(1, f.pronargs) AS g(n);
    v_args := COALESCE(v_args, '');

    IF f.result_declaration LIKE 'TABLE(%'
       OR f.result_declaration LIKE 'SETOF %' THEN
      v_body := format('SELECT * FROM private.%I(%s)', f.proname, v_args);
    ELSE
      v_body := format('SELECT private.%I(%s)', f.proname, v_args);
    END IF;

    v_volatility := CASE f.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      ELSE 'VOLATILE'
    END;
    v_parallel := CASE f.proparallel
      WHEN 's' THEN ' PARALLEL SAFE'
      WHEN 'r' THEN ' PARALLEL RESTRICTED'
      ELSE ''
    END;
    v_strict := CASE WHEN f.proisstrict THEN ' STRICT' ELSE '' END;

    EXECUTE format(
      'ALTER FUNCTION %s SET SCHEMA private',
      v_signature
    );

    v_wrapper_sql := format(
      'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql %s%s%s SECURITY INVOKER SET search_path = '''' AS %L',
      f.proname,
      f.arg_declarations,
      f.result_declaration,
      v_volatility,
      v_parallel,
      v_strict,
      v_body
    );
    EXECUTE v_wrapper_sql;

    -- Remove inherited PUBLIC execution from the private implementation and
    -- grant only the same effective client roles that could call it before.
    EXECUTE format(
      'REVOKE ALL ON FUNCTION private.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
      f.proname, v_types
    );
    IF v_anon THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION private.%I(%s) TO anon', f.proname, v_types);
    END IF;
    IF v_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION private.%I(%s) TO authenticated', f.proname, v_types);
    END IF;
    IF v_service THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION private.%I(%s) TO service_role', f.proname, v_types);
    END IF;

    -- The exposed wrapper is invoker-rights; its body calls the private,
    -- fixed-search_path implementation under the caller's JWT context.
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated, service_role',
      f.proname, v_types
    );
    IF v_anon THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon', f.proname, v_types);
    END IF;
    IF v_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', f.proname, v_types);
    END IF;
    IF v_service THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', f.proname, v_types);
    END IF;
  END LOOP;
END;
$move_rpc_implementations$;

-- Admins already pass public.has_permission() for every permission. Remove
-- the legacy is_admin-only policy layer; action-level RBAC policies remain
-- authoritative for admins and non-admin staff alike.
-- profiles previously used one ALL policy plus a SELECT policy. Split the
-- manage policy into write actions before consolidating legacy own-profile rules.
DROP POLICY IF EXISTS rbac_profiles_manage ON public.profiles;
CREATE POLICY rbac_profiles_create ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('users.manage'));
CREATE POLICY rbac_profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_permission('users.manage'))
  WITH CHECK (public.has_permission('users.manage'));
CREATE POLICY rbac_profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_permission('users.manage'));

DO $dedupe_policies$
DECLARE
  old_policy record;
  target_policy_name text;
  target_qual text;
  target_check text;
  merged_qual text;
  merged_check text;
  is_admin_only boolean;
  has_target boolean;
BEGIN
  FOR old_policy IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT LIKE 'rbac\_%' ESCAPE '\'
      AND (roles @> ARRAY['authenticated']::name[] OR roles @> ARRAY['public']::name[])
    ORDER BY tablename, policyname
  LOOP
    target_policy_name := CASE old_policy.cmd
      WHEN 'SELECT' THEN 'rbac_' || old_policy.tablename || '_read'
      WHEN 'INSERT' THEN 'rbac_' || old_policy.tablename || '_create'
      WHEN 'UPDATE' THEN 'rbac_' || old_policy.tablename || '_update'
      WHEN 'DELETE' THEN 'rbac_' || old_policy.tablename || '_delete'
      ELSE NULL
    END;

    is_admin_only := CASE old_policy.cmd
      WHEN 'SELECT' THEN
        lower(regexp_replace(COALESCE(old_policy.qual, ''), '[[:space:]()]', '', 'g'))
          IN ('is_admin', 'selectis_adminasis_admin')
      WHEN 'DELETE' THEN
        lower(regexp_replace(COALESCE(old_policy.qual, ''), '[[:space:]()]', '', 'g'))
          IN ('is_admin', 'selectis_adminasis_admin')
      WHEN 'INSERT' THEN
        lower(regexp_replace(COALESCE(old_policy.with_check, ''), '[[:space:]()]', '', 'g'))
          IN ('is_admin', 'selectis_adminasis_admin')
      WHEN 'UPDATE' THEN
        lower(regexp_replace(COALESCE(old_policy.qual, ''), '[[:space:]()]', '', 'g'))
          IN ('is_admin', 'selectis_adminasis_admin')
        AND lower(regexp_replace(COALESCE(old_policy.with_check, ''), '[[:space:]()]', '', 'g'))
          IN ('is_admin', 'selectis_adminasis_admin')
      WHEN 'ALL' THEN
        lower(regexp_replace(COALESCE(old_policy.qual, ''), '[[:space:]()]', '', 'g'))
          IN ('is_admin', 'selectis_adminasis_admin')
        AND lower(regexp_replace(COALESCE(old_policy.with_check, ''), '[[:space:]()]', '', 'g'))
          IN ('is_admin', 'selectis_adminasis_admin')
      ELSE false
    END;

    IF old_policy.cmd = 'ALL' AND is_admin_only THEN
      has_target := EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = old_policy.tablename
          AND p.policyname = 'rbac_' || old_policy.tablename || '_manage'
      ) OR (
        SELECT count(*) = 4
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = old_policy.tablename
          AND p.policyname = ANY(ARRAY[
            'rbac_' || old_policy.tablename || '_read',
            'rbac_' || old_policy.tablename || '_create',
            'rbac_' || old_policy.tablename || '_update',
            'rbac_' || old_policy.tablename || '_delete'
          ])
      );
      IF has_target THEN
        EXECUTE format('DROP POLICY %I ON public.%I', old_policy.policyname, old_policy.tablename);
      END IF;
      CONTINUE;
    END IF;

    IF target_policy_name IS NULL THEN
      CONTINUE;
    END IF;

    SELECT p.qual, p.with_check
      INTO target_qual, target_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = old_policy.tablename
      AND p.policyname = target_policy_name;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- A pure admin-only action policy is redundant because has_permission()
    -- grants admins/super-admins all module permissions.
    IF is_admin_only THEN
      EXECUTE format('DROP POLICY %I ON public.%I', old_policy.policyname, old_policy.tablename);
      CONTINUE;
    END IF;

    merged_qual := CASE
      WHEN old_policy.qual IS NULL THEN target_qual
      WHEN target_qual IS NULL THEN old_policy.qual
      ELSE '(' || target_qual || ') OR (' || old_policy.qual || ')'
    END;
    merged_check := CASE
      WHEN old_policy.with_check IS NULL THEN target_check
      WHEN target_check IS NULL THEN old_policy.with_check
      ELSE '(' || target_check || ') OR (' || old_policy.with_check || ')'
    END;

    -- PUBLIC policies are retained for anonymous visitors only. Their access
    -- predicate is folded into the authenticated RBAC policy so signed-in
    -- visitors keep the same public-content access without policy overlap.
    IF old_policy.roles @> ARRAY['public']::name[] THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO anon',
        old_policy.policyname, old_policy.tablename);
    ELSE
      EXECUTE format('DROP POLICY %I ON public.%I',
        old_policy.policyname, old_policy.tablename);
    END IF;

    IF merged_qual IS NOT NULL AND merged_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',
        target_policy_name, old_policy.tablename, merged_qual, merged_check);
    ELSIF merged_qual IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
        target_policy_name, old_policy.tablename, merged_qual);
    ELSIF merged_check IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',
        target_policy_name, old_policy.tablename, merged_check);
    END IF;
  END LOOP;
END;
$dedupe_policies$;

-- Remove the remaining legacy admin-only policies when their equivalent
-- action-level RBAC policies are present. has_permission() explicitly grants
-- every permission to admin and super_admin, so this does not reduce access.
DO $drop_redundant_admin_policies$
DECLARE
  p record;
  target_name text;
  v_using_admin boolean;
  v_check_admin boolean;
  v_has_target boolean;
BEGIN
  FOR p IN
    SELECT *
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname NOT LIKE 'rbac\_%' ESCAPE '\'
      AND roles @> ARRAY['authenticated']::name[]
    ORDER BY tablename, policyname
  LOOP
    v_using_admin := replace(lower(regexp_replace(COALESCE(p.qual,''), '[[:space:]]', '', 'g')), 'public.', '')
      IN ('is_admin()', '(selectis_admin()asis_admin)');
    v_check_admin := replace(lower(regexp_replace(COALESCE(p.with_check,''), '[[:space:]]', '', 'g')), 'public.', '')
      IN ('is_admin()', '(selectis_admin()asis_admin)');

    target_name := CASE p.cmd
      WHEN 'SELECT' THEN 'rbac_' || p.tablename || '_read'
      WHEN 'INSERT' THEN 'rbac_' || p.tablename || '_create'
      WHEN 'UPDATE' THEN 'rbac_' || p.tablename || '_update'
      WHEN 'DELETE' THEN 'rbac_' || p.tablename || '_delete'
      ELSE NULL
    END;

    IF p.cmd = 'ALL' AND v_using_admin AND v_check_admin THEN
      v_has_target := EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname='public' AND x.tablename=p.tablename
          AND x.policyname='rbac_' || p.tablename || '_manage'
      ) OR (
        SELECT count(*)=4 FROM pg_policies x
        WHERE x.schemaname='public' AND x.tablename=p.tablename
          AND x.policyname=ANY(ARRAY[
            'rbac_' || p.tablename || '_read',
            'rbac_' || p.tablename || '_create',
            'rbac_' || p.tablename || '_update',
            'rbac_' || p.tablename || '_delete'
          ])
      );
      IF v_has_target THEN
        EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
      END IF;
    ELSIF target_name IS NOT NULL THEN
      v_has_target := EXISTS (
        SELECT 1 FROM pg_policies x
        WHERE x.schemaname='public' AND x.tablename=p.tablename
          AND x.policyname=target_name
      );
      IF v_has_target AND (
        (p.cmd IN ('SELECT','DELETE') AND v_using_admin)
        OR (p.cmd='INSERT' AND v_check_admin)
        OR (p.cmd='UPDATE' AND v_using_admin AND v_check_admin)
      ) THEN
        EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename);
      END IF;
    END IF;
  END LOOP;
END;
$drop_redundant_admin_policies$;

-- Remove the exact legacy admin-only policies reported as overlapping with RBAC.
-- Their tables already have the matching action-level rbac_* policies.
DROP POLICY IF EXISTS "Admins read audit logs" ON public."audit_logs";
DROP POLICY IF EXISTS "Staff can manage automation events" ON public."automation_events";
DROP POLICY IF EXISTS "Admins manage booking extras" ON public."booking_extras";
DROP POLICY IF EXISTS "Admins can manage booking passengers" ON public."booking_passengers";
DROP POLICY IF EXISTS "Admins manage bookings" ON public."bookings";
DROP POLICY IF EXISTS "Admins manage categories" ON public."categories";
DROP POLICY IF EXISTS "Staff can manage communication messages" ON public."communication_messages";
DROP POLICY IF EXISTS "Staff can manage templates" ON public."communication_templates";
DROP POLICY IF EXISTS "Admins can manage coupons" ON public."coupons";
DROP POLICY IF EXISTS "Staff can manage activities" ON public."crm_activities";
DROP POLICY IF EXISTS "Staff can manage crm communications" ON public."crm_communications";
DROP POLICY IF EXISTS "Staff can manage crm_conversations" ON public."crm_conversations";
DROP POLICY IF EXISTS "Staff can manage crm_lead_stages" ON public."crm_lead_stages";
DROP POLICY IF EXISTS "Staff can manage crm notes" ON public."crm_notes";
DROP POLICY IF EXISTS "Staff can manage crm_segments" ON public."crm_segments";
DROP POLICY IF EXISTS "Staff can manage crm_tags" ON public."crm_tags";
DROP POLICY IF EXISTS "Staff can manage crm tasks" ON public."crm_tasks";
DROP POLICY IF EXISTS "Admins can manage customers" ON public."customers";
DROP POLICY IF EXISTS "Staff can manage departures" ON public."departures";
DROP POLICY IF EXISTS "Admins manage destinations" ON public."destinations";
DROP POLICY IF EXISTS "Admins can manage faqs" ON public."faqs";
DROP POLICY IF EXISTS "Admins can manage guides" ON public."guides";
DROP POLICY IF EXISTS "Admins can manage inquiries" ON public."inquiries";
DROP POLICY IF EXISTS "Staff can manage invoices" ON public."invoices";
DROP POLICY IF EXISTS "Staff can manage leads" ON public."leads";
DROP POLICY IF EXISTS "Admins can manage media assets" ON public."media_assets";
DROP POLICY IF EXISTS "Admins can manage newsletter subscriptions" ON public."newsletter_subscriptions";
DROP POLICY IF EXISTS "Staff can manage operational assignments" ON public."operational_assignments";
DROP POLICY IF EXISTS "Admins can manage payment providers" ON public."payment_providers";
DROP POLICY IF EXISTS "Staff can manage payment transactions" ON public."payment_transactions";
DROP POLICY IF EXISTS "Admins manage pickup locations" ON public."pickup_locations";
DROP POLICY IF EXISTS "Staff can manage pickup schedules" ON public."pickup_schedules";
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public."profiles";
DROP POLICY IF EXISTS "Staff can manage refund records" ON public."refund_records";
DROP POLICY IF EXISTS "Admins manage reviews" ON public."reviews";
DROP POLICY IF EXISTS "Admins manage SEO metadata" ON public."seo_metadata";
DROP POLICY IF EXISTS "Admins manage site settings" ON public."site_settings";
DROP POLICY IF EXISTS "Staff can manage notifications" ON public."staff_notifications";
DROP POLICY IF EXISTS "Admins manage tour assigned extras" ON public."tour_assigned_extras";
DROP POLICY IF EXISTS "Admins manage availability" ON public."tour_availability";
DROP POLICY IF EXISTS "Admins manage tour categories" ON public."tour_categories";
DROP POLICY IF EXISTS "Admins manage exclusions" ON public."tour_exclusions";
DROP POLICY IF EXISTS "Admins manage tour extras" ON public."tour_extras";
DROP POLICY IF EXISTS "Admins manage faqs" ON public."tour_faqs";
DROP POLICY IF EXISTS "Admins manage highlights" ON public."tour_highlights";
DROP POLICY IF EXISTS "Admins manage tour images" ON public."tour_images";
DROP POLICY IF EXISTS "Admins manage inclusions" ON public."tour_inclusions";
DROP POLICY IF EXISTS "Admins manage itinerary" ON public."tour_itinerary";
DROP POLICY IF EXISTS "Admins manage tour pickup links" ON public."tour_pickup_locations";
DROP POLICY IF EXISTS "Admins can manage tour vessels" ON public."tour_vessels";
DROP POLICY IF EXISTS "Admins manage tour videos" ON public."tour_videos";
DROP POLICY IF EXISTS "Admins can delete tours" ON public."tours";
DROP POLICY IF EXISTS "Admins can insert tours" ON public."tours";
DROP POLICY IF EXISTS "Admins can update tours" ON public."tours";
DROP POLICY IF EXISTS "Admins can manage vessels" ON public."vessels";
DROP POLICY IF EXISTS "Admins can manage weather bulletins" ON public."weather_bulletins";

CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by
  ON public.user_roles (assigned_by);

NOTIFY pgrst, 'reload schema';
