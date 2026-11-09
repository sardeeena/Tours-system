-- ==============================================================================
-- Migration: 20261016000000_hardened_abuse_prevention_and_atomic_rate_limits.sql
-- Mahmoud CRM: Hardened Abuse Prevention, Atomic Rate Limiting, & RLS Security
-- ==============================================================================

-- 1. Dedicated Atomic Rate Limiting Table (eliminates concurrent race conditions & table scans)
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    bucket_key TEXT NOT NULL,
    bucket_window TIMESTAMPTZ NOT NULL,
    hit_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bucket_key, bucket_window)
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_buckets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limit_buckets TO postgres, service_role;

-- 2. Add Honeypot Columns to Inquiries and Newsletter Tables
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS website_url_hp TEXT;
ALTER TABLE public.newsletter_subscriptions ADD COLUMN IF NOT EXISTS website_url_hp TEXT;

-- 3. Atomic Rate Limiting Helper Function (Row-level locked upsert)
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

-- 4. Hardened check_public_submission_rate_limit() Trigger Function
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

-- 5. Revoke Direct Execution of Trigger Function
REVOKE ALL ON FUNCTION public.check_public_submission_rate_limit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_submission_rate_limit() TO postgres, service_role;
