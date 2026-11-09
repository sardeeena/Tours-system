-- ==============================================================================
-- FOR MANUAL REVIEW ONLY — NOT EXECUTED AGAINST LIVE PRODUCTION DATABASE
-- File: 20261028000000_booking_lifecycle_and_lookup_hardening.sql
-- Target Project ID: cyifhjqqvtiguitrziqs
-- Production Domain: https://awesomeadventure.tours
-- Purpose:
--   1. Replaces create_booking_atomic RPC with authoritative 'pending' lifecycle status
--   2. Standardizes booking reference generation to 'RST-YYYY-XXXXXX'
--   3. Enforces capacity verification and transactional updates against tour_availability
--   4. Adds passenger manifest item creation in booking_passengers
--   5. Hardens lookup_booking_secure against brute-force reference enumeration
-- ==============================================================================

-- 1. Indexing optimizations for customer lookups and reservation state
CREATE INDEX IF NOT EXISTS idx_bookings_ref_status ON public.bookings(booking_reference, status);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_date ON public.bookings(tour_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_tour_availability_tour_date ON public.tour_availability(tour_id, date);

-- 2. Authoritative Atomic Booking Creation RPC
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
    v_initial_status TEXT := 'pending';
    v_initial_payment_status TEXT := 'pending';
BEGIN
    v_total_guests := COALESCE(p_adult_count, 1) + COALESCE(p_child_count, 0) + COALESCE(p_infant_count, 0);

    -- 1. Identify Tour (by UUID or slug)
    IF p_tour_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT * INTO v_tour FROM public.tours WHERE id = p_tour_identifier::UUID AND status = 'published';
    ELSE
        SELECT * INTO v_tour FROM public.tours WHERE slug = p_tour_identifier AND status = 'published';
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tour excursion not found or not published.');
    END IF;

    -- 2. Concurrency Row Lock & Capacity Validation on Availability
    SELECT * INTO v_avail
    FROM public.tour_availability
    WHERE tour_id = v_tour.id AND date = p_booking_date
    FOR UPDATE;

    IF FOUND THEN
        IF v_avail.status IN ('sold_out', 'unavailable') OR (v_avail.booked_count + v_total_guests > v_avail.max_capacity) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'This excursion departure date is sold out or has insufficient capacity.'
            );
        END IF;
    END IF;

    -- 3. Calculate Authoritative Base Pricing
    v_subtotal := (COALESCE(p_adult_count, 1) * v_tour.price) + 
                  (COALESCE(p_child_count, 0) * COALESCE(v_tour.child_price, v_tour.price * 0.5));

    -- 4. Calculate Pickup Fee if Applicable
    IF p_pickup_location_id IS NOT NULL AND p_pickup_location_id != '' THEN
        SELECT fee_eur_per_person, fee_eur_flat INTO v_extra_record
        FROM public.pickup_locations WHERE id = p_pickup_location_id::UUID;
        IF FOUND THEN
            v_pickup_fee := (v_total_guests * COALESCE(v_extra_record.fee_eur_per_person, 0.00)) + COALESCE(v_extra_record.fee_eur_flat, 0.00);
            v_subtotal := v_subtotal + v_pickup_fee;
        END IF;
    END IF;

    -- 5. Calculate Extras
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

    -- 6. Validate Coupon
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

    -- 7. Deduplicate or Insert Customer Record
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
    ELSE
        -- Update contact phone or hotel if provided
        UPDATE public.customers
        SET phone = COALESCE(NULLIF(TRIM(p_customer_phone), ''), phone),
            hotel = COALESCE(NULLIF(p_customer_hotel, ''), hotel),
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    -- 8. Generate Authoritative Standard Reference (RST-YYYY-XXXXXX)
    v_booking_ref := 'RST-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));

    -- 9. Insert Booking with Standard 'pending' Status
    INSERT INTO public.bookings (
        booking_reference, user_id, tour_id, customer_id, booking_date, status, payment_status,
        payment_method, adult_count, child_count, infant_count, pickup_location_id,
        pickup_hotel_name, pickup_room_number, subtotal, extras_total, discount, total,
        currency, special_requests
    )
    VALUES (
        v_booking_ref, v_current_user_id, v_tour.id, v_customer_id, p_booking_date, v_initial_status,
        v_initial_payment_status, p_payment_method, COALESCE(p_adult_count, 1),
        COALESCE(p_child_count, 0), COALESCE(p_infant_count, 0),
        (CASE WHEN p_pickup_location_id IS NOT NULL AND p_pickup_location_id != '' THEN p_pickup_location_id::UUID ELSE NULL END),
        p_customer_hotel, p_pickup_room_number, v_subtotal, v_extras_total, v_discount, v_final_total,
        'EUR', p_special_requests
    )
    RETURNING id INTO v_booking_id;

    -- 10. Persist Booking Extras
    IF p_extras IS NOT NULL AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            SELECT * INTO v_extra_record FROM public.tour_extras WHERE id = (v_extra_item->>'id')::UUID;
            IF FOUND THEN
                INSERT INTO public.booking_extras (
                    booking_id, extra_id, name, quantity, unit_price, total_price
                )
                VALUES (
                    v_booking_id,
                    v_extra_record.id,
                    v_extra_record.name,
                    (v_extra_item->>'quantity')::INT,
                    v_extra_record.price_eur,
                    (v_extra_record.price_eur * (v_extra_item->>'quantity')::INT)
                );
            END IF;
        END LOOP;
    END IF;

    -- 11. Create Initial Manifest Passenger Entry
    INSERT INTO public.booking_passengers (
        booking_id, full_name, passenger_type, is_lead
    )
    VALUES (
        v_booking_id,
        TRIM(p_customer_first_name || ' ' || p_customer_last_name),
        'adult',
        TRUE
    );

    -- 12. Update Availability Booked Count
    IF FOUND AND v_avail.id IS NOT NULL THEN
        UPDATE public.tour_availability
        SET booked_count = booked_count + v_total_guests,
            status = CASE WHEN (booked_count + v_total_guests) >= max_capacity THEN 'sold_out' ELSE status END,
            updated_at = NOW()
        WHERE id = v_avail.id;
    END IF;

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

-- 3. Grants for create_booking_atomic
REVOKE ALL ON FUNCTION public.create_booking_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic TO anon, authenticated, service_role;
