-- Restricted first-class super-admin provisioning.
-- Only a trusted postgres SQL session or service_role context may invoke this function.
-- The function is not executable by PUBLIC, anon, or authenticated.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_super_admin_role_by_email(target_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  clean_email text;
  target_user_id uuid;
  target_user_metadata jsonb;
  existing_full_name text;
  verified_role text;
  provisioning_nonce text;
  email_confirmed_at timestamptz;
BEGIN
  IF session_user <> 'postgres'
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Access denied: super-admin provisioning requires a trusted postgres or service_role context.';
  END IF;

  IF target_email IS NULL OR pg_catalog.btrim(target_email) = '' THEN
    RAISE EXCEPTION 'Target email cannot be null or empty.';
  END IF;

  clean_email := pg_catalog.lower(pg_catalog.btrim(target_email));

  SELECT u.id, u.raw_user_meta_data, u.email_confirmed_at
    INTO target_user_id, target_user_metadata, email_confirmed_at
  FROM auth.users AS u
  WHERE pg_catalog.lower(u.email) = clean_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'The requested account does not exist. Register and confirm the email before provisioning.';
  END IF;

  IF email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'The requested account email must be confirmed before super-admin provisioning.';
  END IF;

  SELECT p.full_name
    INTO existing_full_name
  FROM public.profiles AS p
  WHERE p.id = target_user_id;

  IF existing_full_name IS NULL OR pg_catalog.btrim(existing_full_name) = '' THEN
    existing_full_name := COALESCE(
      target_user_metadata ->> 'full_name',
      pg_catalog.nullif(
        pg_catalog.btrim(
          COALESCE(target_user_metadata ->> 'first_name', '') || ' ' ||
          COALESCE(target_user_metadata ->> 'last_name', '')
        ),
        ''
      ),
      pg_catalog.split_part(clean_email, '@', 1)
    );
  END IF;

  provisioning_nonce := pg_catalog.md5(
    gen_random_uuid()::text || clock_timestamp()::text || random()::text
  );

  PERFORM pg_catalog.set_config('app.admin_provisioning_nonce', provisioning_nonce, true);
  PERFORM pg_catalog.set_config('app.admin_provisioning_active_user', target_user_id::text, true);

  INSERT INTO public.profiles (
    id, email, full_name, role, is_confirmed, updated_at
  )
  VALUES (
    target_user_id, clean_email, COALESCE(existing_full_name, 'Super Administrator'),
    'super_admin', true, now()
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'super_admin',
      is_confirmed = true,
      updated_at = now();

  PERFORM pg_catalog.set_config('app.admin_provisioning_nonce', '', true);
  PERFORM pg_catalog.set_config('app.admin_provisioning_active_user', '', true);

  SELECT p.role
    INTO verified_role
  FROM public.profiles AS p
  WHERE p.id = target_user_id;

  IF verified_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Super-admin provisioning failed verification for the requested account.';
  END IF;

  UPDATE auth.users AS u
  SET raw_app_meta_data =
    COALESCE(u.raw_app_meta_data, '{}'::jsonb) ||
    pg_catalog.jsonb_build_object('role', 'super_admin')
  WHERE u.id = target_user_id;

  RETURN 'Success: confirmed account ' || clean_email ||
         ' is now super_admin; profile and server-controlled app_metadata verified.';
END;
$function$;

REVOKE ALL ON FUNCTION public.set_super_admin_role_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_super_admin_role_by_email(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_super_admin_role_by_email(text) TO service_role;

COMMENT ON FUNCTION public.set_super_admin_role_by_email(text) IS
  'Restricted operator-only provisioning function for confirmed super-admin accounts. Never grant to anon or authenticated.';

COMMIT;