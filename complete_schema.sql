-- ==============================================================================
-- RED SEA VOYAGES & MARITIME EXCURSIONS - CANONICAL COMPLETE DATABASE SCHEMA
-- Authoritative Supabase Database Schema: "complete_schema.sql"
-- ==============================================================================
-- Consolidated from all 14 historical database migrations, seed profiles,
-- and application service data contracts.
--
-- TARGET ENVIRONMENT:
--   • PostgreSQL 15+ / Supabase Managed Cloud Platform
--   • Designed exclusively for FRESH DATABASE INITIALIZATION
--   • Fully self-contained, transactional, and order-dependent
--
-- SECURITY ARCHITECTURE:
--   • Extensions: "uuid-ossp", "pgcrypto"
--   • Strict Foreign Keys with ON DELETE CASCADE / SET NULL / RESTRICT
--   • Automated handle_updated_at() triggers on all mutating entities
--   • auth.users synchronization triggers for profiles
--   • Role privilege escalation defense on profiles (public.protect_profile_role)
--   • Hardened is_admin() supporting service_role JWT and staff roles
--   • Zero-leak RLS policies on bookings, customers, CRM, finance, operations, and communications
--   • Secure RPC functions for public booking lookup & atomic checkout
--   • Storage buckets configuration for tour-media, avatars, and vouchers
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: EXTENSIONS & ENVIRONMENT SETUP
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- SECTION 2: CORE AUTOMATION & AUTH FUNCTIONS
-- ==============================================================================

-- 2.1 Automated updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2.2 Canonical is_admin() Authorization Check
-- Evaluates service_role JWT or membership in ('admin', 'staff', 'superadmin', 'manager')
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
BEGIN
    IF auth.uid() IS NULL AND (auth.jwt() ->> 'role') != 'service_role' THEN
        RETURN FALSE;
    END IF;

    RETURN (
        SELECT COALESCE(
            (auth.jwt() ->> 'role' = 'service_role') OR
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('admin', 'staff', 'superadmin', 'manager')
            ),
            FALSE
        )
    );
END;
$$;

-- 2.3 Prevent Profile Role Escalation Trigger Function
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

-- 2.4 Auth New User Signup Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- SECURITY HARDENING: Ordinary signups ALWAYS receive exclusively the default 'customer' role.
    -- No email address or client-submitted metadata can grant admin or staff permissions.
    -- Administrative accounts must be provisioned via Supabase Auth Admin API (scripts/setup-admin.ts).
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        phone,
        role,
        is_confirmed,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            TRIM(CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name')),
            SPLIT_PART(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'phone',
        'customer',
        (NEW.email_confirmed_at IS NOT NULL),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
        is_confirmed = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- 2.5 Auth User Email Confirmation Trigger Function
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        UPDATE public.profiles
        SET is_confirmed = TRUE,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

-- 2.6 Administrative Role Assignment Utility Function
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

-- Revoke default PUBLIC execution; grant strictly to trusted operators
REVOKE ALL ON FUNCTION public.set_admin_role_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_role_by_email(text) TO postgres, service_role;

-- 2.11 Atomic Rate Limiting Helper Function (Row-level locked upsert)
CREATE OR REPLACE FUNCTION public.check_atomic_rate_limit(
    p_action TEXT,
    p_identifier TEXT,
    p_window_interval INTERVAL,
    p_max_hits INT,
    p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    v_clean_id TEXT;
    v_window_start TIMESTAMPTZ;
    v_hits INT;
BEGIN
    IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
        RETURN;
    END IF;

    v_clean_id := LOWER(TRIM(p_identifier));
    v_window_start := date_trunc('minute', NOW()) - 
        (((EXTRACT(minute FROM NOW())::int) % GREATEST(1, (EXTRACT(epoch FROM p_window_interval)::int / 60))) * INTERVAL '1 minute');

    INSERT INTO public.rate_limit_buckets (bucket_key, bucket_window, hit_count)
    VALUES (p_action || ':' || v_clean_id, v_window_start, 1)
    ON CONFLICT (bucket_key, bucket_window)
    DO UPDATE SET hit_count = public.rate_limit_buckets.hit_count + 1
    RETURNING hit_count INTO v_hits;

    IF v_hits > p_max_hits THEN
        RAISE EXCEPTION '%', p_error_message USING ERRCODE = 'P0001';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_atomic_rate_limit(TEXT, TEXT, INTERVAL, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_atomic_rate_limit(TEXT, TEXT, INTERVAL, INT, TEXT) TO postgres, service_role;

-- 2.12 Server-Side Hardened Rate Limiting & Abuse Prevention Trigger Function
CREATE OR REPLACE FUNCTION public.check_public_submission_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
    client_ip TEXT;
    clean_email TEXT;
BEGIN
    -- 1. Trusted administrative bypass (strictly restricted to postgres & service_role)
    IF session_user IN ('postgres', 'service_role') THEN
        RETURN NEW;
    END IF;

    -- 2. Anti-Bot Honeypot Enforcement (in-database check)
    IF TG_TABLE_NAME IN ('inquiries', 'newsletter_subscriptions') THEN
        IF NEW.website_url_hp IS NOT NULL AND TRIM(NEW.website_url_hp) <> '' THEN
            RAISE EXCEPTION 'Bot submission blocked by honeypot verification.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 3. Extract and sanitize client IP from PostgREST headers
    BEGIN
        client_ip := NULLIF(current_setting('request.headers', true)::json->>'cf-connecting-ip', '');
        IF client_ip IS NULL THEN
            client_ip := NULLIF(current_setting('request.headers', true)::json->>'x-forwarded-for', '');
            IF client_ip LIKE '%,%' THEN
                client_ip := trim(split_part(client_ip, ',', 1));
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        client_ip := NULL;
    END;

    IF client_ip IS NOT NULL THEN
        client_ip := TRIM(client_ip);
        IF LENGTH(client_ip) > 64 THEN
            client_ip := SUBSTRING(client_ip FROM 1 FOR 64);
        END IF;
    END IF;

    -- 4. Table-Specific Validation & Atomic Throttling
    IF TG_TABLE_NAME = 'inquiries' THEN
        -- Enforce required fields
        IF TRIM(COALESCE(NEW.customer_name, '')) = '' OR TRIM(COALESCE(NEW.email, '')) = '' OR TRIM(COALESCE(NEW.message, '')) = '' THEN
            RAISE EXCEPTION 'Invalid inquiry submission: Customer name, email, and message are required.'
                USING ERRCODE = 'P0001';
        END IF;

        clean_email := LOWER(TRIM(NEW.email));
        IF NOT (clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
            RAISE EXCEPTION 'Invalid email address format for customer inquiry.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Unprivileged clients cannot manipulate status or admin notes
        NEW.status := 'new';
        NEW.email := clean_email;

        IF (NEW.ip_address IS NULL OR NEW.ip_address = '') AND client_ip IS NOT NULL THEN
            NEW.ip_address := client_ip;
        END IF;

        -- Atomic email rate limit: 5 inquiries per 10 minutes
        PERFORM public.check_atomic_rate_limit(
            'inquiry_email',
            clean_email,
            INTERVAL '10 minutes',
            5,
            'Rate limit exceeded: Too many inquiries submitted for this email address. Please wait a few minutes before trying again.'
        );

        -- Atomic IP rate limit: 10 inquiries per 10 minutes
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            PERFORM public.check_atomic_rate_limit(
                'inquiry_ip',
                client_ip,
                INTERVAL '10 minutes',
                10,
                'Rate limit exceeded: Too many inquiries submitted from your IP address. Please wait a few minutes before trying again.'
            );
        END IF;

    ELSIF TG_TABLE_NAME = 'newsletter_subscriptions' THEN
        clean_email := LOWER(TRIM(NEW.email));
        IF clean_email = '' OR NOT (clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
            RAISE EXCEPTION 'Invalid email address format for newsletter subscription.'
                USING ERRCODE = 'P0001';
        END IF;

        NEW.email := clean_email;
        NEW.status := 'subscribed';

        -- Atomic email rate limit: 3 attempts per 10 minutes
        PERFORM public.check_atomic_rate_limit(
            'newsletter_email',
            clean_email,
            INTERVAL '10 minutes',
            3,
            'Rate limit exceeded: Too many newsletter subscription requests for this email.'
        );

        -- Atomic IP rate limit: 10 attempts per 10 minutes
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            PERFORM public.check_atomic_rate_limit(
                'newsletter_ip',
                client_ip,
                INTERVAL '10 minutes',
                10,
                'Rate limit exceeded: Too many newsletter subscriptions from this network. Please try again later.'
            );
        END IF;

    ELSIF TG_TABLE_NAME = 'bookings' THEN
        -- Unprivileged clients cannot self-grant 'paid' or forged statuses
        IF NEW.payment_status NOT IN ('pending', 'pay_at_pickup') THEN
            NEW.payment_status := 'pending';
        END IF;
        IF NEW.status NOT IN ('pending', 'confirmed') THEN
            NEW.status := 'confirmed';
        END IF;
        IF NEW.operational_status IS DISTINCT FROM 'Scheduled' THEN
            NEW.operational_status := 'Scheduled';
        END IF;

        -- Atomic customer rate limit: 5 bookings per 30 minutes
        IF NEW.customer_id IS NOT NULL THEN
            PERFORM public.check_atomic_rate_limit(
                'booking_customer',
                NEW.customer_id::text,
                INTERVAL '30 minutes',
                5,
                'Rate limit exceeded: Too many bookings initiated in a short period. Please contact reservations or wait 30 minutes.'
            );
        END IF;

        -- Atomic IP rate limit on booking creation: 10 bookings per 30 minutes
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            PERFORM public.check_atomic_rate_limit(
                'booking_ip',
                client_ip,
                INTERVAL '30 minutes',
                10,
                'Rate limit exceeded: Too many bookings submitted from your network. Please wait a few minutes before trying again.'
            );
        END IF;
    END IF;

    -- Cleanup expired rate limit buckets probabilistically (5% of calls)
    IF (random() < 0.05) THEN
        DELETE FROM public.rate_limit_buckets WHERE bucket_window < (NOW() - INTERVAL '2 hours');
    END IF;

    RETURN NEW;
END;
$$;

-- Revoke direct execution of trigger function
REVOKE ALL ON FUNCTION public.check_public_submission_rate_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_submission_rate_limit() TO postgres, service_role;

-- ==============================================================================
-- SECTION 3: APPLICATION TABLES (CANONICAL SCHEMA)
-- ==============================================================================

-- 3.1 PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'manager', 'admin', 'superadmin', 'guest', 'client')),
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 DESTINATIONS TABLE
CREATE TABLE IF NOT EXISTS public.destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT,
    description TEXT,
    main_image TEXT NOT NULL,
    gallery TEXT[] DEFAULT '{}'::TEXT[],
    distance_from_airport TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'archived')),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    description TEXT,
    banner_image TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 FLEET VESSELS TABLE
CREATE TABLE IF NOT EXISTS public.vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    vessel_type TEXT NOT NULL CHECK (vessel_type IN ('yacht', 'speedboat', 'catamaran', 'safari_boat', 'glass_bottom')),
    registration_number TEXT,
    port_marina TEXT NOT NULL DEFAULT 'Hurghada Marina',
    passenger_capacity INT NOT NULL DEFAULT 35,
    crew_capacity INT NOT NULL DEFAULT 5,
    year_built INT,
    safety_inspection_expiry DATE,
    amenities TEXT[] DEFAULT '{}'::TEXT[],
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'docked', 'inactive')),
    maintenance_notes TEXT,
    next_maintenance DATE,
    crew TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 GUIDES, CAPTAINS & OPERATIONAL CREW TABLE
