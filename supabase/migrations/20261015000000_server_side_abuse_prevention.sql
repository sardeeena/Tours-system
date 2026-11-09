-- ==============================================================================
-- Migration: 20261015000000_server_side_abuse_prevention.sql
-- Mahmoud CRM: Server-Side Rate Limiting & Abuse Prevention for Public Submissions
-- ==============================================================================

-- 1. Server-side Rate Limiting Function
CREATE OR REPLACE FUNCTION public.check_public_submission_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    client_ip TEXT;
    recent_ip_count INT;
    recent_email_count INT;
    ip_window INTERVAL := INTERVAL '10 minutes';
    email_window INTERVAL := INTERVAL '10 minutes';
    max_ip_submissions INT := 10;
    max_email_submissions INT := 5;
BEGIN
    -- Bypass rate limiting for administrative, batch, and test maintenance roles
    IF session_user IN ('postgres', 'service_role') THEN
        RETURN NEW;
    END IF;

    -- Extract client IP from PostgREST headers if present
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

    -- Sanitize client IP
    IF client_ip IS NOT NULL THEN
        client_ip := trim(client_ip);
    END IF;

    -- 1. Handling for INQUIRIES
    IF TG_TABLE_NAME = 'inquiries' THEN
        -- Auto-attach detected client IP to the inquiry record
        IF (NEW.ip_address IS NULL OR NEW.ip_address = '') AND client_ip IS NOT NULL THEN
            NEW.ip_address := client_ip;
        END IF;

        -- Check IP-based rate limit
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            SELECT COUNT(*) INTO recent_ip_count
            FROM public.inquiries
            WHERE (ip_address = client_ip)
              AND created_at > (NOW() - ip_window);

            IF recent_ip_count >= max_ip_submissions THEN
                RAISE EXCEPTION 'Rate limit exceeded: Too many inquiries submitted from your IP address. Please wait a few minutes before trying again.'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;

        -- Check Email-based rate limit
        IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
            SELECT COUNT(*) INTO recent_email_count
            FROM public.inquiries
            WHERE LOWER(email) = LOWER(TRIM(NEW.email))
              AND created_at > (NOW() - email_window);

            IF recent_email_count >= max_email_submissions THEN
                RAISE EXCEPTION 'Rate limit exceeded: Too many inquiries submitted for this email address. Please check your inbox or wait before resubmitting.'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;

    -- 2. Handling for NEWSLETTER SUBSCRIPTIONS
    ELSIF TG_TABLE_NAME = 'newsletter_subscriptions' THEN
        IF client_ip IS NOT NULL AND client_ip <> '' THEN
            -- Check if IP is recorded in metadata->>'client_ip'
            SELECT COUNT(*) INTO recent_ip_count
            FROM public.newsletter_subscriptions
            WHERE (metadata->>'client_ip' = client_ip)
              AND created_at > (NOW() - ip_window);

            IF recent_ip_count >= max_ip_submissions THEN
                RAISE EXCEPTION 'Rate limit exceeded: Too many newsletter subscription requests from this network. Please try again later.'
                    USING ERRCODE = 'P0001';
            END IF;

            -- Attach client_ip into metadata JSONB
            IF NEW.metadata IS NULL THEN
                NEW.metadata := jsonb_build_object('client_ip', client_ip);
            ELSE
                NEW.metadata := NEW.metadata || jsonb_build_object('client_ip', client_ip);
            END IF;
        END IF;

    -- 3. Handling for BOOKINGS
    ELSIF TG_TABLE_NAME = 'bookings' THEN
        -- Prevent automated flood of bookings from the same customer
        IF NEW.customer_id IS NOT NULL THEN
            SELECT COUNT(*) INTO recent_email_count
            FROM public.bookings
            WHERE customer_id = NEW.customer_id
              AND created_at > (NOW() - INTERVAL '30 minutes');

            IF recent_email_count >= 5 THEN
                RAISE EXCEPTION 'Rate limit exceeded: Too many bookings initiated in a short period. Please contact reservations or wait 30 minutes.'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Drop and Rebind Triggers
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

-- 3. Execution Grants
REVOKE ALL ON FUNCTION public.check_public_submission_rate_limit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_public_submission_rate_limit() TO anon, authenticated, service_role;
