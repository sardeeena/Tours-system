-- Forward-only hardening for the departure linkage introduced in 20261117120000.
-- The original private RPC remains in place for compatibility; the public RPC
-- below is the authenticated API entry point used by the current application.

BEGIN;

ALTER TABLE public.vessels
  ADD COLUMN IF NOT EXISTS next_maintenance_date DATE;

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
  v_booked INTEGER := 0;
  v_actual_booked INTEGER := 0;
  v_status TEXT := lower(coalesce(nullif(btrim(p_status), ''), 'scheduled'));
  v_availability_status TEXT;
BEGIN
  IF NOT (
    coalesce(auth.role(),'') = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage departures' USING ERRCODE = '42501';
  END IF;

  IF p_tour_id IS NULL OR p_date IS NULL
     OR p_start_time IS NULL OR btrim(p_start_time) = ''
     OR p_end_time IS NULL OR btrim(p_end_time) = ''
     OR p_capacity IS NULL OR p_capacity < 1 OR p_capacity > 500 THEN
    RAISE EXCEPTION 'A published tour, date, actual start/end times and capacity between 1 and 500 are required'
      USING ERRCODE = '22023';
  END IF;
  IF p_end_time <= p_start_time THEN
    RAISE EXCEPTION 'Departure end time must be later than its start time' USING ERRCODE = '22023';
  END IF;
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

  SELECT * INTO v_availability
  FROM public.tour_availability
  WHERE tour_id = p_tour_id AND date = p_date
  FOR UPDATE;

  IF FOUND THEN
    IF v_availability.departure_id IS NOT NULL
       AND v_availability.departure_id IS DISTINCT FROM p_departure_id THEN
      RAISE EXCEPTION 'A different departure is already linked to this tour and date. Multiple daily departures require a separate capacity model.'
        USING ERRCODE = '23505';
    END IF;
    v_booked := greatest(0, coalesce(v_availability.booked_count, 0));
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE tour_id = p_tour_id AND booking_date = p_date
      AND status <> 'cancelled'
      AND departure_id IS NOT NULL
      AND departure_id IS DISTINCT FROM p_departure_id
  ) THEN
    RAISE EXCEPTION 'One or more bookings are already linked to a different departure for this tour/date'
      USING ERRCODE = '23505';
  END IF;

  SELECT coalesce(sum(adult_count + child_count + infant_count), 0)::INTEGER
  INTO v_actual_booked
  FROM public.bookings
  WHERE tour_id = p_tour_id
    AND booking_date = p_date
    AND status <> 'cancelled'
    AND (departure_id IS NULL OR departure_id = p_departure_id);

  IF v_availability.id IS NOT NULL AND v_actual_booked <> v_booked THEN
    RAISE EXCEPTION 'Availability ledger and booking passenger totals do not match. Reconcile this date before assigning a departure.'
      USING ERRCODE = '23514';
  END IF;
  v_booked := v_actual_booked;

  IF EXISTS (
    SELECT 1 FROM public.bookings
    WHERE tour_id = p_tour_id AND booking_date = p_date
      AND status <> 'cancelled'
      AND (
        (assigned_vessel_id IS NOT NULL AND assigned_vessel_id IS DISTINCT FROM p_vessel_id)
        OR (assigned_guide_id IS NOT NULL AND assigned_guide_id IS DISTINCT FROM p_guide_id)
      )
  ) THEN
    RAISE EXCEPTION 'Existing booking vessel/guide assignments do not match the proposed departure. Reconcile assignments before linking.'
      USING ERRCODE = '23514';
  END IF;

  IF p_departure_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.departures WHERE id = p_departure_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The departure being updated no longer exists' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.tour_id <> p_tour_id OR v_existing.date <> p_date THEN
      RAISE EXCEPTION 'A departure cannot be moved to another tour or date through this workflow'
        USING ERRCODE = '22023';
    END IF;
    IF v_booked > p_capacity THEN
      RAISE EXCEPTION 'New capacity is below the current booked passenger count (%)', v_booked
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.departures
    SET start_time = p_start_time, end_time = p_end_time, capacity = p_capacity,
        booked_passengers = v_booked, remaining_capacity = p_capacity - v_booked,
        status = v_status, vessel_id = p_vessel_id, guide_id = p_guide_id,
        driver_id = p_driver_id, notes = nullif(btrim(coalesce(p_notes,'')), ''),
        updated_at = now()
    WHERE id = p_departure_id
    RETURNING * INTO v_departure;
  ELSE
    IF v_booked > p_capacity THEN
      RAISE EXCEPTION 'Departure capacity is below the current booked passenger count (%)', v_booked
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.departures (
      tour_id,date,start_time,end_time,capacity,booked_passengers,remaining_capacity,
      status,vessel_id,guide_id,driver_id,notes
    ) VALUES (
      p_tour_id,p_date,p_start_time,p_end_time,p_capacity,v_booked,p_capacity-v_booked,
      v_status,p_vessel_id,p_guide_id,p_driver_id,nullif(btrim(coalesce(p_notes,'')),'')
    )
    RETURNING * INTO v_departure;
  END IF;

  v_availability_status := CASE
    WHEN v_status IN ('cancelled','completed','boarding','in_progress') THEN 'unavailable'
    WHEN v_booked >= p_capacity THEN 'sold_out'
    ELSE 'available'
  END;

  INSERT INTO public.tour_availability (
    tour_id,date,status,max_capacity,booked_count,notes,departure_id
  ) VALUES (
    p_tour_id,p_date,v_availability_status,p_capacity,v_booked,
    'Linked to operator-scheduled departure ' || v_departure.id::TEXT,v_departure.id
  )
  ON CONFLICT (tour_id,date) DO UPDATE
  SET status = EXCLUDED.status, max_capacity = EXCLUDED.max_capacity,
      booked_count = EXCLUDED.booked_count, notes = EXCLUDED.notes,
      departure_id = EXCLUDED.departure_id, updated_at = now()
  WHERE public.tour_availability.departure_id IS NULL
     OR public.tour_availability.departure_id = EXCLUDED.departure_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not link the booking capacity row to this departure' USING ERRCODE = '23505';
  END IF;

  UPDATE public.bookings
  SET departure_id = v_departure.id,
      assigned_vessel_id = v_departure.vessel_id,
      assigned_guide_id = v_departure.guide_id
  WHERE tour_id = p_tour_id AND booking_date = p_date
    AND status <> 'cancelled' AND departure_id IS NULL;

  SELECT coalesce(sum(adult_count + child_count + infant_count), 0)::INTEGER
  INTO v_booked
  FROM public.bookings
  WHERE departure_id = v_departure.id AND status <> 'cancelled';
  IF v_booked > p_capacity THEN
    RAISE EXCEPTION 'Actual booking manifest exceeds configured departure capacity (%)', p_capacity
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.tour_availability
  SET booked_count = v_booked,
      status = CASE WHEN v_status IN ('cancelled','completed','boarding','in_progress') THEN 'unavailable'
                    WHEN v_booked >= p_capacity THEN 'sold_out' ELSE 'available' END,
      updated_at = now()
  WHERE departure_id = v_departure.id;

  UPDATE public.departures
  SET booked_passengers = v_booked, remaining_capacity = greatest(0,capacity-v_booked),
      updated_at = now()
  WHERE id = v_departure.id
  RETURNING * INTO v_departure;

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
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage departures' USING ERRCODE = '42501';
  END IF;
  RETURN private.upsert_departure_with_availability(
    p_departure_id,p_tour_id,p_date,p_start_time,p_end_time,p_capacity,
    p_status,p_vessel_id,p_guide_id,p_driver_id,p_notes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_departure_with_availability(UUID,UUID,DATE,TEXT,TEXT,INTEGER,TEXT,UUID,UUID,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_departure_with_availability(UUID,UUID,DATE,TEXT,TEXT,INTEGER,TEXT,UUID,UUID,UUID,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.assign_booking_to_scheduled_departure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_vessel_id UUID;
  v_guide_id UUID;
BEGIN
  IF NEW.departure_id IS NULL THEN
    SELECT ta.departure_id INTO NEW.departure_id
    FROM public.tour_availability AS ta
    WHERE ta.tour_id = NEW.tour_id AND ta.date = NEW.booking_date
      AND ta.status = 'available'
      AND ta.departure_id IS NOT NULL;
  END IF;

  IF NEW.departure_id IS NOT NULL THEN
    SELECT vessel_id,guide_id INTO v_vessel_id,v_guide_id
    FROM public.departures WHERE id = NEW.departure_id;
    NEW.assigned_vessel_id := v_vessel_id;
    NEW.assigned_guide_id := v_guide_id;
  END IF;
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
  v_capacity INTEGER;
  v_booked INTEGER;
  v_status TEXT;
BEGIN
  v_departure_id := NEW.departure_id;
  IF v_departure_id IS NULL THEN RETURN NEW; END IF;

  SELECT capacity,status INTO v_capacity,v_status
  FROM public.departures WHERE id = v_departure_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT coalesce(sum(adult_count + child_count + infant_count),0)::INTEGER
  INTO v_booked
  FROM public.bookings
  WHERE departure_id = v_departure_id AND status <> 'cancelled';

  UPDATE public.tour_availability
  SET booked_count = v_booked,
      status = CASE
        WHEN v_status IN ('cancelled','completed','boarding','in_progress') THEN 'unavailable'
        WHEN v_booked >= v_capacity THEN 'sold_out'
        ELSE 'available'
      END,
      updated_at = now()
  WHERE departure_id = v_departure_id;

  UPDATE public.departures
  SET booked_passengers = v_booked,
      remaining_capacity = greatest(0,capacity-v_booked),
      updated_at = now()
  WHERE id = v_departure_id;
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
  v_booked INTEGER;
BEGIN
  SELECT coalesce(booked_count,0) INTO v_booked
  FROM public.tour_availability
  WHERE departure_id = NEW.id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE public.tour_availability
  SET max_capacity = NEW.capacity,
      status = CASE
        WHEN NEW.status IN ('cancelled','completed','boarding','in_progress') THEN 'unavailable'
        WHEN v_booked >= NEW.capacity THEN 'sold_out'
        ELSE 'available'
      END,
      updated_at = now()
  WHERE departure_id = NEW.id;
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
AFTER UPDATE OF status,capacity ON public.departures
FOR EACH ROW
EXECUTE FUNCTION private.sync_departure_availability_status();

REVOKE ALL ON FUNCTION private.sync_scheduled_departure_capacity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_departure_availability_status() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
