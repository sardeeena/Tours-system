CREATE OR REPLACE FUNCTION public.create_booking_atomic(p_tour_identifier text, p_booking_date date, p_adult_count integer, p_child_count integer DEFAULT 0, p_infant_count integer DEFAULT 0, p_customer_first_name text DEFAULT ''::text, p_customer_last_name text DEFAULT ''::text, p_customer_email text DEFAULT ''::text, p_customer_phone text DEFAULT ''::text, p_customer_country text DEFAULT 'International'::text, p_customer_hotel text DEFAULT NULL::text, p_pickup_location_id text DEFAULT NULL::text, p_pickup_room_number text DEFAULT NULL::text, p_extras jsonb DEFAULT '[]'::jsonb, p_coupon_code text DEFAULT NULL::text, p_payment_method text DEFAULT 'pay_at_pickup'::text, p_special_requests text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_tour RECORD;
    v_avail RECORD;
    v_customer_id UUID;
    v_pickup_location_id UUID;
    v_booking_id UUID;
    v_booking_ref TEXT;
    v_total_guests INT;
    v_subtotal NUMERIC(10,2) := 0.00;
    v_pickup_fee NUMERIC(10,2) := 0.00;
    v_extras_total NUMERIC(10,2) := 0.00;
    v_discount NUMERIC(10,2) := 0.00;
    v_final_total NUMERIC(10,2) := 0.00;
    v_coupon RECORD;
    v_extra_item JSONB;
    v_extra_record RECORD;
    v_extra_qty INT;
    v_extra_unit_price NUMERIC(10,2);
    v_extra_line_total NUMERIC(10,2);
    v_current_user_id UUID := auth.uid();
    v_initial_status TEXT := 'pending';
    v_initial_payment_status TEXT := 'pending';
    v_default_capacity INT;
    v_existing_dup RECORD;
BEGIN
    -- 1. Input Sanitization & Strict Passenger Count Validation
    IF p_tour_identifier IS NULL OR TRIM(p_tour_identifier) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid tour specified for reservation.');
    END IF;

    IF p_booking_date IS NULL OR p_booking_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error', 'Departure date must be today or a future date.');
    END IF;

    -- Adult count: positive integer between 1 and 100
    IF p_adult_count IS NULL OR p_adult_count < 1 OR p_adult_count > 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservations must include at least 1 adult guest (maximum 100).');
    END IF;

    -- Child count: non-negative integer between 0 and 100
    IF p_child_count IS NOT NULL AND (p_child_count < 0 OR p_child_count > 100) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Child guest count must be a non-negative integer (0 to 100).');
    END IF;

    -- Infant count: non-negative integer between 0 and 50
    IF p_infant_count IS NOT NULL AND (p_infant_count < 0 OR p_infant_count > 50) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Infant guest count must be a non-negative integer (0 to 50).');
    END IF;

    IF TRIM(p_customer_first_name) = '' OR TRIM(p_customer_last_name) = '' OR TRIM(p_customer_email) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please provide guest contact details (name and email).');
    END IF;

    v_total_guests := p_adult_count + COALESCE(p_child_count, 0) + COALESCE(p_infant_count, 0);

    -- 2. Resolve Tour
    IF p_tour_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        SELECT * INTO v_tour FROM public.tours WHERE id = p_tour_identifier::UUID AND status = 'published';
    ELSE
        SELECT * INTO v_tour FROM public.tours WHERE slug = p_tour_identifier AND status = 'published';
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'The requested excursion is either unavailable or unpublished.');
    END IF;

    -- 3. Genuine Request Idempotency Check
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        SELECT * INTO v_existing_dup
        FROM public.bookings
        WHERE idempotency_key = TRIM(p_idempotency_key)
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'bookingId', v_existing_dup.id,
                'bookingReference', v_existing_dup.booking_reference,
                'status', v_existing_dup.status,
                'paymentStatus', v_existing_dup.payment_status,
                'totalEur', v_existing_dup.total,
                'bookingDate', v_existing_dup.booking_date,
                'isDuplicate', true,
                'message', 'Idempotent replay: original booking returned.'
            );
        END IF;
    END IF;

    -- 4. Atomic Capacity & Concurrency Lock
    v_default_capacity := GREATEST(1, COALESCE(v_tour.max_guests, 20));

    INSERT INTO public.tour_availability (
        tour_id, date, max_capacity, booked_count, status, created_at, updated_at
    )
    VALUES (
        v_tour.id, p_booking_date, v_default_capacity, 0, 'available', NOW(), NOW()
    )
    ON CONFLICT (tour_id, date) DO UPDATE
    SET updated_at = NOW()
    RETURNING * INTO v_avail;

    SELECT * INTO v_avail
    FROM public.tour_availability
    WHERE id = v_avail.id
    FOR UPDATE;

    IF v_avail.status IN ('unavailable', 'sold_out') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This departure is not available for online booking.'
        );
    END IF;

    IF v_avail.booked_count < 0 OR v_avail.max_capacity < 1 THEN
        RAISE EXCEPTION 'Invalid availability capacity state for tour % on %.', v_tour.id, p_booking_date
            USING ERRCODE = '23514';
    END IF;

    IF (v_avail.booked_count + v_total_guests) > v_avail.max_capacity THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient capacity for this date. Remaining spots: ' || GREATEST(0, (v_avail.max_capacity - v_avail.booked_count)) || '.'
        );
    END IF;

    -- 5. Calculate Base Tour Price (Adults & Children)
    v_subtotal := (p_adult_count * v_tour.price) + (COALESCE(p_child_count, 0) * (v_tour.price * 0.50));

    -- 6. Pickup Location Fees: only active locations may be selected.
    IF p_pickup_location_id IS NOT NULL AND TRIM(p_pickup_location_id) <> '' THEN
        IF p_pickup_location_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            SELECT * INTO v_extra_record
            FROM public.pickup_locations
            WHERE id = p_pickup_location_id::UUID
              AND is_active = TRUE;
        ELSE
            SELECT * INTO v_extra_record
            FROM public.pickup_locations
            WHERE code = TRIM(p_pickup_location_id)
              AND is_active = TRUE;
        END IF;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'The selected pickup area is not currently available. Please choose an active pickup area.'
            );
        END IF;

        -- If a tour has explicit pickup assignments, enforce them server-side.
        IF EXISTS (
            SELECT 1 FROM public.tour_pickup_locations
            WHERE tour_id = v_tour.id
        ) AND NOT EXISTS (
            SELECT 1 FROM public.tour_pickup_locations
            WHERE tour_id = v_tour.id
              AND pickup_location_id = v_extra_record.id
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'The selected pickup area is not available for this excursion.'
            );
        END IF;

        v_pickup_location_id := v_extra_record.id;
        v_pickup_fee := ((p_adult_count + COALESCE(p_child_count, 0)) * COALESCE(v_extra_record.fee_eur_per_person, 0.00))
            + COALESCE(v_extra_record.fee_eur_flat, 0.00);
        v_subtotal := v_subtotal + v_pickup_fee;
    END IF;

    -- 7. Tour-Specific Extras Validation & Pricing
    -- Strict Enforcement: Every selected add-on MUST have an explicit ACTIVE assignment to this specific tour in tour_assigned_extras.
    IF p_extras IS NOT NULL AND jsonb_typeof(p_extras) = 'array' AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            v_extra_qty := COALESCE((v_extra_item->>'quantity')::INT, 1);
            
            -- Query extra strictly INNER JOINED with tour_assigned_extras for THIS specific tour (v_tour.id)
            SELECT te.id, te.name, te.pricing_type, te.min_quantity, te.max_quantity, te.currency,
                   te.is_active AS catalog_is_active,
                   tae.is_active AS assignment_is_active,
                   COALESCE(tae.custom_price_eur, te.price_eur) AS effective_price
            INTO v_extra_record
            FROM public.tour_extras te
            INNER JOIN public.tour_assigned_extras tae 
                ON tae.extra_id = te.id AND tae.tour_id = v_tour.id
            WHERE (
                (v_extra_item->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND te.id = (v_extra_item->>'id')::UUID)
                OR te.id::TEXT = (v_extra_item->>'id')
                OR te.name = (v_extra_item->>'name')
            )
            LIMIT 1;

            -- Case 1, 2, 3, 5: If not assigned to this tour, or tour has zero assignments, or assigned to other tour
            IF NOT FOUND THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Selected add-on "' || COALESCE(v_extra_item->>'name', 'Unknown') || '" is not assigned or available for excursion "' || v_tour.title || '".'
                );
            END IF;

            -- Case 4: Catalog inactive OR assignment inactive
            IF NOT v_extra_record.catalog_is_active THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Selected add-on "' || v_extra_record.name || '" is currently deactivated in the catalog.'
                );
            END IF;

            IF NOT v_extra_record.assignment_is_active THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Selected add-on "' || v_extra_record.name || '" is deactivated for excursion "' || v_tour.title || '".'
                );
            END IF;

            -- Case 6 & 7: Quantity below minimum or above maximum
            IF v_extra_record.min_quantity IS NOT NULL AND v_extra_qty < v_extra_record.min_quantity THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Selected add-on "' || v_extra_record.name || '" requires a minimum quantity of ' || v_extra_record.min_quantity || '.'
                );
            END IF;

            IF v_extra_record.max_quantity IS NOT NULL AND v_extra_qty > v_extra_record.max_quantity THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'Selected add-on "' || v_extra_record.name || '" exceeds maximum allowed quantity of ' || v_extra_record.max_quantity || '.'
                );
            END IF;

            -- Case 8: Never trust browser price! Always use v_extra_record.effective_price from DB
            v_extra_unit_price := v_extra_record.effective_price;

            -- Dynamic Pricing Methods: per_person, per_adult, per_child, per_vehicle, per_item, per_booking
            IF v_extra_record.pricing_type = 'per_person' THEN
                v_extra_line_total := v_extra_unit_price * (p_adult_count + COALESCE(p_child_count, 0)) * v_extra_qty;
            ELSIF v_extra_record.pricing_type = 'per_adult' THEN
                v_extra_line_total := v_extra_unit_price * p_adult_count * v_extra_qty;
            ELSIF v_extra_record.pricing_type = 'per_child' THEN
                v_extra_line_total := v_extra_unit_price * COALESCE(p_child_count, 0) * v_extra_qty;
            ELSIF v_extra_record.pricing_type IN ('per_vehicle', 'per_item') THEN
                v_extra_line_total := v_extra_unit_price * v_extra_qty;
            ELSE
                v_extra_line_total := v_extra_unit_price * v_extra_qty;
            END IF;

            v_extras_total := v_extras_total + v_extra_line_total;
        END LOOP;
    END IF;

    -- 8. Coupon Code Validation (Server-Side)
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
        -- Lock the coupon row so concurrent bookings cannot exceed its usage limit.
        SELECT * INTO v_coupon
        FROM public.coupons
        WHERE code = UPPER(TRIM(p_coupon_code))
          AND is_active = TRUE
          AND valid_from <= CURRENT_DATE
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
          AND (usage_limit IS NULL OR times_used < usage_limit)
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'The coupon is invalid, expired, or has reached its usage limit.');
        END IF;

        IF (v_subtotal + v_extras_total) < COALESCE(v_coupon.min_spend, 0) THEN
            RETURN jsonb_build_object('success', false, 'error', 'The booking does not meet the minimum spend for this coupon.');
        END IF;

        IF v_coupon.discount_type = 'percentage' THEN
            v_discount := (v_subtotal + v_extras_total) * (v_coupon.discount_value / 100.00);
        ELSIF v_coupon.discount_type = 'fixed' THEN
            v_discount := LEAST(v_subtotal + v_extras_total, v_coupon.discount_value);
        END IF;

        IF v_coupon.max_discount IS NOT NULL THEN
            v_discount := LEAST(v_discount, v_coupon.max_discount);
        END IF;
        v_discount := LEAST(v_discount, v_subtotal + v_extras_total);
    END IF;

    v_final_total := GREATEST(0.00, (v_subtotal + v_extras_total) - v_discount);

    -- 9. Authoritative Customer Record Association & Hotel Persistence
    -- Only reuse a customer record already linked to this authenticated account.
    -- Guest checkouts get a separate customer row rather than modifying another guest's CRM record by email.
    IF v_current_user_id IS NOT NULL THEN
        SELECT id INTO v_customer_id
        FROM public.customers
        WHERE user_id = v_current_user_id
          AND LOWER(TRIM(email)) = LOWER(TRIM(p_customer_email))
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

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
        UPDATE public.customers
        SET first_name = COALESCE(NULLIF(TRIM(p_customer_first_name), ''), first_name),
            last_name = COALESCE(NULLIF(TRIM(p_customer_last_name), ''), last_name),
            phone = COALESCE(NULLIF(TRIM(p_customer_phone), ''), phone),
            hotel = COALESCE(NULLIF(p_customer_hotel, ''), hotel),
            country = COALESCE(NULLIF(p_customer_country, ''), country),
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    -- 10. Generate Authoritative Unpredictable Booking Reference
    v_booking_ref := 'RST-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || UPPER(ENCODE(gen_random_bytes(10), 'hex'));

    -- 11. Insert Authoritative Booking Record with Idempotency Key & Concurrency Protection
    BEGIN
        INSERT INTO public.bookings (
            booking_reference, user_id, tour_id, customer_id, booking_date, status, payment_status,
            payment_method, adult_count, child_count, infant_count, pickup_location_id,
            pickup_hotel_name, pickup_room_number, subtotal, extras_total, discount, total,
            currency, special_requests, idempotency_key
        )
        VALUES (
            v_booking_ref, v_current_user_id, v_tour.id, v_customer_id, p_booking_date, v_initial_status,
            v_initial_payment_status, p_payment_method, p_adult_count,
            COALESCE(p_child_count, 0), COALESCE(p_infant_count, 0),
            v_pickup_location_id,
            p_customer_hotel, p_pickup_room_number, v_subtotal, v_extras_total, v_discount, v_final_total,
            'EUR', p_special_requests, NULLIF(TRIM(p_idempotency_key), '')
        )
        RETURNING id INTO v_booking_id;
    EXCEPTION WHEN unique_violation THEN
        -- Concurrently committed duplicate request with exact same idempotency_key
        IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
            SELECT * INTO v_existing_dup
            FROM public.bookings
            WHERE idempotency_key = TRIM(p_idempotency_key)
            LIMIT 1;

            IF FOUND THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'bookingId', v_existing_dup.id,
                    'bookingReference', v_existing_dup.booking_reference,
                    'status', v_existing_dup.status,
                    'paymentStatus', v_existing_dup.payment_status,
                    'totalEur', v_existing_dup.total,
                    'bookingDate', v_existing_dup.booking_date,
                    'isDuplicate', true,
                    'message', 'Idempotent replay: concurrent request resolved.'
                );
            END IF;
        END IF;
        RAISE;
    END;

    -- 12. Persist Immutable Booking Extras Snapshot
    IF p_extras IS NOT NULL AND jsonb_typeof(p_extras) = 'array' AND jsonb_array_length(p_extras) > 0 THEN
        FOR v_extra_item IN SELECT * FROM jsonb_array_elements(p_extras)
        LOOP
            v_extra_qty := GREATEST(1, COALESCE((v_extra_item->>'quantity')::INT, 1));
            
            IF (v_extra_item->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                SELECT te.*, COALESCE(tae.custom_price_eur, te.price_eur) AS effective_price
                INTO v_extra_record 
                FROM public.tour_extras te
                INNER JOIN public.tour_assigned_extras tae ON tae.extra_id = te.id AND tae.tour_id = v_tour.id
                WHERE te.id = (v_extra_item->>'id')::UUID;
            ELSE
                SELECT te.*, COALESCE(tae.custom_price_eur, te.price_eur) AS effective_price
                INTO v_extra_record 
                FROM public.tour_extras te
                INNER JOIN public.tour_assigned_extras tae ON tae.extra_id = te.id AND tae.tour_id = v_tour.id
                WHERE (te.name = (v_extra_item->>'name') OR te.id::TEXT = (v_extra_item->>'id'));
            END IF;

            IF FOUND THEN
                v_extra_unit_price := v_extra_record.effective_price;

                IF v_extra_record.pricing_type = 'per_person' THEN
                    v_extra_line_total := v_extra_unit_price * (p_adult_count + COALESCE(p_child_count, 0)) * v_extra_qty;
                ELSIF v_extra_record.pricing_type = 'per_adult' THEN
                    v_extra_line_total := v_extra_unit_price * p_adult_count * v_extra_qty;
                ELSIF v_extra_record.pricing_type = 'per_child' THEN
                    v_extra_line_total := v_extra_unit_price * COALESCE(p_child_count, 0) * v_extra_qty;
                ELSIF v_extra_record.pricing_type IN ('per_vehicle', 'per_item') THEN
                    v_extra_line_total := v_extra_unit_price * v_extra_qty;
                ELSE
                    v_extra_line_total := v_extra_unit_price * v_extra_qty;
                END IF;

                INSERT INTO public.booking_extras (
                    booking_id, extra_id, name, description, quantity, unit_price, total_price, pricing_type, currency
                )
                VALUES (
                    v_booking_id, v_extra_record.id, v_extra_record.name,
                    v_extra_record.description, v_extra_qty, v_extra_unit_price, v_extra_line_total, v_extra_record.pricing_type, 'EUR'
                );
            END IF;
        END LOOP;
    END IF;

    -- 13. Persist Passenger Manifest with Dual-Column Compatibility
    INSERT INTO public.booking_passengers (
        booking_id, full_name, passenger_type, is_lead_passenger, is_lead
    )
    VALUES (
        v_booking_id,
        TRIM(p_customer_first_name) || ' ' || TRIM(p_customer_last_name),
        'adult',
        TRUE,
        TRUE
    );

    IF p_adult_count > 1 THEN
        FOR i IN 2..p_adult_count LOOP
            INSERT INTO public.booking_passengers (booking_id, full_name, passenger_type, is_lead_passenger, is_lead)
            VALUES (v_booking_id, 'Adult Guest ' || i || ' (' || TRIM(p_customer_last_name) || ')', 'adult', FALSE, FALSE);
        END LOOP;
    END IF;

    IF p_child_count > 0 THEN
        FOR i IN 1..p_child_count LOOP
            INSERT INTO public.booking_passengers (booking_id, full_name, passenger_type, is_lead_passenger, is_lead)
            VALUES (v_booking_id, 'Child Guest ' || i || ' (' || TRIM(p_customer_last_name) || ')', 'child', FALSE, FALSE);
        END LOOP;
    END IF;

    IF p_infant_count > 0 THEN
        FOR i IN 1..p_infant_count LOOP
            INSERT INTO public.booking_passengers (booking_id, full_name, passenger_type, is_lead_passenger, is_lead)
            VALUES (v_booking_id, 'Infant Guest ' || i || ' (' || TRIM(p_customer_last_name) || ')', 'infant', FALSE, FALSE);
        END LOOP;
    END IF;

    -- Consume one coupon use only after the booking and its child records exist.
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        UPDATE public.coupons
        SET times_used = times_used + 1,
            updated_at = NOW()
        WHERE id = v_coupon.id;
    END IF;

    -- 14. Increment Availability Count Atomically
    UPDATE public.tour_availability
    SET booked_count = booked_count + v_total_guests,
        status = CASE 
            WHEN (booked_count + v_total_guests) >= max_capacity THEN 'sold_out'
            ELSE 'available'
        END,
        updated_at = NOW()
    WHERE id = v_avail.id;

    -- 15. Audit Log Entry
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
            'total', v_final_total,
            'hotel', COALESCE(p_customer_hotel, 'TBA'),
            'idempotencyKey', p_idempotency_key
        )
    );

    -- 16. Return Authoritative Response Payload
    RETURN jsonb_build_object(
        'success', true,
        'bookingId', v_booking_id,
        'bookingReference', v_booking_ref,
        'status', v_initial_status,
        'paymentStatus', v_initial_payment_status,
        'totalEur', v_final_total,
        'subtotalEur', v_subtotal,
        'extrasTotalEur', v_extras_total,
        'bookingDate', p_booking_date,
        'isDuplicate', false
    );
END;
$function$;

-- Activate the seven catalogue pickup areas that match the current public booking defaults.
-- The booking RPC now rejects inactive areas before calculating or persisting a fee.
UPDATE public.pickup_locations
SET is_active = TRUE,
    updated_at = NOW()
WHERE (code, id) IN (
  ('hurghada', 'b1000000-0000-0000-0000-000000000001'::uuid),
  ('el-gouna', 'b1000000-0000-0000-0000-000000000002'::uuid),
  ('makadi-bay', 'b1000000-0000-0000-0000-000000000003'::uuid),
  ('sahl-hasheesh', 'b1000000-0000-0000-0000-000000000004'::uuid),
  ('safaga', 'b1000000-0000-0000-0000-000000000005'::uuid),
  ('marsa-alam', 'b1000000-0000-0000-0000-000000000006'::uuid),
  ('sharm-el-sheikh', 'b1000000-0000-0000-0000-000000000007'::uuid)
);
