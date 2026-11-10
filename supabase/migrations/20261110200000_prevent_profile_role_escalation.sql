-- Prevent authenticated users from promoting their own profile.
-- Role changes must be performed by a trusted server-side service-role workflow.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Profile role changes must be performed by a trusted administrator workflow'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

COMMENT ON FUNCTION public.prevent_profile_role_escalation() IS
  'Blocks profile role changes from browser-authenticated users; only service-role or trusted database administration may change roles.';
