-- Exclusive trips are a separate product and reservation model.
-- Existing tours, departures and create_booking_atomic_with_departure remain untouched.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.exclusive_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL UNIQUE REFERENCES public.tours(id) ON DELETE CASCADE,
  fixed_trip_price NUMERIC(12,2) NOT NULL CHECK (fixed_trip_price > 0 AND fixed_trip_price <= 99999999.99),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency ~ '^[A-Z]{3}$'),
  minimum_guests INTEGER NOT NULL DEFAULT 1 CHECK (minimum_guests BETWEEN 1 AND 500),
  maximum_guests INTEGER NOT NULL CHECK (maximum_guests BETWEEN 1 AND 500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exclusive_trip_guest_range CHECK (minimum_guests <= maximum_guests)
);

CREATE TABLE IF NOT EXISTS public.exclusive_departures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exclusive_trip_id UUID NOT NULL REFERENCES public.exclusive_trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  maximum_guests INTEGER NOT NULL CHECK (maximum_guests BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','confirmed','cancelled','completed')),
  vessel_id UUID REFERENCES public.vessels(id) ON DELETE SET NULL,
  captain_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
  guide_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.guides(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exclusive_departure_time_range CHECK (end_time > start_time),
  CONSTRAINT exclusive_departure_trip_slot_unique UNIQUE (exclusive_trip_id, date, start_time)
);

CREATE TABLE IF NOT EXISTS public.exclusive_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_reference TEXT NOT NULL UNIQUE,
  booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL,
  exclusive_departure_id UUID NOT NULL REFERENCES public.exclusive_departures(id) ON DELETE RESTRICT,
  customer_first_name TEXT NOT NULL,
  customer_last_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_country TEXT,
  customer_hotel TEXT,
  guest_count INTEGER NOT NULL CHECK (guest_count BETWEEN 1 AND 500),
  fixed_trip_price NUMERIC(12,2) NOT NULL CHECK (fixed_trip_price > 0),
  total NUMERIC(12,2) NOT NULL CHECK (total > 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  payment_method TEXT NOT NULL DEFAULT 'pay_at_pickup'
    CHECK (payment_method IN ('pay_at_pickup','pay_online')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','partially_paid','refunded','failed')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','cancelled','completed','no_show')),
  special_requests TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS exclusive_one_active_reservation_per_slot
  ON public.exclusive_reservations(exclusive_departure_id)
  WHERE status IN ('pending','confirmed','completed','no_show');

ALTER TABLE public.exclusive_reservations
  ADD COLUMN IF NOT EXISTS booking_id UUID UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS exclusive_departures_public_schedule_idx
  ON public.exclusive_departures(date, start_time)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS exclusive_reservations_departure_idx
  ON public.exclusive_reservations(exclusive_departure_id, status);


-- Validate operator-created slots against the trip's configured limits and assigned resources.
CREATE OR REPLACE FUNCTION private.validate_exclusive_departure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_trip public.exclusive_trips%ROWTYPE;
  v_tour_status TEXT;
  v_capacity INTEGER;
  v_inspection DATE;
  v_maintenance DATE;
BEGIN
  SELECT * INTO v_trip
  FROM public.exclusive_trips
  WHERE id = NEW.exclusive_trip_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active Exclusive product is required before scheduling a slot' USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_tour_status
  FROM public.tours
  WHERE id = v_trip.tour_id AND is_exclusive = TRUE;
  IF NOT FOUND OR v_tour_status <> 'published' THEN
    RAISE EXCEPTION 'The Exclusive tour listing must be published before scheduling slots' USING ERRCODE = '22023';
  END IF;

  IF NEW.date < (now() AT TIME ZONE 'Africa/Cairo')::date
     OR (NEW.date = (now() AT TIME ZONE 'Africa/Cairo')::date
         AND NEW.start_time <= (now() AT TIME ZONE 'Africa/Cairo')::time) THEN
    RAISE EXCEPTION 'An Exclusive departure cannot be scheduled in the past' USING ERRCODE = '22023';
  END IF;
  IF NEW.maximum_guests < v_trip.minimum_guests THEN
    RAISE EXCEPTION 'Slot capacity cannot be below the Exclusive product minimum of % guests', v_trip.minimum_guests USING ERRCODE = '22023';
  END IF;
  IF NEW.maximum_guests > v_trip.maximum_guests THEN
    RAISE EXCEPTION 'Slot capacity cannot exceed the Exclusive product maximum of % guests', v_trip.maximum_guests USING ERRCODE = '22023';
  END IF;

  IF NEW.vessel_id IS NOT NULL THEN
    SELECT passenger_capacity, safety_inspection_expiry, next_maintenance_date
    INTO v_capacity, v_inspection, v_maintenance
    FROM public.vessels
    WHERE id = NEW.vessel_id AND is_active = TRUE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The assigned vessel is inactive or unavailable' USING ERRCODE = '22023';
    END IF;
    IF NEW.maximum_guests > v_capacity THEN
      RAISE EXCEPTION 'Slot capacity exceeds the assigned vessel passenger capacity (%)', v_capacity USING ERRCODE = '22023';
    END IF;
    IF v_inspection IS NOT NULL AND v_inspection < NEW.date THEN
      RAISE EXCEPTION 'The assigned vessel safety inspection expires before this departure' USING ERRCODE = '22023';
    END IF;
    IF v_maintenance IS NOT NULL AND v_maintenance <= NEW.date THEN
      RAISE EXCEPTION 'The assigned vessel is due for maintenance on or before this departure' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Prevent assigning the same vessel or crew to overlapping regular or Exclusive departures.
  IF NEW.vessel_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND d.vessel_id=NEW.vessel_id
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    )
    OR EXISTS (
      SELECT 1 FROM public.departures d
      WHERE d.date=NEW.date AND d.status NOT IN ('cancelled','completed')
        AND d.vessel_id=NEW.vessel_id
        AND d.start_time::time < NEW.end_time AND d.end_time::time > NEW.start_time
    )
  ) THEN
    RAISE EXCEPTION 'The assigned vessel is already scheduled during this time window' USING ERRCODE = '23P01';
  END IF;

  IF (
    (NEW.captain_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND NEW.captain_id IN (d.captain_id,d.guide_id,d.driver_id)
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    ))
    OR (NEW.guide_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND NEW.guide_id IN (d.captain_id,d.guide_id,d.driver_id)
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    ))
    OR (NEW.driver_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.exclusive_departures d
      WHERE d.id IS DISTINCT FROM NEW.id AND d.date=NEW.date
        AND d.status NOT IN ('cancelled','completed')
        AND NEW.driver_id IN (d.captain_id,d.guide_id,d.driver_id)
        AND d.start_time < NEW.end_time AND d.end_time > NEW.start_time
    ))
  ) THEN
    RAISE EXCEPTION 'The assigned crew member is already scheduled during this time window' USING ERRCODE = '23P01';
  END IF;

  IF NEW.captain_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guides WHERE id = NEW.captain_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'The assigned captain is inactive or unavailable' USING ERRCODE = '22023';
  END IF;
  IF NEW.guide_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guides WHERE id = NEW.guide_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'The assigned guide is inactive or unavailable' USING ERRCODE = '22023';
  END IF;
  IF NEW.driver_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guides WHERE id = NEW.driver_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'The assigned driver is inactive or unavailable' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_exclusive_departure_before_write ON public.exclusive_departures;
