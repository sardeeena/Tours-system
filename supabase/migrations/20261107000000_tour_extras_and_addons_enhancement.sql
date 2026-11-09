-- ==============================================================================
-- AWESOME ADVENTURE TOURS — ENHANCEMENT MIGRATION 20261107000000
-- TOUR-SPECIFIC EXTRAS, DYNAMIC ADD-ONS, VEHICLE PRICING & DATA PERSISTENCE
-- ==============================================================================

-- 1. EXTEND TOUR_EXTRAS SCHEMA FOR DYNAMIC ADD-ONS
DO $$
BEGIN
    -- Allow 'per_vehicle' and 'per_item' in tour_extras pricing_type check constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.tour_extras'::regclass 
          AND conname = 'tour_extras_pricing_type_check'
    ) THEN
        ALTER TABLE public.tour_extras DROP CONSTRAINT tour_extras_pricing_type_check;
    END IF;
    
    ALTER TABLE public.tour_extras 
    ADD CONSTRAINT tour_extras_pricing_type_check 
    CHECK (pricing_type IN ('per_person', 'per_booking', 'per_vehicle', 'per_item', 'per_adult', 'per_child'));

    -- Add extra dynamic columns if not present
    ALTER TABLE public.tour_extras ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE public.tour_extras ADD COLUMN IF NOT EXISTS min_quantity INT NOT NULL DEFAULT 1;
    ALTER TABLE public.tour_extras ADD COLUMN IF NOT EXISTS max_quantity INT NOT NULL DEFAULT 10;

    -- Add custom_price_eur, is_active, and sort_order to tour_assigned_extras for tour-specific pricing persistence
    ALTER TABLE public.tour_assigned_extras ADD COLUMN IF NOT EXISTS custom_price_eur NUMERIC(10,2);
    ALTER TABLE public.tour_assigned_extras ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    ALTER TABLE public.tour_assigned_extras ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

    -- Add description & currency to booking_extras for immutable snapshots
    ALTER TABLE public.booking_extras ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE public.booking_extras ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

    -- Ensure booking_passengers supports both is_lead and is_lead_passenger for full backward and forward compatibility
    ALTER TABLE public.booking_passengers ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.booking_passengers ADD COLUMN IF NOT EXISTS is_lead_passenger BOOLEAN DEFAULT FALSE;

    -- Add idempotency_key to public.bookings for genuine request deduplication
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
END $$;

