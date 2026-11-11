-- Booking must only accept dates that an operator explicitly scheduled.
-- Missing availability rows are closed; no default seat capacity is fabricated.
BEGIN;

ALTER TABLE public.tour_availability
  ALTER COLUMN status SET DEFAULT 'unavailable',
  ALTER COLUMN max_capacity SET DEFAULT 0;

DO $migration$
DECLARE
  v_schedule_oid oid;
  v_schedule_definition text;
  v_booking_oid oid;
  v_booking_definition text;
  v_start integer;
  v_for_update_offset integer;
  v_end integer;
  v_new_block text := $new$
    -- Require an explicitly configured availability row; never create a
    -- departure or capacity as a side effect of a guest booking.
    SELECT * INTO v_avail
    FROM public.tour_availability
    WHERE tour_id = v_tour.id
      AND date = p_booking_date
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No confirmed departure is scheduled for this date.'
        );
    END IF;
$new$;
BEGIN
  SELECT p.oid
    INTO v_schedule_oid
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND p.proname = 'get_tour_availability_schedule'
    AND p.pronargs = 3;

  IF v_schedule_oid IS NULL THEN
    RAISE EXCEPTION 'Expected private.get_tour_availability_schedule/3 was not found';
  END IF;

  v_schedule_definition := pg_get_functiondef(v_schedule_oid);

  v_schedule_definition := regexp_replace(
    v_schedule_definition,
    'COALESCE\(ta\.max_capacity,[[:space:]]*v_tour\.max_guests,[[:space:]]*30\)',
    'COALESCE(ta.max_capacity, 0)',
    'gi'
  );

  v_schedule_definition := replace(
    v_schedule_definition,
    $old$      WHEN ta.status = 'unavailable' THEN 'unavailable'$old$,
    $new$      WHEN ta.id IS NULL THEN 'unavailable'
      WHEN ta.status = 'unavailable' THEN 'unavailable'$new$
  );

  v_schedule_definition := replace(
    v_schedule_definition,
    $old$      WHEN ta.status IN ('unavailable', 'sold_out') THEN FALSE$old$,
    $new$      WHEN ta.id IS NULL THEN FALSE
      WHEN ta.status IN ('unavailable', 'sold_out') THEN FALSE$new$
  );

  v_schedule_definition := replace(
    v_schedule_definition,
    $old$(COALESCE(ta.status, '') = 'unavailable') AS is_blackout$old$,
    $new$(ta.id IS NULL OR COALESCE(ta.status, '') = 'unavailable') AS is_blackout$new$
  );

  v_schedule_definition := replace(
    v_schedule_definition,
    $old$COALESCE(v_tour.departure_time, '08:30 AM') AS departure_time$old$,
    $new$CASE WHEN ta.id IS NULL THEN NULL ELSE v_tour.departure_time END AS departure_time$new$
  );

  IF v_schedule_definition ~* 'COALESCE\(ta\.max_capacity,[[:space:]]*v_tour\.max_guests,[[:space:]]*30\)' THEN
    RAISE EXCEPTION 'Availability schedule still contains a fabricated capacity fallback';
  END IF;

  IF position('ta.id IS NULL THEN ''unavailable''' IN v_schedule_definition) = 0
     OR position('ta.id IS NULL THEN FALSE' IN v_schedule_definition) = 0 THEN
    RAISE EXCEPTION 'Availability schedule was not safely changed to fail closed';
  END IF;

  EXECUTE v_schedule_definition;

  SELECT p.oid
    INTO v_booking_oid
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND p.proname = 'create_booking_atomic'
    AND p.pronargs = 18;

  IF v_booking_oid IS NULL THEN
    RAISE EXCEPTION 'Expected private.create_booking_atomic/18 was not found';
  END IF;

  v_booking_definition := pg_get_functiondef(v_booking_oid);
  v_start := position(
    'v_default_capacity := GREATEST(1, COALESCE(v_tour.max_guests, 20));'
    IN v_booking_definition
  );

  IF v_start > 0 THEN
    v_for_update_offset := position(
      'FOR UPDATE;'
      IN substring(v_booking_definition FROM v_start)
    );

    IF v_for_update_offset = 0 THEN
      RAISE EXCEPTION 'Could not locate the booking availability lock boundary';
    END IF;

    v_end := v_start + v_for_update_offset + length('FOR UPDATE;') - 1;

    v_booking_definition :=
      substring(v_booking_definition FROM 1 FOR v_start - 1)
      || v_new_block
      || substring(v_booking_definition FROM v_end + 1);

    EXECUTE v_booking_definition;
  ELSIF position('INSERT INTO public.tour_availability' IN v_booking_definition) > 0 THEN
    RAISE EXCEPTION 'Booking function still auto-creates availability but its expected block changed';
  ELSE
    RAISE NOTICE 'Booking function already requires an explicit availability row';
  END IF;

  IF position('v_default_capacity := GREATEST(1, COALESCE(v_tour.max_guests, 20));' IN v_booking_definition) > 0 THEN
    RAISE EXCEPTION 'Booking function still contains a fabricated default capacity';
  END IF;
END
$migration$;

COMMIT;
