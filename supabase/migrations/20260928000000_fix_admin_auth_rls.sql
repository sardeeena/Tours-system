-- ==============================================================================
-- RED SEA VOYAGES & MARITIME EXCURSIONS - ADMIN AUTH & RLS RECURSION FIX PATCH
-- ==============================================================================
-- Run this standalone script in your Supabase SQL Editor if you have an existing
-- database instance and need to apply the administrator authentication and RLS fixes:
-- 1. Eliminates infinite recursion in Row-Level Security on public.profiles
-- 2. Secures public.is_admin() with plpgsql, search_path, and proper permissions
-- 3. Prevents privilege escalation (ordinary users cannot set their own role)
-- 4. Backfills any missing profiles for existing auth.users accounts
-- 5. Provides set_admin_role_by_email() to easily grant admin roles without errors
-- ==============================================================================

-- 1. SECURE & NON-RECURSIVE IS_ADMIN() FUNCTION
-- Uses PL/pgSQL so PostgreSQL query planner NEVER inlines it into RLS queries.
-- SECURITY DEFINER executes as postgres, bypassing RLS on public.profiles internally.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
DECLARE
    current_role text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- 1. Primary check: public.profiles table
    SELECT role INTO current_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF current_role IN ('admin', 'manager', 'staff') THEN
        RETURN true;
    END IF;

    -- 2. Fallback check: auth.users metadata if profile record is syncing
    SELECT COALESCE(raw_user_meta_data->>'role', raw_app_meta_data->>'role') INTO current_role
    FROM auth.users
    WHERE id = auth.uid();

    RETURN current_role IN ('admin', 'manager', 'staff');
END;
$$;

-- Grant execution permission to authenticated and anonymous API roles
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- 2. RESTRUCTURE ROW-LEVEL SECURITY POLICIES ON public.profiles
-- Dropping old policies that created circular references
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view own profile" ON public.profiles;

-- Authenticated users can read their own profile directly by UID without calling is_admin()
-- Supabase Performance Best Practice: Use (SELECT auth.uid()) for statement-level caching
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

-- Admins can view all user profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Users can update their own profile contact and name details
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- Admins have full access to manage all profiles
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. ROLE PROTECTION TRIGGER: PREVENT SELF-ESCALATION
-- Prevents non-admin users from changing their own role to 'admin' via API update requests
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
        NEW.role = OLD.role;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 4. BACKFILL MISSING PROFILES FROM auth.users
-- Fixes the case where users were created in Supabase Auth before the migration
-- or where the handle_new_user trigger did not run.
INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    is_confirmed,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'role', 'customer'),
    (u.email_confirmed_at IS NOT NULL),
    COALESCE(u.created_at, NOW()),
    NOW()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET 
    email = EXCLUDED.email,
    is_confirmed = EXCLUDED.is_confirmed,
    updated_at = NOW();

-- 5. CONVENIENCE FUNCTION: SET ADMIN ROLE BY EMAIL
-- Safely promotes any user to administrator by email address.
-- Can be called in the Supabase SQL Editor like:
-- SELECT public.set_admin_role_by_email('diamond.entertainment70@gmail.com');
CREATE OR REPLACE FUNCTION public.set_admin_role_by_email(target_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    found_user_id uuid;
    clean_email text;
BEGIN
    clean_email := LOWER(TRIM(target_email));
    
    SELECT id INTO found_user_id 
    FROM auth.users 
    WHERE LOWER(email) = clean_email;

    IF found_user_id IS NULL THEN
        RETURN 'Error: User ' || target_email || ' was not found in auth.users. The user must register or sign up first before being assigned a role.';
    END IF;

    -- Upsert record in public.profiles with role = 'admin'
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        is_confirmed,
        updated_at
    )
    VALUES (
        found_user_id,
        clean_email,
        split_part(clean_email, '@', 1),
        'admin',
        true,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        role = 'admin',
        is_confirmed = true,
        updated_at = NOW();

    -- Also update auth.users metadata so JWT mirrors the role
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"admin"'::jsonb
    )
    WHERE id = found_user_id;

    RETURN 'Success: Account ' || clean_email || ' (User ID: ' || found_user_id || ') is now an active administrator.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_admin_role_by_email(text) TO postgres, service_role;
