-- Keep customer-facing and server-side pricing identical, and enforce
-- minimum booking notice at the database boundary.
--
-- Both private booking implementations are used: the legacy public wrapper
-- calls the 18-argument function, while the locale-aware booking flow calls
-- the 19-argument function. Patch both deliberately and fail closed if either
-- implementation no longer matches the reviewed source anchors.
DO $migration$
DECLARE
  v_signature regprocedure;
  v_definition text;
  v_old_declaration text := '    v_idempotency_payload JSONB;';
  v_new_declaration text := '    v_idempotency_payload JSONB;' || E'\n' || '    v_departure_at TIMESTAMPTZ;';
  v_old_lookup text := E'    IF NOT FOUND THEN\n        RETURN jsonb_build_object(''success'', false, ''error'', ''The requested excursion is either unavailable or unpublished.'');\n    END IF;';
  v_new_lookup text := v_old_lookup || E'\n\n' ||
    '    -- Enforce the configured notice window using the configured local departure time.' || E'\n' ||
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
  v_old_pricing text := '    v_subtotal := (p_adult_count * v_tour.price) + (COALESCE(p_child_count, 0) * (v_tour.price * 0.50));';
  v_old_capacity_guard text := '    IF v_avail.status IN (''unavailable'', ''sold_out'') THEN';
  v_new_capacity_guard text := '    IF v_avail.departure_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.departures AS d WHERE d.id = v_avail.departure_id AND d.tour_id = v_tour.id AND d.date = p_booking_date AND d.status = ''confirmed'') THEN' || E'\n' ||
    '        RETURN jsonb_build_object(''success'', false, ''error'', ''This date has no operator-confirmed departure. Please choose another date or contact our booking team.'');' || E'\n' ||
    '    END IF;' || E'\n' || v_old_capacity_guard;
  v_new_pricing text := E'    IF COALESCE(v_tour.tour_type, ''Shared'') = ''Private'' THEN' || E'\n' ||
    '        IF COALESCE(v_tour.private_price, 0) <= 0 THEN' || E'\n' ||
    '            RETURN jsonb_build_object(''success'', false, ''error'', ''The private per-person rate is not configured for this excursion.'');' || E'\n' ||
    '        END IF;' || E'\n' ||
    '        v_subtotal := (p_adult_count + COALESCE(p_child_count, 0)) * v_tour.private_price;' || E'\n' ||
    '    ELSE' || E'\n' ||
    '        v_subtotal := (p_adult_count * v_tour.price) + (COALESCE(p_child_count, 0) * COALESCE(v_tour.child_price, ROUND(v_tour.price * 0.50, 2)));' || E'\n' ||
    '    END IF;';
  v_patched integer := 0;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    WHERE p.pronamespace = 'private'::regnamespace
      AND p.proname = 'create_booking_atomic'
      AND p.pronargs IN (18, 19)
  LOOP
    v_definition := pg_get_functiondef(v_signature);

    IF position(v_old_declaration in v_definition) = 0
       OR position(v_old_lookup in v_definition) = 0
       OR position(v_old_pricing in v_definition) = 0
       OR position(v_old_capacity_guard in v_definition) = 0 THEN
      RAISE EXCEPTION 'Booking function % no longer matches the reviewed migration anchors; stop and review manually.', v_signature;
    END IF;

    v_definition := replace(v_definition, v_old_declaration, v_new_declaration);
    v_definition := replace(v_definition, v_old_lookup, v_new_lookup);
    v_definition := replace(v_definition, v_old_pricing, v_new_pricing);
    v_definition := replace(v_definition, v_old_capacity_guard, v_new_capacity_guard);

    EXECUTE v_definition;
    v_patched := v_patched + 1;
  END LOOP;

  IF v_patched <> 2 THEN
    RAISE EXCEPTION 'Expected to patch both 18- and 19-argument booking implementations; patched %.', v_patched;
  END IF;
END;
$migration$;

COMMENT ON FUNCTION private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)
IS 'Atomic booking creation with per-tour child pricing, per-person private-tour pricing and Egypt-local minimum departure notice.';

COMMENT ON FUNCTION private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)
IS 'Locale-aware atomic booking implementation with per-tour child pricing, per-person private-tour pricing and Egypt-local minimum departure notice.';
