-- Restrict guest schedule reads to published tours and bound date-range work.
-- Admins retain access to draft and archived tours for operational review.

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $availability$
DECLARE
  v_tour RECORD;
  v_tour_identifier TEXT := NULLIF(BTRIM(p_tour_identifier), '');
  v_is_admin BOOLEAN := public.is_admin();
BEGIN
  IF v_tour_identifier IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Tour identifier is required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Availability start and end dates are required';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Availability start date must not be after end date';
  END IF;

  IF p_end_date - p_start_date > 365 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Availability date range cannot exceed 366 days';
  END IF;

  IF NOT v_is_admin AND p_start_date < CURRENT_DATE THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Public availability lookup cannot include past dates';
  END IF;

  SELECT t.*
  INTO v_tour
  FROM public.tours AS t
  WHERE t.slug = v_tour_identifier
     OR t.id::text = v_tour_identifier;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Public booking pages may query only published tours. Internal staff keep
  -- access to draft/archived tours through the existing administrator helper.
  IF v_tour.status <> 'published' AND NOT v_is_admin THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH date_series AS (
    SELECT d::date AS calendar_date
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d
  ),
  live_bookings AS (
    SELECT
      b.booking_date,
      COALESCE(SUM(b.adult_count + b.child_count + b.infant_count), 0)::int AS reserved_count
    FROM public.bookings AS b
    WHERE b.tour_id = v_tour.id
      AND b.booking_date >= p_start_date
      AND b.booking_date <= p_end_date
      AND b.status NOT IN ('cancelled')
    GROUP BY b.booking_date
  )
  SELECT
    v_tour.id AS tour_id,
    ds.calendar_date AS date,
    CASE
      WHEN ta.status = 'unavailable' THEN 'unavailable'
      WHEN ta.status = 'sold_out' THEN 'sold_out'
      WHEN GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))
        >= COALESCE(ta.max_capacity, v_tour.max_guests, 30) THEN 'sold_out'
      ELSE 'available'
    END AS status,
    COALESCE(ta.max_capacity, v_tour.max_guests, 30)::int AS max_capacity,
    GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))::int AS booked_count,
    GREATEST(
      0,
      COALESCE(ta.max_capacity, v_tour.max_guests, 30)
        - GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))
    )::int AS remaining_capacity,
    CASE
      WHEN ta.status IN ('unavailable', 'sold_out') THEN FALSE
      WHEN ds.calendar_date < CURRENT_DATE THEN FALSE
      WHEN GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))
        >= COALESCE(ta.max_capacity, v_tour.max_guests, 30) THEN FALSE
      ELSE TRUE
    END AS is_available,
    (COALESCE(ta.status, '') = 'unavailable') AS is_blackout,
    COALESCE(v_tour.departure_time, '08:30 AM') AS departure_time,
    CASE WHEN v_is_admin THEN ta.notes ELSE NULL END AS notes
  FROM date_series AS ds
  LEFT JOIN public.tour_availability AS ta
    ON ta.tour_id = v_tour.id AND ta.date = ds.calendar_date
  LEFT JOIN live_bookings AS lb
    ON lb.booking_date = ds.calendar_date
  ORDER BY ds.calendar_date ASC;
END;
$availability$;

REVOKE ALL ON FUNCTION public.get_tour_availability_schedule(TEXT, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tour_availability_schedule(TEXT, DATE, DATE) TO anon, authenticated, service_role;
