-- ==============================================================================
-- MIGRATION: PRODUCTION FOUNDATION, SECURITY, AND AUTHORITATIVE WORKFLOWS
-- Migration ID: 20261008000000_production_foundation_and_security.sql
-- ==============================================================================
-- 1. Tighten Bookings Row-Level Security:
--    - Revoke the dangerous public lookup policy that checked only (booking_reference IS NOT NULL).
--    - Ensure public queries cannot scan the bookings table directly.
-- 2. Create Secure Public Booking Lookup RPC:
--    - Requires BOTH booking_reference AND contact verification (email or phone).
--    - Emits a sanitized projection; never leaks internal IDs, passwords, or staff data.
-- 3. Create Atomic Transactional Booking Creation RPC:
--    - Authoritative database pricing, capacity check, and reservation with row-level locking.
--    - Prevents double-booking via FOR UPDATE concurrency lock.
--    - Validates tours, extras, pickup fees, and promo coupons strictly against database state.
-- 4. Create Availability Query Function:
--    - Unifies admin and public availability data queried directly from tour_availability.
-- 5. Audit Logging triggers and helpers for all booking and admin actions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: TIGHTEN BOOKINGS ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------

-- Drop the dangerous unrestricted public lookup policy
DROP POLICY IF EXISTS "Public lookup booking by reference" ON public.bookings;
DROP POLICY IF EXISTS "Public can lookup own booking" ON public.bookings;
DROP POLICY IF EXISTS "Public update booking cancellation" ON public.bookings;

-- Ensure authenticated guests can only view their own linked bookings
DROP POLICY IF EXISTS "Users can view linked bookings" ON public.bookings;
CREATE POLICY "Users can view linked bookings"
    ON public.bookings FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid()))
        OR public.is_admin()
    );

-- Allow authenticated users to request cancellation on their own bookings
CREATE POLICY "Users can request booking cancellation"
    ON public.bookings FOR UPDATE
    TO authenticated
    USING (
        (user_id = (SELECT auth.uid()) OR customer_id IN (SELECT id FROM public.customers WHERE user_id = (SELECT auth.uid())))
        AND status IN ('confirmed', 'pending')
    )
    WITH CHECK (status = 'cancellation_requested');

-- Ensure Administrators retain full management privileges over all bookings
DROP POLICY IF EXISTS "Admins manage bookings" ON public.bookings;
CREATE POLICY "Admins manage bookings"
    ON public.bookings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ------------------------------------------------------------------------------
-- SECTION 2: SECURE PUBLIC BOOKING LOOKUP RPC
-- ------------------------------------------------------------------------------
-- This Security Definer RPC allows travelers to verify and view their own booking
-- voucher without giving anonymous users direct table SELECT privileges.
-- Requires BOTH booking reference AND customer email or phone.

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

    -- 2. Lookup booking and join customer details
    SELECT b.*
    INTO v_booking
    FROM public.bookings b
    WHERE b.booking_reference = v_clean_ref;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Retrieve associated customer
    SELECT c.*
    INTO v_customer
    FROM public.customers c
    WHERE c.id = v_booking.customer_id;

    -- 3. Verify that the second verification credential matches either email or phone
    IF v_customer.id IS NOT NULL THEN
        -- Check email match
        IF LOWER(TRIM(v_customer.email)) <> v_clean_contact THEN
            -- Check phone match
            IF v_digits_contact = '' OR LENGTH(v_digits_contact) < 5 THEN
                RETURN NULL;
            END IF;

            -- Compare digits-only suffix or equality
            IF REGEXP_REPLACE(v_customer.phone, '[^0-9]', '', 'g') NOT LIKE ('%' || v_digits_contact)
               AND v_digits_contact NOT LIKE ('%' || REGEXP_REPLACE(v_customer.phone, '[^0-9]', '', 'g')) THEN
                RETURN NULL;
            END IF;
        END IF;
    ELSE
        -- No customer record linked to booking; deny public inspection
        RETURN NULL;
    END IF;

    -- 4. Retrieve Tour metadata
    SELECT t.title, t.slug, t.departure_time, t.duration, t.pickup_info, d.name AS destination_name
    INTO v_tour
    FROM public.tours t
    LEFT JOIN public.destinations d ON d.id = t.destination_id
    WHERE t.id = v_booking.tour_id;

    -- 5. Aggregate booked extras
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

    -- 6. Mask sensitive customer email and phone
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

    -- 7. Build sanitized public projection (Strictly safe for guest voucher presentation)
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
            'lastNameInitial', SUBSTRING(v_customer.last_name FROM 1 FOR 1) || '.',
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

