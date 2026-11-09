-- ==============================================================================
-- MIGRATION: SECURE & LEAST-PRIVILEGE ADMIN PROVISIONING
-- ==============================================================================
-- Resolves root cause of false success in set_admin_role_by_email:
-- 1. Tightens protect_profile_role() with multi-condition operator verification:
--    - Requires session_user IN ('postgres', 'service_role') (cannot be spoofed by PostgREST clients).
--    - Requires active transaction nonce and matching target user ID.
--    - Untrusted clients setting custom configuration variables are strictly rejected.
--    - Avoids global trigger bypass for postgres.
-- 2. Restructures set_admin_role_by_email() to:
--    - Verify caller permissions (restricted to session_user in postgres, service_role).
--    - Target matching auth.users row and canonical is_confirmed column.
--    - Set transaction-scoped config parameter app.admin_provisioning_nonce & active user.
--    - Upsert public.profiles with role = 'admin'.
--    - Sync server-side auth.users.raw_app_meta_data (never user-editable metadata).
--    - Explicitly query and verify that public.profiles.role actually persisted as 'admin'.
--    - Raise an honest exception if the role is not 'admin' (never returning false success).
-- 3. Revokes all execution privileges on set_admin_role_by_email() from PUBLIC, anon,
--    and authenticated, granting EXECUTE strictly to postgres and service_role.
-- ==============================================================================

-- 1. Ensure canonical is_confirmed column exists on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Hardened protect_profile_role() trigger function
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    active_nonce text;
    active_target text;
    is_trusted_operator_provisioning boolean := false;
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Check if trusted operator provisioning is active:
        -- Untrusted clients (anon, authenticated, authenticator) CANNOT bypass this because:
        -- 1. session_user MUST be postgres or service_role
        -- 2. app.admin_provisioning_active_user MUST match NEW.id
        -- 3. app.admin_provisioning_nonce MUST be non-empty (set only by set_admin_role_by_email)
        IF session_user IN ('postgres', 'service_role') THEN
            active_nonce := NULLIF(current_setting('app.admin_provisioning_nonce', true), '');
            active_target := NULLIF(current_setting('app.admin_provisioning_active_user', true), '');
            IF active_nonce IS NOT NULL AND active_target = NEW.id::text THEN
                is_trusted_operator_provisioning := true;
            END IF;
        END IF;

        -- Role escalation is strictly prohibited unless either:
        -- (a) A trusted operator is running authorized provisioning for this specific user ID, or
        -- (b) The session caller is verified as an active administrator or service_role via public.is_admin()
        IF NOT is_trusted_operator_provisioning AND NOT public.is_admin() THEN
            NEW.role := OLD.role;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Ensure trigger is active on public.profiles
DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 3. Robust, honest, least-privilege set_admin_role_by_email() function
CREATE OR REPLACE FUNCTION public.set_admin_role_by_email(target_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    clean_email text;
    target_user_id uuid;
    target_user_metadata jsonb;
    existing_full_name text;
    verified_role text;
    provisioning_nonce text;
BEGIN
    -- 1. Authorization guard: Only postgres (SQL Editor / superuser) or service_role session may execute
    IF session_user NOT IN ('postgres', 'service_role') THEN
        RAISE EXCEPTION 'Access Denied: public.set_admin_role_by_email may only be executed by trusted database operators (postgres, service_role). Current session_user is "%".', session_user;
    END IF;

    -- 2. Validate input
    IF target_email IS NULL OR TRIM(target_email) = '' THEN
        RAISE EXCEPTION 'Target email cannot be null or empty.';
    END IF;
    clean_email := LOWER(TRIM(target_email));

    -- 3. Locate corresponding auth user
    SELECT id, raw_user_meta_data INTO target_user_id, target_user_metadata
    FROM auth.users
    WHERE LOWER(email) = clean_email
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email "%" does not exist in auth.users. The account must register or sign up before being promoted.', clean_email;
    END IF;

    -- 4. Determine display name
    SELECT full_name INTO existing_full_name
    FROM public.profiles
    WHERE id = target_user_id;

    IF existing_full_name IS NULL OR TRIM(existing_full_name) = '' THEN
        existing_full_name := COALESCE(
            target_user_metadata->>'full_name',
            TRIM(CONCAT(target_user_metadata->>'first_name', ' ', target_user_metadata->>'last_name')),
            SPLIT_PART(clean_email, '@', 1)
        );
    END IF;

    -- 5. Generate a cryptographically random transaction-scoped nonce
    provisioning_nonce := md5(gen_random_uuid()::text || clock_timestamp()::text || random()::text);
    PERFORM set_config('app.admin_provisioning_nonce', provisioning_nonce, true);
    PERFORM set_config('app.admin_provisioning_active_user', target_user_id::text, true);

    -- 6. Upsert profile with role = 'admin'
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_confirmed,
        updated_at
    )
    VALUES (
        target_user_id,
        clean_email,
        COALESCE(existing_full_name, 'Administrator'),
        'admin',
        true,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        role = 'admin',
        is_confirmed = true,
        updated_at = NOW();

    -- 7. Immediately clear transaction nonce after update
    PERFORM set_config('app.admin_provisioning_nonce', '', true);
    PERFORM set_config('app.admin_provisioning_active_user', '', true);

    -- 8. Post-update verification: assert that the role was actually persisted in public.profiles
    SELECT role INTO verified_role
    FROM public.profiles
    WHERE id = target_user_id;

    IF verified_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Admin provisioning failed: public.profiles.role remained "%" for user % (ID: %). Check triggers and security policies.',
            COALESCE(verified_role, 'NULL'), clean_email, target_user_id;
    END IF;

    -- 9. Update server-controlled app_metadata so JWT mirrors the admin role
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
    WHERE id = target_user_id;

    RETURN 'Success: Account ' || clean_email || ' (User ID: ' || target_user_id || ') is now an active administrator with verified role "admin".';
END;
$$;

-- 4. Enforce strict least-privilege permissions
REVOKE ALL ON FUNCTION public.set_admin_role_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_role_by_email(text) TO postgres, service_role;
