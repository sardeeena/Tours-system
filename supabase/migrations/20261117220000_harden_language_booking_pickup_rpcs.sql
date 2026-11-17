-- Close legacy language-aware booking RPC pickup-policy bypasses.
-- Public wrappers remain available, but execute as their owner so the private
-- implementation functions can be made inaccessible to client roles.
-- All booking variants must enforce the same explicit pickup mappings.

BEGIN;

DO $strict_language_pickup$
DECLARE
  v_definition text;
  v_old_pickup_block text := $old$
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

$old$;
  v_new_pickup_block text := $new$
    -- 6. Strict tour-specific pickup eligibility and authoritative fee calculation.
    IF COALESCE(v_tour.pickup_available, FALSE) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.tour_pickup_locations AS tpl
            INNER JOIN public.pickup_locations AS pl
                ON pl.id = tpl.pickup_location_id
               AND pl.is_active = TRUE
            WHERE tpl.tour_id = v_tour.id
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Pickup is not configured for this excursion. Please contact our booking team.'
            );
        END IF;

        IF p_pickup_location_id IS NULL OR TRIM(p_pickup_location_id) = '' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'A pickup location is required for this excursion. Please select an approved area.'
            );
        END IF;
    ELSIF p_pickup_location_id IS NOT NULL AND TRIM(p_pickup_location_id) <> '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This excursion does not offer hotel pickup.'
        );
    END IF;

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

        IF NOT EXISTS (
            SELECT 1
            FROM public.tour_pickup_locations AS tpl
            INNER JOIN public.pickup_locations AS pl
                ON pl.id = tpl.pickup_location_id
               AND pl.is_active = TRUE
            WHERE tpl.tour_id = v_tour.id
              AND tpl.pickup_location_id = v_extra_record.id
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'The selected pickup area is not explicitly approved for this excursion.'
            );
        END IF;

        v_pickup_location_id := v_extra_record.id;
        v_pickup_fee := ((p_adult_count + COALESCE(p_child_count, 0)) * COALESCE(v_extra_record.fee_eur_per_person, 0.00))
            + COALESCE(v_extra_record.fee_eur_flat, 0.00);
        v_subtotal := v_subtotal + v_pickup_fee;
    END IF;

$new$;
BEGIN
  SELECT pg_get_functiondef(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_pickup_block IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected legacy pickup validation block was not found in the language-aware booking function; refusing to overwrite it.';
  END IF;

  v_definition := replace(v_definition, v_old_pickup_block, v_new_pickup_block);

  IF position('COALESCE(v_tour.pickup_available, FALSE)' IN v_definition) = 0
     OR position('A pickup location is required for this excursion.' IN v_definition) = 0
     OR position('pickup_location_id = v_extra_record.id' IN v_definition) = 0
     OR position('Pickup is not configured for this excursion.' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Strict pickup enforcement postconditions failed for the language-aware booking function.';
  END IF;

  EXECUTE v_definition;
END;
$strict_language_pickup$;

-- Keep the public PostgREST entry points, but make the wrappers execute their
-- private callees as the trusted owner. The wrappers contain no user-controlled
-- SQL and delegate to fixed, fully-qualified functions with an empty search_path.
ALTER FUNCTION public.create_booking_atomic(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text
) SECURITY DEFINER;
ALTER FUNCTION public.create_booking_atomic(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text
) SET search_path = '';

ALTER FUNCTION public.create_booking_atomic_with_language(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text
) SECURITY DEFINER;
ALTER FUNCTION public.create_booking_atomic_with_language(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text
) SET search_path = '';

ALTER FUNCTION public.create_booking_atomic_with_locale(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text
) SECURITY DEFINER;
ALTER FUNCTION public.create_booking_atomic_with_locale(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text
) SET search_path = '';

-- Prevent clients from calling implementation functions directly, including
-- the legacy overloads. Service-role and postgres privileges are retained.
REVOKE ALL PRIVILEGES ON FUNCTION private.create_booking_atomic(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.create_booking_atomic(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.create_booking_atomic_with_language(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION private.create_booking_atomic_with_locale(
  text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