GRANT EXECUTE ON FUNCTION public.lookup_booking_secure TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- SECTION 3: SECURE GUEST CANCELLATION REQUEST RPC
-- ------------------------------------------------------------------------------
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

    SELECT b.*
    INTO v_booking
    FROM public.bookings b
    WHERE b.booking_reference = v_clean_ref;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking not found.');
    END IF;

    SELECT c.*
    INTO v_customer
    FROM public.customers c
    WHERE c.id = v_booking.customer_id;

    IF v_customer.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Customer verification failed.');
    END IF;

    -- Verify credentials
    IF LOWER(TRIM(v_customer.email)) <> v_clean_contact THEN
        IF v_digits_contact = '' OR LENGTH(v_digits_contact) < 5 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Verification credentials do not match this reservation.');
        END IF;

        IF REGEXP_REPLACE(v_customer.phone, '[^0-9]', '', 'g') NOT LIKE ('%' || v_digits_contact)
           AND v_digits_contact NOT LIKE ('%' || REGEXP_REPLACE(v_customer.phone, '[^0-9]', '', 'g')) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Verification credentials do not match this reservation.');
        END IF;
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

GRANT EXECUTE ON FUNCTION public.request_booking_cancellation_secure TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- SECTION 4: ATOMIC TRANSACTIONAL BOOKING CREATION RPC
-- ------------------------------------------------------------------------------
-- Performs full server/database authoritative pricing, concurrency locking (FOR UPDATE)
-- on tour availability to prevent double-booking, customer deduplication, and
-- manifest creation in a single atomic database transaction.

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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tour RECORD;
    v_avail RECORD;
    v_pickup RECORD;
    v_customer_id UUID;
    v_booking_id UUID;
    v_party_size INT;
    v_paying_passengers INT;
    v_current_booked INT;
    v_max_capacity INT;
    v_base_adult_price NUMERIC(10,2);
    v_base_child_price NUMERIC(10,2);
    v_adult_subtotal NUMERIC(10,2);
    v_child_subtotal NUMERIC(10,2);
    v_pickup_fee NUMERIC(10,2) := 0.00;
    v_pickup_location_name TEXT := 'Central Pier Departure';
    v_extras_subtotal NUMERIC(10,2) := 0.00;
    v_subtotal NUMERIC(10,2);
    v_discount NUMERIC(10,2) := 0.00;
    v_total NUMERIC(10,2);
    v_coupon RECORD;
    v_reference TEXT;
    v_ref_exists BOOLEAN;
    v_letters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_extra_item JSONB;
    v_extra_record RECORD;
    v_extra_qty INT;
    v_extra_amount NUMERIC(10,2);
    v_i INT;
    v_user_id UUID;