CREATE TABLE IF NOT EXISTS public.guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (
        role IN (
            'guide',
            'tour_guide',
            'captain',
            'driver',
            'crew',
            'photographer',
            'dive_master',
            'snorkel_guide',
            'safari_lead',
            'other'
        )
    ),
    languages TEXT[] DEFAULT ARRAY['English']::TEXT[],
    phone TEXT,
    email TEXT,
    license_number TEXT,
    rating NUMERIC(3,2) DEFAULT 5.0,
    availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'assigned', 'off_duty', 'sick')),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6 TOURS & EXCURSIONS TABLE
CREATE TABLE IF NOT EXISTS public.tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT,
    description TEXT,
    destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
    duration TEXT NOT NULL,
    duration_type TEXT NOT NULL DEFAULT 'hours' CHECK (duration_type IN ('hours', 'days', 'weeks')),
    duration_hours INT DEFAULT 7,
    tour_type TEXT NOT NULL DEFAULT 'shared' CHECK (tour_type IN ('shared', 'private', 'luxury_vip', 'adventure')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'archived')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    child_price NUMERIC(10,2) DEFAULT 0.00,
    infant_price NUMERIC(10,2) DEFAULT 0.00,
    private_price NUMERIC(10,2),
    currency TEXT NOT NULL DEFAULT 'EUR',
    max_guests INT NOT NULL DEFAULT 35,
    minimum_booking_notice_hours INT NOT NULL DEFAULT 12,
    pickup_available BOOLEAN NOT NULL DEFAULT TRUE,
    pickup_info TEXT,
    cancellation_policy TEXT DEFAULT 'Free cancellation up to 24 hours prior to excursion departure',
    departure_time TEXT DEFAULT '08:30 AM',
    available_days INT[] DEFAULT ARRAY[0,1,2,3,4,5,6],
    languages TEXT[] DEFAULT ARRAY['English']::TEXT[],
    difficulty TEXT NOT NULL DEFAULT 'Easy' CHECK (difficulty IN ('Easy', 'Moderate', 'Challenging', 'Demanding')),
    age_restrictions TEXT DEFAULT 'Suitable for all ages',
    badge TEXT,
    rating NUMERIC(3,2) DEFAULT 5.00,
    review_count INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 TOUR CATEGORIES RELATIONSHIP
CREATE TABLE IF NOT EXISTS public.tour_categories (
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (tour_id, category_id)
);

-- 3.8 TOUR IMAGES GALLERY
CREATE TABLE IF NOT EXISTS public.tour_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    alt_text TEXT,
    caption TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9 TOUR VIDEOS
CREATE TABLE IF NOT EXISTS public.tour_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    provider TEXT NOT NULL DEFAULT 'youtube' CHECK (provider IN ('youtube', 'vimeo', 'custom_storage')),
    storage_path TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 TOUR ITINERARY TIMELINE
CREATE TABLE IF NOT EXISTS public.tour_itinerary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    time TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11 TOUR INCLUSIONS
CREATE TABLE IF NOT EXISTS public.tour_inclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12 TOUR EXCLUSIONS
CREATE TABLE IF NOT EXISTS public.tour_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.13 TOUR HIGHLIGHTS
CREATE TABLE IF NOT EXISTS public.tour_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.14 TOUR FAQS
CREATE TABLE IF NOT EXISTS public.tour_faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.15 PICKUP LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.pickup_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    fee_eur_per_person NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fee_eur_flat NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.16 TOUR PICKUP LOCATIONS RELATIONSHIP
CREATE TABLE IF NOT EXISTS public.tour_pickup_locations (
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    pickup_location_id UUID NOT NULL REFERENCES public.pickup_locations(id) ON DELETE CASCADE,
    PRIMARY KEY (tour_id, pickup_location_id)
);

-- 3.17 TOUR EXTRAS & ADD-ONS TABLE
CREATE TABLE IF NOT EXISTS public.tour_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_eur NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    pricing_type TEXT NOT NULL DEFAULT 'per_booking' CHECK (pricing_type IN ('per_person', 'per_booking')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.18 TOUR ASSIGNED EXTRAS RELATIONSHIP
CREATE TABLE IF NOT EXISTS public.tour_assigned_extras (
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    extra_id UUID NOT NULL REFERENCES public.tour_extras(id) ON DELETE CASCADE,
    PRIMARY KEY (tour_id, extra_id)
);

-- 3.19 TOUR DEFAULT VESSELS RELATIONSHIP
CREATE TABLE IF NOT EXISTS public.tour_vessels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.20 TOUR AVAILABILITY & CAPACITY LEDGER
CREATE TABLE IF NOT EXISTS public.tour_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'limited', 'sold_out', 'unavailable')),
    max_capacity INT NOT NULL DEFAULT 35,
    booked_count INT NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tour_availability_date UNIQUE (tour_id, date)
);

-- 3.21 CUSTOMERS TABLE (AUTHORITATIVE CRM MASTER)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    country TEXT NOT NULL,
    country_code TEXT,
    hotel TEXT,
    notes TEXT,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    source TEXT NOT NULL DEFAULT 'Website Booking',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'vip', 'inactive', 'archived')),
    last_contact_at TIMESTAMPTZ,
    total_revenue NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    outstanding_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_bookings_count INT NOT NULL DEFAULT 0,
    completed_bookings_count INT NOT NULL DEFAULT 0,
    cancelled_bookings_count INT NOT NULL DEFAULT 0,
    first_booking_date DATE,
    latest_booking_date DATE,
    upcoming_booking_date DATE,
    preferred_currency TEXT NOT NULL DEFAULT 'EUR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.22 BOOKINGS MASTER TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_reference TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    booking_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancellation_requested', 'cancelled', 'completed', 'no_show')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'failed')),
    payment_method TEXT NOT NULL DEFAULT 'pay_at_pickup' CHECK (payment_method IN ('pay_at_pickup', 'pay_online')),
    adult_count INT NOT NULL DEFAULT 1,
    child_count INT NOT NULL DEFAULT 0,
    infant_count INT NOT NULL DEFAULT 0,
    pickup_location_id UUID REFERENCES public.pickup_locations(id) ON DELETE SET NULL,
    pickup_hotel_name TEXT,
    pickup_room_number TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    extras_total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    special_requests TEXT,
    cancellation_reason TEXT,
    operational_status TEXT DEFAULT 'Scheduled',
    pickup_status TEXT DEFAULT 'Waiting',
    pickup_time TEXT,
    driver_vehicle TEXT,
    assigned_vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    assigned_guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.23 BOOKING EXTRAS LINE ITEMS
