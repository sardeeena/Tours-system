-- Exclusive trips are a separate product and reservation model.
-- Existing tours, departures and create_booking_atomic_with_departure remain untouched.
BEGIN;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.exclusive_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID NOT NULL UNIQUE REFERENCES public.tours(id) ON DELETE CASCADE,
  fixed_trip_price NUMERIC(12,2) NOT NULL CHECK (fixed_trip_price > 0),
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
  WHERE status IN ('pending','confirmed');

CREATE INDEX IF NOT EXISTS exclusive_departures_public_schedule_idx
  ON public.exclusive_departures(date, start_time)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS exclusive_reservations_departure_idx
  ON public.exclusive_reservations(exclusive_departure_id, status);

ALTER TABLE public.exclusive_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusive_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusive_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exclusive_trips_public_read ON public.exclusive_trips;
CREATE POLICY exclusive_trips_public_read ON public.exclusive_trips
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id = exclusive_trips.tour_id
        AND t.is_exclusive = TRUE
        AND t.status = 'published'
    )
  );

DROP POLICY IF EXISTS exclusive_trips_admin_read ON public.exclusive_trips;
CREATE POLICY exclusive_trips_admin_read ON public.exclusive_trips
  FOR SELECT TO authenticated
  USING (public.has_permission('content.read'));

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
CREATE POLICY exclusive_departures_public_read ON public.exclusive_departures
  FOR SELECT TO anon, authenticated
  USING (
    status = 'confirmed'
    AND date >= (now() AT TIME ZONE 'Africa/Cairo')::date
    AND EXISTS (
      SELECT 1 FROM public.exclusive_trips et
      JOIN public.tours t ON t.id = et.tour_id
      WHERE et.id = exclusive_departures.exclusive_trip_id
        AND et.is_active = TRUE
        AND t.is_exclusive = TRUE
        AND t.status = 'published'
    )
  );

DROP POLICY IF EXISTS exclusive_departures_admin_read ON public.exclusive_departures;
CREATE POLICY exclusive_departures_admin_read ON public.exclusive_departures
  FOR SELECT TO authenticated
  USING (public.has_permission('operations.read'));

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

DROP POLICY IF EXISTS exclusive_reservations_admin_update ON public.exclusive_reservations;
CREATE POLICY exclusive_reservations_admin_update ON public.exclusive_reservations
  FOR UPDATE TO authenticated
  USING (public.has_permission('bookings.update'))
  WITH CHECK (public.has_permission('bookings.update'));

REVOKE ALL ON public.exclusive_trips, public.exclusive_departures, public.exclusive_reservations FROM PUBLIC;
GRANT SELECT ON public.exclusive_trips, public.exclusive_departures TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exclusive_trips, public.exclusive_departures TO authenticated;
GRANT SELECT, UPDATE ON public.exclusive_reservations TO authenticated;

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
     OR position('@' IN p_email) < 2
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
    RETURN jsonb_build_object(
      'success', TRUE, 'duplicate', TRUE,
      'reservationId', v_existing.id,
      'reservationReference', v_existing.reservation_reference,
      'total', v_existing.total, 'currency', v_existing.currency,
      'status', v_existing.status
    );
  END IF;

  SELECT * INTO v_departure
  FROM public.exclusive_departures
  WHERE id = p_departure_id
  FOR UPDATE;
  IF NOT FOUND OR v_departure.status <> 'confirmed'
     OR v_departure.date < (now() AT TIME ZONE 'Africa/Cairo')::date THEN
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
      AND r.status IN ('pending','confirmed')
  ) THEN
    RAISE EXCEPTION 'This exclusive trip slot has already been reserved' USING ERRCODE = '23505';
  END IF;

  v_total := v_trip.fixed_trip_price;
  v_reference := 'EXC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  INSERT INTO public.exclusive_reservations (
    reservation_reference, exclusive_departure_id,
    customer_first_name, customer_last_name, customer_email, customer_phone,
    customer_country, customer_hotel, guest_count,
    fixed_trip_price, total, currency, payment_method,
    special_requests, idempotency_key
  ) VALUES (
    v_reference, v_departure.id,
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
    'reservationReference', v_existing.reservation_reference,
    'total', v_existing.total, 'currency', v_existing.currency,
    'status', v_existing.status,
    'guestCount', v_existing.guest_count
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.exclusive_reservations WHERE idempotency_key = v_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE, 'duplicate', TRUE,
      'reservationId', v_existing.id,
      'reservationReference', v_existing.reservation_reference,
      'total', v_existing.total, 'currency', v_existing.currency,
      'status', v_existing.status
    );
  END IF;
  RAISE EXCEPTION 'This exclusive trip slot has already been reserved' USING ERRCODE = '23505';
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_exclusive_trip(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated, service_role;

COMMIT;
