-- Allow Supabase Auth to synchronize the profile confirmation flag without
-- weakening the profile protection trigger for application users.
--
-- Auth updates auth.users while connected as supabase_auth_admin. The
-- SECURITY DEFINER trigger below marks only the target profile ID for the
-- duration of its own profile update. The profile guard requires BOTH that
-- unspoofable session_user and the transaction-local target marker, and then
-- permits only the false -> true is_confirmed transition (plus updated_at).
-- All other profile fields, including email and role, remain protected.

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        PERFORM set_config('app.auth_email_confirmation_user', NEW.id::text, true);

        UPDATE public.profiles
        SET is_confirmed = TRUE,
            updated_at = NOW()
        WHERE id = NEW.id
          AND is_confirmed IS DISTINCT FROM TRUE;

        PERFORM set_config('app.auth_email_confirmation_user', '', true);
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  active_nonce text;
  active_target text;
  active_confirmation_target text;
  is_trusted_operator_provisioning boolean := false;
  is_trusted_auth_confirmation boolean := false;
  v_is_verified_manager boolean := false;
  v_is_service_role boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';
BEGIN
  -- Supabase Auth's database connection is the only caller allowed to use
  -- this narrow synchronization path. A custom GUC alone is not sufficient:
  -- application sessions cannot spoof session_user = supabase_auth_admin.
  active_confirmation_target :=
    NULLIF(current_setting('app.auth_email_confirmation_user', true), '');

  IF session_user = 'supabase_auth_admin'
     AND active_confirmation_target = NEW.id::text
     AND OLD.is_confirmed IS FALSE
     AND NEW.is_confirmed IS TRUE
     AND (TO_JSONB(NEW) - ARRAY['is_confirmed', 'updated_at'])
         IS NOT DISTINCT FROM
         (TO_JSONB(OLD) - ARRAY['is_confirmed', 'updated_at']) THEN
    is_trusted_auth_confirmation := true;
  END IF;

  IF is_trusted_auth_confirmation THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.is_confirmed = TRUE
    ) AND private.has_permission('users.manage')
    INTO v_is_verified_manager;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Keep the existing explicit provisioning guard for service-role role changes.
    IF session_user = 'postgres' OR v_is_service_role THEN
      active_nonce := NULLIF(current_setting('app.admin_provisioning_nonce', true), '');
      active_target := NULLIF(current_setting('app.admin_provisioning_active_user', true), '');
      IF active_nonce IS NOT NULL AND active_target = NEW.id::text THEN
        is_trusted_operator_provisioning := true;
      END IF;
    END IF;

    IF NOT is_trusted_operator_provisioning AND NOT v_is_verified_manager THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  IF NOT v_is_service_role AND NOT v_is_verified_manager THEN
    IF is_trusted_operator_provisioning THEN
      -- Trusted provisioning may change role and is_confirmed only for its nonce-bound target.
      -- Email, confirmation_sent_at, identity, and other server-managed metadata remain protected.
      IF (TO_JSONB(NEW) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code',
            'updated_at', 'role', 'is_confirmed'
          ]) IS DISTINCT FROM
         (TO_JSONB(OLD) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code',
            'updated_at', 'role', 'is_confirmed'
          ]) THEN
        RAISE EXCEPTION 'Trusted provisioning cannot change email or unrelated server-managed profile fields.'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Ordinary self-edits may change only the approved profile fields.
      -- The JSON diff protects email, role, is_confirmed, confirmation_sent_at,
      -- identity and creation metadata by default.
      IF (TO_JSONB(NEW) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code', 'updated_at'
          ]) IS DISTINCT FROM
         (TO_JSONB(OLD) - ARRAY[
            'full_name', 'avatar_url', 'phone', 'country', 'country_code', 'updated_at'
          ]) THEN
        RAISE EXCEPTION 'Profile email, role, confirmation and server-managed fields cannot be changed directly.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.handle_user_confirmed() IS
  'Synchronizes Auth email confirmation to profiles using a transaction-local target marker; paired with the narrowly scoped supabase_auth_admin allowance in protect_profile_role().';

COMMENT ON FUNCTION public.protect_profile_role() IS
  'Protects profile server-managed fields and roles; allows only a target-bound false-to-true confirmation sync initiated by the Supabase Auth database session.';

NOTIFY pgrst, 'reload schema';

COMMIT;