CREATE TRIGGER validate_exclusive_departure_before_write
BEFORE INSERT OR UPDATE ON public.exclusive_departures
FOR EACH ROW EXECUTE FUNCTION private.validate_exclusive_departure();

-- This narrow security-definer predicate keeps reserved slots out of the public schedule
-- without exposing customer reservation records to anonymous visitors.

REVOKE ALL ON FUNCTION private.validate_exclusive_departure() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_exclusive_departure_available(p_departure_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.exclusive_departures d
    JOIN public.exclusive_trips et ON et.id = d.exclusive_trip_id AND et.is_active = TRUE
    JOIN public.tours t ON t.id = et.tour_id AND t.status = 'published' AND t.is_exclusive = TRUE
    WHERE d.id = p_departure_id
      AND d.status = 'confirmed'
      AND (d.date > (now() AT TIME ZONE 'Africa/Cairo')::date
        OR (d.date = (now() AT TIME ZONE 'Africa/Cairo')::date
          AND d.start_time > (now() AT TIME ZONE 'Africa/Cairo')::time))
      AND NOT EXISTS (
        SELECT 1 FROM public.exclusive_reservations r
        WHERE r.exclusive_departure_id = d.id AND r.status IN ('pending','confirmed','completed','no_show')
      )
  );
$function$;
REVOKE ALL ON FUNCTION private.is_exclusive_departure_available(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_exclusive_departure_available(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_exclusive_departure_available(p_departure_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.is_exclusive_departure_available(p_departure_id);
$wrapper$;
REVOKE ALL ON FUNCTION public.is_exclusive_departure_available(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_exclusive_departure_available(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.save_exclusive_trip_settings(
  p_tour_id UUID,
  p_fixed_trip_price NUMERIC,
  p_currency TEXT,
  p_minimum_guests INTEGER,
  p_maximum_guests INTEGER,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $save$
DECLARE
  v_trip_id UUID;
BEGIN
  IF NOT (
    coalesce(auth.role(),'') = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND public.has_permission('tours.update')
      AND (
        (EXISTS (SELECT 1 FROM public.exclusive_trips WHERE tour_id=p_tour_id) AND public.has_permission('content.update'))
        OR
        (NOT EXISTS (SELECT 1 FROM public.exclusive_trips WHERE tour_id=p_tour_id) AND public.has_permission('content.create'))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage Exclusive trip settings' USING ERRCODE = '42501';
  END IF;

  IF p_tour_id IS NULL
     OR p_fixed_trip_price IS NULL
     OR p_fixed_trip_price <= 0
     OR p_fixed_trip_price > 99999999.99
     OR p_currency IS NULL
     OR length(p_currency) <> 3
     OR p_currency !~ '^[A-Z]{3}'
     OR p_minimum_guests IS NULL
     OR p_maximum_guests IS NULL
     OR p_minimum_guests < 1
     OR p_maximum_guests < p_minimum_guests
     OR p_maximum_guests > 500 THEN
    RAISE EXCEPTION 'Valid fixed price, currency and guest limits are required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tours
  SET is_exclusive=TRUE, updated_at=now()
  WHERE id=p_tour_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected tour does not exist' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.exclusive_trips (
    tour_id,fixed_trip_price,currency,minimum_guests,maximum_guests,is_active,updated_at
  ) VALUES (
    p_tour_id,p_fixed_trip_price,p_currency,p_minimum_guests,p_maximum_guests,coalesce(p_is_active,TRUE),now()
  )
  ON CONFLICT (tour_id) DO UPDATE SET
    fixed_trip_price=EXCLUDED.fixed_trip_price,
    currency=EXCLUDED.currency,
    minimum_guests=EXCLUDED.minimum_guests,
    maximum_guests=EXCLUDED.maximum_guests,
    is_active=EXCLUDED.is_active,
    updated_at=now()
  RETURNING id INTO v_trip_id;

  RETURN jsonb_build_object('success',TRUE,'exclusiveTripId',v_trip_id);
END;
$save$;

REVOKE ALL ON FUNCTION private.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.save_exclusive_trip_settings(
  p_tour_id UUID,
  p_fixed_trip_price NUMERIC,
  p_currency TEXT,
  p_minimum_guests INTEGER,
  p_maximum_guests INTEGER,
  p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.save_exclusive_trip_settings(
    p_tour_id,p_fixed_trip_price,p_currency,p_minimum_guests,p_maximum_guests,p_is_active
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_exclusive_trip_settings(UUID,NUMERIC,TEXT,INTEGER,INTEGER,BOOLEAN) TO authenticated, service_role;

-- Bridge Exclusive reservations into the existing booking, payment and finance ledgers.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_kind TEXT NOT NULL DEFAULT 'standard'
    CHECK (booking_kind IN ('standard','exclusive')),
  ADD COLUMN IF NOT EXISTS exclusive_departure_id UUID
    REFERENCES public.exclusive_departures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_exclusive_departure_idx
  ON public.bookings(exclusive_departure_id)
  WHERE booking_kind = 'exclusive';



ALTER TABLE public.exclusive_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusive_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusive_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exclusive_trips_public_read ON public.exclusive_trips;
DROP POLICY IF EXISTS exclusive_trips_admin_read ON public.exclusive_trips;
DROP POLICY IF EXISTS exclusive_trips_select ON public.exclusive_trips;
CREATE POLICY exclusive_trips_select ON public.exclusive_trips
  FOR SELECT TO anon, authenticated
  USING (
    (
      is_active
      AND EXISTS (
        SELECT 1 FROM public.tours t
        WHERE t.id = exclusive_trips.tour_id
          AND t.is_exclusive = TRUE
          AND t.status = 'published'
      )
    )
    OR (auth.role() = 'authenticated' AND public.has_permission('content.read'))
  );

DROP POLICY IF EXISTS exclusive_trips_admin_insert ON public.exclusive_trips;
CREATE POLICY exclusive_trips_admin_insert ON public.exclusive_trips
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('content.create'));

DROP POLICY IF EXISTS exclusive_trips_admin_update ON public.exclusive_trips;
CREATE POLICY exclusive_trips_admin_update ON public.exclusive_trips
  FOR UPDATE TO authenticated
  USING (public.has_permission('content.update'))
  WITH CHECK (public.has_permission('content.update'));

DROP POLICY IF EXISTS exclusive_trips_admin_delete ON public.exclusive_trips;
CREATE POLICY exclusive_trips_admin_delete ON public.exclusive_trips
  FOR DELETE TO authenticated
  USING (public.has_permission('content.delete'));

DROP POLICY IF EXISTS exclusive_departures_public_read ON public.exclusive_departures;
DROP POLICY IF EXISTS exclusive_departures_admin_read ON public.exclusive_departures;
DROP POLICY IF EXISTS exclusive_departures_select ON public.exclusive_departures;
CREATE POLICY exclusive_departures_select ON public.exclusive_departures
  FOR SELECT TO anon, authenticated
  USING (
    (
      status = 'confirmed'
      AND date >= (now() AT TIME ZONE 'Africa/Cairo')::date
      AND public.is_exclusive_departure_available(id)
      AND EXISTS (
        SELECT 1 FROM public.exclusive_trips et
        JOIN public.tours t ON t.id = et.tour_id
        WHERE et.id = exclusive_departures.exclusive_trip_id
          AND et.is_active = TRUE
          AND t.is_exclusive = TRUE
          AND t.status = 'published'
      )
    )
    OR (auth.role() = 'authenticated' AND public.has_permission('operations.read'))
  );

DROP POLICY IF EXISTS exclusive_departures_admin_insert ON public.exclusive_departures;
CREATE POLICY exclusive_departures_admin_insert ON public.exclusive_departures
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('operations.create'));

DROP POLICY IF EXISTS exclusive_departures_admin_update ON public.exclusive_departures;
CREATE POLICY exclusive_departures_admin_update ON public.exclusive_departures
  FOR UPDATE TO authenticated
  USING (public.has_permission('operations.update'))
  WITH CHECK (public.has_permission('operations.update'));

DROP POLICY IF EXISTS exclusive_departures_admin_delete ON public.exclusive_departures;
CREATE POLICY exclusive_departures_admin_delete ON public.exclusive_departures
  FOR DELETE TO authenticated
  USING (public.has_permission('operations.delete'));

DROP POLICY IF EXISTS exclusive_reservations_admin_read ON public.exclusive_reservations;
CREATE POLICY exclusive_reservations_admin_read ON public.exclusive_reservations
  FOR SELECT TO authenticated
  USING (public.has_permission('bookings.read'));

REVOKE ALL ON public.exclusive_trips, public.exclusive_departures, public.exclusive_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.exclusive_trips, public.exclusive_departures TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exclusive_trips, public.exclusive_departures TO authenticated;
GRANT SELECT ON public.exclusive_reservations TO authenticated;

-- The existing business audit trigger migration ran before these tables existed.
-- The audit function strips customer/contact/free-text columns before storing snapshots.
DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.exclusive_trips;
CREATE TRIGGER trg_capture_business_audit
AFTER INSERT OR UPDATE OR DELETE ON public.exclusive_trips
FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();

DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.exclusive_departures;
CREATE TRIGGER trg_capture_business_audit
AFTER INSERT OR UPDATE OR DELETE ON public.exclusive_departures
FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();

DROP TRIGGER IF EXISTS trg_capture_business_audit ON public.exclusive_reservations;
CREATE TRIGGER trg_capture_business_audit
AFTER INSERT OR UPDATE OR DELETE ON public.exclusive_reservations
FOR EACH ROW EXECUTE FUNCTION private.capture_business_audit();

CREATE OR REPLACE FUNCTION private.reserve_exclusive_trip(
  p_departure_id UUID,
  p_guest_count INTEGER,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_country TEXT DEFAULT NULL,
  p_hotel TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'pay_at_pickup',
  p_special_requests TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_departure public.exclusive_departures%ROWTYPE;
  v_trip public.exclusive_trips%ROWTYPE;
  v_tour public.tours%ROWTYPE;
  v_existing public.exclusive_reservations%ROWTYPE;
  v_reference TEXT;
  v_total NUMERIC(12,2);
  v_client_ip TEXT;
  v_customer_id UUID;
  v_booking_id UUID;
  v_key TEXT := nullif(btrim(coalesce(p_idempotency_key,'')), '');
BEGIN
  IF p_departure_id IS NULL OR v_key IS NULL OR length(v_key) > 160 THEN
    RAISE EXCEPTION 'A departure and valid reservation request key are required' USING ERRCODE = '22023';
  END IF;
  IF p_guest_count IS NULL OR p_guest_count < 1 OR p_guest_count > 500 THEN
    RAISE EXCEPTION 'Guest count must be between 1 and 500' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_first_name,'')), '') IS NULL
     OR nullif(btrim(coalesce(p_last_name,'')), '') IS NULL
     OR nullif(btrim(coalesce(p_email,'')), '') IS NULL
     OR length(btrim(p_email)) > 254
     OR btrim(p_email) !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
     OR nullif(btrim(coalesce(p_phone,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Valid customer name, email and phone are required' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_payment_method,'pay_at_pickup') NOT IN ('pay_at_pickup','pay_online') THEN
    RAISE EXCEPTION 'Unsupported payment method' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.exclusive_reservations
  WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.exclusive_departure_id IS DISTINCT FROM p_departure_id
       OR v_existing.guest_count IS DISTINCT FROM p_guest_count
       OR lower(v_existing.customer_email) IS DISTINCT FROM lower(btrim(p_email))
       OR lower(v_existing.customer_first_name) IS DISTINCT FROM lower(btrim(p_first_name))
       OR lower(v_existing.customer_last_name) IS DISTINCT FROM lower(btrim(p_last_name))
       OR v_existing.customer_phone IS DISTINCT FROM btrim(p_phone)
       OR v_existing.payment_method IS DISTINCT FROM coalesce(p_payment_method,'pay_at_pickup')
       OR coalesce(v_existing.customer_country,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_country,'')),''),'')
       OR coalesce(v_existing.customer_hotel,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_hotel,'')),''),'')
       OR coalesce(v_existing.special_requests,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_special_requests,'')),''),'') THEN
      RAISE EXCEPTION 'This idempotency key was already used for different Exclusive reservation details' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'success', TRUE, 'duplicate', TRUE,
      'reservationId', v_existing.id,
      'bookingId', v_existing.booking_id,
      'reservationReference', v_existing.reservation_reference,
      'total', v_existing.total, 'currency', v_existing.currency,
      'status', v_existing.status
    );
  END IF;

  -- Atomic abuse controls apply to guest reservations; exact idempotent retries return above.
  BEGIN
    v_client_ip := nullif(current_setting('request.headers', TRUE)::json->>'cf-connecting-ip', '');
    IF v_client_ip IS NULL THEN
      v_client_ip := nullif(current_setting('request.headers', TRUE)::json->>'x-forwarded-for', '');
      IF v_client_ip LIKE '%,%' THEN
        v_client_ip := btrim(split_part(v_client_ip, ',', 1));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;
  PERFORM public.check_atomic_rate_limit(
    'exclusive_reservation_email', lower(btrim(coalesce(p_email,''))),
    INTERVAL '10 minutes', 5,
    'Too many exclusive trip reservation attempts for this email. Please wait before trying again.'
  );
  IF v_client_ip IS NOT NULL AND length(v_client_ip) <= 64 THEN
    PERFORM public.check_atomic_rate_limit(
      'exclusive_reservation_ip', btrim(v_client_ip),
      INTERVAL '10 minutes', 10,
      'Too many exclusive trip reservation attempts from this network. Please wait before trying again.'
    );
  END IF;

  SELECT * INTO v_departure
  FROM public.exclusive_departures
  WHERE id = p_departure_id
  FOR UPDATE;
  IF NOT FOUND OR v_departure.status <> 'confirmed'
     OR v_departure.date < (now() AT TIME ZONE 'Africa/Cairo')::date
     OR (v_departure.date = (now() AT TIME ZONE 'Africa/Cairo')::date
         AND v_departure.start_time <= (now() AT TIME ZONE 'Africa/Cairo')::time) THEN
    RAISE EXCEPTION 'This exclusive trip slot is no longer available' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_trip
  FROM public.exclusive_trips
  WHERE id = v_departure.exclusive_trip_id AND is_active = TRUE
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This exclusive trip is not currently bookable' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_tour
  FROM public.tours
  WHERE id = v_trip.tour_id AND status = 'published' AND is_exclusive = TRUE
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This exclusive trip is not currently published' USING ERRCODE = 'P0002';
  END IF;

  IF p_guest_count < v_trip.minimum_guests
     OR p_guest_count > least(v_trip.maximum_guests, v_departure.maximum_guests) THEN
    RAISE EXCEPTION 'Guest count must be between % and % for this trip',
      v_trip.minimum_guests, least(v_trip.maximum_guests, v_departure.maximum_guests)
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.exclusive_reservations r
    WHERE r.exclusive_departure_id = v_departure.id
      AND r.status IN ('pending','confirmed','completed','no_show')
  ) THEN
    RAISE EXCEPTION 'This exclusive trip slot has already been reserved' USING ERRCODE = '23505';
  END IF;

  v_total := v_trip.fixed_trip_price;
  v_reference := 'EXC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  -- Reuse the existing customer and booking ledgers so payment transactions,
  -- invoices, refunds and finance reporting continue to use booking_id.
  PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(p_email)), 0));
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE lower(email) = lower(btrim(p_email))
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      user_id,first_name,last_name,email,phone,country,hotel,source,preferred_currency
    ) VALUES (
      auth.uid(),btrim(p_first_name),btrim(p_last_name),lower(btrim(p_email)),btrim(p_phone),
      coalesce(nullif(btrim(coalesce(p_country,'')),''),'International'),
      nullif(btrim(coalesce(p_hotel,'')),''),'Exclusive Trip Booking',v_trip.currency
    )
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO public.bookings (
    booking_reference,user_id,tour_id,customer_id,booking_date,status,payment_status,
    payment_method,adult_count,child_count,infant_count,subtotal,total,currency,
    special_requests,booking_kind,exclusive_departure_id
  ) VALUES (
    v_reference,auth.uid(),v_tour.id,v_customer_id,v_departure.date,'pending','pending',
    coalesce(p_payment_method,'pay_at_pickup'),p_guest_count,0,0,v_total,v_total,
    v_trip.currency,nullif(btrim(coalesce(p_special_requests,'')),''),'exclusive',v_departure.id
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.exclusive_reservations (
    reservation_reference, booking_id, exclusive_departure_id,
    customer_first_name, customer_last_name, customer_email, customer_phone,
    customer_country, customer_hotel, guest_count,
    fixed_trip_price, total, currency, payment_method,
    special_requests, idempotency_key
  ) VALUES (
    v_reference, v_booking_id, v_departure.id,
    btrim(p_first_name), btrim(p_last_name), lower(btrim(p_email)), btrim(p_phone),
    nullif(btrim(coalesce(p_country,'')), ''),
    nullif(btrim(coalesce(p_hotel,'')), ''),
    p_guest_count, v_trip.fixed_trip_price, v_total, v_trip.currency,
    coalesce(p_payment_method,'pay_at_pickup'),
    nullif(btrim(coalesce(p_special_requests,'')), ''), v_key
  )
  RETURNING * INTO v_existing;

  RETURN jsonb_build_object(
    'success', TRUE, 'duplicate', FALSE,
    'reservationId', v_existing.id,
    'bookingId', v_existing.booking_id,
    'reservationReference', v_existing.reservation_reference,
    'total', v_existing.total, 'currency', v_existing.currency,
    'status', v_existing.status,
    'guestCount', v_existing.guest_count
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.exclusive_reservations WHERE idempotency_key = v_key;
  IF FOUND THEN
    IF v_existing.exclusive_departure_id IS DISTINCT FROM p_departure_id
       OR v_existing.guest_count IS DISTINCT FROM p_guest_count
       OR lower(v_existing.customer_email) IS DISTINCT FROM lower(btrim(p_email))
       OR lower(v_existing.customer_first_name) IS DISTINCT FROM lower(btrim(p_first_name))
       OR lower(v_existing.customer_last_name) IS DISTINCT FROM lower(btrim(p_last_name))
       OR v_existing.customer_phone IS DISTINCT FROM btrim(p_phone)
       OR v_existing.payment_method IS DISTINCT FROM coalesce(p_payment_method,'pay_at_pickup')
       OR coalesce(v_existing.customer_country,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_country,'')),''),'')
       OR coalesce(v_existing.customer_hotel,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_hotel,'')),''),'')
       OR coalesce(v_existing.special_requests,'') IS DISTINCT FROM coalesce(nullif(btrim(coalesce(p_special_requests,'')),''),'') THEN
      RAISE EXCEPTION 'This idempotency key was already used for different Exclusive reservation details' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object(
      'success', TRUE, 'duplicate', TRUE,
      'reservationId', v_existing.id,
      'bookingId', v_existing.booking_id,
      'reservationReference', v_existing.reservation_reference,
      'total', v_existing.total, 'currency', v_existing.currency,
      'status', v_existing.status
    );
  END IF;
  RAISE EXCEPTION 'This exclusive trip slot has already been reserved' USING ERRCODE = '23505';
