-- ==============================================================================
-- ADMIN ACCOUNT VALIDATION AND DATABASE-SIDE ROLE PROVISIONING
-- File: supabase/admin_seed.sql
-- ==============================================================================
-- SECURITY ARCHITECTURE:
-- 1. This file NEVER inserts directly into internal auth.users table or sets passwords.
-- 2. The Auth user MUST be created first via the supported Supabase Auth Admin API
--    using scripts/setup-admin.ts with ADMIN_EMAIL, ADMIN_PASSWORD, and SUPABASE_SERVICE_ROLE_KEY.
-- 3. This script is strictly idempotent and safe to rerun repeatedly.
-- 4. If the auth.users record exists, it validates and synchronizes the public.profiles
--    record, ensuring the role is set to 'admin' and email is verified.
-- 5. If no auth.users record exists yet, it outputs a helpful notice with instructions.
-- ==============================================================================

DO $$
DECLARE
    v_admin_email CONSTANT text := 'admin@awesomeadventure.tours';
    v_user_id uuid;
    v_existing_role text;
BEGIN
    -- Check if auth user exists in auth.users
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(v_admin_email);

    IF v_user_id IS NOT NULL THEN
        -- Check current role in public.profiles
        SELECT role INTO v_existing_role
        FROM public.profiles
        WHERE id = v_user_id;

        IF v_existing_role IS NULL THEN
            -- Profile doesn't exist yet: insert canonical admin profile
            INSERT INTO public.profiles (
                id,
                email,
                full_name,
                role,
                is_email_verified,
                created_at,
                updated_at
            ) VALUES (
                v_user_id,
                v_admin_email,
                'Awesome Adventure Administrator',
                'admin',
                TRUE,
                NOW(),
                NOW()
            );
            RAISE NOTICE 'Admin profile successfully created for % (UUID: %)', v_admin_email, v_user_id;
        ELSIF v_existing_role <> 'admin' THEN
            -- Role mismatch: repair role to admin
            UPDATE public.profiles
            SET role = 'admin',
                is_email_verified = TRUE,
                updated_at = NOW()
            WHERE id = v_user_id;
            RAISE NOTICE 'Admin profile role updated to admin for % (UUID: %)', v_admin_email, v_user_id;
        ELSE
            -- Already verified admin
            UPDATE public.profiles
            SET is_email_verified = TRUE,
                updated_at = NOW()
            WHERE id = v_user_id;
            RAISE NOTICE 'Admin profile already valid with admin role for % (UUID: %)', v_admin_email, v_user_id;
        END IF;
    ELSE
        RAISE NOTICE 'Notice: Auth account "%" was not found in auth.users. Please create the user first via "npx tsx scripts/setup-admin.ts" using SUPABASE_SERVICE_ROLE_KEY, then run this script to verify the profile.', v_admin_email;
    END IF;
END $$;
