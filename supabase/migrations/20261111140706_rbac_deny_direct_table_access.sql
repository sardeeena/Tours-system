-- RBAC internals are accessible only through audited, checked SECURITY DEFINER RPCs.
-- Trigger functions are not callable through the Data API.
BEGIN;
REVOKE ALL ON FUNCTION public.sync_legacy_profile_role_to_user_roles() FROM PUBLIC,anon,authenticated,service_role;
DO $deny_direct_rbac$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['access_roles','access_permissions','user_roles','role_permissions'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','rbac_deny_direct_'||table_name,table_name);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon,authenticated USING (false) WITH CHECK (false)',
    'rbac_deny_direct_'||table_name,table_name);
 END LOOP;
END;
$deny_direct_rbac$;
COMMIT;