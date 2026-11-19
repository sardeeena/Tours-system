-- Keep guest-facing and server-side child pricing identical, and enforce the
-- tour's configured booking-notice window at the database boundary.
--
-- The function body is rewritten only when its expected source fragments match.
-- This prevents a migration from silently applying to an unexpected function
-- revision. No booking rows or availability records are changed.
DO $migration$
DECLARE
  v_signature regprocedure := to_regprocedure(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)'
  );
  v_definition text;
  v_old_declaration text := '    v_idempotency_payload JSONB;';
  v_new_declaration text := '    v_idempotency_payload JSONB;' || E'\n' || '    v_departure_at TIMESTAMPTZ;';
  v_old_lookup text := E'    IF NOT FOUND THEN\n        RETURN jsonb_build_object(''success'', false, ''error'', ''The requested excursion is either unavailable or unpublished.'');\n    END IF;';
  v_new_lookup text := E'    IF NOT FOUND THEN\n        RETURN jsonb_build_object(''success'', false, ''error'', ''The requested excursion is either unavailable or unpublished.'');\n    END IF;\n\n' ||
    '    -- Enforce the configured notice window using Egypt local departure time.' || E'\n' ||
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
  v_new_pricing text := '    v_subtotal := (p_adult_count * v_tour.price) + (COALESCE(p_child_count, 0) * COALESCE(v_tour.child_price, ROUND(v_tour.price * 0.50, 2)));';
BEGIN
  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'Expected private.create_booking_atomic signature was not found.';
  END IF;

  v_definition := pg_get_functiondef(v_signature);

  IF position(v_old_declaration in v_definition) = 0
     OR position(v_old_lookup in v_definition) = 0
     OR position(v_old_pricing in v_definition) = 0 THEN
    RAISE EXCEPTION 'Booking function source no longer matches the reviewed migration anchors; stop and review manually.';
  END IF;

  v_definition := replace(v_definition, v_old_declaration, v_new_declaration);
  v_definition := replace(v_definition, v_old_lookup, v_new_lookup);
  v_definition := replace(v_definition, v_old_pricing, v_new_pricing);

  EXECUTE v_definition;
END;
$migration$;

COMMENT ON FUNCTION private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text)
IS 'Atomic booking creation with database-enforced per-tour child pricing and Egypt-local minimum departure notice.';