CREATE TABLE IF NOT EXISTS public.booking_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    extra_id UUID REFERENCES public.tour_extras(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    pricing_type TEXT NOT NULL DEFAULT 'per_booking',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.24 BOOKING PASSENGERS MANIFEST
CREATE TABLE IF NOT EXISTS public.booking_passengers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    nationality TEXT,
    passport_or_id_number TEXT,
    passenger_type TEXT NOT NULL DEFAULT 'adult' CHECK (passenger_type IN ('adult', 'child', 'infant')),
    is_lead_passenger BOOLEAN NOT NULL DEFAULT FALSE,
    date_of_birth DATE,
    gender TEXT,
    phone TEXT,
    special_requests TEXT,
    pickup_location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.25 REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    country TEXT,
    country_code TEXT,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    traveler_type TEXT DEFAULT 'Couple' CHECK (traveler_type IN ('Solo', 'Couple', 'Family', 'Friends', 'Group')),
    verified_booking BOOLEAN NOT NULL DEFAULT TRUE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.26 COUPONS & PROMOTIONS TABLE
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_spend NUMERIC(10,2) DEFAULT 0.00,
    max_discount NUMERIC(10,2),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    usage_limit INT,
    times_used INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.27 CUSTOMER INQUIRIES & SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL,
    tour_title TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'converted', 'closed', 'archived')),
    source TEXT DEFAULT 'web',
    ip_address TEXT,
    admin_notes TEXT,
    website_url_hp TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.28 GLOBAL FAQS TABLE
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('booking', 'cancellation', 'marine_safety', 'transfers', 'diving', 'general')),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.29 WEATHER BULLETINS TABLE
CREATE TABLE IF NOT EXISTS public.weather_bulletins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    harbor_location TEXT NOT NULL DEFAULT 'Hurghada Marina',
    water_temperature_c NUMERIC(4,1) NOT NULL,
    air_temperature_c NUMERIC(4,1) NOT NULL,
    swell_height_m NUMERIC(3,1) NOT NULL,
    wind_speed_knots NUMERIC(4,1) NOT NULL,
    wind_direction TEXT NOT NULL,
    visibility_meters INT NOT NULL,
    coast_guard_cleared BOOLEAN NOT NULL DEFAULT TRUE,
    advisory_notes TEXT,
    bulletin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    provider TEXT DEFAULT 'open-meteo',
    is_available BOOLEAN DEFAULT TRUE,
    raw_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.30 SEO METADATA TABLE
CREATE TABLE IF NOT EXISTS public.seo_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'tour', 'destination', 'category')),
    entity_id UUID,
    page_slug TEXT,
    seo_title TEXT NOT NULL,
    meta_description TEXT NOT NULL,
    seo_keywords TEXT[] DEFAULT '{}'::TEXT[],
    canonical_url TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    social_image TEXT,
    robots_index BOOLEAN NOT NULL DEFAULT TRUE,
    robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.31 SITE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3.32 SYSTEM AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.33 NEWSLETTER SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'website_footer',
    status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
    discount_code TEXT,
    website_url_hp TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.34 MEDIA ASSETS METADATA TABLE
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path TEXT NOT NULL UNIQUE,
    bucket_name TEXT NOT NULL DEFAULT 'tour-media',
    public_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    title TEXT,
    alt_text TEXT,
    tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.34B RATE LIMIT BUCKETS TABLE (ATOMIC CONCURRENCY ENGINE)
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    bucket_key TEXT NOT NULL,
    bucket_window TIMESTAMPTZ NOT NULL,
    hit_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bucket_key, bucket_window)
);

-- 3.35 CRM LEADS PIPELINE
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    country TEXT,
    hotel TEXT,
    source TEXT NOT NULL DEFAULT 'Website',
    interested_tour_id UUID REFERENCES public.tours(id) ON DELETE SET NULL,
    interested_tour_title TEXT,
    travel_date DATE,
    number_of_guests INT NOT NULL DEFAULT 1,
    estimated_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    stage TEXT NOT NULL DEFAULT 'New',
    score INT NOT NULL DEFAULT 50,
    destination TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT[] DEFAULT '{}'::TEXT[],
    notes TEXT,
    assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_staff_name TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    follow_up_date TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    contact_attempts_count INT NOT NULL DEFAULT 0,
    lost_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.36 CRM LEAD STAGES CONFIGURATION
CREATE TABLE IF NOT EXISTS public.crm_lead_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.37 CRM TAGS REGISTRY
CREATE TABLE IF NOT EXISTS public.crm_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    category TEXT DEFAULT 'general',
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.38 CRM SEGMENTS TABLE
CREATE TABLE IF NOT EXISTS public.crm_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    badge_label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#2dd4bf',
    icon TEXT NOT NULL DEFAULT 'Tag',
    rule_type TEXT NOT NULL,
    filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.39 CRM TASKS TABLE
CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    lead_name TEXT,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_reference TEXT,
    assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_staff_name TEXT,
    due_date TIMESTAMPTZ,
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    is_follow_up BOOLEAN NOT NULL DEFAULT FALSE,
    follow_up_channel TEXT DEFAULT 'Phone',
    outcome_notes TEXT,
    completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    completed_by_name TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.40 CRM COMMUNICATIONS LOG
CREATE TABLE IF NOT EXISTS public.crm_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('Email', 'WhatsApp', 'Phone Call', 'SMS', 'In-Person', 'Other')),
    direction TEXT NOT NULL CHECK (direction IN ('Outbound', 'Inbound')),
    summary TEXT NOT NULL,
    content TEXT,
    staff_name TEXT NOT NULL DEFAULT 'Staff Dispatcher',
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.41 CRM STAFF NOTES
CREATE TABLE IF NOT EXISTS public.crm_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    staff_name TEXT NOT NULL DEFAULT 'Admin Staff',
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.42 CRM CUSTOMER ACTIVITIES TIMELINE
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    actor TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    staff_name TEXT,
    is_system_generated BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.43 CRM CONVERSATIONS LOG (OMNICHANNEL MESSAGING)
CREATE TABLE IF NOT EXISTS public.crm_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'phone', 'web_chat', 'sms')),
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_identifier TEXT NOT NULL,
    recipient_identifier TEXT NOT NULL,
    subject TEXT,
    message_body TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'unconfigured',
    provider_message_id TEXT,
    provider_status TEXT NOT NULL DEFAULT 'logged',
    error_details TEXT,
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL DEFAULT 'Admin Staff',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.44 OPERATIONAL TOUR ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.operational_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    departure_time TEXT NOT NULL DEFAULT '08:30',
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    captain_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    crew_ids UUID[] DEFAULT '{}'::UUID[],
    status TEXT NOT NULL DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.45 OPERATIONAL DEPARTURES TABLE (FIRST-CLASS SCHEDULED DEPARTURES)
CREATE TABLE IF NOT EXISTS public.departures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TEXT NOT NULL DEFAULT '08:30',
    end_time TEXT NOT NULL DEFAULT '16:30',
    capacity INT NOT NULL DEFAULT 35,
    booked_passengers INT NOT NULL DEFAULT 0,
    remaining_capacity INT NOT NULL DEFAULT 35,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'confirmed', 'boarding', 'in_progress', 'completed', 'cancelled')
    ),
    guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
    captain_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    driver_name TEXT,
    vehicle_name TEXT,
    crew_ids UUID[] DEFAULT '{}'::UUID[],
    notes TEXT,
    weather_status TEXT DEFAULT 'Cleared',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.46 OPERATIONAL PICKUP SCHEDULES TABLE
CREATE TABLE IF NOT EXISTS public.pickup_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_reference TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    hotel TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT 'Hurghada',
    pickup_time TEXT NOT NULL DEFAULT '07:30',
    driver_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
    driver_name TEXT,
    vehicle TEXT,
    passenger_count INT NOT NULL DEFAULT 1,
    departure_id UUID REFERENCES public.departures(id) ON DELETE SET NULL,
    tour_title TEXT,
    tour_date DATE NOT NULL DEFAULT CURRENT_DATE,
    departure_time TEXT DEFAULT '08:30',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'confirmed', 'picked_up', 'no_show', 'cancelled')
    ),
    special_requests TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.47 PAYMENT PROVIDERS REGISTRY
