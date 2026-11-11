-- Port the pickup-fee validation to the current private booking implementation.
-- Patch only the pickup-specific parts of the live function definition so the
-- existing idempotency, capacity locking, customer isolation, coupon, extras,
-- passenger manifest, and notification logic remain untouched.

DO $pickup_fee_hardening$
DECLARE
  v_definition text;
  v_old_pickup_block text := $old$
    -- 6. Pickup Location Fees
    IF p_pickup_location_id IS NOT NULL AND TRIM(p_pickup_location_id) != '' THEN
        IF p_pickup_location_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            SELECT * INTO v_extra_record
            FROM public.pickup_locations WHERE id = p_pickup_location_id::UUID;
        ELSE
            SELECT * INTO v_extra_record
            FROM public.pickup_locations WHERE code = p_pickup_location_id;
        END IF;

        IF FOUND THEN
            v_pickup_fee := ((p_adult_count + COALESCE(p_child_count, 0)) * COALESCE(v_extra_record.fee_eur_per_person, 0.00)) + COALESCE(v_extra_record.fee_eur_flat, 0.00);
            v_subtotal := v_subtotal + v_pickup_fee;
        END IF;
    END IF;

$old$;
  v_new_pickup_block text := $new$
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

$new$;
  v_old_booking_pickup text := $old$
            (CASE WHEN p_pickup_location_id IS NOT NULL AND p_pickup_location_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_pickup_location_id::UUID ELSE NULL END),
$old$;
BEGIN
  SELECT pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'::regprocedure
  )
  INTO v_definition;

  IF position('v_pickup_location_id UUID;' IN v_definition) = 0 THEN
    IF position('    v_customer_id UUID;' || E'\n' IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Booking function declaration changed; refusing unsafe pickup-fee patch.';
    END IF;
    v_definition := replace(
      v_definition,
      '    v_customer_id UUID;' || E'\n',
      '    v_customer_id UUID;' || E'\n    v_pickup_location_id UUID;' || E'\n'
    );
  END IF;

  IF position(v_old_pickup_block IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected legacy pickup-fee block not found; refusing to overwrite the current booking function.';
  END IF;

  IF position(v_old_booking_pickup IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected legacy booking pickup-location assignment not found; refusing unsafe patch.';
  END IF;

  v_definition := replace(v_definition, v_old_pickup_block, v_new_pickup_block);
  v_definition := replace(v_definition, v_old_booking_pickup, '            v_pickup_location_id,' || E'\n');

  IF position('AND is_active = TRUE' IN v_definition) = 0
     OR position('public.tour_pickup_locations' IN v_definition) = 0
     OR position('v_pickup_location_id,' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Pickup-fee hardening postconditions failed; aborting migration.';
  END IF;

  EXECUTE v_definition;
END;
$pickup_fee_hardening$;

NOTIFY pgrst, 'reload schema';
