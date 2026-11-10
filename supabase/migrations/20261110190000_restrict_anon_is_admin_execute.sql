-- is_admin() is intentionally SECURITY DEFINER because profiles RLS policies call it.
-- Keep it available to signed-in users for policy evaluation, but never to guests.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
