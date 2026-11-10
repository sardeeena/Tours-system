-- Make the public availability schedule authoritative and harden its definer context.
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
BEGIN
  SELECT *
  INTO v_tour
  FROM public.tours
  WHERE (slug = TRIM(p_tour_identifier) OR id::text = TRIM(p_tour_identifier));

  IF NOT FOUND THEN
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
    ta.notes
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
