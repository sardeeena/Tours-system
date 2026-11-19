-- Multi-departure capacity model.
-- tour_availability remains one daily summary row; each independently bookable
-- slot is stored in departures, which is the source of truth for slot capacity.
-- Existing bookings are never reassigned or rewritten by this migration.

BEGIN;

ALTER TABLE public.tour_availability
  ADD COLUMN IF NOT EXISTS is_blackout BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION private.upsert_departure_with_availability(
  p_departure_id UUID,
  p_tour_id UUID,
  p_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_capacity INTEGER,
  p_status TEXT,
  p_vessel_id UUID,
  p_guide_id UUID,
  p_driver_id UUID,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tour public.tours%ROWTYPE;
  v_vessel public.vessels%ROWTYPE;
  v_guide public.guides%ROWTYPE;
  v_existing public.departures%ROWTYPE;
  v_availability public.tour_availability%ROWTYPE;
  v_departure public.departures%ROWTYPE;
  v_new_start_at TIMESTAMPTZ;
  v_new_end_at TIMESTAMPTZ;
  v_booked INTEGER := 0;
  v_daily_capacity INTEGER := 0;
  v_daily_booked INTEGER := 0;
  v_has_confirmed BOOLEAN := FALSE;
  v_has_open_confirmed BOOLEAN := FALSE;
  v_availability_status TEXT;
  v_status TEXT := lower(coalesce(nullif(btrim(p_status), ''), 'scheduled'));
BEGIN
  IF NOT (
    coalesce(auth.role(),'') = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        (p_departure_id IS NULL AND public.has_permission('operations.create'))
        OR (p_departure_id IS NOT NULL AND public.has_permission('operations.update'))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to create or update this departure' USING ERRCODE = '42501';
  END IF;

  IF p_tour_id IS NULL OR p_date IS NULL
     OR p_start_time IS NULL OR btrim(p_start_time) = ''
     OR p_end_time IS NULL OR btrim(p_end_time) = ''
     OR p_capacity IS NULL OR p_capacity < 1 OR p_capacity > 500 THEN
    RAISE EXCEPTION 'A published tour, date, actual start/end times and capacity between 1 and 500 are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_time !~ '^[0-9]{2}:[0-9]{2}$'
     OR p_end_time !~ '^[0-9]{2}:[0-9]{2}$' THEN
    RAISE EXCEPTION 'Departure times must use 24-hour HH:MM format' USING ERRCODE = '22023';
  END IF;
  PERFORM p_start_time::TIME;
  PERFORM p_end_time::TIME;
  v_new_start_at := ((p_date + p_start_time::TIME) AT TIME ZONE 'Africa/Cairo');
  v_new_end_at := (
    (
      p_date + p_end_time::TIME
      + CASE WHEN p_end_time::TIME <= p_start_time::TIME THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
    ) AT TIME ZONE 'Africa/Cairo'
  );

  IF p_departure_id IS NULL AND p_date < (now() AT TIME ZONE 'Africa/Cairo')::DATE THEN
    RAISE EXCEPTION 'A new departure cannot be scheduled in the past' USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('scheduled','confirmed','boarding','in_progress','completed','cancelled') THEN
    RAISE EXCEPTION 'Unsupported departure status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tour
  FROM public.tours
  WHERE id = p_tour_id AND status = 'published'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected tour is not published or no longer exists' USING ERRCODE = 'P0002';
  END IF;

  IF p_end_time = p_start_time AND COALESCE(v_tour.duration_hours, 0) < 24 THEN
    RAISE EXCEPTION 'Equal start and end times are valid only for excursions lasting at least 24 hours'
      USING ERRCODE = '22023';
  END IF;
  IF p_end_time < p_start_time AND COALESCE(v_tour.duration_hours, 0) <= 0 THEN
    RAISE EXCEPTION 'An overnight departure requires a configured tour duration'
      USING ERRCODE = '22023';
  END IF;

  IF p_vessel_id IS NOT NULL THEN
    SELECT * INTO v_vessel FROM public.vessels WHERE id = p_vessel_id FOR SHARE;
    IF NOT FOUND OR NOT v_vessel.is_active THEN
      RAISE EXCEPTION 'The selected vessel does not exist or is inactive' USING ERRCODE = '22023';
    END IF;
    IF p_capacity > v_vessel.passenger_capacity THEN
      RAISE EXCEPTION 'Departure capacity exceeds selected vessel capacity (%)', v_vessel.passenger_capacity
        USING ERRCODE = '22023';
    END IF;
    IF v_vessel.safety_inspection_expiry IS NOT NULL
       AND v_vessel.safety_inspection_expiry < p_date THEN
      RAISE EXCEPTION 'The selected vessel safety inspection expires before this departure date'
        USING ERRCODE = '22023';
    END IF;
    IF v_vessel.next_maintenance_date IS NOT NULL
       AND v_vessel.next_maintenance_date <= p_date THEN
      RAISE EXCEPTION 'The selected vessel is due for maintenance on or before this departure date'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_guide_id IS NOT NULL THEN
    SELECT * INTO v_guide FROM public.guides WHERE id = p_guide_id FOR SHARE;
    IF NOT FOUND OR NOT v_guide.is_active THEN
      RAISE EXCEPTION 'The selected guide does not exist or is inactive' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_driver_id IS NOT NULL THEN
    SELECT * INTO v_guide FROM public.guides WHERE id = p_driver_id FOR SHARE;
    IF NOT FOUND OR NOT v_guide.is_active THEN
      RAISE EXCEPTION 'The selected driver does not exist or is inactive' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_vessel_id IS NOT NULL THEN
    PERFORM 1
    FROM public.departures AS d
    WHERE d.id IS DISTINCT FROM p_departure_id
      AND d.date BETWEEN p_date - 1 AND p_date + 1
      AND d.vessel_id = p_vessel_id
      AND d.status NOT IN ('cancelled','completed')
      AND ((d.date + d.start_time::TIME) AT TIME ZONE 'Africa/Cairo') < v_new_end_at
      AND (
        (
          d.date + d.end_time::TIME
          + CASE WHEN d.end_time::TIME <= d.start_time::TIME THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
        ) AT TIME ZONE 'Africa/Cairo'
      ) > v_new_start_at
    FOR UPDATE;
    IF FOUND THEN
      RAISE EXCEPTION 'The selected vessel is already assigned to an overlapping departure.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_guide_id IS NOT NULL THEN
    PERFORM 1
    FROM public.departures AS d
    WHERE d.id IS DISTINCT FROM p_departure_id
      AND d.date BETWEEN p_date - 1 AND p_date + 1
      AND d.guide_id = p_guide_id
      AND d.status NOT IN ('cancelled','completed')
      AND ((d.date + d.start_time::TIME) AT TIME ZONE 'Africa/Cairo') < v_new_end_at
      AND (
        (
          d.date + d.end_time::TIME
          + CASE WHEN d.end_time::TIME <= d.start_time::TIME THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
        ) AT TIME ZONE 'Africa/Cairo'
      ) > v_new_start_at
    FOR UPDATE;
    IF FOUND THEN
      RAISE EXCEPTION 'The selected guide is already assigned to an overlapping departure.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_driver_id IS NOT NULL THEN
    PERFORM 1
    FROM public.departures AS d
    WHERE d.id IS DISTINCT FROM p_departure_id
      AND d.date BETWEEN p_date - 1 AND p_date + 1
      AND d.driver_id = p_driver_id
      AND d.status NOT IN ('cancelled','completed')
      AND ((d.date + d.start_time::TIME) AT TIME ZONE 'Africa/Cairo') < v_new_end_at
      AND (
        (
          d.date + d.end_time::TIME
          + CASE WHEN d.end_time::TIME <= d.start_time::TIME THEN INTERVAL '1 day' ELSE INTERVAL '0 day' END
        ) AT TIME ZONE 'Africa/Cairo'
      ) > v_new_start_at
    FOR UPDATE;
    IF FOUND THEN
      RAISE EXCEPTION 'The selected driver is already assigned to an overlapping departure.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_availability
  FROM public.tour_availability
  WHERE tour_id = p_tour_id AND date = p_date
  FOR UPDATE;

  -- A legacy booking with no departure assignment cannot safely be allocated
  -- to a guessed time. Leave it untouched and block slot creation for that date.
  IF EXISTS (
    SELECT 1
    FROM public.bookings
    WHERE tour_id = p_tour_id
      AND booking_date = p_date
      AND status <> 'cancelled'
      AND departure_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Unassigned legacy bookings exist for this date. Reconcile them before creating or changing departures.'
      USING ERRCODE = '23514';
  END IF;

  IF p_departure_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.departures
    WHERE id = p_departure_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The departure being updated no longer exists' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.tour_id <> p_tour_id OR v_existing.date <> p_date THEN
      RAISE EXCEPTION 'A departure cannot be moved to another tour or date through this workflow'
        USING ERRCODE = '22023';
    END IF;

    SELECT coalesce(sum(adult_count + child_count + infant_count), 0)::INTEGER
    INTO v_booked
    FROM public.bookings
    WHERE departure_id = p_departure_id AND status <> 'cancelled';

    IF coalesce(v_existing.booked_passengers,0) <> v_booked THEN
      RAISE EXCEPTION 'Departure capacity ledger and assigned booking passenger totals do not match. Reconcile this slot before changing it.'
        USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.bookings AS b
      WHERE b.departure_id = p_departure_id
        AND b.status <> 'cancelled'
        AND (
          v_existing.vessel_id IS DISTINCT FROM p_vessel_id
          OR v_existing.guide_id IS DISTINCT FROM p_guide_id
          OR v_existing.driver_id IS DISTINCT FROM p_driver_id
        )
    ) THEN
      RAISE EXCEPTION 'Resource assignments cannot be changed on a departure with active bookings. Reconcile the manifest first.'
        USING ERRCODE = '23514';
    END IF;

    IF v_booked > p_capacity THEN
      RAISE EXCEPTION 'New capacity is below the current booked passenger count (%)', v_booked
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.departures
    SET start_time = p_start_time,
        end_time = p_end_time,
        capacity = p_capacity,
        booked_passengers = v_booked,
        remaining_capacity = greatest(0, p_capacity - v_booked),
        status = v_status,
        vessel_id = p_vessel_id,
        guide_id = p_guide_id,
        driver_id = p_driver_id,
        notes = nullif(btrim(coalesce(p_notes,'')), ''),
        updated_at = now()
    WHERE id = p_departure_id
    RETURNING * INTO v_departure;
  ELSE
    INSERT INTO public.departures (
      tour_id,date,start_time,end_time,capacity,booked_passengers,remaining_capacity,
      status,vessel_id,guide_id,driver_id,notes
    ) VALUES (
      p_tour_id,p_date,p_start_time,p_end_time,p_capacity,0,p_capacity,
      v_status,p_vessel_id,p_guide_id,p_driver_id,nullif(btrim(coalesce(p_notes,'')),'')
    )
    RETURNING * INTO v_departure;
  END IF;

  SELECT
    coalesce(sum(d.capacity) FILTER (WHERE d.status NOT IN ('cancelled','completed')), 0)::INTEGER,
    coalesce(sum(d.booked_passengers) FILTER (WHERE d.status NOT IN ('cancelled','completed')), 0)::INTEGER,
    coalesce(bool_or(d.status = 'confirmed'), FALSE),
    coalesce(bool_or(d.status = 'confirmed' AND d.remaining_capacity > 0), FALSE)
  INTO v_daily_capacity, v_daily_booked, v_has_confirmed, v_has_open_confirmed
  FROM public.departures AS d
  WHERE d.tour_id = p_tour_id AND d.date = p_date;

  v_availability_status := CASE
    WHEN coalesce(v_availability.is_blackout, FALSE) THEN 'unavailable'
    WHEN NOT v_has_confirmed THEN 'unavailable'
    WHEN v_has_open_confirmed THEN 'available'
    ELSE 'sold_out'
  END;

  INSERT INTO public.tour_availability (
    tour_id,date,status,max_capacity,booked_count,notes,departure_id,is_blackout
  ) VALUES (
    p_tour_id,p_date,v_availability_status,v_daily_capacity,v_daily_booked,
    coalesce(v_availability.notes, 'Daily summary of independently bookable departure slots.'),
    NULL,
    FALSE
  )
  ON CONFLICT (tour_id,date) DO UPDATE
  SET status = CASE
        WHEN public.tour_availability.is_blackout THEN 'unavailable'
        ELSE EXCLUDED.status
      END,
      max_capacity = EXCLUDED.max_capacity,
      booked_count = EXCLUDED.booked_count,
      departure_id = NULL,
      updated_at = now();

  RETURN jsonb_build_object('success', true, 'departure', to_jsonb(v_departure));
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_departure_with_availability(
  p_departure_id UUID,
  p_tour_id UUID,
  p_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_capacity INTEGER,
  p_status TEXT,
  p_vessel_id UUID,
  p_guide_id UUID,
  p_driver_id UUID,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT (
    coalesce(auth.role(),'') = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (
        (p_departure_id IS NULL AND public.has_permission('operations.create'))
        OR (p_departure_id IS NOT NULL AND public.has_permission('operations.update'))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to create or update this departure' USING ERRCODE = '42501';
  END IF;

  RETURN private.upsert_departure_with_availability(
    p_departure_id,p_tour_id,p_date,p_start_time,p_end_time,p_capacity,
    p_status,p_vessel_id,p_guide_id,p_driver_id,p_notes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_departure_with_availability(UUID,UUID,DATE,TEXT,TEXT,INTEGER,TEXT,UUID,UUID,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_departure_with_availability(UUID,UUID,DATE,TEXT,TEXT,INTEGER,TEXT,UUID,UUID,UUID,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_tour_availability_blackout_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_has_confirmed BOOLEAN := FALSE;
  v_has_open_confirmed BOOLEAN := FALSE;
BEGIN
  IF NEW.is_blackout THEN
    NEW.status := 'unavailable';
    RETURN NEW;
  END IF;

  SELECT
    coalesce(bool_or(d.status = 'confirmed'),FALSE),
    coalesce(bool_or(d.status = 'confirmed' AND d.remaining_capacity > 0),FALSE)
  INTO v_has_confirmed,v_has_open_confirmed
  FROM public.departures AS d
  WHERE d.tour_id = NEW.tour_id AND d.date = NEW.date;

  NEW.status := CASE
    WHEN NOT v_has_confirmed THEN 'unavailable'
    WHEN v_has_open_confirmed THEN 'available'
    ELSE 'sold_out'
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_tour_availability_blackout_status ON public.tour_availability;
CREATE TRIGGER trg_sync_tour_availability_blackout_status
BEFORE INSERT OR UPDATE OF is_blackout
ON public.tour_availability
FOR EACH ROW
EXECUTE FUNCTION private.sync_tour_availability_blackout_status();

CREATE OR REPLACE FUNCTION private.guard_departure_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND EXISTS (
       SELECT 1
       FROM public.bookings AS b
       WHERE b.departure_id = OLD.id
         AND b.status <> 'cancelled'
     ) THEN
    RAISE EXCEPTION 'A departure with active bookings cannot be cancelled until its bookings are resolved.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_departure_status_change ON public.departures;
CREATE TRIGGER trg_guard_departure_status_change
BEFORE UPDATE OF status ON public.departures
FOR EACH ROW
EXECUTE FUNCTION private.guard_departure_status_change();

CREATE OR REPLACE FUNCTION private.assign_booking_to_scheduled_departure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_requested_departure_id UUID;
  v_departure_count INTEGER := 0;
  v_vessel_id UUID;
  v_guide_id UUID;
BEGIN
  v_requested_departure_id := COALESCE(
    NEW.departure_id,
    NULLIF(current_setting('app.booking_departure_id', TRUE), '')::UUID
  );

  IF v_requested_departure_id IS NULL THEN
    SELECT count(*)::INTEGER
    INTO v_departure_count
    FROM public.departures AS d
    WHERE d.tour_id = NEW.tour_id
      AND d.date = NEW.booking_date
      AND d.status = 'confirmed';

    IF v_departure_count = 0 THEN
      RAISE EXCEPTION 'No confirmed departure exists for this tour and date'
        USING ERRCODE = '23514';
    ELSIF v_departure_count > 1 THEN
      RAISE EXCEPTION 'Select a departure time before completing this booking'
        USING ERRCODE = '23514';
    END IF;

    SELECT d.id
    INTO v_requested_departure_id
    FROM public.departures AS d
    WHERE d.tour_id = NEW.tour_id
      AND d.date = NEW.booking_date
      AND d.status = 'confirmed'
    LIMIT 1;
  END IF;

  SELECT d.vessel_id, d.guide_id
  INTO v_vessel_id, v_guide_id
  FROM public.departures AS d
  WHERE d.id = v_requested_departure_id
    AND d.tour_id = NEW.tour_id
    AND d.date = NEW.booking_date
    AND d.status = 'confirmed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected departure does not belong to this tour/date or is not confirmed'
      USING ERRCODE = '23514';
  END IF;

  NEW.departure_id := v_requested_departure_id;
  NEW.assigned_vessel_id := v_vessel_id;
  NEW.assigned_guide_id := v_guide_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sync_scheduled_departure_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_departure_id UUID;
  v_tour_id UUID;
  v_date DATE;
  v_capacity INTEGER;
  v_booked INTEGER;
  v_daily_capacity INTEGER;
  v_daily_booked INTEGER;
  v_has_confirmed BOOLEAN;
  v_has_open_confirmed BOOLEAN;
  v_is_blackout BOOLEAN;
BEGIN
  FOR v_departure_id IN
    SELECT DISTINCT slot_id
    FROM unnest(ARRAY[OLD.departure_id,NEW.departure_id]) AS slot_ids(slot_id)
    WHERE slot_id IS NOT NULL
  LOOP
    SELECT tour_id,date,capacity
    INTO v_tour_id,v_date,v_capacity
    FROM public.departures
    WHERE id = v_departure_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT coalesce(sum(adult_count + child_count + infant_count),0)::INTEGER
    INTO v_booked
    FROM public.bookings
    WHERE departure_id = v_departure_id AND status <> 'cancelled';

    UPDATE public.departures
    SET booked_passengers = v_booked,
        remaining_capacity = greatest(0,capacity-v_booked),
        updated_at = now()
    WHERE id = v_departure_id;

    SELECT
      coalesce(sum(d.capacity) FILTER (WHERE d.status NOT IN ('cancelled','completed')), 0)::INTEGER,
      coalesce(sum(d.booked_passengers) FILTER (WHERE d.status NOT IN ('cancelled','completed')), 0)::INTEGER,
      coalesce(bool_or(d.status = 'confirmed'), FALSE),
      coalesce(bool_or(d.status = 'confirmed' AND d.remaining_capacity > 0), FALSE)
    INTO v_daily_capacity,v_daily_booked,v_has_confirmed,v_has_open_confirmed
    FROM public.departures AS d
    WHERE d.tour_id = v_tour_id AND d.date = v_date;

    SELECT coalesce(ta.is_blackout,FALSE)
    INTO v_is_blackout
    FROM public.tour_availability AS ta
    WHERE ta.tour_id = v_tour_id AND ta.date = v_date;

    UPDATE public.tour_availability AS ta
    SET max_capacity = v_daily_capacity,
        booked_count = v_daily_booked,
        status = CASE
          WHEN coalesce(v_is_blackout,FALSE) THEN 'unavailable'
          WHEN NOT v_has_confirmed THEN 'unavailable'
          WHEN v_has_open_confirmed THEN 'available'
          ELSE 'sold_out'
        END,
        departure_id = NULL,
        updated_at = now()
    WHERE ta.tour_id = v_tour_id AND ta.date = v_date;
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.sync_departure_availability_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_daily_capacity INTEGER;
  v_daily_booked INTEGER;
  v_has_confirmed BOOLEAN;
  v_has_open_confirmed BOOLEAN;
  v_is_blackout BOOLEAN;
BEGIN
  SELECT
    coalesce(sum(d.capacity) FILTER (WHERE d.status NOT IN ('cancelled','completed')), 0)::INTEGER,
    coalesce(sum(d.booked_passengers) FILTER (WHERE d.status NOT IN ('cancelled','completed')), 0)::INTEGER,
    coalesce(bool_or(d.status = 'confirmed'), FALSE),
    coalesce(bool_or(d.status = 'confirmed' AND d.remaining_capacity > 0), FALSE)
  INTO v_daily_capacity,v_daily_booked,v_has_confirmed,v_has_open_confirmed
  FROM public.departures AS d
  WHERE d.tour_id = NEW.tour_id AND d.date = NEW.date;

  SELECT coalesce(ta.is_blackout,FALSE)
  INTO v_is_blackout
  FROM public.tour_availability AS ta
  WHERE ta.tour_id = NEW.tour_id AND ta.date = NEW.date;

  UPDATE public.tour_availability AS ta
  SET max_capacity = v_daily_capacity,
      booked_count = v_daily_booked,
      status = CASE
        WHEN coalesce(v_is_blackout,FALSE) THEN 'unavailable'
        WHEN NOT v_has_confirmed THEN 'unavailable'
        WHEN v_has_open_confirmed THEN 'available'
        ELSE 'sold_out'
      END,
      departure_id = NULL,
      updated_at = now()
  WHERE ta.tour_id = NEW.tour_id AND ta.date = NEW.date;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_scheduled_departure_capacity ON public.bookings;
CREATE TRIGGER trg_sync_scheduled_departure_capacity
AFTER INSERT OR UPDATE OF status,adult_count,child_count,infant_count,departure_id
ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION private.sync_scheduled_departure_capacity();

DROP TRIGGER IF EXISTS trg_sync_departure_availability_status ON public.departures;
CREATE TRIGGER trg_sync_departure_availability_status
AFTER INSERT OR UPDATE OF status,capacity
ON public.departures
FOR EACH ROW
EXECUTE FUNCTION private.sync_departure_availability_status();

REVOKE ALL ON FUNCTION private.upsert_departure_with_availability(UUID,UUID,DATE,TEXT,TEXT,INTEGER,TEXT,UUID,UUID,UUID,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.upsert_departure_with_availability(UUID,UUID,DATE,TEXT,TEXT,INTEGER,TEXT,UUID,UUID,UUID,TEXT) TO service_role;

REVOKE ALL ON FUNCTION private.sync_tour_availability_blackout_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assign_booking_to_scheduled_departure() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_scheduled_departure_capacity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_departure_availability_status() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.get_tour_availability_schedule(
  p_tour_identifier TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  tour_id UUID,
  date DATE,
  status TEXT,
  max_capacity INTEGER,
  booked_count INTEGER,
  remaining_capacity INTEGER,
  is_available BOOLEAN,
  is_blackout BOOLEAN,
  departure_time TEXT,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tour RECORD;
  v_tour_identifier TEXT := NULLIF(BTRIM(p_tour_identifier), '');
  v_is_admin BOOLEAN := COALESCE(
    auth.jwt() ->> 'role' = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (public.has_permission('operations.read') OR public.has_permission('bookings.read'))
    ),
    FALSE
  );
  v_is_privileged BOOLEAN := FALSE;
  v_client_ip TEXT;
  v_today DATE := (now() AT TIME ZONE 'Africa/Cairo')::date;
BEGIN
  IF v_tour_identifier IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tour identifier is required';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Availability start and end dates are required';
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Availability start date must not be after end date';
  END IF;
  IF p_end_date - p_start_date > 365 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Availability date range cannot exceed 366 days';
  END IF;
  IF NOT v_is_admin AND p_start_date < v_today THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Public availability lookup cannot include past dates';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.is_confirmed = TRUE
    ) AND private.has_permission('users.manage')
    INTO v_is_privileged;
  END IF;
  v_is_privileged := v_is_privileged OR COALESCE(auth.jwt() ->> 'role' = 'service_role', FALSE);

  IF NOT v_is_privileged THEN
    BEGIN
      v_client_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip', '');
      IF v_client_ip IS NULL THEN
        v_client_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '');
        IF v_client_ip LIKE '%,%' THEN
          v_client_ip := BTRIM(SPLIT_PART(v_client_ip, ',', 1));
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_client_ip := NULL;
    END;

    IF v_client_ip IS NOT NULL THEN
      v_client_ip := LEFT(BTRIM(v_client_ip), 64);
      PERFORM public.check_atomic_rate_limit(
        'tour_availability_ip',
        v_client_ip,
        INTERVAL '1 minute',
        60,
        'Too many public availability requests. Please wait a moment and try again.'
      );
    END IF;
  END IF;

  SELECT t.* INTO v_tour
  FROM public.tours AS t
  WHERE t.slug = v_tour_identifier OR t.id::text = v_tour_identifier;

  IF NOT FOUND THEN RETURN; END IF;
  IF v_tour.status <> 'published' AND NOT v_is_admin THEN RETURN; END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT generated_date::date AS calendar_date
    FROM generate_series(p_start_date, p_end_date, INTERVAL '1 day') AS generated_date
  ),
  departure_summary AS (
    SELECT
      d.tour_id,
      d.date,
      count(*)::INTEGER AS confirmed_count,
      coalesce(sum(d.capacity),0)::INTEGER AS max_capacity,
      coalesce(sum(greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0))),0)::INTEGER AS booked_count,
      coalesce(sum(greatest(0,d.capacity-greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0)))),0)::INTEGER AS remaining_capacity,
      coalesce(bool_or(
        greatest(0,d.capacity-greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0))) > 0
        AND ((d.date + d.start_time::TIME) AT TIME ZONE 'Africa/Cairo')
          >= now() + make_interval(hours => greatest(0,coalesce(v_tour.minimum_booking_notice_hours,12)))
      ),FALSE) AS has_bookable_slot,
      string_agg(d.start_time, ', ' ORDER BY d.start_time) AS departure_times
    FROM public.departures AS d
    LEFT JOIN LATERAL (
      SELECT coalesce(sum(b.adult_count + b.child_count + b.infant_count),0)::INTEGER AS reserved_count
      FROM public.bookings AS b
      WHERE b.departure_id = d.id AND b.status <> 'cancelled'
    ) AS booked ON TRUE
    WHERE d.tour_id = v_tour.id
      AND d.date BETWEEN p_start_date AND p_end_date
      AND d.status = 'confirmed'
    GROUP BY d.tour_id,d.date
  )
  SELECT
    v_tour.id,
    ds.calendar_date,
    CASE
      WHEN coalesce(ta.is_blackout,FALSE) THEN 'unavailable'
      WHEN coalesce(summary.confirmed_count,0) = 0 THEN 'unavailable'
      WHEN coalesce(summary.remaining_capacity,0) <= 0 THEN 'sold_out'
      WHEN NOT coalesce(summary.has_bookable_slot,FALSE) THEN 'unavailable'
      ELSE 'available'
    END,
    coalesce(summary.max_capacity,0)::INTEGER,
    coalesce(summary.booked_count,0)::INTEGER,
    coalesce(summary.remaining_capacity,0)::INTEGER,
    (
      NOT coalesce(ta.is_blackout,FALSE)
      AND ds.calendar_date >= v_today
      AND coalesce(summary.has_bookable_slot,FALSE)
    ),
    coalesce(ta.is_blackout,FALSE),
    summary.departure_times,
    CASE WHEN v_is_admin THEN ta.notes ELSE NULL END
  FROM date_series AS ds
  LEFT JOIN public.tour_availability AS ta
    ON ta.tour_id = v_tour.id AND ta.date = ds.calendar_date
  LEFT JOIN departure_summary AS summary
    ON summary.tour_id = v_tour.id AND summary.date = ds.calendar_date
  ORDER BY ds.calendar_date ASC;
