-- Bind each atomic booking to one explicitly selected departure slot.
-- Legacy bookings are never rewritten; only newly inserted bookings receive
-- a departure_id through the validated transaction-local request context.

BEGIN;

DO $migration$
DECLARE
  v_signature REGPROCEDURE;
  v_definition TEXT;
  v_old_declaration TEXT := '    v_avail RECORD;';
  v_new_declaration TEXT := '    v_avail RECORD;' || E'\n' ||
    '    v_selected_departure_id UUID;' || E'\n' ||
    '    v_departure_count INTEGER := 0;';
  v_old_payload TEXT := E'        ''booking_date'', p_booking_date,';
  v_new_payload TEXT := E'        ''booking_date'', p_booking_date,' || E'\n' ||
    '        ''departure_id'', NULLIF(current_setting(''app.booking_departure_id'', TRUE), ''''),';
  v_old_selection TEXT := E'    -- Require an explicitly configured availability row; never create a' || E'\n' ||
    '    -- departure or capacity as a side effect of a guest booking.' || E'\n' ||
    '    SELECT * INTO v_avail' || E'\n' ||
    '    FROM public.tour_availability' || E'\n' ||
    '    WHERE tour_id = v_tour.id' || E'\n' ||
    '      AND date = p_booking_date' || E'\n' ||
    '    FOR UPDATE;' || E'\n\n' ||
    '    IF NOT FOUND THEN' || E'\n' ||
    '        RETURN jsonb_build_object(' || E'\n' ||
    '            ''success'', false,' || E'\n' ||
    '            ''error'', ''No confirmed departure is scheduled for this date.''' || E'\n' ||
    '        );' || E'\n' ||
    '    END IF;';
  v_new_selection TEXT := E'    -- Select and lock one independently bookable departure slot.' || E'\n' ||
    '    v_selected_departure_id := NULLIF(current_setting(''app.booking_departure_id'', TRUE), '''')::UUID;' || E'\n' ||
    '    IF v_selected_departure_id IS NULL THEN' || E'\n' ||
    '        SELECT count(*)::INTEGER INTO v_departure_count' || E'\n' ||
    '        FROM public.departures AS candidate' || E'\n' ||
    '        WHERE candidate.tour_id = v_tour.id' || E'\n' ||
    '          AND candidate.date = p_booking_date' || E'\n' ||
    '          AND candidate.status = ''confirmed'';' || E'\n' ||
    '        IF v_departure_count = 0 THEN' || E'\n' ||
    '            RETURN jsonb_build_object(''success'', false, ''error'', ''No confirmed departure is scheduled for this date.'');' || E'\n' ||
    '        ELSIF v_departure_count > 1 THEN' || E'\n' ||
    '            RETURN jsonb_build_object(''success'', false, ''error'', ''Please select a departure time before completing this booking.'');' || E'\n' ||
    '        END IF;' || E'\n' ||
    '        SELECT candidate.id INTO v_selected_departure_id' || E'\n' ||
    '        FROM public.departures AS candidate' || E'\n' ||
    '        WHERE candidate.tour_id = v_tour.id' || E'\n' ||
    '          AND candidate.date = p_booking_date' || E'\n' ||
    '          AND candidate.status = ''confirmed''' || E'\n' ||
    '        LIMIT 1;' || E'\n' ||
    '    END IF;' || E'\n\n' ||
    '    SELECT' || E'\n' ||
    '        d.id AS id,' || E'\n' ||
    '        d.id AS departure_id,' || E'\n' ||
    '        d.status,' || E'\n' ||
    '        d.capacity AS max_capacity,' || E'\n' ||
    '        greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0))::INTEGER AS booked_count,' || E'\n' ||
    '        greatest(0,d.capacity-greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0)))::INTEGER AS remaining_capacity,' || E'\n' ||
    '        d.start_time' || E'\n' ||
    '    INTO v_avail' || E'\n' ||
    '    FROM public.departures AS d' || E'\n' ||
    '    LEFT JOIN LATERAL (' || E'\n' ||
    '        SELECT coalesce(sum(b.adult_count + b.child_count + b.infant_count),0)::INTEGER AS reserved_count' || E'\n' ||
    '        FROM public.bookings AS b' || E'\n' ||
    '        WHERE b.departure_id = d.id AND b.status <> ''cancelled''' || E'\n' ||
    '    ) AS booked ON TRUE' || E'\n' ||
    '    WHERE d.id = v_selected_departure_id' || E'\n' ||
    '      AND d.tour_id = v_tour.id' || E'\n' ||
    '      AND d.date = p_booking_date' || E'\n' ||
    '    FOR UPDATE OF d;' || E'\n\n' ||
    '    IF NOT FOUND OR v_avail.status <> ''confirmed'' THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''The selected departure is no longer available. Please choose another time.'');' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    PERFORM set_config(''app.booking_departure_id'', v_selected_departure_id::TEXT, TRUE);' || E'\n' ||
    '    IF NOT EXISTS (' || E'\n' ||
    '        SELECT 1 FROM public.tour_availability AS configured' || E'\n' ||
    '        WHERE configured.tour_id = v_tour.id AND configured.date = p_booking_date' || E'\n' ||
    '    ) THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''No configured availability row exists for this date.'');' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    IF EXISTS (' || E'\n' ||
    '        SELECT 1 FROM public.tour_availability AS blackout' || E'\n' ||
    '        WHERE blackout.tour_id = v_tour.id AND blackout.date = p_booking_date AND blackout.is_blackout = TRUE' || E'\n' ||
    '    ) THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This date is closed for bookings. Please choose another date.'');' || E'\n' ||
    '    END IF;';
  v_old_notice_block TEXT := E'    -- Enforce the configured notice window using the configured local departure time.' || E'\n' ||
    '    IF NULLIF(TRIM(v_tour.departure_time), '''') IS NULL THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This excursion has no confirmed departure time. Please contact our booking team.'');' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    BEGIN' || E'\n' ||
    '        v_departure_at := (p_booking_date::text || '' '' || TRIM(SPLIT_PART(v_tour.departure_time, '','', 1)))::timestamp AT TIME ZONE ''Africa/Cairo'';' || E'\n' ||
    '    EXCEPTION WHEN OTHERS THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This excursion departure time needs operator verification. Please contact our booking team.'');' || E'\n' ||
    '    END;' || E'\n' ||
    '    IF v_departure_at < NOW() + make_interval(hours => GREATEST(0, COALESCE(v_tour.minimum_booking_notice_hours, 12))) THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This departure is inside the minimum booking notice period. Please choose a later date.'');' || E'\n' ||
    '    END IF;';
  v_new_notice_block TEXT := E'    -- Enforce minimum notice against the selected slot, not the first tour-level time.' || E'\n' ||
    '    IF v_avail.start_time IS NULL THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This departure time needs operator verification. Please contact our booking team.'');' || E'\n' ||
    '    END IF;' || E'\n' ||
    '    BEGIN' || E'\n' ||
    '        v_departure_at := (p_booking_date::text || '' '' || TRIM(v_avail.start_time::TEXT))::timestamp AT TIME ZONE ''Africa/Cairo'';' || E'\n' ||
    '    EXCEPTION WHEN OTHERS THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This departure time needs operator verification. Please contact our booking team.'');' || E'\n' ||
    '    END;' || E'\n' ||
    '    IF v_departure_at < NOW() + make_interval(hours => GREATEST(0, COALESCE(v_tour.minimum_booking_notice_hours, 12))) THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This departure is inside the minimum booking notice period. Please choose a later date.'');' || E'\n' ||
    '    END IF;';
  v_notice_anchor TEXT := '    -- 7. Tour-Specific Extras Validation & Pricing';
  v_old_capacity_status TEXT := '    IF v_avail.status IN (''unavailable'', ''sold_out'') THEN';
  v_new_capacity_status TEXT := '    IF v_avail.status <> ''confirmed'' THEN';
  v_old_final_capacity TEXT := E'    UPDATE public.tour_availability' || E'\n' ||
    '    SET booked_count = booked_count + v_total_guests,' || E'\n' ||
    '        status = CASE ' || E'\n' ||
    '            WHEN (booked_count + v_total_guests) >= max_capacity THEN ''sold_out''' || E'\n' ||
    '            ELSE ''available''' || E'\n' ||
    '        END,' || E'\n' ||
    '        updated_at = NOW()' || E'\n' ||
    '    WHERE id = v_avail.id;';
  v_new_final_capacity TEXT := E'    UPDATE public.tour_availability AS daily' || E'\n' ||
    '    SET max_capacity = coalesce((' || E'\n' ||
    '          SELECT sum(d.capacity)::INTEGER FROM public.departures AS d' || E'\n' ||
    '          WHERE d.tour_id = v_tour.id AND d.date = p_booking_date AND d.status NOT IN (''cancelled'',''completed'')' || E'\n' ||
    '        ),0),' || E'\n' ||
    '        booked_count = coalesce((' || E'\n' ||
    '          SELECT sum(d.booked_passengers)::INTEGER FROM public.departures AS d' || E'\n' ||
    '          WHERE d.tour_id = v_tour.id AND d.date = p_booking_date AND d.status NOT IN (''cancelled'',''completed'')' || E'\n' ||
    '        ),0),' || E'\n' ||
    '        status = CASE' || E'\n' ||
    '          WHEN daily.is_blackout THEN ''unavailable''' || E'\n' ||
    '          WHEN NOT EXISTS (SELECT 1 FROM public.departures AS d WHERE d.tour_id = v_tour.id AND d.date = p_booking_date AND d.status = ''confirmed'') THEN ''unavailable''' || E'\n' ||
    '          WHEN EXISTS (SELECT 1 FROM public.departures AS d WHERE d.tour_id = v_tour.id AND d.date = p_booking_date AND d.status = ''confirmed'' AND d.remaining_capacity > 0) THEN ''available''' || E'\n' ||
    '          ELSE ''sold_out''' || E'\n' ||
    '        END,' || E'\n' ||
    '        departure_id = NULL,' || E'\n' ||
    '        updated_at = NOW()' || E'\n' ||
    '    WHERE daily.tour_id = v_tour.id AND daily.date = p_booking_date;';
  v_old_return TEXT := E'        ''bookingDate'', p_booking_date,' || E'\n' ||
    '        ''isDuplicate'', false';
  v_new_return TEXT := E'        ''bookingDate'', p_booking_date,' || E'\n' ||
    '        ''departureId'', v_selected_departure_id,' || E'\n' ||
    '        ''departureTime'', v_avail.start_time,' || E'\n' ||
    '        ''isDuplicate'', false';
  v_patched INTEGER := 0;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    WHERE p.pronamespace = 'private'::regnamespace
      AND p.proname = 'create_booking_atomic'
      AND p.pronargs IN (18,19)
  LOOP
    v_definition := pg_get_functiondef(v_signature);

    IF position(v_old_declaration in v_definition) = 0
       OR position(v_old_payload in v_definition) = 0
       OR position(v_old_selection in v_definition) = 0
       OR position(v_old_notice_block in v_definition) = 0
       OR position(v_notice_anchor in v_definition) = 0
       OR position(v_old_capacity_status in v_definition) = 0
       OR position(v_old_final_capacity in v_definition) = 0
       OR position(v_old_return in v_definition) = 0 THEN
      RAISE EXCEPTION 'Booking function % no longer matches the reviewed multi-departure anchors.', v_signature;
    END IF;

    v_definition := replace(v_definition, v_old_declaration, v_new_declaration);
    v_definition := replace(v_definition, v_old_payload, v_new_payload);
    v_definition := replace(v_definition, v_old_selection, v_new_selection);
    v_definition := replace(v_definition, v_old_notice_block, '');
    v_definition := replace(v_definition, v_notice_anchor, v_new_notice_block || E'\n\n' || v_notice_anchor);
    v_definition := replace(v_definition, v_old_capacity_status, v_new_capacity_status);
    v_definition := replace(v_definition, v_old_final_capacity, v_new_final_capacity);
    v_definition := replace(v_definition, v_old_return, v_new_return);

    EXECUTE v_definition;
    v_patched := v_patched + 1;
  END LOOP;

  IF v_patched <> 2 THEN
    RAISE EXCEPTION 'Expected to patch both private booking implementations; patched %.', v_patched;
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.create_booking_atomic_with_departure(
  p_tour_identifier TEXT,
  p_booking_date DATE,
  p_adult_count INTEGER,
  p_child_count INTEGER,
  p_infant_count INTEGER,
  p_customer_first_name TEXT,
  p_customer_last_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_customer_country TEXT,
  p_customer_hotel TEXT,
  p_pickup_location_id TEXT,
  p_pickup_room_number TEXT,
  p_extras JSONB,
  p_coupon_code TEXT,
  p_payment_method TEXT,
  p_special_requests TEXT,
  p_idempotency_key TEXT,
  p_tour_language TEXT,
  p_customer_locale TEXT,
  p_departure_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF p_departure_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please select a departure time before completing this booking.');
  END IF;

  PERFORM set_config('app.booking_departure_id', p_departure_id::TEXT, TRUE);

  RETURN public.create_booking_atomic_with_locale(
    p_tour_identifier,
    p_booking_date,
    p_adult_count,
    p_child_count,
    p_infant_count,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_email,
    p_customer_phone,
    p_customer_country,
    p_customer_hotel,
    p_pickup_location_id,
    p_pickup_room_number,
    p_extras,
    p_coupon_code,
    p_payment_method,
    p_special_requests,
    p_idempotency_key,
    p_tour_language,
    p_customer_locale
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_booking_atomic_with_departure(TEXT,DATE,INTEGER,INTEGER,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic_with_departure(TEXT,DATE,INTEGER,INTEGER,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID) TO anon,authenticated,service_role;

COMMENT ON FUNCTION public.create_booking_atomic_with_departure(TEXT,DATE,INTEGER,INTEGER,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID)
IS 'Creates a booking atomically against the exact confirmed departure slot selected by the customer.';

NOTIFY pgrst, 'reload schema';
COMMIT;