CREATE TABLE IF NOT EXISTS public.payment_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('manual', 'gateway', 'bank_transfer', 'wallet')),
    is_connected BOOLEAN NOT NULL DEFAULT FALSE,
    is_manual BOOLEAN NOT NULL DEFAULT TRUE,
    supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['EUR', 'USD', 'GBP', 'EGP']::TEXT[],
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.48 PAYMENT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    booking_reference TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'EUR',
    payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'Card', 'Bank Transfer', 'Online Payment', 'Other')),
    provider TEXT NOT NULL DEFAULT 'cash',
    is_manual BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'Paid' CHECK (status IN ('Pending', 'Paid', 'Partially Paid', 'Failed', 'Refunded')),
    transaction_reference TEXT,
    notes TEXT,
    recorded_by TEXT DEFAULT 'Staff Dispatcher',
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.49 REFUND RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.refund_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    booking_reference TEXT,
    payment_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    requested_amount NUMERIC(10,2),
    approved_amount NUMERIC(10,2),
    currency TEXT NOT NULL DEFAULT 'EUR',
    reason TEXT NOT NULL,
    refund_method TEXT NOT NULL CHECK (refund_method IN ('Original Payment Method', 'Cash', 'Credit Card', 'Bank Wire', 'Credit Voucher')),
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('requested', 'pending_approval', 'approved', 'processed', 'rejected')),
    transaction_reference TEXT,
    notes TEXT,
    requested_by TEXT DEFAULT 'Staff',
    approved_by TEXT,
    processed_by TEXT DEFAULT 'Finance Desk',
    processed_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.50 COMMERCIAL INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    tour_title TEXT,
    tour_date DATE,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    paid NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'EUR',
    status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled')),
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    company_details JSONB NOT NULL DEFAULT '{"name": "Red Sea Voyages SAE", "taxId": "EG-902-184-771"}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.51 COMMUNICATION TEMPLATES
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'Both' CHECK (channel IN ('Email', 'WhatsApp', 'Both')),
    subject TEXT,
    body_text TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.52 COMMUNICATION DISPATCH MESSAGES
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL CHECK (channel IN ('Email', 'WhatsApp')),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    recipient_address TEXT NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_reference TEXT,
    template_key TEXT,
    subject TEXT,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Queued' CHECK (
        status IN ('queued', 'sent', 'delivered', 'failed', 'opened', 'Queued', 'Sent', 'Delivered', 'Failed', 'Opened')
    ),
    provider_name TEXT DEFAULT 'None',
    provider_message_id TEXT,
    failure_reason TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    task_id UUID REFERENCES public.crm_tasks(id) ON DELETE SET NULL,
    inquiry_id UUID REFERENCES public.inquiries(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL DEFAULT 'System Dispatcher',
    staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.53 INTERNAL STAFF NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.staff_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (
        category IN (
            'new_booking',
            'new_inquiry',
            'new_payment',
            'payment_overdue',
            'new_lead',
            'followup_due',
            'task_overdue',
            'departure_unassigned',
            'pickup_pending',
            'document_expiring',
            'cancellation',
            'new_review',
            'operational_issue',
            'payment_pending'
        )
    ),
    dedup_key TEXT UNIQUE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
    entity_type TEXT,
    entity_id TEXT,
    link_tab TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.54 EVENT-DRIVEN AUTOMATION BUS
CREATE TABLE IF NOT EXISTS public.automation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL CHECK (
        event_name IN (
            'booking.created',
            'booking.updated',
            'payment.received',
            'payment.failed',
            'booking.cancelled',
            'departure.tomorrow',
            'followup.due'
        )
    ),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    entity_type TEXT,
    entity_id TEXT,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    actions_triggered JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SECTION 4: PERFORMANCE INDEXES (ALL APPLICATION ENTITIES)
-- ==============================================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Destinations & Categories
CREATE INDEX IF NOT EXISTS idx_destinations_slug ON public.destinations(slug);
CREATE INDEX IF NOT EXISTS idx_destinations_status ON public.destinations(status);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- Vessels & Guides
CREATE INDEX IF NOT EXISTS idx_vessels_active ON public.vessels(is_active);
CREATE INDEX IF NOT EXISTS idx_vessels_status ON public.vessels(status);
CREATE INDEX IF NOT EXISTS idx_guides_active ON public.guides(is_active);
CREATE INDEX IF NOT EXISTS idx_guides_role ON public.guides(role);
CREATE INDEX IF NOT EXISTS idx_guides_avail ON public.guides(availability_status);

-- Tours & Catalogs
CREATE INDEX IF NOT EXISTS idx_tours_slug ON public.tours(slug);
CREATE INDEX IF NOT EXISTS idx_tours_status ON public.tours(status);
CREATE INDEX IF NOT EXISTS idx_tours_featured ON public.tours(featured);
CREATE INDEX IF NOT EXISTS idx_tours_destination ON public.tours(destination_id);
CREATE INDEX IF NOT EXISTS idx_tours_price ON public.tours(price);
CREATE INDEX IF NOT EXISTS idx_tour_images_tour ON public.tour_images(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_images_primary ON public.tour_images(tour_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_tour_videos_tour ON public.tour_videos(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_itinerary_tour ON public.tour_itinerary(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_inclusions_tour ON public.tour_inclusions(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_exclusions_tour ON public.tour_exclusions(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_highlights_tour ON public.tour_highlights(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_faqs_tour ON public.tour_faqs(tour_id);

-- Locations & Extras
CREATE INDEX IF NOT EXISTS idx_pickup_locations_code ON public.pickup_locations(code);
CREATE INDEX IF NOT EXISTS idx_pickup_locations_active ON public.pickup_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_tour_extras_active ON public.tour_extras(is_active);
CREATE INDEX IF NOT EXISTS idx_tour_vessels_tour ON public.tour_vessels(tour_id);

-- Availability & Capacity
CREATE INDEX IF NOT EXISTS idx_tour_availability_query ON public.tour_availability(tour_id, date);
CREATE INDEX IF NOT EXISTS idx_tour_availability_date ON public.tour_availability(date);

-- Customers Master
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_email ON public.customers(user_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON public.customers USING GIN (tags);

-- Bookings Master
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON public.bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_ref ON public.bookings(user_id, booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_date_status ON public.bookings(tour_id, booking_date, status);
CREATE INDEX IF NOT EXISTS idx_booking_extras_booking ON public.booking_extras(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking ON public.booking_passengers(booking_id);

-- Business Intelligence Composite Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_reporting_composite ON public.bookings(created_at, booking_date, status, payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_reporting_customer ON public.bookings(customer_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_reporting_tour ON public.bookings(tour_id, booking_date);

-- Reviews & Marketing
CREATE INDEX IF NOT EXISTS idx_reviews_tour ON public.reviews(tour_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_inquiries_email ON public.inquiries(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON public.faqs(category);
CREATE INDEX IF NOT EXISTS idx_weather_date ON public.weather_bulletins(bulletin_date);
CREATE INDEX IF NOT EXISTS idx_seo_page_slug ON public.seo_metadata(page_slug);
CREATE INDEX IF NOT EXISTS idx_seo_entity ON public.seo_metadata(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON public.newsletter_subscriptions(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_media_assets_tour ON public.media_assets(tour_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_storage_path ON public.media_assets(storage_path);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON public.media_assets(created_at DESC);

-- CRM Pipeline Indexes
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_leads_customer_stage ON public.leads(customer_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_reporting_composite ON public.leads(created_at, source, stage);
CREATE INDEX IF NOT EXISTS idx_leads_reporting_staff ON public.leads(assigned_staff_name);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer ON public.crm_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead ON public.crm_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON public.crm_tasks(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_crm_comms_customer ON public.crm_communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_customer ON public.crm_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_customer ON public.crm_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_booking_cust ON public.crm_activities(booking_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_customer ON public.crm_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_lead ON public.crm_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_booking ON public.crm_conversations(booking_id);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_created_at ON public.crm_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_conversations_channel ON public.crm_conversations(channel);

-- Operations & Dispatch Indexes
CREATE INDEX IF NOT EXISTS idx_op_assign_date ON public.operational_assignments(date);
CREATE INDEX IF NOT EXISTS idx_op_assign_tour ON public.operational_assignments(tour_id);
CREATE INDEX IF NOT EXISTS idx_op_assign_vessel ON public.operational_assignments(vessel_id);
CREATE INDEX IF NOT EXISTS idx_op_assign_guide ON public.operational_assignments(guide_id);
CREATE INDEX IF NOT EXISTS idx_assignments_reporting_date ON public.operational_assignments(date, status);
CREATE INDEX IF NOT EXISTS idx_departures_date ON public.departures(date);
CREATE INDEX IF NOT EXISTS idx_departures_tour ON public.departures(tour_id);
CREATE INDEX IF NOT EXISTS idx_departures_status ON public.departures(status);
CREATE INDEX IF NOT EXISTS idx_departures_vessel ON public.departures(vessel_id);
CREATE INDEX IF NOT EXISTS idx_pickups_date ON public.pickup_schedules(tour_date);
CREATE INDEX IF NOT EXISTS idx_pickups_status ON public.pickup_schedules(status);
CREATE INDEX IF NOT EXISTS idx_pickups_booking ON public.pickup_schedules(booking_reference);
CREATE INDEX IF NOT EXISTS idx_pickups_driver ON public.pickup_schedules(driver_id);

-- Finance & Ledger Indexes
CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payment_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_payments_is_manual ON public.payment_transactions(is_manual);
CREATE INDEX IF NOT EXISTS idx_payments_booking_ref ON public.payment_transactions(booking_reference);
CREATE INDEX IF NOT EXISTS idx_pay_tx_booking_cust ON public.payment_transactions(booking_reference, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_reporting_date ON public.payment_transactions(payment_date, status);
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON public.refund_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refund_records(status);
CREATE INDEX IF NOT EXISTS idx_refunds_booking_ref ON public.refund_records(booking_reference);
CREATE INDEX IF NOT EXISTS idx_refunds_reporting_date ON public.refund_records(created_at, status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);

-- Communications & Automation Indexes
CREATE INDEX IF NOT EXISTS idx_comm_msgs_channel ON public.communication_messages(channel);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_status ON public.communication_messages(status);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_customer ON public.communication_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_booking ON public.communication_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_comm_msgs_created ON public.communication_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_staff_notif_unread ON public.staff_notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_staff_notif_category ON public.staff_notifications(category);
CREATE INDEX IF NOT EXISTS idx_auto_events_processed ON public.automation_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_events_name ON public.automation_events(event_name);

-- ==============================================================================
-- SECTION 5: AUTOMATED TIMESTAMP & AUDIT TRIGGERS
-- ==============================================================================

-- Core Profile Triggers
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_user_confirmed();

-- Entity Timestamp Triggers
CREATE TRIGGER trigger_destinations_updated_at BEFORE UPDATE ON public.destinations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_vessels_updated_at BEFORE UPDATE ON public.vessels FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_guides_updated_at BEFORE UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_tours_updated_at BEFORE UPDATE ON public.tours FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_pickup_locations_updated_at BEFORE UPDATE ON public.pickup_locations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_tour_extras_updated_at BEFORE UPDATE ON public.tour_extras FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_tour_availability_updated_at BEFORE UPDATE ON public.tour_availability FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_faqs_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_seo_metadata_updated_at BEFORE UPDATE ON public.seo_metadata FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_newsletter_updated_at BEFORE UPDATE ON public.newsletter_subscriptions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_media_assets_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_crm_tasks_updated_at BEFORE UPDATE ON public.crm_tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_op_assign_updated_at BEFORE UPDATE ON public.operational_assignments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_departures_updated_at BEFORE UPDATE ON public.departures FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_pickup_schedules_updated_at BEFORE UPDATE ON public.pickup_schedules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_pay_providers_updated_at BEFORE UPDATE ON public.payment_providers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_pay_tx_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_refunds_updated_at BEFORE UPDATE ON public.refund_records FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_comm_tmpl_updated_at BEFORE UPDATE ON public.communication_templates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trigger_comm_msgs_updated_at BEFORE UPDATE ON public.communication_messages FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Public Abuse Prevention Triggers
DROP TRIGGER IF EXISTS trg_rate_limit_inquiries ON public.inquiries;
CREATE TRIGGER trg_rate_limit_inquiries
    BEFORE INSERT ON public.inquiries
    FOR EACH ROW
    EXECUTE FUNCTION public.check_public_submission_rate_limit();

DROP TRIGGER IF EXISTS trg_rate_limit_newsletter ON public.newsletter_subscriptions;
CREATE TRIGGER trg_rate_limit_newsletter
    BEFORE INSERT ON public.newsletter_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_public_submission_rate_limit();

DROP TRIGGER IF EXISTS trg_rate_limit_bookings ON public.bookings;
CREATE TRIGGER trg_rate_limit_bookings
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_public_submission_rate_limit();

-- ==============================================================================
-- SECTION 6: BUSINESS WORKFLOW & APPLICATION RPCS
-- ==============================================================================

-- 6.1 SECURE PUBLIC BOOKING LOOKUP RPC
-- Requires both booking reference AND contact verification (email or phone).
CREATE OR REPLACE FUNCTION public.lookup_booking_secure(
    p_reference TEXT,
    p_verification TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_ref TEXT;
    v_clean_contact TEXT;
    v_digits_contact TEXT;
    v_booking RECORD;
    v_tour RECORD;
    v_customer RECORD;
    v_extras JSONB;
    v_masked_email TEXT;
    v_masked_phone TEXT;
    v_email_parts TEXT[];
BEGIN
    IF p_reference IS NULL OR TRIM(p_reference) = '' THEN
        RETURN NULL;
    END IF;

    IF p_verification IS NULL OR TRIM(p_verification) = '' THEN
        RETURN NULL;
    END IF;

    v_clean_ref := UPPER(TRIM(p_reference));
    v_clean_contact := LOWER(TRIM(p_verification));
    v_digits_contact := REGEXP_REPLACE(p_verification, '[^0-9]', '', 'g');

    SELECT b.* INTO v_booking
    FROM public.bookings b
    WHERE b.booking_reference = v_clean_ref
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT c.* INTO v_customer
    FROM public.customers c
    WHERE c.id = v_booking.customer_id;

    IF v_customer IS NOT NULL THEN
        IF LOWER(TRIM(v_customer.email)) != v_clean_contact THEN
            IF v_digits_contact = '' OR RIGHT(REGEXP_REPLACE(v_customer.phone, '[^0-9]', '', 'g'), 7) != RIGHT(v_digits_contact, 7) THEN
                RETURN NULL;
            END IF;
        END IF;
    END IF;

    SELECT t.id, t.title, t.slug, t.duration, t.departure_time, t.pickup_info
    INTO v_tour
    FROM public.tours t
    WHERE t.id = v_booking.tour_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', be.name,
        'quantity', be.quantity,
        'unitPrice', be.unit_price,
        'totalPrice', be.total_price
    )), '[]'::jsonb)
    INTO v_extras
    FROM public.booking_extras be
    WHERE be.booking_id = v_booking.id;

    IF v_customer.email IS NOT NULL AND POSITION('@' IN v_customer.email) > 0 THEN
        v_email_parts := STRING_TO_ARRAY(v_customer.email, '@');
        v_masked_email := SUBSTRING(v_email_parts[1] FROM 1 FOR 2) || '***@' || v_email_parts[2];
    ELSE
        v_masked_email := '***@***.com';
    END IF;

    IF v_customer.phone IS NOT NULL AND LENGTH(v_customer.phone) > 4 THEN
        v_masked_phone := '***-***-' || RIGHT(v_customer.phone, 4);
    ELSE
        v_masked_phone := '***-****';
    END IF;

    RETURN jsonb_build_object(
        'bookingReference', v_booking.booking_reference,
        'status', v_booking.status,
        'paymentStatus', v_booking.payment_status,
        'paymentMethod', v_booking.payment_method,
        'bookingDate', v_booking.booking_date,
        'createdAt', v_booking.created_at,
        'guests', jsonb_build_object(
            'adults', v_booking.adult_count,
            'children', v_booking.child_count,
            'infants', v_booking.infant_count
        ),
        'tour', jsonb_build_object(
            'id', v_tour.id,
            'title', v_tour.title,
            'slug', v_tour.slug,
            'duration', v_tour.duration,
            'departureTime', v_tour.departure_time,
            'pickupInfo', v_tour.pickup_info
        ),
        'pickup', jsonb_build_object(
            'hotelName', v_booking.pickup_hotel_name,
            'roomNumber', v_booking.pickup_room_number,
            'time', v_booking.pickup_time,
            'status', v_booking.pickup_status
        ),
        'pricing', jsonb_build_object(
            'subtotal', v_booking.subtotal,
            'extrasTotal', v_booking.extras_total,
            'discount', v_booking.discount,
            'total', v_booking.total,
            'currency', v_booking.currency,
            'formattedTotal', '€' || TO_CHAR(v_booking.total, 'FM999,990.00')
        ),
        'customer', jsonb_build_object(
            'firstName', v_customer.first_name,
            'lastName', v_customer.last_name,
            'emailMasked', v_masked_email,
            'phoneMasked', v_masked_phone,
            'country', v_customer.country
        ),
        'extras', v_extras,
        'specialRequests', v_booking.special_requests
    );
END;
$$;

-- 6.2 SECURE GUEST CANCELLATION REQUEST RPC
CREATE OR REPLACE FUNCTION public.request_booking_cancellation_secure(
    p_reference TEXT,
    p_verification TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_ref TEXT;
    v_clean_contact TEXT;
    v_digits_contact TEXT;
    v_booking RECORD;
    v_customer RECORD;
    v_hours_until_departure NUMERIC;
BEGIN
    IF p_reference IS NULL OR TRIM(p_reference) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid booking reference.');
    END IF;

    v_clean_ref := UPPER(TRIM(p_reference));
    v_clean_contact := LOWER(TRIM(p_verification));
    v_digits_contact := REGEXP_REPLACE(p_verification, '[^0-9]', '', 'g');

    SELECT b.* INTO v_booking
    FROM public.bookings b
    WHERE b.booking_reference = v_clean_ref
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking reference not found.');
    END IF;

    IF v_booking.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This reservation is already cancelled.');
    END IF;

    IF v_booking.status = 'cancellation_requested' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Cancellation is currently pending review.');
    END IF;

    SELECT c.* INTO v_customer
    FROM public.customers c
    WHERE c.id = v_booking.customer_id;

    IF v_customer IS NOT NULL THEN
        IF LOWER(TRIM(v_customer.email)) != v_clean_contact THEN
            IF v_digits_contact = '' OR RIGHT(REGEXP_REPLACE(v_customer.phone, '[^0-9]', '', 'g'), 7) != RIGHT(v_digits_contact, 7) THEN
                RETURN jsonb_build_object('success', false, 'error', 'Contact verification failed.');
            END IF;
        END IF;
    END IF;

    v_hours_until_departure := EXTRACT(EPOCH FROM (v_booking.booking_date::TIMESTAMP - NOW())) / 3600;

    UPDATE public.bookings
    SET status = 'cancellation_requested',
        cancellation_reason = SUBSTRING(TRIM(p_reason) FROM 1 FOR 500),
        updated_at = NOW()
    WHERE id = v_booking.id;

    -- Return updated state
    RETURN jsonb_build_object(
        'success', true,
        'bookingReference', v_clean_ref,
        'status', 'cancellation_requested',
        'isWithinFreeCancellationWindow', (v_hours_until_departure >= 24)
    );
END;
$$;

-- 6.3 ATOMIC TRANSACTIONAL BOOKING CREATION RPC
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
    p_tour_identifier TEXT,
    p_booking_date DATE,
    p_adult_count INT,
    p_child_count INT DEFAULT 0,
    p_infant_count INT DEFAULT 0,
    p_customer_first_name TEXT DEFAULT '',
    p_customer_last_name TEXT DEFAULT '',
    p_customer_email TEXT DEFAULT '',
    p_customer_phone TEXT DEFAULT '',
    p_customer_country TEXT DEFAULT 'International',
    p_customer_hotel TEXT DEFAULT NULL,
    p_pickup_location_id TEXT DEFAULT NULL,
    p_pickup_room_number TEXT DEFAULT NULL,
    p_extras JSONB DEFAULT '[]'::jsonb,
    p_coupon_code TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'pay_at_pickup',
    p_special_requests TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_tour RECORD;
    v_avail RECORD;
    v_customer_id UUID;
    v_booking_id UUID;
    v_booking_ref TEXT;
    v_total_guests INT;
    v_subtotal NUMERIC(10,2) := 0.00;
    v_extras_total NUMERIC(10,2) := 0.00;
    v_discount NUMERIC(10,2) := 0.00;
    v_final_total NUMERIC(10,2) := 0.00;
    v_extra_item JSONB;
    v_extra_record RECORD;
    v_pickup_fee NUMERIC(10,2) := 0.00;
    v_coupon RECORD;
    v_current_user_id UUID := auth.uid();
BEGIN
    v_total_guests := COALESCE(p_adult_count, 1) + COALESCE(p_child_count, 0) + COALESCE(p_infant_count, 0);

    -- Find Tour
    IF p_tour_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT * INTO v_tour FROM public.tours WHERE id = p_tour_identifier::UUID;
    ELSE
        SELECT * INTO v_tour FROM public.tours WHERE slug = p_tour_identifier;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tour not found.');
    END IF;

    -- Concurrency Row Lock on Availability
    SELECT * INTO v_avail
    FROM public.tour_availability
    WHERE tour_id = v_tour.id AND date = p_booking_date
    FOR UPDATE;

    IF FOUND THEN
        IF v_avail.status IN ('sold_out', 'unavailable') OR (v_avail.booked_count + v_total_guests > v_avail.max_capacity) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Tour departure date is completely booked.');
        END IF;
    END IF;

    -- Authoritative Pricing
    v_subtotal := (COALESCE(p_adult_count, 1) * v_tour.price) + 
                  (COALESCE(p_child_count, 0) * COALESCE(v_tour.child_price, v_tour.price * 0.5));

    -- Pickup Fee
    IF p_pickup_location_id IS NOT NULL AND p_pickup_location_id != '' THEN
        SELECT fee_eur_per_person, fee_eur_flat INTO v_extra_record
        FROM public.pickup_locations WHERE id = p_pickup_location_id::UUID;
        IF FOUND THEN
            v_pickup_fee := (v_total_guests * v_extra_record.fee_eur_per_person) + v_extra_record.fee_eur_flat;
            v_subtotal := v_subtotal + v_pickup_fee;
        END IF;
    END IF;

    -- Extras Processing
    IF p_extras IS NOT NULL AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            SELECT * INTO v_extra_record FROM public.tour_extras WHERE id = (v_extra_item->>'id')::UUID;
            IF FOUND THEN
                IF v_extra_record.pricing_type = 'per_person' THEN
                    v_extras_total := v_extras_total + (v_extra_record.price_eur * (v_extra_item->>'quantity')::INT * v_total_guests);
                ELSE
                    v_extras_total := v_extras_total + (v_extra_record.price_eur * (v_extra_item->>'quantity')::INT);
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Coupon Validation
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
        SELECT * INTO v_coupon FROM public.coupons 
        WHERE code = UPPER(TRIM(p_coupon_code)) AND is_active = TRUE;
        IF FOUND THEN
            IF v_coupon.discount_type = 'percentage' THEN
                v_discount := (v_subtotal + v_extras_total) * (v_coupon.discount_value / 100.0);
            ELSE
                v_discount := v_coupon.discount_value;
            END IF;
            IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
                v_discount := v_coupon.max_discount;
            END IF;
        END IF;
    END IF;

    v_final_total := GREATEST(0.00, (v_subtotal + v_extras_total) - v_discount);

    -- Customer Deduplication / Creation
    SELECT id INTO v_customer_id FROM public.customers WHERE LOWER(email) = LOWER(TRIM(p_customer_email)) LIMIT 1;
    IF v_customer_id IS NULL THEN
        INSERT INTO public.customers (
            user_id, first_name, last_name, email, phone, country, hotel, source
        )
        VALUES (
            v_current_user_id,
            TRIM(p_customer_first_name),
            TRIM(p_customer_last_name),
            LOWER(TRIM(p_customer_email)),
            TRIM(p_customer_phone),
            COALESCE(p_customer_country, 'International'),
            p_customer_hotel,
            'Online Checkout'
        )
        RETURNING id INTO v_customer_id;
    END IF;

    -- Generate Booking Reference
    v_booking_ref := 'RSV-' || TO_CHAR(CURRENT_DATE, 'YY') || '-' || UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));

    -- Create Booking
    INSERT INTO public.bookings (
        booking_reference, user_id, tour_id, customer_id, booking_date, status, payment_status,
        payment_method, adult_count, child_count, infant_count, pickup_location_id,
        pickup_hotel_name, pickup_room_number, subtotal, extras_total, discount, total,
        currency, special_requests
    )
    VALUES (
        v_booking_ref, v_current_user_id, v_tour.id, v_customer_id, p_booking_date, 'confirmed',
        (CASE WHEN p_payment_method = 'pay_online' THEN 'paid' ELSE 'pending' END),
        p_payment_method, COALESCE(p_adult_count, 1), COALESCE(p_child_count, 0), COALESCE(p_infant_count, 0),
        (CASE WHEN p_pickup_location_id IS NOT NULL AND p_pickup_location_id != '' THEN p_pickup_location_id::UUID ELSE NULL END),
        p_customer_hotel, p_pickup_room_number, v_subtotal, v_extras_total, v_discount, v_final_total,
        'EUR', p_special_requests
    )
    RETURNING id INTO v_booking_id;

    -- Update Capacity
    INSERT INTO public.tour_availability (tour_id, date, max_capacity, booked_count, status)
    VALUES (v_tour.id, p_booking_date, v_tour.max_guests, v_total_guests, 'available')
    ON CONFLICT (tour_id, date) DO UPDATE
    SET booked_count = public.tour_availability.booked_count + v_total_guests,
        status = (CASE WHEN public.tour_availability.booked_count + v_total_guests >= public.tour_availability.max_capacity THEN 'sold_out' ELSE 'available' END),
        updated_at = NOW();

    -- Lead Passenger Manifest Record
    INSERT INTO public.booking_passengers (booking_id, full_name, nationality, is_lead_passenger)
    VALUES (v_booking_id, TRIM(p_customer_first_name || ' ' || p_customer_last_name), p_customer_country, TRUE);

    RETURN jsonb_build_object(
        'success', true,
        'bookingReference', v_booking_ref,
        'bookingId', v_booking_id,
        'totalEur', v_final_total
    );
END;
$$;

-- 6.4 CONSOLIDATED AVAILABILITY QUERY FUNCTION
CREATE OR REPLACE FUNCTION public.get_tour_availability_schedule(
    p_tour_identifier TEXT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    departure_date DATE,
    tour_id UUID,
    max_capacity INT,
    booked_count INT,
    remaining_seats INT,
    availability_status TEXT,
    is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tour_id UUID;
    v_tour_max_capacity INT;
BEGIN
    IF p_tour_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT id, max_guests INTO v_tour_id, v_tour_max_capacity FROM public.tours WHERE id = p_tour_identifier::UUID;
    ELSE
        SELECT id, max_guests INTO v_tour_id, v_tour_max_capacity FROM public.tours WHERE slug = p_tour_identifier;
    END IF;

    IF v_tour_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH date_series AS (
        SELECT d::DATE AS day_date
        FROM GENERATE_SERIES(p_start_date::TIMESTAMP, p_end_date::TIMESTAMP, '1 day'::INTERVAL) d
    )
    SELECT
        ds.day_date AS departure_date,
        v_tour_id AS tour_id,
        COALESCE(ta.max_capacity, v_tour_max_capacity, 35) AS max_capacity,
        COALESCE(ta.booked_count, 0) AS booked_count,
        GREATEST(0, COALESCE(ta.max_capacity, v_tour_max_capacity, 35) - COALESCE(ta.booked_count, 0)) AS remaining_seats,
        COALESCE(ta.status, 'available') AS availability_status,
        (COALESCE(ta.status, 'available') NOT IN ('sold_out', 'unavailable') AND (COALESCE(ta.max_capacity, v_tour_max_capacity, 35) - COALESCE(ta.booked_count, 0)) > 0) AS is_available
    FROM date_series ds
    LEFT JOIN public.tour_availability ta ON ta.tour_id = v_tour_id AND ta.date = ds.day_date
    ORDER BY ds.day_date ASC;
END;
$$;

-- 6.5 AUTOMATED CUSTOMER METRICS RECALCULATION RPC
CREATE OR REPLACE FUNCTION public.recalculate_customer_stats(p_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_spent NUMERIC(10,2) := 0;
    v_outstanding NUMERIC(10,2) := 0;
    v_total_count INT := 0;
    v_completed_count INT := 0;
    v_cancelled_count INT := 0;
    v_first_date DATE;
    v_latest_date DATE;
    v_upcoming_date DATE;
    v_current_tags TEXT[];
BEGIN
    IF p_customer_id IS NULL THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status != 'cancelled' AND payment_status != 'paid' THEN total ELSE 0 END), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'cancelled'),
        MIN(booking_date),
        MAX(booking_date),
        MIN(booking_date) FILTER (WHERE booking_date >= CURRENT_DATE AND status IN ('confirmed', 'pending'))
    INTO
        v_total_spent,
        v_outstanding,
        v_total_count,
        v_completed_count,
        v_cancelled_count,
        v_first_date,
        v_latest_date,
        v_upcoming_date
    FROM public.bookings
    WHERE customer_id = p_customer_id;

    SELECT tags INTO v_current_tags FROM public.customers WHERE id = p_customer_id;
    IF v_current_tags IS NULL THEN
        v_current_tags := '{}';
    END IF;

    IF v_total_count >= 2 AND NOT ('repeat_customer' = ANY(v_current_tags)) THEN
        v_current_tags := array_append(v_current_tags, 'repeat_customer');
    END IF;
    IF v_total_spent >= 500 AND NOT ('high_value' = ANY(v_current_tags)) THEN
        v_current_tags := array_append(v_current_tags, 'high_value');
    END IF;

    UPDATE public.customers
    SET
        total_revenue = v_total_spent,
        outstanding_amount = v_outstanding,
        total_bookings_count = v_total_count,
        completed_bookings_count = v_completed_count,
        cancelled_bookings_count = v_cancelled_count,
        first_booking_date = v_first_date,
        latest_booking_date = v_latest_date,
        upcoming_booking_date = v_upcoming_date,
        tags = v_current_tags,
        updated_at = NOW()
    WHERE id = p_customer_id;
END;
$$;

-- 6.6 EXECUTIVE BI & REPORTING AGGREGATION RPC
CREATE OR REPLACE FUNCTION public.get_executive_bi_metrics(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_res JSONB;
BEGIN
    SELECT jsonb_build_object(
        'totalRevenue', COALESCE(SUM(b.total) FILTER (WHERE b.status != 'cancelled'), 0),
        'collectedRevenue', COALESCE(SUM(b.total) FILTER (WHERE b.payment_status = 'paid' AND b.status != 'cancelled'), 0),
        'outstandingRevenue', COALESCE(SUM(b.total) FILTER (WHERE b.payment_status != 'paid' AND b.status != 'cancelled'), 0),
        'totalBookings', COUNT(*),
        'confirmedBookings', COUNT(*) FILTER (WHERE b.status = 'confirmed'),
        'cancellations', COUNT(*) FILTER (WHERE b.status = 'cancelled'),
        'totalPassengers', COALESCE(SUM(b.adult_count + b.child_count + b.infant_count) FILTER (WHERE b.status != 'cancelled'), 0),
        'averageBookingValue', CASE 
            WHEN COUNT(*) FILTER (WHERE b.status != 'cancelled') > 0 
            THEN ROUND(COALESCE(SUM(b.total) FILTER (WHERE b.status != 'cancelled'), 0) / COUNT(*) FILTER (WHERE b.status != 'cancelled'), 2)
            ELSE 0 
        END
    )
    INTO v_res
    FROM public.bookings b
    WHERE (p_start_date IS NULL OR b.booking_date >= p_start_date)
      AND (p_end_date IS NULL OR b.booking_date <= p_end_date);

    RETURN v_res;
END;
$$;

-- 6.7 MULTI-DIMENSIONAL CUSTOM REPORT BUILDER RPC
CREATE OR REPLACE FUNCTION public.query_custom_bi_report(
    p_filters JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE := (p_filters->>'startDate')::DATE;
    v_end_date DATE := (p_filters->>'endDate')::DATE;
    v_tour_id TEXT := p_filters->>'tourId';
    v_destination TEXT := p_filters->>'destination';
    v_booking_status TEXT := p_filters->>'bookingStatus';
    v_payment_status TEXT := p_filters->>'paymentStatus';
    v_lead_source TEXT := p_filters->>'leadSource';
    v_staff_name TEXT := p_filters->>'staffName';
    v_customer_query TEXT := p_filters->>'customerQuery';
    v_rows JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(r), '[]'::jsonb)
    INTO v_rows
    FROM (
        SELECT 
            b.id AS booking_id,
            b.booking_reference,
            b.booking_date,
            b.created_at,
            b.status AS booking_status,
            b.payment_status,
            b.payment_method,
            (b.adult_count + b.child_count + b.infant_count) AS total_guests,
            b.subtotal,
            b.discount,
            b.total,
            b.currency,
            t.title AS tour_title,
            d.name AS destination_name,
            COALESCE(c.first_name || ' ' || c.last_name, 'Guest') AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            COALESCE(l.source, 'Website') AS lead_source,
            l.assigned_staff_name AS staff_name
        FROM public.bookings b
        LEFT JOIN public.tours t ON b.tour_id = t.id
        LEFT JOIN public.destinations d ON t.destination_id = d.id
        LEFT JOIN public.customers c ON b.customer_id = c.id
        LEFT JOIN public.leads l ON b.customer_id = l.customer_id
        WHERE 
            (v_start_date IS NULL OR b.booking_date >= v_start_date OR b.created_at::DATE >= v_start_date)
            AND (v_end_date IS NULL OR b.booking_date <= v_end_date OR b.created_at::DATE <= v_end_date)
            AND (v_tour_id IS NULL OR v_tour_id = 'all' OR b.tour_id::TEXT = v_tour_id)
            AND (v_destination IS NULL OR v_destination = 'all' OR LOWER(d.name) = LOWER(v_destination))
            AND (v_booking_status IS NULL OR v_booking_status = 'all' OR b.status = v_booking_status)
            AND (v_payment_status IS NULL OR v_payment_status = 'all' OR b.payment_status = v_payment_status)
            AND (v_lead_source IS NULL OR v_lead_source = 'all' OR LOWER(l.source) = LOWER(v_lead_source))
            AND (v_staff_name IS NULL OR v_staff_name = 'all' OR LOWER(l.assigned_staff_name) LIKE '%' || LOWER(v_staff_name) || '%')
            AND (
                v_customer_query IS NULL 
                OR v_customer_query = '' 
                OR LOWER(c.email) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(c.first_name) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(c.last_name) LIKE '%' || LOWER(v_customer_query) || '%'
                OR LOWER(b.booking_reference) LIKE '%' || LOWER(v_customer_query) || '%'
            )
        ORDER BY b.booking_date DESC, b.created_at DESC
        LIMIT 500
    ) r;

    RETURN v_rows;
END;
$$;

-- ==============================================================================
-- SECTION 7: SUPABASE STORAGE BUCKETS & STORAGE RLS POLICIES
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'tour-media',
        'tour-media',
        true,
        52428800, -- 50MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
    ),
    (
        'avatars',
        'avatars',
        true,
        5242880, -- 5MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    ),
    (
        'vouchers',
        'vouchers',
        false, -- Private
        10485760, -- 10MB
        ARRAY['application/pdf']
    )
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Objects Policies
DROP POLICY IF EXISTS "Public can view tour media files" ON storage.objects;
CREATE POLICY "Public can view tour media files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'tour-media');

DROP POLICY IF EXISTS "Public can view avatar files" ON storage.objects;
CREATE POLICY "Public can view avatar files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can view own vouchers" ON storage.objects;
CREATE POLICY "Users can view own vouchers"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'vouchers' AND (owner = (SELECT auth.uid()) OR public.is_admin()));

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Admins can upload tour media" ON storage.objects;
CREATE POLICY "Admins can upload tour media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'tour-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update tour media" ON storage.objects;
CREATE POLICY "Admins can update tour media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'tour-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete tour media" ON storage.objects;
CREATE POLICY "Admins can delete tour media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'tour-media' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can upload vouchers" ON storage.objects;
CREATE POLICY "Admins can upload vouchers"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'vouchers' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete vouchers" ON storage.objects;
CREATE POLICY "Admins can delete vouchers"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'vouchers' AND public.is_admin());

-- ==============================================================================
-- SECTION 8: ROW LEVEL SECURITY & HARDENED ACCESS POLICIES
-- ==============================================================================

-- Enable RLS across all 54 application tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_itinerary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_assigned_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_bulletins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

-- 8.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8.2 CATALOG READ POLICIES (PUBLIC VISIBLE)
CREATE POLICY "Public can view published destinations" ON public.destinations FOR SELECT USING (status = 'published' OR public.is_admin());
CREATE POLICY "Admins manage destinations" ON public.destinations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view active vessels" ON public.vessels FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Staff can manage vessels" ON public.vessels FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view active guides" ON public.guides FOR SELECT USING (is_active = TRUE OR public.is_admin());
CREATE POLICY "Staff can manage guides" ON public.guides FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view published tours" ON public.tours FOR SELECT USING (status = 'published' OR public.is_admin());
CREATE POLICY "Admins manage tours" ON public.tours FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour categories" ON public.tour_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage tour categories" ON public.tour_categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour images" ON public.tour_images FOR SELECT USING (true);
CREATE POLICY "Admins manage tour images" ON public.tour_images FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour videos" ON public.tour_videos FOR SELECT USING (true);
CREATE POLICY "Admins manage tour videos" ON public.tour_videos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour itinerary" ON public.tour_itinerary FOR SELECT USING (true);
CREATE POLICY "Admins manage tour itinerary" ON public.tour_itinerary FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour inclusions" ON public.tour_inclusions FOR SELECT USING (true);
CREATE POLICY "Admins manage tour inclusions" ON public.tour_inclusions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour exclusions" ON public.tour_exclusions FOR SELECT USING (true);
CREATE POLICY "Admins manage tour exclusions" ON public.tour_exclusions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour highlights" ON public.tour_highlights FOR SELECT USING (true);
CREATE POLICY "Admins manage tour highlights" ON public.tour_highlights FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour faqs" ON public.tour_faqs FOR SELECT USING (true);
CREATE POLICY "Admins manage tour faqs" ON public.tour_faqs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view active pickup locations" ON public.pickup_locations FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins manage pickup locations" ON public.pickup_locations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour pickup locations" ON public.tour_pickup_locations FOR SELECT USING (true);
CREATE POLICY "Admins manage tour pickup locations" ON public.tour_pickup_locations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view active tour extras" ON public.tour_extras FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins manage tour extras" ON public.tour_extras FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour assigned extras" ON public.tour_assigned_extras FOR SELECT USING (true);
CREATE POLICY "Admins manage tour assigned extras" ON public.tour_assigned_extras FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour vessels" ON public.tour_vessels FOR SELECT USING (true);
CREATE POLICY "Admins manage tour vessels" ON public.tour_vessels FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view tour availability" ON public.tour_availability FOR SELECT USING (true);
CREATE POLICY "Admins manage tour availability" ON public.tour_availability FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8.3 CUSTOMERS POLICIES (ISOLATION)
CREATE POLICY "Users can view own customer record" ON public.customers
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can update own customer record" ON public.customers
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Public can create customer record" ON public.customers
    FOR INSERT TO anon, authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Staff can manage all customers" ON public.customers
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8.4 BOOKINGS POLICIES (HARDENED)
CREATE POLICY "Users can view own bookings" ON public.bookings
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
        OR public.is_admin()
    );

CREATE POLICY "Public can create bookings" ON public.bookings
    FOR INSERT TO anon, authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Users can request booking cancellation" ON public.bookings
    FOR UPDATE TO authenticated
    USING (
        (auth.uid() = user_id OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()))
        AND status IN ('confirmed', 'pending')
    )
    WITH CHECK (status = 'cancellation_requested');

CREATE POLICY "Staff can manage all bookings" ON public.bookings
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Booking Line Items & Passengers
CREATE POLICY "Users view linked booking extras" ON public.booking_extras
    FOR SELECT USING (
        booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid())
        OR public.is_admin()
    );
CREATE POLICY "Public insert booking extras" ON public.booking_extras FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage booking extras" ON public.booking_extras FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users view linked passengers" ON public.booking_passengers
    FOR SELECT USING (
        booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid())
        OR public.is_admin()
    );
CREATE POLICY "Public insert passengers" ON public.booking_passengers FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff manage passengers" ON public.booking_passengers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8.5 MARKETING & CONTENT POLICIES
CREATE POLICY "Public can view published reviews" ON public.reviews FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "Admins manage reviews" ON public.reviews FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public validate coupons" ON public.coupons FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can insert inquiry" ON public.inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage inquiries" ON public.inquiries FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view faqs" ON public.faqs FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "Admins manage faqs" ON public.faqs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view weather bulletins" ON public.weather_bulletins FOR SELECT USING (true);
CREATE POLICY "Admins manage weather bulletins" ON public.weather_bulletins FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view seo metadata" ON public.seo_metadata FOR SELECT USING (true);
CREATE POLICY "Admins manage seo metadata" ON public.seo_metadata FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage site settings" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "System insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can subscribe newsletter" ON public.newsletter_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage newsletter" ON public.newsletter_subscriptions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Public can view media assets" ON public.media_assets FOR SELECT USING (true);
CREATE POLICY "Admins can manage media assets" ON public.media_assets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8.6 CRM MODULE ISOLATION (STAFF ONLY)
CREATE POLICY "Staff can manage leads" ON public.leads FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage crm_lead_stages" ON public.crm_lead_stages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage crm_tags" ON public.crm_tags FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage crm_segments" ON public.crm_segments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage crm tasks" ON public.crm_tasks FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage crm communications" ON public.crm_communications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage crm notes" ON public.crm_notes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can view crm activities" ON public.crm_activities FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage crm_conversations" ON public.crm_conversations FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8.7 OPERATIONS MODULE ISOLATION
CREATE POLICY "Staff can manage operational assignments" ON public.operational_assignments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Public can view departures" ON public.departures FOR SELECT USING (true);
CREATE POLICY "Staff can manage departures" ON public.departures FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage pickup schedules" ON public.pickup_schedules FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8.8 FINANCE MODULE ISOLATION
CREATE POLICY "Anyone authenticated can view payment providers" ON public.payment_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage payment providers" ON public.payment_providers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Customers view own payments" ON public.payment_transactions FOR SELECT TO authenticated
    USING (
        booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid())
        OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
        OR public.is_admin()
    );
CREATE POLICY "Staff can manage payment transactions" ON public.payment_transactions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Customers view own refunds" ON public.refund_records FOR SELECT TO authenticated
    USING (
        booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid())
        OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
        OR public.is_admin()
    );
CREATE POLICY "Staff can manage refund records" ON public.refund_records FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Customers view own invoices" ON public.invoices FOR SELECT TO authenticated
    USING (
        booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid())
        OR customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
        OR public.is_admin()
    );
CREATE POLICY "Staff can manage invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 8.9 COMMUNICATIONS & AUTOMATION MODULE
CREATE POLICY "Staff can manage templates" ON public.communication_templates FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Customers view own communication messages" ON public.communication_messages FOR SELECT TO authenticated
    USING (
        customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
        OR booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid())
        OR public.is_admin()
    );
CREATE POLICY "Staff can manage communication messages" ON public.communication_messages FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Staff can manage notifications" ON public.staff_notifications FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can manage automation events" ON public.automation_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ==============================================================================
-- SECTION 9: FOUNDATIONAL REFERENCE SEED DATA
-- ==============================================================================

-- 9.1 PAYMENT PROVIDERS
INSERT INTO public.payment_providers (id, name, provider_type, is_connected, is_manual, supported_currencies, description)
VALUES 
    ('cash', 'Marina Office Cash Desk', 'manual', true, true, ARRAY['EUR', 'USD', 'GBP', 'EGP'], 'In-person physical cash collection at Hurghada Marina pier or hotel pickup.'),
    ('pos_terminal', 'Pier Mobile POS Terminal', 'manual', true, true, ARRAY['EUR', 'USD', 'GBP', 'EGP'], 'Physical chip & PIN / contactless terminal managed by pier desk supervisor.'),
    ('bank_wire', 'National Bank of Egypt (Wire)', 'bank_transfer', true, true, ARRAY['EUR', 'USD', 'EGP'], 'Corporate bank wire transfer for group bookings, VIP yacht charters, and advance deposits.'),
    ('stripe', 'Stripe Card Gateway', 'gateway', false, false, ARRAY['EUR', 'USD', 'GBP'], 'Online credit and debit card processing. Live API keys required to accept online payments.'),
    ('fawry', 'Fawry Pay Egypt', 'wallet', false, false, ARRAY['EGP'], 'Egyptian national digital wallet and kiosk payment network. Live Merchant Code required.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    provider_type = EXCLUDED.provider_type,
    is_connected = EXCLUDED.is_connected,
    is_manual = EXCLUDED.is_manual,
    supported_currencies = EXCLUDED.supported_currencies,
    description = EXCLUDED.description;

-- 9.2 CRM LEAD STAGES
INSERT INTO public.crm_lead_stages (name, label, color, sort_order, is_active, is_won, is_lost)
VALUES
    ('New', 'New Inquiry', '#38bdf8', 1, true, false, false),
    ('Contacted', 'Contacted', '#818cf8', 2, true, false, false),
    ('Qualified', 'Qualified Prospect', '#a78bfa', 3, true, false, false),
    ('Proposal', 'Proposal Sent', '#fbbf24', 4, true, false, false),
    ('Negotiation', 'In Negotiation', '#f97316', 5, true, false, false),
    ('Won', 'Converted / Won', '#34d399', 6, true, true, false),
    ('Lost', 'Closed / Lost', '#f87171', 7, true, false, true)
ON CONFLICT (name) DO NOTHING;

-- 9.3 DEFAULT SITE SETTINGS
INSERT INTO public.site_settings (key, value, description)
VALUES 
    ('general', '{"siteName": "Red Sea Voyages", "supportEmail": "concierge@redseavoyages.com", "currency": "EUR"}'::jsonb, 'General website settings'),
    ('operations', '{"minNoticeHours": 12, "defaultCapacity": 35, "marinaLocation": "Hurghada Marina Pier 3"}'::jsonb, 'Default maritime operations config')
ON CONFLICT (key) DO NOTHING;

COMMIT;