END;
$function$;

-- Keep the existing public RPC contract while delegating to the new
-- departure-backed schedule implementation.
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.get_tour_availability_schedule(
    p_tour_identifier,
    p_start_date,
    p_end_date
  );
$function$;

REVOKE ALL ON FUNCTION private.get_tour_availability_schedule(TEXT,DATE,DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_tour_availability_schedule(TEXT,DATE,DATE) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_tour_availability_schedule(TEXT,DATE,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tour_availability_schedule(TEXT,DATE,DATE) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_tour_availability_schedule(TEXT,DATE,DATE)
IS 'Returns date-level availability aggregated from independently bookable confirmed departure slots.';

CREATE OR REPLACE FUNCTION private.get_tour_departure_slots(
  p_tour_identifier TEXT,
  p_date DATE
)
RETURNS TABLE(
  departure_id UUID,
  tour_id UUID,
  date DATE,
  start_time TEXT,
  end_time TEXT,
  status TEXT,
  capacity INTEGER,
  booked_count INTEGER,
  remaining_capacity INTEGER,
  is_available BOOLEAN,
  minimum_notice_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tour RECORD;
  v_tour_identifier TEXT := NULLIF(BTRIM(p_tour_identifier), '');
  v_is_admin BOOLEAN := COALESCE(
    auth.jwt() ->> 'role' = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND (public.has_permission('operations.read') OR public.has_permission('bookings.read'))
    ),
    FALSE
  );
  v_client_ip TEXT;
  v_today DATE := (now() AT TIME ZONE 'Africa/Cairo')::date;
BEGIN
  IF v_tour_identifier IS NULL OR p_date IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tour identifier and departure date are required';
  END IF;
  IF NOT v_is_admin AND p_date < v_today THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Public departure lookup cannot include past dates';
  END IF;

  BEGIN
    v_client_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip', '');
    IF v_client_ip IS NULL THEN
      v_client_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '');
      IF v_client_ip LIKE '%,%' THEN
        v_client_ip := BTRIM(SPLIT_PART(v_client_ip, ',', 1));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;

  IF v_client_ip IS NOT NULL AND NOT v_is_admin THEN
    v_client_ip := LEFT(BTRIM(v_client_ip),64);
    PERFORM public.check_atomic_rate_limit(
      'tour_departure_slots_ip',
      v_client_ip,
      INTERVAL '1 minute',
      60,
      'Too many departure requests. Please wait a moment and try again.'
    );
  END IF;

  SELECT t.* INTO v_tour
  FROM public.tours AS t
  WHERE t.slug = v_tour_identifier OR t.id::text = v_tour_identifier;

  IF NOT FOUND OR (v_tour.status <> 'published' AND NOT v_is_admin) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.tour_id,
    d.date,
    d.start_time,
    d.end_time,
    d.status,
    d.capacity,
    greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0))::INTEGER,
    greatest(0,d.capacity-greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0)))::INTEGER,
    (
      d.status = 'confirmed'
      AND NOT coalesce(ta.is_blackout,FALSE)
      AND greatest(0,d.capacity-greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0))) > 0
      AND ((d.date + d.start_time::TIME) AT TIME ZONE 'Africa/Cairo')
        >= now() + make_interval(hours => greatest(0,coalesce(v_tour.minimum_booking_notice_hours,12)))
    ),
    greatest(0,coalesce(v_tour.minimum_booking_notice_hours,12))::INTEGER
  FROM public.departures AS d
  LEFT JOIN public.tour_availability AS ta
    ON ta.tour_id = d.tour_id AND ta.date = d.date
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(b.adult_count + b.child_count + b.infant_count),0)::INTEGER AS reserved_count
    FROM public.bookings AS b
    WHERE b.departure_id = d.id AND b.status <> 'cancelled'
  ) AS booked ON TRUE
  WHERE d.tour_id = v_tour.id
    AND d.date = p_date
    AND d.status = 'confirmed'
    AND ta.id IS NOT NULL
    AND NOT coalesce(ta.is_blackout,FALSE)
    -- Keep the public selector from labelling a still-closed-by-notice slot as sold out.
    AND (
      greatest(0,d.capacity-greatest(coalesce(d.booked_passengers,0),coalesce(booked.reserved_count,0))) = 0
      OR ((d.date + d.start_time::TIME) AT TIME ZONE 'Africa/Cairo')
        >= now() + make_interval(hours => greatest(0,coalesce(v_tour.minimum_booking_notice_hours,12)))
    )
  ORDER BY d.start_time,d.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_tour_departure_slots(
  p_tour_identifier TEXT,
  p_date DATE
)
RETURNS TABLE(
  departure_id UUID,
  tour_id UUID,
  date DATE,
  start_time TEXT,
  end_time TEXT,
  status TEXT,
  capacity INTEGER,
  booked_count INTEGER,
  remaining_capacity INTEGER,
  is_available BOOLEAN,
  minimum_notice_hours INTEGER
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT *
  FROM private.get_tour_departure_slots(p_tour_identifier,p_date);
$function$;

REVOKE ALL ON FUNCTION private.get_tour_departure_slots(TEXT,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_tour_departure_slots(TEXT,DATE) TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_tour_departure_slots(TEXT,DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tour_departure_slots(TEXT,DATE) TO anon,authenticated,service_role;

COMMENT ON COLUMN public.tour_availability.is_blackout
IS 'Explicit operator blackout override; daily status and capacity are otherwise derived from departure slots.';

COMMENT ON FUNCTION private.get_tour_availability_schedule(TEXT,DATE,DATE)
IS 'Returns date-level aggregates from confirmed departure slots; each slot retains its own independently bookable capacity.';

COMMENT ON FUNCTION public.get_tour_departure_slots(TEXT,DATE)
IS 'Returns independently bookable confirmed departure slots and per-slot remaining capacity for the public booking flow.';

NOTIFY pgrst, 'reload schema';
COMMIT;
