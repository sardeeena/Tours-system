-- Least-privilege hardening for privileged operational RPCs and server-only tables.
-- The public departure RPC remains callable by authenticated staff, but its
-- SECURITY DEFINER work is delegated to the private guarded implementation.
-- The notification scanner is a server worker and must use service_role only.
-- The eight RLS tables below are deliberately server-only; restrictive deny
-- policies document and preserve that boundary if accidental grants are added.
BEGIN;

REVOKE ALL ON FUNCTION public.scan_staff_notifications()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scan_staff_notifications()
  TO service_role;

ALTER FUNCTION public.upsert_departure_with_availability(
  UUID, UUID, DATE, TEXT, TEXT, INTEGER, TEXT, UUID, UUID, UUID, TEXT
) SECURITY INVOKER;

REVOKE ALL ON FUNCTION private.upsert_departure_with_availability(
  UUID, UUID, DATE, TEXT, TEXT, INTEGER, TEXT, UUID, UUID, UUID, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.upsert_departure_with_availability(
  UUID, UUID, DATE, TEXT, TEXT, INTEGER, TEXT, UUID, UUID, UUID, TEXT
) TO authenticated, service_role;

DO $server_only_rls$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'content_translations',
    'customer_communication_consent_events',
    'technical_events',
    'visitor_analytics_settings',
    'visitor_consent_records',
    'visitor_events',
    'visitor_sessions',
    'whatsapp_provider_status_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      'deny_api_roles_' || v_table, v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'deny_api_roles_' || v_table, v_table
    );
  END LOOP;
END;
$server_only_rls$;

NOTIFY pgrst, 'reload schema';
COMMIT;
