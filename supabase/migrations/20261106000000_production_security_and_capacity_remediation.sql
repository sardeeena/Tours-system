-- ==============================================================================
-- FOR MANUAL REVIEW ONLY — NOT EXECUTED AGAINST LIVE PRODUCTION DATABASE
-- File: 20261106000000_production_security_and_capacity_remediation.sql
-- Target Project ID: cyifhjqqvtiguitrziqs
-- Production Domain: https://awesomeadventure.tours
--
-- REMEDIATION SUMMARY:
-- 1. BOOKINGS RLS & PRIVILEGE ISOLATION:
--    - Revokes direct anonymous SELECT, UPDATE, DELETE on public.bookings
--    - Drops insecure policy 'Users can view own bookings' containing 'auth.uid() IS NULL'
--    - Replaces with secure authenticated-only policy: (auth.uid() = user_id OR public.is_admin())
--    - Restricts public.customers, public.invoices, public.payment_transactions, public.refund_records
--
-- 2. PRIVILEGED FUNCTION SECURITY:
--    - Hardens get_executive_bi_metrics(date, date): pins search_path, validates admin role, revokes anon
--    - Hardens query_custom_bi_report(jsonb): pins search_path, validates admin/staff role, revokes anon
--    - Hardens recalculate_customer_stats(uuid): pins search_path, revokes anon execution
--
-- 3. GUEST BOOKING LOOKUP & CANCELLATION HARDENING:
--    - Hardens lookup_booking_secure: eliminates partial 5-digit phone matching; requires exact normalized
--      full phone number or exact email; integrates server-side rate limiting; masks contact info;
--      prevents booking reference enumeration
--    - Hardens request_booking_cancellation_secure: eliminates partial phone matching; uniform error responses
--
-- 4. ATOMIC CAPACITY ENFORCEMENT & INTEGRITY:
--    - Hardens create_booking_atomic: handles missing tour_availability records safely via atomic upsert
--      locked FOR UPDATE; validates passenger counts (>=1 adult, non-negative children/infants); validates
--      future date; validates email format; prevents duplicate booking submissions via idempotency window
--
-- 5. COVERING FOREIGN KEY INDEXES:
--    - Adds missing covering indexes on critical foreign keys for performance
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CRITICAL RLS & PERMISSION HARDENING: BOOKINGS & FINANCIAL TABLES
-- ------------------------------------------------------------------------------

-- Ensure Row Level Security is active on all private tables
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_extras ENABLE ROW LEVEL SECURITY;

-- Revoke direct anonymous SELECT, UPDATE, DELETE from sensitive tables
REVOKE SELECT, UPDATE, DELETE ON public.bookings FROM anon, public;
REVOKE SELECT, UPDATE, DELETE ON public.customers FROM anon, public;
REVOKE ALL ON public.invoices FROM anon, public;
REVOKE ALL ON public.payment_transactions FROM anon, public;
REVOKE ALL ON public.refund_records FROM anon, public;
REVOKE SELECT, UPDATE, DELETE ON public.booking_passengers FROM anon, public;
REVOKE SELECT, UPDATE, DELETE ON public.booking_extras FROM anon, public;

-- Drop insecure legacy policies that allowed anonymous reads
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can manage all bookings" ON public.bookings;

-- Replace with strict, authenticated customer and staff-only policies
CREATE POLICY "Users can view own bookings" ON public.bookings
    FOR SELECT TO authenticated
    USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
        public.is_admin()
    );

CREATE POLICY "Users can update own bookings" ON public.bookings
    FOR UPDATE TO authenticated
    USING (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
        public.is_admin()
    )
    WITH CHECK (
        (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
        public.is_admin()
    );

CREATE POLICY "Staff can manage all bookings" ON public.bookings
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Controlled insert for authenticated users (guest bookings use create_booking_atomic)
CREATE POLICY "Controlled booking creation" ON public.bookings
    FOR INSERT TO authenticated, anon
    WITH CHECK (
        -- Enforce pending status and EUR currency on direct inserts
        status IN ('pending', 'draft') AND
        currency = 'EUR' AND
        adult_count >= 1
    );

-- Financial Tables: Strictly Staff & Authenticated Customer Isolation
DROP POLICY IF EXISTS "Customers can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can manage invoices" ON public.invoices;

CREATE POLICY "Staff can manage invoices" ON public.invoices
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Customers can view their own invoices" ON public.invoices
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = invoices.booking_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Customers can view their own payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Staff can manage payment transactions" ON public.payment_transactions;

CREATE POLICY "Staff can manage payment transactions" ON public.payment_transactions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Customers can view their own payment transactions" ON public.payment_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = payment_transactions.booking_id
              AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Customers can view their own refund records" ON public.refund_records;
DROP POLICY IF EXISTS "Staff can manage refund records" ON public.refund_records;

CREATE POLICY "Staff can manage refund records" ON public.refund_records
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Customers can view their own refund records" ON public.refund_records
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = refund_records.booking_id
              AND b.user_id = auth.uid()
        )
    );