END;
$function$;


-- Finance and existing booking administration may update the linked booking directly.
-- Mirror those authoritative changes back into the Exclusive reservation record.

REVOKE ALL ON FUNCTION private.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reserve_exclusive_trip(
  p_departure_id UUID,
  p_guest_count INTEGER,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_country TEXT DEFAULT NULL,
  p_hotel TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'pay_at_pickup',
  p_special_requests TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.reserve_exclusive_trip(
    p_departure_id,p_guest_count,p_first_name,p_last_name,p_email,p_phone,
    p_country,p_hotel,p_payment_method,p_special_requests,p_idempotency_key
  );
$wrapper$;
REVOKE ALL ON FUNCTION public.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_exclusive_reservation_from_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.booking_kind = 'exclusive' THEN
    UPDATE public.exclusive_reservations
    SET payment_status=NEW.payment_status,
        status=CASE
          WHEN NEW.status='cancellation_requested' THEN 'pending'
          WHEN NEW.status IN ('pending','confirmed','cancelled','completed','no_show') THEN NEW.status
          ELSE status
        END,
        updated_at=now()
    WHERE booking_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_exclusive_reservation_from_booking_trigger ON public.bookings;
CREATE TRIGGER sync_exclusive_reservation_from_booking_trigger
AFTER UPDATE OF status,payment_status ON public.bookings
FOR EACH ROW
WHEN (NEW.booking_kind = 'exclusive')
EXECUTE FUNCTION private.sync_exclusive_reservation_from_booking();

-- Keep reservation lifecycle and the linked booking/payment ledger synchronized.
CREATE OR REPLACE FUNCTION private.update_exclusive_reservation_status(
  p_reservation_id UUID,
  p_status TEXT DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_reservation public.exclusive_reservations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
     OR (p_status = 'cancelled' AND NOT public.has_permission('bookings.approve'))
     OR (
       (p_status IS NULL OR p_status <> 'cancelled' OR p_payment_status IS NOT NULL)
       AND NOT public.has_permission('bookings.update')
     ) THEN
    RAISE EXCEPTION 'Not authorized to update Exclusive reservations' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL AND p_payment_status IS NULL THEN
    RAISE EXCEPTION 'At least one reservation status change is required' USING ERRCODE = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('pending','confirmed','cancelled','completed','no_show') THEN
    RAISE EXCEPTION 'Invalid Exclusive reservation status' USING ERRCODE = '22023';
  END IF;
  IF p_payment_status IS NOT NULL AND p_payment_status NOT IN ('pending','paid','partially_paid','refunded','failed') THEN
    RAISE EXCEPTION 'Invalid Exclusive payment status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_reservation
  FROM public.exclusive_reservations
  WHERE id=p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exclusive reservation not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.exclusive_reservations
  SET status=coalesce(p_status,status),
      payment_status=coalesce(p_payment_status,payment_status),
      updated_at=now()
  WHERE id=p_reservation_id;

  IF v_reservation.booking_id IS NOT NULL THEN
    UPDATE public.bookings
    SET status=coalesce(p_status,status),
        payment_status=coalesce(p_payment_status,payment_status),
        updated_at=now()
    WHERE id=v_reservation.booking_id;
  END IF;

  RETURN jsonb_build_object('success',TRUE,'reservationId',p_reservation_id,'bookingId',v_reservation.booking_id);
END;
$function$;
REVOKE ALL ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) TO authenticated, service_role;



REVOKE ALL ON FUNCTION private.sync_exclusive_reservation_from_booking() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.update_exclusive_reservation_status(UUID,TEXT,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_exclusive_reservation_status(
  p_reservation_id UUID,
  p_status TEXT DEFAULT NULL,
  p_payment_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $wrapper$
  SELECT private.update_exclusive_reservation_status(p_reservation_id,p_status,p_payment_status);
$wrapper$;
REVOKE ALL ON FUNCTION public.update_exclusive_reservation_status(UUID,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_exclusive_reservation_status(UUID,TEXT,TEXT) TO authenticated, service_role;


COMMIT;