-- Create unique index on bookings idempotency_key for true request deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency_key 
ON public.bookings(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 2. SEED INITIAL DYNAMIC ADD-ON CATALOG EXAMPLES
INSERT INTO public.tour_extras (id, name, description, price_eur, currency, pricing_type, is_active, sort_order, image_url, min_quantity, max_quantity)
VALUES 
    (
        'b2a3c4d5-1111-4444-8888-000000000001',
        'Single Quad',
        'Single-rider 250cc Yamaha/Honda desert quad bike with safety helmet and goggle rental.',
        35.00,
        'EUR',
        'per_vehicle',
        TRUE,
        1,
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=600&q=80',
        1,
        8
    ),
    (
        'b2a3c4d5-2222-4444-8888-000000000002',
        'Double Quad',
        'Two-seater desert quad bike for driver and passenger with twin helmet sets.',
        50.00,
        'EUR',
        'per_vehicle',
        TRUE,
        2,
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
        1,
        5
    ),
    (
        'b2a3c4d5-3333-4444-8888-000000000003',
        'Buggy',
        'Heavy-duty desert roll-cage dune buggy designed for rugged sand dune exploration.',
        65.00,
        'EUR',
        'per_vehicle',
        TRUE,
        3,
        'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
        1,
        4
    ),
    (
        'b2a3c4d5-4444-4444-8888-000000000004',
        'Additional Safari Experience',
        'Extended Bedouin campfire dinner, traditional tea, astronomy telescope session & sunset camel ride.',
        20.00,
        'EUR',
        'per_person',
        TRUE,
        4,
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
        1,
        20
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_eur = EXCLUDED.price_eur,
    pricing_type = EXCLUDED.pricing_type,
    image_url = EXCLUDED.image_url,
    min_quantity = EXCLUDED.min_quantity,
    max_quantity = EXCLUDED.max_quantity;

-- Link dynamic safari add-ons to safari tours in tour_assigned_extras
INSERT INTO public.tour_assigned_extras (tour_id, extra_id)
SELECT t.id, e.id
FROM public.tours t
CROSS JOIN public.tour_extras e
WHERE (t.slug LIKE '%safari%' OR t.slug LIKE '%quad%')
  AND e.id IN (
    'b2a3c4d5-1111-4444-8888-000000000001',
    'b2a3c4d5-2222-4444-8888-000000000002',
    'b2a3c4d5-3333-4444-8888-000000000003',
    'b2a3c4d5-4444-4444-8888-000000000004'
  )
ON CONFLICT DO NOTHING;

-- 3. HARDENED ATOMIC BOOKING FUNCTION WITH TOUR-EXTRA VALIDATION
-- Safely retire legacy 17-parameter overload to prevent function overload ambiguity (SQLSTATE 42725)
DROP FUNCTION IF EXISTS public.create_booking_atomic(
    TEXT, DATE, INT, INT, INT,
    TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, JSONB, TEXT,
    TEXT, TEXT
);

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
    p_special_requests TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
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
    v_extra_valid BOOLEAN;
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
    -- If an idempotency key is provided, returning the original booking prevents duplicates
    -- and ensures network retries return identical booking confirmation.
    -- Distinct bookings with different idempotency keys are allowed even on the same date.
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

    IF v_avail.status IN ('sold_out', 'unavailable') OR (v_avail.booked_count + v_total_guests > v_avail.max_capacity) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This departure date is sold out or has insufficient remaining capacity for ' || v_total_guests || ' guests.'
        );
    END IF;

    -- 5. Authoritative Base Pricing Calculation
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

    -- 7. Tour-Specific Extras Validation & Pricing
    -- Strict Enforcement: Every selected add-on MUST have an explicit ACTIVE assignment to this specific tour in tour_assigned_extras.
    -- General catalog extras are NOT automatically bookable without explicit active tour assignment.
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
                -- Per person extra applies to paying passengers (adults + children)
                v_extra_line_total := v_extra_unit_price * (p_adult_count + COALESCE(p_child_count, 0)) * v_extra_qty;
            ELSIF v_extra_record.pricing_type = 'per_adult' THEN
                v_extra_line_total := v_extra_unit_price * p_adult_count * v_extra_qty;
            ELSIF v_extra_record.pricing_type = 'per_child' THEN
                v_extra_line_total := v_extra_unit_price * COALESCE(p_child_count, 0) * v_extra_qty;
            ELSIF v_extra_record.pricing_type IN ('per_vehicle', 'per_item') THEN
                -- Per vehicle or item pricing calculates directly by unit quantity
                v_extra_line_total := v_extra_unit_price * v_extra_qty;
            ELSE
                -- Flat per booking
                v_extra_line_total := v_extra_unit_price * v_extra_qty;
            END IF;

            v_extras_total := v_extras_total + v_extra_line_total;
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

    -- 9. Authoritative Customer Record Association & Hotel Persistence
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
        SET first_name = COALESCE(NULLIF(TRIM(p_customer_first_name), ''), first_name),
            last_name = COALESCE(NULLIF(TRIM(p_customer_last_name), ''), last_name),
            phone = COALESCE(NULLIF(TRIM(p_customer_phone), ''), phone),
            hotel = COALESCE(NULLIF(p_customer_hotel, ''), hotel),
            country = COALESCE(NULLIF(p_customer_country, ''), country),
            updated_at = NOW()
        WHERE id = v_customer_id;
    END IF;

    -- 10. Generate Authoritative Unpredictable Booking Reference
    v_booking_ref := 'RST-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || UPPER(SUBSTRING(MD5(gen_random_uuid()::TEXT) FROM 1 FOR 6));

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
            (CASE WHEN p_pickup_location_id IS NOT NULL AND p_pickup_location_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_pickup_location_id::UUID ELSE NULL END),
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
                    v_booking_id,
                    v_extra_record.id,
                    v_extra_record.name,
                    v_extra_record.description,
                    v_extra_qty,
                    v_extra_unit_price,
                    v_extra_line_total,
                    v_extra_record.pricing_type,
                    COALESCE(v_extra_record.currency, 'EUR')
                );
            END IF;
        END LOOP;
    END IF;

    -- 13. Persist Passenger Manifest
    INSERT INTO public.booking_passengers (
        booking_id, full_name, passenger_type, is_lead_passenger, is_lead
    )
    VALUES (
        v_booking_id,
        TRIM(p_customer_first_name || ' ' || p_customer_last_name),
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
            'hotel', COALESCE(p_customer_hotel, 'TBA')
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
$$;

-- 4. ATOMIC TOUR ASSIGNMENT MANAGEMENT FUNCTIONS
-- Atomically replaces all tour assignments for an add-on in a single transaction.
-- Pre-validates all tour IDs and custom prices BEFORE deleting, and rolls back if any error occurs.
CREATE OR REPLACE FUNCTION public.replace_extra_tour_assignments_atomic(
    p_extra_id UUID,
    p_assignments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_item JSONB;
    v_tour_id UUID;
    v_custom_price NUMERIC(10,2);
    v_is_active BOOLEAN;
    v_sort_order INT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- Authorization check: Requires admin privileges
    IF auth.role() = 'service_role' THEN
        v_is_authorized := TRUE;
    ELSE
        BEGIN
            v_is_authorized := public.is_admin();
        EXCEPTION WHEN OTHERS THEN
            v_is_authorized := FALSE;
        END;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access denied: Administrator privileges required to manage tour assignments.'
            USING ERRCODE = '42501';
    END IF;

    -- Validate target extra exists
    IF NOT EXISTS (SELECT 1 FROM public.tour_extras WHERE id = p_extra_id) THEN
        RAISE EXCEPTION 'Invalid add-on: Target add-on ID % does not exist.', p_extra_id
            USING ERRCODE = '23503';
    END IF;

    -- Pre-validate all assignment items BEFORE deleting existing assignments
    IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            IF (v_item->>'tour_id') IS NULL OR NOT (v_item->>'tour_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
                RAISE EXCEPTION 'Invalid tour ID: % is not a valid UUID.', COALESCE(v_item->>'tour_id', 'null')
                    USING ERRCODE = '22P02';
            END IF;

            v_tour_id := (v_item->>'tour_id')::UUID;
            IF NOT EXISTS (SELECT 1 FROM public.tours WHERE id = v_tour_id) THEN
                RAISE EXCEPTION 'Invalid tour: Tour ID % does not exist.', v_tour_id
                    USING ERRCODE = '23503';
            END IF;

            IF v_item->>'custom_price_eur' IS NOT NULL AND TRIM(v_item->>'custom_price_eur') <> '' THEN
                BEGIN
                    v_custom_price := (v_item->>'custom_price_eur')::NUMERIC;
                EXCEPTION WHEN OTHERS THEN
                    RAISE EXCEPTION 'Invalid custom price: "%" must be a valid numeric amount.', v_item->>'custom_price_eur'
                        USING ERRCODE = '22P02';
                END;

                IF v_custom_price < 0 THEN
                    RAISE EXCEPTION 'Invalid custom price: % cannot be negative.', v_custom_price
                        USING ERRCODE = '23514';
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- Atomic Replace: Delete existing assignments for this extra
    DELETE FROM public.tour_assigned_extras
    WHERE extra_id = p_extra_id;

    -- Insert new validated assignments
    IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            v_tour_id := (v_item->>'tour_id')::UUID;
            v_custom_price := NULL;
            IF v_item->>'custom_price_eur' IS NOT NULL AND TRIM(v_item->>'custom_price_eur') <> '' THEN
                v_custom_price := (v_item->>'custom_price_eur')::NUMERIC;
            END IF;
            v_is_active := COALESCE((v_item->>'is_active')::BOOLEAN, TRUE);
            v_sort_order := COALESCE((v_item->>'sort_order')::INT, 0);

            INSERT INTO public.tour_assigned_extras (tour_id, extra_id, custom_price_eur, is_active, sort_order, created_at)
            VALUES (v_tour_id, p_extra_id, v_custom_price, v_is_active, v_sort_order, NOW());
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'extraId', p_extra_id,
        'assignedCount', COALESCE(jsonb_array_length(p_assignments), 0),
        'message', 'Tour assignments updated atomically.'
    );
END;
$$;

-- Atomically replaces all extra assignments for a specific tour in a single transaction.
CREATE OR REPLACE FUNCTION public.replace_tour_extra_assignments_atomic(
    p_tour_id UUID,
    p_assignments JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_item JSONB;
    v_extra_id UUID;
    v_custom_price NUMERIC(10,2);
    v_is_active BOOLEAN;
    v_sort_order INT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    IF auth.role() = 'service_role' THEN
        v_is_authorized := TRUE;
    ELSE
        BEGIN
            v_is_authorized := public.is_admin();
        EXCEPTION WHEN OTHERS THEN
            v_is_authorized := FALSE;
        END;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Access denied: Administrator privileges required to manage tour assignments.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.tours WHERE id = p_tour_id) THEN
        RAISE EXCEPTION 'Invalid tour: Tour ID % does not exist.', p_tour_id
            USING ERRCODE = '23503';
    END IF;

    IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            IF (v_item->>'extra_id') IS NULL OR NOT (v_item->>'extra_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
                RAISE EXCEPTION 'Invalid add-on ID: % is not a valid UUID.', COALESCE(v_item->>'extra_id', 'null')
                    USING ERRCODE = '22P02';
            END IF;

            v_extra_id := (v_item->>'extra_id')::UUID;
            IF NOT EXISTS (SELECT 1 FROM public.tour_extras WHERE id = v_extra_id) THEN
                RAISE EXCEPTION 'Invalid add-on: Add-on ID % does not exist.', v_extra_id
                    USING ERRCODE = '23503';
            END IF;

            IF v_item->>'custom_price_eur' IS NOT NULL AND TRIM(v_item->>'custom_price_eur') <> '' THEN
                BEGIN
                    v_custom_price := (v_item->>'custom_price_eur')::NUMERIC;
                EXCEPTION WHEN OTHERS THEN
                    RAISE EXCEPTION 'Invalid custom price: "%" must be a valid numeric amount.', v_item->>'custom_price_eur'
                        USING ERRCODE = '22P02';
                END;

                IF v_custom_price < 0 THEN
                    RAISE EXCEPTION 'Invalid custom price: % cannot be negative.', v_custom_price
                        USING ERRCODE = '23514';
                END IF;
            END IF;
        END LOOP;
    END IF;

    DELETE FROM public.tour_assigned_extras
    WHERE tour_id = p_tour_id;

    IF p_assignments IS NOT NULL AND jsonb_typeof(p_assignments) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_assignments)
        LOOP
            v_extra_id := (v_item->>'extra_id')::UUID;
            v_custom_price := NULL;
            IF v_item->>'custom_price_eur' IS NOT NULL AND TRIM(v_item->>'custom_price_eur') <> '' THEN
                v_custom_price := (v_item->>'custom_price_eur')::NUMERIC;
            END IF;
            v_is_active := COALESCE((v_item->>'is_active')::BOOLEAN, TRUE);
            v_sort_order := COALESCE((v_item->>'sort_order')::INT, 0);

            INSERT INTO public.tour_assigned_extras (tour_id, extra_id, custom_price_eur, is_active, sort_order, created_at)
            VALUES (p_tour_id, v_extra_id, v_custom_price, v_is_active, v_sort_order, NOW());
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'tourId', p_tour_id,
        'assignedCount', COALESCE(jsonb_array_length(p_assignments), 0),
        'message', 'Tour assignments updated atomically.'
    );
END;
$$;

-- 5. PERMISSIONS & ROLE GRANTS
-- Unambiguous grants using exact function identity signature (18 parameters)
REVOKE ALL ON FUNCTION public.create_booking_atomic(
    TEXT, DATE, INT, INT, INT,
    TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, JSONB, TEXT,
    TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(
    TEXT, DATE, INT, INT, INT,
    TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, JSONB, TEXT,
    TEXT, TEXT, TEXT
) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.replace_extra_tour_assignments_atomic(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_extra_tour_assignments_atomic(UUID, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.replace_tour_extra_assignments_atomic(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_tour_extra_assignments_atomic(UUID, JSONB) TO authenticated, service_role;