-- ------------------------------------------------------------------------------
-- 2. PRIVILEGED FUNCTIONS HARDENING (BI & REPORTING)
-- ------------------------------------------------------------------------------

-- Executive BI Metrics
CREATE OR REPLACE FUNCTION public.get_executive_bi_metrics(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_revenue NUMERIC(12,2) := 0;
    v_collected_revenue NUMERIC(12,2) := 0;
    v_outstanding_revenue NUMERIC(12,2) := 0;
    v_bookings_count INT := 0;
    v_confirmed_bookings_count INT := 0;
    v_cancellations_count INT := 0;
    v_total_passengers INT := 0;
    v_adults INT := 0;
    v_children INT := 0;
    v_infants INT := 0;
    v_total_customers INT := 0;
    v_new_customers INT := 0;
    v_repeat_customers INT := 0;
    v_leads_count INT := 0;
    v_conversion_rate NUMERIC(5,2) := 0;
    v_cancellation_rate NUMERIC(5,2) := 0;
    v_abv NUMERIC(10,2) := 0;
    v_res JSONB;
BEGIN
    -- Strict authorization check: Only administrators and authorized staff
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Executive BI metrics are restricted to authorized administrators.'
            USING ERRCODE = '42501';
    END IF;

    -- Bookings in range
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')),
        COUNT(*) FILTER (WHERE status IN ('cancelled', 'cancellation_requested')),
        COALESCE(SUM(total) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(adult_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(child_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0),
        COALESCE(SUM(infant_count) FILTER (WHERE status NOT IN ('cancelled', 'cancellation_requested')), 0)
    INTO 
        v_bookings_count,
        v_confirmed_bookings_count,
        v_cancellations_count,
        v_total_revenue,
        v_adults,
        v_children,
        v_infants
    FROM public.bookings
    WHERE (booking_date BETWEEN p_start_date AND p_end_date)
       OR (created_at::DATE BETWEEN p_start_date AND p_end_date);

    v_total_passengers := v_adults + v_children + v_infants;

    -- Collected payments in range
    SELECT COALESCE(SUM(amount), 0)
    INTO v_collected_revenue
    FROM public.payment_transactions
    WHERE status IN ('paid', 'Paid')
      AND (
          (payment_date::DATE BETWEEN p_start_date AND p_end_date)
          OR (created_at::DATE BETWEEN p_start_date AND p_end_date)
      );

    v_outstanding_revenue := GREATEST(0, v_total_revenue - v_collected_revenue);

    -- Leads count in range
    SELECT COUNT(*)
    INTO v_leads_count
    FROM public.leads
    WHERE created_at::DATE BETWEEN p_start_date AND p_end_date;

    -- Customers count in range
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE total_bookings = 1),
        COUNT(*) FILTER (WHERE total_bookings > 1)
    INTO 
        v_total_customers,
        v_new_customers,
        v_repeat_customers
    FROM public.customers
    WHERE (created_at::DATE BETWEEN p_start_date AND p_end_date)
       OR (last_booking_date BETWEEN p_start_date AND p_end_date);

    -- Rates & Averages
    IF (v_confirmed_bookings_count + v_cancellations_count) > 0 THEN
        v_cancellation_rate := ROUND((v_cancellations_count::NUMERIC / (v_confirmed_bookings_count + v_cancellations_count)::NUMERIC) * 100, 2);
    END IF;

    IF v_leads_count > 0 THEN
        v_conversion_rate := ROUND((v_confirmed_bookings_count::NUMERIC / v_leads_count::NUMERIC) * 100, 2);
    END IF;

    IF v_confirmed_bookings_count > 0 THEN
        v_abv := ROUND(v_total_revenue / v_confirmed_bookings_count::NUMERIC, 2);
    END IF;

    v_res := jsonb_build_object(
        'startDate', p_start_date,
        'endDate', p_end_date,
        'revenue', jsonb_build_object(
            'total', v_total_revenue,
            'collected', v_collected_revenue,
            'outstanding', v_outstanding_revenue,
            'currency', 'EUR',
            'averageBookingValue', v_abv
        ),
        'bookings', jsonb_build_object(
            'total', v_bookings_count,
            'confirmed', v_confirmed_bookings_count,
            'cancelled', v_cancellations_count,
            'cancellationRatePercent', v_cancellation_rate,
            'conversionRatePercent', v_conversion_rate
        ),
        'passengers', jsonb_build_object(
            'total', v_total_passengers,
            'adults', v_adults,
            'children', v_children,
            'infants', v_infants
        ),
        'customers', jsonb_build_object(
            'totalActive', v_total_customers,
            'new', v_new_customers,
            'repeat', v_repeat_customers
        ),
        'leads', jsonb_build_object(
            'total', v_leads_count
        )
    );

    RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.get_executive_bi_metrics(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_executive_bi_metrics(DATE, DATE) TO authenticated, service_role;

-- Custom BI Query Function
CREATE OR REPLACE FUNCTION public.query_custom_bi_report(
    p_filters JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    -- Strict authorization check: Only administrators and authorized staff
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: BI reports are restricted to authorized administrators.'
            USING ERRCODE = '42501';
    END IF;

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

REVOKE ALL ON FUNCTION public.query_custom_bi_report(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.query_custom_bi_report(JSONB) TO authenticated, service_role;

-- Recalculate customer stats: Internal maintenance only
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
    -- Reject unauthenticated calls
    IF auth.role() = 'anon' THEN
        RAISE EXCEPTION 'Access Denied: Recalculate stats restricted to authenticated maintenance.'
            USING ERRCODE = '42501';
    END IF;

    IF p_customer_id IS NULL THEN
        RETURN;
    END IF;

    -- Aggregate stats from bookings
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

    -- Fetch current tags
    SELECT tags INTO v_current_tags FROM public.customers WHERE id = p_customer_id;
    IF v_current_tags IS NULL THEN
        v_current_tags := '{}'::TEXT[];
    END IF;

    -- Adjust VIP and Repeat tags
    IF v_total_spent >= 1000 OR v_total_count >= 5 THEN
        IF NOT ('VIP' = ANY(v_current_tags)) THEN
            v_current_tags := array_append(v_current_tags, 'VIP');
        END IF;
    END IF;

    IF v_total_count >= 2 THEN
        IF NOT ('Repeat Guest' = ANY(v_current_tags)) THEN
            v_current_tags := array_append(v_current_tags, 'Repeat Guest');
        END IF;
    END IF;

    -- Update customer record
    UPDATE public.customers
    SET
        total_spent = v_total_spent,
        outstanding_balance = v_outstanding,
        total_bookings = v_total_count,
        completed_bookings = v_completed_count,
        cancelled_bookings = v_cancelled_count,
        first_booking_date = v_first_date,
        last_booking_date = v_latest_date,
        upcoming_booking_date = v_upcoming_date,
        tags = v_current_tags,
        updated_at = NOW()
    WHERE id = p_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_customer_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_stats(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDENED GUEST BOOKING LOOKUP & CANCELLATION RPCs
-- ------------------------------------------------------------------------------

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
    v_cust_email TEXT;
    v_cust_phone_digits TEXT;
    v_booking RECORD;
    v_tour RECORD;
    v_customer RECORD;
    v_extras JSONB;
    v_masked_email TEXT;
    v_masked_phone TEXT;
    v_email_parts TEXT[];
BEGIN
    -- 1. Validate inputs
    IF p_reference IS NULL OR TRIM(p_reference) = '' THEN
        RETURN NULL;
    END IF;

    IF p_verification IS NULL OR TRIM(p_verification) = '' THEN
        RETURN NULL;
    END IF;

    v_clean_ref := UPPER(TRIM(p_reference));
    v_clean_contact := LOWER(TRIM(p_verification));
    v_digits_contact := REGEXP_REPLACE(p_verification, '[^0-9]', '', 'g');

    -- 2. Server-Side Rate Limiting against reference enumeration / brute-force
    BEGIN
        PERFORM public.check_atomic_rate_limit(
            'lookup_booking',
            v_clean_ref,
            INTERVAL '1 minute',
            10,
            'Too many verification attempts for this reservation. Please wait a moment.'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Re-raise rate limit exception
        RAISE;
    END;

    -- 3. Retrieve booking
    SELECT b.*
    INTO v_booking
    FROM public.bookings b
    WHERE b.booking_reference = v_clean_ref;

    IF NOT FOUND THEN
        -- Constant-time style behavior: Return NULL without revealing whether reference exists
        RETURN NULL;
    END IF;

    -- Retrieve associated customer
    SELECT c.*
    INTO v_customer
    FROM public.customers c
    WHERE c.id = v_booking.customer_id;

    IF v_customer.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- 4. Strict Exact Credential Matching (Reject partial / suffix substring matching)
    v_cust_email := LOWER(TRIM(COALESCE(v_customer.email, '')));
    v_cust_phone_digits := REGEXP_REPLACE(COALESCE(v_customer.phone, ''), '[^0-9]', '', 'g');

    -- Match Condition:
    -- (a) Exact Email Match (case-insensitive normalized)
    -- (b) OR Exact Full Phone Number Match (minimum 8 digits, exact normalized digit equality or standard international format)
    IF v_cust_email = v_clean_contact THEN
        -- Valid Email Match
        NULL;
    ELSIF LENGTH(v_digits_contact) >= 8 AND (
        -- Direct equality of digits
        v_cust_phone_digits = v_digits_contact
        -- OR match without leading '0' / international trunk (e.g., +20 1515... vs 01515...)
        OR (v_digits_contact ~ '^20' AND SUBSTRING(v_digits_contact FROM 3) = v_cust_phone_digits)
        OR (v_cust_phone_digits ~ '^20' AND SUBSTRING(v_cust_phone_digits FROM 3) = v_digits_contact)
    ) THEN
        -- Valid Full Phone Match
        NULL;
    ELSE
        -- Verification failed: Return NULL immediately
        RETURN NULL;
    END IF;

    -- 5. Retrieve Tour metadata
    SELECT t.title, t.slug, t.departure_time, t.duration, t.pickup_info, d.name AS destination_name
    INTO v_tour
    FROM public.tours t
    LEFT JOIN public.destinations d ON d.id = t.destination_id
    WHERE t.id = v_booking.tour_id;

    -- 6. Aggregate booked extras
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'name', be.name,
                'quantity', be.quantity,
                'total_price', be.total_price,
                'pricing_type', be.pricing_type
            )
        ),
        '[]'::jsonb
    )
    INTO v_extras
    FROM public.booking_extras be
    WHERE be.booking_id = v_booking.id;

    -- 7. Mask sensitive customer email and phone
    IF POSITION('@' IN v_customer.email) > 0 THEN
        v_email_parts := string_to_array(v_customer.email, '@');
        IF LENGTH(v_email_parts[1]) > 2 THEN
            v_masked_email := SUBSTRING(v_email_parts[1] FROM 1 FOR 1) || '***' || SUBSTRING(v_email_parts[1] FROM LENGTH(v_email_parts[1]) FOR 1) || '@' || v_email_parts[2];
        ELSE
            v_masked_email := '***@' || v_email_parts[2];
        END IF;
    ELSE
        v_masked_email := '***';
    END IF;

    IF LENGTH(v_customer.phone) > 4 THEN
        v_masked_phone := '***' || SUBSTRING(v_customer.phone FROM (LENGTH(v_customer.phone) - 3));
    ELSE
        v_masked_phone := '***';
    END IF;

    -- 8. Return sanitized public projection strictly for voucher display
    RETURN jsonb_build_object(
        'found', true,
        'bookingReference', v_booking.booking_reference,
        'status', v_booking.status,
        'bookingDate', v_booking.booking_date,
        'guests', jsonb_build_object(
            'adults', v_booking.adult_count,
            'children', v_booking.child_count,
            'infants', v_booking.infant_count,
            'total', v_booking.adult_count + v_booking.child_count + v_booking.infant_count
        ),
        'tour', jsonb_build_object(
            'title', COALESCE(v_tour.title, 'Red Sea Excursion'),
            'slug', v_tour.slug,
            'destination', COALESCE(v_tour.destination_name, 'Hurghada'),
            'departureTime', COALESCE(v_tour.departure_time, '08:30 AM'),
            'duration', v_tour.duration
        ),
        'pickup', jsonb_build_object(
            'hotelName', v_booking.pickup_hotel_name,
            'roomNumber', v_booking.pickup_room_number,
            'pickupTime', v_booking.pickup_time,
            'pickupStatus', COALESCE(v_booking.pickup_status, 'Waiting')
        ),
        'pricing', jsonb_build_object(
            'subtotal', v_booking.subtotal,
            'extrasTotal', v_booking.extras_total,
            'discount', v_booking.discount,
            'total', v_booking.total,
            'currency', v_booking.currency,
            'paymentStatus', v_booking.payment_status,
            'paymentMethod', v_booking.payment_method
        ),
        'customer', jsonb_build_object(
            'firstName', v_customer.first_name,
            'lastNameInitial', SUBSTRING(COALESCE(v_customer.last_name, ' ') FROM 1 FOR 1) || '.',
            'maskedEmail', v_masked_email,
            'maskedPhone', v_masked_phone,
            'country', v_customer.country
        ),
        'extras', v_extras,
        'specialRequests', v_booking.special_requests,
        'createdAt', v_booking.created_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_booking_secure(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_booking_secure(TEXT, TEXT) TO anon, authenticated, service_role;

-- Secure Guest Cancellation Request RPC
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
    v_cust_email TEXT;
    v_cust_phone_digits TEXT;
    v_booking RECORD;
    v_customer RECORD;
BEGIN
    IF p_reference IS NULL OR TRIM(p_reference) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking reference is required.');
    END IF;

    IF p_verification IS NULL OR TRIM(p_verification) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer email or phone is required for verification.');
    END IF;

    v_clean_ref := UPPER(TRIM(p_reference));
    v_clean_contact := LOWER(TRIM(p_verification));
    v_digits_contact := REGEXP_REPLACE(p_verification, '[^0-9]', '', 'g');

    -- Rate limiting against cancellation abuse
    BEGIN
        PERFORM public.check_atomic_rate_limit(
            'cancel_booking',
            v_clean_ref,
            INTERVAL '1 minute',
            5,
            'Too many requests submitted for this reservation. Please wait a moment.'
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE;
    END;

    SELECT b.*
    INTO v_booking
    FROM public.bookings b
    WHERE b.booking_reference = v_clean_ref;

    -- Return uniform non-revealing error
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation details could not be verified.');
    END IF;

    SELECT c.*
    INTO v_customer
    FROM public.customers c
    WHERE c.id = v_booking.customer_id;

    IF v_customer.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation details could not be verified.');
    END IF;

    -- Verify credentials strictly
    v_cust_email := LOWER(TRIM(COALESCE(v_customer.email, '')));
    v_cust_phone_digits := REGEXP_REPLACE(COALESCE(v_customer.phone, ''), '[^0-9]', '', 'g');

    IF v_cust_email = v_clean_contact THEN
        NULL;
    ELSIF LENGTH(v_digits_contact) >= 8 AND (
        v_cust_phone_digits = v_digits_contact
        OR (v_digits_contact ~ '^20' AND SUBSTRING(v_digits_contact FROM 3) = v_cust_phone_digits)
        OR (v_cust_phone_digits ~ '^20' AND SUBSTRING(v_cust_phone_digits FROM 3) = v_digits_contact)
    ) THEN
        NULL;
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Reservation details could not be verified.');
    END IF;

    IF v_booking.status IN ('cancelled', 'completed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'This reservation is already ' || v_booking.status || '.');
    END IF;

    -- Update booking status to cancellation_requested
    UPDATE public.bookings
    SET status = 'cancellation_requested',
        cancellation_reason = COALESCE(TRIM(p_reason), 'Guest requested online cancellation'),
        updated_at = NOW()
    WHERE id = v_booking.id;

    -- Audit log
    INSERT INTO public.audit_logs (
        action,
        entity_type,
        entity_id,
        old_data,
        new_data
    ) VALUES (
        'BOOKING_CANCELLATION_REQUESTED',
        'booking',
        v_booking.id::text,
        jsonb_build_object('status', v_booking.status),
        jsonb_build_object('status', 'cancellation_requested', 'reason', p_reason)
    );

    RETURN jsonb_build_object(
        'success', true,
        'bookingReference', v_booking.booking_reference,
        'status', 'cancellation_requested',
        'message', 'Cancellation request submitted successfully. Our pier desk will process your voucher confirmation shortly.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.request_booking_cancellation_secure(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_booking_cancellation_secure(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. HARDENED ATOMIC BOOKING CREATION & CAPACITY LOCKING
-- ------------------------------------------------------------------------------

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
    v_extra_qty INT;
    v_pickup_fee NUMERIC(10,2) := 0.00;
    v_coupon RECORD;
    v_current_user_id UUID := auth.uid();
    v_initial_status TEXT := 'pending';
    v_initial_payment_status TEXT := 'pending';
    v_existing_dup RECORD;
    v_default_capacity INT;
BEGIN
    -- 1. Input Validation
    IF p_adult_count IS NULL OR p_adult_count < 1 OR p_adult_count > 50 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Adult passenger count must be between 1 and 50.');
    END IF;

    IF p_child_count < 0 OR p_child_count > 50 OR p_infant_count < 0 OR p_infant_count > 50 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid child or infant passenger counts.');
    END IF;

    IF p_booking_date IS NULL OR p_booking_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Departure date cannot be in the past.');
    END IF;

    IF p_customer_email IS NULL OR TRIM(p_customer_email) = '' OR TRIM(p_customer_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'A valid customer email address is required.');
    END IF;

    IF p_customer_first_name IS NULL OR TRIM(p_customer_first_name) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer first name is required.');
    END IF;

    v_total_guests := p_adult_count + COALESCE(p_child_count, 0) + COALESCE(p_infant_count, 0);
    IF v_total_guests > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Total party size exceeds maximum online booking limit.');
    END IF;

    -- 2. Identify Tour (by UUID or slug)
    IF p_tour_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT * INTO v_tour FROM public.tours WHERE id = p_tour_identifier::UUID AND status = 'published';
    ELSE
        SELECT * INTO v_tour FROM public.tours WHERE slug = p_tour_identifier AND status = 'published';
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tour excursion not found or not currently published.');
    END IF;

    -- 3. Idempotency & Duplicate Submission Prevention
    -- If identical reservation submitted within 60 seconds by same email/tour/date/guests, return existing
    SELECT b.id, b.booking_reference, b.status, b.payment_status, b.total
    INTO v_existing_dup
    FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.tour_id = v_tour.id
      AND b.booking_date = p_booking_date
      AND LOWER(TRIM(c.email)) = LOWER(TRIM(p_customer_email))
      AND b.adult_count = p_adult_count
      AND b.child_count = COALESCE(p_child_count, 0)
      AND b.created_at > (NOW() - INTERVAL '60 seconds');

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'bookingId', v_existing_dup.id,
            'bookingReference', v_existing_dup.booking_reference,
            'status', v_existing_dup.status,
            'paymentStatus', v_existing_dup.payment_status,
            'totalEur', v_existing_dup.total,
            'bookingDate', p_booking_date,
            'isDuplicate', true
        );
    END IF;

    -- 4. Atomic Capacity & Concurrency Lock (Safely handles missing availability records)
    v_default_capacity := GREATEST(1, COALESCE(v_tour.max_guests, 20));

    -- Upsert availability row if missing, ensuring an atomic row lock target always exists
    INSERT INTO public.tour_availability (
        tour_id,
        date,
        max_capacity,
        booked_count,
        status,
        created_at,
        updated_at
    )
    VALUES (
        v_tour.id,
        p_booking_date,
        v_default_capacity,
        0,
        'available',
        NOW(),
        NOW()
    )
    ON CONFLICT (tour_id, date) DO UPDATE
    SET updated_at = NOW()
    RETURNING * INTO v_avail;

    -- Lock the row for update to prevent concurrent double-booking
    SELECT * INTO v_avail
    FROM public.tour_availability
    WHERE id = v_avail.id
    FOR UPDATE;

    -- Validate capacity against authoritative record
    IF v_avail.status IN ('sold_out', 'unavailable') OR (v_avail.booked_count + v_total_guests > v_avail.max_capacity) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This excursion departure date is sold out or has insufficient remaining capacity for ' || v_total_guests || ' guests.'
        );
    END IF;

    -- 5. Authoritative Server-Side Base Pricing Calculation
    v_subtotal := (p_adult_count * v_tour.price) + 
                  (COALESCE(p_child_count, 0) * COALESCE(v_tour.child_price, v_tour.price * 0.5));

    -- 6. Pickup Transfer Calculation
    IF p_pickup_location_id IS NOT NULL AND p_pickup_location_id != '' THEN
        IF p_pickup_location_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            SELECT fee_eur_per_person, fee_eur_flat INTO v_extra_record
            FROM public.pickup_locations WHERE id = p_pickup_location_id::UUID;
        ELSE
            SELECT fee_eur_per_person, fee_eur_flat INTO v_extra_record
            FROM public.pickup_locations WHERE code = p_pickup_location_id;
        END IF;

        IF FOUND THEN
            v_pickup_fee := (v_total_guests * COALESCE(v_extra_record.fee_eur_per_person, 0.00)) + COALESCE(v_extra_record.fee_eur_flat, 0.00);
            v_subtotal := v_subtotal + v_pickup_fee;
        END IF;
    END IF;

    -- 7. Extras Calculation & Validation
    IF p_extras IS NOT NULL AND jsonb_typeof(p_extras) = 'array' AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            v_extra_qty := GREATEST(1, COALESCE((v_extra_item->>'quantity')::INT, 1));
            
            IF (v_extra_item->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                SELECT * INTO v_extra_record FROM public.tour_extras WHERE id = (v_extra_item->>'id')::UUID;
            ELSE
                SELECT * INTO v_extra_record FROM public.tour_extras WHERE name = (v_extra_item->>'name');
            END IF;

            IF FOUND THEN
                IF v_extra_record.pricing_type = 'per_person' THEN
                    v_extras_total := v_extras_total + (v_extra_record.price_eur * v_total_guests * v_extra_qty);
                ELSE
                    v_extras_total := v_extras_total + (v_extra_record.price_eur * v_extra_qty);
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 8. Coupon Code Validation (Server-Side)
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
        SELECT * INTO v_coupon
        FROM public.coupons
        WHERE code = UPPER(TRIM(p_coupon_code))
          AND is_active = TRUE
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

        IF FOUND THEN
            IF v_coupon.discount_type = 'percentage' THEN
                v_discount := ROUND((v_subtotal * (v_coupon.discount_value / 100.0)), 2);
            ELSIF v_coupon.discount_type = 'fixed' THEN
                v_discount := LEAST(v_subtotal, v_coupon.discount_value);
            END IF;
        END IF;
    END IF;

    v_final_total := GREATEST(0.00, v_subtotal + v_extras_total - v_discount);

    -- 9. Authoritative Customer Record Association
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_customer_email))
    LIMIT 1;

    IF v_customer_id IS NULL THEN
        INSERT INTO public.customers (
            first_name, last_name, email, phone, country, hotel, source
        )
        VALUES (
            TRIM(p_customer_first_name),
            TRIM(p_customer_last_name),
            LOWER(TRIM(p_customer_email)),
            TRIM(p_customer_phone),
            COALESCE(p_customer_country, 'International'),
            p_customer_hotel,
            'Online Checkout'
        )
        RETURNING id INTO v_customer_id;
    ELSE
        UPDATE public.customers
        SET phone = COALESCE(NULLIF(TRIM(p_customer_phone), ''), phone),
            hotel = COALESCE(NULLIF(p_customer_hotel, ''), hotel),
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    -- 10. Generate Authoritative Unpredictable Booking Reference
    v_booking_ref := 'RST-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));

    -- 11. Insert Authoritative Booking Record
    INSERT INTO public.bookings (
        booking_reference, user_id, tour_id, customer_id, booking_date, status, payment_status,
        payment_method, adult_count, child_count, infant_count, pickup_location_id,
        pickup_hotel_name, pickup_room_number, subtotal, extras_total, discount, total,
        currency, special_requests
    )
    VALUES (
        v_booking_ref, v_current_user_id, v_tour.id, v_customer_id, p_booking_date, v_initial_status,
        v_initial_payment_status, p_payment_method, p_adult_count,
        COALESCE(p_child_count, 0), COALESCE(p_infant_count, 0),
        (CASE WHEN p_pickup_location_id IS NOT NULL AND p_pickup_location_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_pickup_location_id::UUID ELSE NULL END),
        p_customer_hotel, p_pickup_room_number, v_subtotal, v_extras_total, v_discount, v_final_total,
        'EUR', p_special_requests
    )
    RETURNING id INTO v_booking_id;

    -- 12. Persist Booking Extras
    IF p_extras IS NOT NULL AND jsonb_typeof(p_extras) = 'array' AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            v_extra_qty := GREATEST(1, COALESCE((v_extra_item->>'quantity')::INT, 1));
            
            IF (v_extra_item->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                SELECT * INTO v_extra_record FROM public.tour_extras WHERE id = (v_extra_item->>'id')::UUID;
            ELSE
                SELECT * INTO v_extra_record FROM public.tour_extras WHERE name = (v_extra_item->>'name');
            END IF;

            IF FOUND THEN
                INSERT INTO public.booking_extras (
                    booking_id, extra_id, name, quantity, unit_price, total_price, pricing_type
                )
                VALUES (
                    v_booking_id,
                    v_extra_record.id,
                    v_extra_record.name,
                    v_extra_qty,
                    v_extra_record.price_eur,
                    (v_extra_record.price_eur * v_extra_qty),
                    v_extra_record.pricing_type
                );
            END IF;
        END LOOP;
    END IF;

    -- 13. Create Lead Passenger Record
    INSERT INTO public.booking_passengers (
        booking_id, full_name, passenger_type, is_lead
    )
    VALUES (
        v_booking_id,
        TRIM(p_customer_first_name || ' ' || p_customer_last_name),
        'adult',
        TRUE
    );

    -- Additional Adult Passengers
    IF p_adult_count > 1 THEN
        FOR i IN 2..p_adult_count LOOP
            INSERT INTO public.booking_passengers (booking_id, full_name, passenger_type, is_lead)
            VALUES (v_booking_id, 'Adult Guest ' || i || ' (' || TRIM(p_customer_last_name) || ')', 'adult', FALSE);
        END LOOP;
    END IF;

    -- Child Passengers
    IF p_child_count > 0 THEN
        FOR i IN 1..p_child_count LOOP
            INSERT INTO public.booking_passengers (booking_id, full_name, passenger_type, is_lead)
            VALUES (v_booking_id, 'Child Guest ' || i || ' (' || TRIM(p_customer_last_name) || ')', 'child', FALSE);
        END LOOP;
    END IF;

    -- Infant Passengers
    IF p_infant_count > 0 THEN
        FOR i IN 1..p_infant_count LOOP
            INSERT INTO public.booking_passengers (booking_id, full_name, passenger_type, is_lead)
            VALUES (v_booking_id, 'Infant Guest ' || i || ' (' || TRIM(p_customer_last_name) || ')', 'infant', FALSE);
        END LOOP;
    END IF;

    -- 14. Update Availability Booked Count Atomically
    UPDATE public.tour_availability
    SET booked_count = booked_count + v_total_guests,
        status = CASE WHEN (booked_count + v_total_guests) >= max_capacity THEN 'sold_out' ELSE status END,
        updated_at = NOW()
    WHERE id = v_avail.id;

    -- 15. Audit Log
    INSERT INTO public.audit_logs (
        action, entity_type, entity_id, new_data
    )
    VALUES (
        'BOOKING_CREATED_ONLINE',
        'booking',
        v_booking_id::TEXT,
        jsonb_build_object(
            'reference', v_booking_ref,
            'tourId', v_tour.id,
            'date', p_booking_date,
            'guests', v_total_guests,
            'total', v_final_total
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', v_booking_id,
        'bookingReference', v_booking_ref,
        'status', v_initial_status,
        'paymentStatus', v_initial_payment_status,
        'totalEur', v_final_total,
        'bookingDate', p_booking_date
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. COVERING FOREIGN KEY INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON public.bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_booking_id ON public.payment_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_refund_records_booking_id ON public.refund_records(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking_id ON public.booking_passengers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_extras_booking_id ON public.booking_extras(booking_id);