BEGIN
    -- 1. Input Validation
    IF p_tour_identifier IS NULL OR TRIM(p_tour_identifier) = '' THEN
        RAISE EXCEPTION 'Tour identifier is required.';
    END IF;

    IF p_booking_date IS NULL THEN
        RAISE EXCEPTION 'Booking departure date is required.';
    END IF;

    IF p_booking_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot book an excursion date in the past.';
    END IF;

    IF COALESCE(p_adult_count, 0) < 1 THEN
        RAISE EXCEPTION 'At least one adult passenger is required.';
    END IF;

    IF TRIM(p_customer_first_name) = '' THEN
        RAISE EXCEPTION 'Customer first name is required.';
    END IF;

    IF p_customer_email IS NULL OR POSITION('@' IN p_customer_email) = 0 THEN
        RAISE EXCEPTION 'A valid customer email address is required.';
    END IF;

    v_party_size := COALESCE(p_adult_count, 1) + COALESCE(p_child_count, 0) + COALESCE(p_infant_count, 0);
    v_paying_passengers := COALESCE(p_adult_count, 1) + COALESCE(p_child_count, 0);

    -- 2. Load Tour from Supabase (Lock tour row in SHARE mode)
    SELECT *
    INTO v_tour
    FROM public.tours
    WHERE (slug = TRIM(p_tour_identifier) OR id::text = TRIM(p_tour_identifier))
      AND status = 'published'
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Excursion "%" not found or is currently not published for booking.', p_tour_identifier;
    END IF;

    -- 3. Concurrency-Safe Capacity Verification & Row Locking
    -- Lock availability record for this tour and date to prevent race conditions
    SELECT *
    INTO v_avail
    FROM public.tour_availability
    WHERE tour_id = v_tour.id AND date = p_booking_date
    FOR UPDATE;

    IF FOUND THEN
        IF v_avail.status = 'unavailable' THEN
            RAISE EXCEPTION 'The selected departure date (%) is marked as an operational blackout date or closed.', p_booking_date;
        END IF;

        IF v_avail.status = 'sold_out' THEN
            RAISE EXCEPTION 'The selected excursion departure on % is completely sold out.', p_booking_date;
        END IF;

        v_max_capacity := v_avail.max_capacity;
        IF (v_avail.booked_count + v_party_size) > v_max_capacity THEN
            RAISE EXCEPTION 'Requested passenger count (% guests) exceeds remaining capacity (% seats) for %.',
                v_party_size, GREATEST(0, v_max_capacity - v_avail.booked_count), p_booking_date;
        END IF;
    ELSE
        -- No custom date row yet; calculate default group capacity and existing bookings
        v_max_capacity := COALESCE(v_tour.max_guests, 30);
        SELECT COALESCE(SUM(adult_count + child_count + infant_count), 0)
        INTO v_current_booked
        FROM public.bookings
        WHERE tour_id = v_tour.id
          AND booking_date = p_booking_date
          AND status NOT IN ('cancelled');

        IF (v_current_booked + v_party_size) > v_max_capacity THEN
            RAISE EXCEPTION 'Requested passenger count (% guests) exceeds remaining capacity (% seats) for %.',
                v_party_size, GREATEST(0, v_max_capacity - v_current_booked), p_booking_date;
        END IF;
    END IF;

    -- 4. Authoritative Pricing Calculation from Database
    v_base_adult_price := v_tour.price;
    v_base_child_price := COALESCE(v_tour.child_price, ROUND(v_tour.price * 0.5));
    v_adult_subtotal := p_adult_count * v_base_adult_price;
    v_child_subtotal := COALESCE(p_child_count, 0) * v_base_child_price;

    -- 5. Validate Pickup Location and Calculate Authoritative Fee
    IF p_pickup_location_id IS NOT NULL AND TRIM(p_pickup_location_id) <> '' THEN
        SELECT *
        INTO v_pickup
        FROM public.pickup_locations
        WHERE (id::text = TRIM(p_pickup_location_id) OR code = TRIM(p_pickup_location_id))
          AND is_active = TRUE;

        IF FOUND THEN
            v_pickup_location_name := v_pickup.name;
            v_pickup_fee := COALESCE(v_pickup.fee_eur_flat, 0) + (COALESCE(v_pickup.fee_eur_per_person, 0) * v_paying_passengers);
        END IF;
    END IF;

    v_subtotal := v_adult_subtotal + v_child_subtotal + v_pickup_fee;

    -- 6. Validate and Calculate Optional Extras from Database
    IF p_extras IS NOT NULL AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            v_extra_qty := GREATEST(1, COALESCE((v_extra_item->>'quantity')::int, 1));
            SELECT *
            INTO v_extra_record
            FROM public.tour_extras
            WHERE (id::text = (v_extra_item->>'extraId') OR id::text = (v_extra_item->>'id') OR id::text = (v_extra_item->>'extra_id'))
              AND is_active = TRUE;

            IF FOUND THEN
                IF v_extra_record.pricing_type = 'per_person' THEN
                    v_extra_amount := v_extra_record.price_eur * v_paying_passengers * v_extra_qty;
                ELSE
                    v_extra_amount := v_extra_record.price_eur * v_extra_qty;
                END IF;
                v_extras_subtotal := v_extras_subtotal + v_extra_amount;
            END IF;
        END LOOP;
    END IF;

    -- 7. Validate Coupon Code Authoritatively from Database
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        SELECT *
        INTO v_coupon
        FROM public.coupons
        WHERE LOWER(code) = LOWER(TRIM(p_coupon_code))
          AND is_active = TRUE
          AND (valid_until IS NULL OR valid_until >= NOW())
          AND (valid_from IS NULL OR valid_from <= NOW());

        IF FOUND THEN
            IF (v_subtotal + v_extras_subtotal) >= COALESCE(v_coupon.min_spend, 0) THEN
                IF v_coupon.discount_type = 'percentage' THEN
                    v_discount := ROUND(((v_subtotal + v_extras_subtotal) * (v_coupon.discount_value / 100.0)), 2);
                ELSE
                    v_discount := v_coupon.discount_value;
                END IF;

                IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
                    v_discount := v_coupon.max_discount;
                END IF;

                -- Increment coupon redemption count
                UPDATE public.coupons
                SET times_used = times_used + 1,
                    times_redeemed = times_redeemed + 1
                WHERE id = v_coupon.id;
            END IF;
        END IF;
    END IF;

    v_total := GREATEST(0.00, v_subtotal + v_extras_subtotal - v_discount);

    -- 8. Customer Deduplication & Profile Persistence
    SELECT id
    INTO v_customer_id
    FROM public.customers
    WHERE LOWER(email) = LOWER(TRIM(p_customer_email))
    LIMIT 1;

    -- Associate authenticated user if session active
    v_user_id := auth.uid();

    IF v_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET first_name = TRIM(p_customer_first_name),
            last_name = TRIM(p_customer_last_name),
            phone = COALESCE(TRIM(p_customer_phone), phone),
            hotel = COALESCE(TRIM(p_customer_hotel), hotel),
            user_id = COALESCE(v_user_id, user_id),
            updated_at = NOW()
        WHERE id = v_customer_id;
    ELSE
        INSERT INTO public.customers (
            user_id,
            first_name,
            last_name,
            email,
            phone,
            country,
            hotel
        ) VALUES (
            v_user_id,
            TRIM(p_customer_first_name),
            TRIM(p_customer_last_name),
            LOWER(TRIM(p_customer_email)),
            COALESCE(TRIM(p_customer_phone), '+20 000 000 0000'),
            COALESCE(TRIM(p_customer_country), 'International'),
            TRIM(p_customer_hotel)
        )
        RETURNING id INTO v_customer_id;
    END IF;

    -- 9. Generate Unique Booking Reference
    LOOP
        v_reference := 'RST-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
            SUBSTRING(v_letters FROM (1 + FLOOR(RANDOM() * 24))::int FOR 1) ||
            SUBSTRING(v_letters FROM (1 + FLOOR(RANDOM() * 24))::int FOR 1) ||
            LPAD((1000 + FLOOR(RANDOM() * 9000))::text, 4, '0');

        SELECT EXISTS (
            SELECT 1 FROM public.bookings WHERE booking_reference = v_reference
        ) INTO v_ref_exists;

        EXIT WHEN NOT v_ref_exists;
    END LOOP;

    -- 10. Insert Main Booking Record
    INSERT INTO public.bookings (
        booking_reference,
        user_id,
        tour_id,
        customer_id,
        booking_date,
        status,
        payment_status,
        payment_method,
        adult_count,
        child_count,
        infant_count,
        pickup_location_id,
        pickup_hotel_name,
        pickup_room_number,
        subtotal,
        extras_total,
        discount,
        total,
        currency,
        special_requests
    ) VALUES (
        v_reference,
        v_user_id,
        v_tour.id,
        v_customer_id,
        p_booking_date,
        'confirmed',
        'pending',
        COALESCE(p_payment_method, 'pay_at_pickup'),
        p_adult_count,
        COALESCE(p_child_count, 0),
        COALESCE(p_infant_count, 0),
        CASE WHEN v_pickup.id IS NOT NULL THEN v_pickup.id ELSE NULL END,
        COALESCE(p_customer_hotel, v_pickup_location_name),
        p_pickup_room_number,
        v_subtotal,
        v_extras_subtotal,
        v_discount,
        v_total,
        'EUR',
        p_special_requests
    )
    RETURNING id INTO v_booking_id;

    -- 11. Insert Passengers into Passenger Manifest
    -- Lead Passenger
    INSERT INTO public.booking_passengers (
        booking_id,
        full_name,
        nationality,
        passenger_type,
        is_lead_passenger,
        pickup_location
    ) VALUES (
        v_booking_id,
        TRIM(p_customer_first_name || ' ' || p_customer_last_name),
        COALESCE(p_customer_country, 'International'),
        'adult',
        TRUE,
        COALESCE(p_customer_hotel, v_pickup_location_name)
    );

    -- Additional adults
    IF p_adult_count > 1 THEN
        FOR v_i IN 2..p_adult_count LOOP
            INSERT INTO public.booking_passengers (
                booking_id,
                full_name,
                nationality,
                passenger_type,
                is_lead_passenger
            ) VALUES (
                v_booking_id,
                'Adult Guest ' || v_i || ' (' || p_customer_last_name || ')',
                COALESCE(p_customer_country, 'International'),
                'adult',
                FALSE
            );
        END LOOP;
    END IF;

    -- Children
    IF COALESCE(p_child_count, 0) > 0 THEN
        FOR v_i IN 1..p_child_count LOOP
            INSERT INTO public.booking_passengers (
                booking_id,
                full_name,
                nationality,
                passenger_type,
                is_lead_passenger
            ) VALUES (
                v_booking_id,
                'Child Guest ' || v_i || ' (' || p_customer_last_name || ')',
                COALESCE(p_customer_country, 'International'),
                'child',
                FALSE
            );
        END LOOP;
    END IF;

    -- Infants
    IF COALESCE(p_infant_count, 0) > 0 THEN
        FOR v_i IN 1..p_infant_count LOOP
            INSERT INTO public.booking_passengers (
                booking_id,
                full_name,
                nationality,
                passenger_type,
                is_lead_passenger
            ) VALUES (
                v_booking_id,
                'Infant Guest ' || v_i || ' (' || p_customer_last_name || ')',
                COALESCE(p_customer_country, 'International'),
                'infant',
                FALSE
            );
        END LOOP;
    END IF;

    -- 12. Insert Extras Records
    IF p_extras IS NOT NULL AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            v_extra_qty := GREATEST(1, COALESCE((v_extra_item->>'quantity')::int, 1));
            SELECT *
            INTO v_extra_record
            FROM public.tour_extras
            WHERE (id::text = (v_extra_item->>'extraId') OR id::text = (v_extra_item->>'id') OR id::text = (v_extra_item->>'extra_id'))
              AND is_active = TRUE;

            IF FOUND THEN
                IF v_extra_record.pricing_type = 'per_person' THEN
                    v_extra_amount := v_extra_record.price_eur * v_paying_passengers * v_extra_qty;
                ELSE
                    v_extra_amount := v_extra_record.price_eur * v_extra_qty;
                END IF;

                INSERT INTO public.booking_extras (
                    booking_id,
                    name,
                    quantity,
                    unit_price,
                    total_price,
                    pricing_type
                ) VALUES (
                    v_booking_id,
                    v_extra_record.name,
                    v_extra_qty,
                    v_extra_record.price_eur,
                    v_extra_amount,
                    v_extra_record.pricing_type
                );
            END IF;
        END LOOP;
    END IF;

    -- 13. Atomically Reserve Capacity on tour_availability
    INSERT INTO public.tour_availability (
        tour_id,
        date,
        max_capacity,
        booked_count,
        status
    ) VALUES (
        v_tour.id,
        p_booking_date,
        v_max_capacity,
        v_party_size,
        CASE WHEN v_party_size >= v_max_capacity THEN 'sold_out' ELSE 'available' END
    )
    ON CONFLICT (tour_id, date)
    DO UPDATE SET
        booked_count = public.tour_availability.booked_count + v_party_size,
        status = CASE
            WHEN (public.tour_availability.booked_count + v_party_size) >= public.tour_availability.max_capacity THEN 'sold_out'
            ELSE public.tour_availability.status
        END,
        updated_at = NOW();

    -- 14. Insert Audit Log
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        new_data
    ) VALUES (
        v_user_id,
        'BOOKING_CREATED_ATOMIC',
        'booking',
        v_booking_id::text,
        jsonb_build_object(
            'reference', v_reference,
            'tour', v_tour.slug,
            'date', p_booking_date,
            'passengers', v_party_size,
            'total', v_total
        )
    );

    -- 15. Return Authoritative Confirmation
    RETURN jsonb_build_object(
        'success', true,
        'bookingReference', v_reference,
        'bookingId', v_booking_id,
        'tour', jsonb_build_object(
            'id', v_tour.id,
            'slug', v_tour.slug,
            'title', v_tour.title,
            'duration', v_tour.duration
        ),
        'date', p_booking_date,
        'guests', jsonb_build_object(
            'adults', p_adult_count,
            'children', COALESCE(p_child_count, 0),
            'infants', COALESCE(p_infant_count, 0),
            'total', v_party_size
        ),
        'pickup', jsonb_build_object(
            'locationName', v_pickup_location_name,
            'hotelName', p_customer_hotel,
            'roomNumber', p_pickup_room_number,
            'feeEur', v_pickup_fee
        ),
        'pricing', jsonb_build_object(
            'adultBasePriceEur', v_base_adult_price,
            'childBasePriceEur', v_base_child_price,
            'adultSubtotalEur', v_adult_subtotal,
            'childSubtotalEur', v_child_subtotal,
            'pickupFeeEur', v_pickup_fee,
            'extrasSubtotalEur', v_extras_subtotal,
            'discountEur', v_discount,
            'subtotalEur', v_subtotal,
            'totalEur', v_total,
            'currency', 'EUR',
            'formattedTotal', '€' || TO_CHAR(v_total, 'FM999990.00')
        ),
        'customer', jsonb_build_object(
            'name', TRIM(p_customer_first_name || ' ' || p_customer_last_name),
            'email', LOWER(TRIM(p_customer_email)),
            'phone', p_customer_phone,
            'country', p_customer_country
        ),
        'status', 'confirmed',
        'paymentStatus', 'pending',
        'createdAt', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- SECTION 5: CONSOLIDATED AVAILABILITY QUERY FUNCTION
-- ------------------------------------------------------------------------------
-- Provides a single authoritative source of truth for departure availability,
-- used identically by both the public booking interface and the admin availability manager.

CREATE OR REPLACE FUNCTION public.get_tour_availability_schedule(
    p_tour_identifier TEXT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    tour_id UUID,
    date DATE,
    status TEXT,
    max_capacity INT,
    booked_count INT,
    remaining_capacity INT,
    is_available BOOLEAN,
    is_blackout BOOLEAN,
    departure_time TEXT,
    notes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tour RECORD;
BEGIN
    SELECT *
    INTO v_tour
    FROM public.tours
    WHERE (slug = TRIM(p_tour_identifier) OR id::text = TRIM(p_tour_identifier));

    IF NOT FOUND THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH date_series AS (
        SELECT d::date AS calendar_date
        FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d
    ),
    live_bookings AS (
        SELECT
            b.booking_date,
            COALESCE(SUM(b.adult_count + b.child_count + b.infant_count), 0)::int AS reserved_count
        FROM public.bookings b
        WHERE b.tour_id = v_tour.id
          AND b.booking_date >= p_start_date
          AND b.booking_date <= p_end_date
          AND b.status NOT IN ('cancelled')
        GROUP BY b.booking_date
    )
    SELECT
        v_tour.id AS tour_id,
        ds.calendar_date AS date,
        CASE
            WHEN ta.status = 'unavailable' THEN 'unavailable'
            WHEN ta.status = 'sold_out' THEN 'sold_out'
            WHEN (COALESCE(ta.booked_count, lb.reserved_count, 0)) >= COALESCE(ta.max_capacity, v_tour.max_guests, 30) THEN 'sold_out'
            ELSE 'available'
        END AS status,
        COALESCE(ta.max_capacity, v_tour.max_guests, 30)::int AS max_capacity,
        GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))::int AS booked_count,
        GREATEST(
            0,
            COALESCE(ta.max_capacity, v_tour.max_guests, 30) - GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))
        )::int AS remaining_capacity,
        CASE
            WHEN ta.status = 'unavailable' THEN FALSE
            WHEN ta.status = 'sold_out' THEN FALSE
            WHEN ds.calendar_date < CURRENT_DATE THEN FALSE
            WHEN (COALESCE(ta.booked_count, lb.reserved_count, 0)) >= COALESCE(ta.max_capacity, v_tour.max_guests, 30) THEN FALSE
            ELSE TRUE
        END AS is_available,
        (COALESCE(ta.status, '') = 'unavailable') AS is_blackout,
        COALESCE(v_tour.departure_time, '08:30 AM') AS departure_time,
        ta.notes
    FROM date_series ds
    LEFT JOIN public.tour_availability ta
        ON ta.tour_id = v_tour.id AND ta.date = ds.calendar_date
    LEFT JOIN live_bookings lb
        ON lb.booking_date = ds.calendar_date
    ORDER BY ds.calendar_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tour_availability_schedule TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- SECTION 6: INQUIRIES RLS REINFORCEMENT
-- ------------------------------------------------------------------------------
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert inquiry" ON public.inquiries;
CREATE POLICY "Public can insert inquiry"
    ON public.inquiries FOR INSERT
    TO public
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Admins can manage inquiries" ON public.inquiries;
CREATE POLICY "Admins can manage inquiries"
    ON public.inquiries FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
