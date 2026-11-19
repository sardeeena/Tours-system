-- Materialize configured tour times as independently bookable departure
-- records without increasing the existing daily capacity. The existing
-- tour_availability.max_capacity is the only verified capacity source, so it
-- is divided evenly across the configured times (remainder goes to the
-- earliest times). Every new slot remains SCHEDULED and non-bookable until an
-- operator verifies the per-slot allocation and resources.
--
-- Existing bookings are never assigned, updated, or deleted. Dates with
-- active unassigned legacy bookings are excluded from automatic slot creation.

BEGIN;

DO $seed$
DECLARE
  v_inserted INTEGER := 0;
  v_invalid_days INTEGER := 0;
BEGIN
  WITH eligible_days AS (
    SELECT
      ta.tour_id,
      ta.date,
      ta.max_capacity,
      t.duration_hours,
      t.departure_time
    FROM public.tour_availability AS ta
    JOIN public.tours AS t ON t.id = ta.tour_id
    WHERE t.status = 'published'
      AND ta.date > (now() AT TIME ZONE 'Africa/Cairo')::DATE
      AND ta.status = 'available'
      AND ta.max_capacity BETWEEN 1 AND 500
      AND t.duration_hours > 0
      AND nullif(btrim(t.departure_time),'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings AS b
        WHERE b.tour_id = ta.tour_id
          AND b.booking_date = ta.date
          AND b.departure_id IS NULL
          AND b.status <> 'cancelled'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.departures AS existing
        WHERE existing.tour_id = ta.tour_id
          AND existing.date = ta.date
      )
  ),
  parsed_slots AS (
    SELECT DISTINCT
      d.tour_id,
      d.date,
      d.max_capacity AS daily_capacity,
      d.duration_hours,
      to_timestamp(btrim(slot_time),'HH12:MI AM')::TIME AS start_time
    FROM eligible_days AS d
    CROSS JOIN LATERAL unnest(string_to_array(d.departure_time,',')) AS slot_time
    WHERE btrim(slot_time) ~* '^[0-9]{1,2}:[0-9]{2}[[:space:]]*(AM|PM)$'
  ),
  invalid_days AS (
    SELECT tour_id,date
    FROM parsed_slots
    GROUP BY tour_id,date,daily_capacity
    HAVING daily_capacity < count(*)
  )
  SELECT count(*)::INTEGER INTO v_invalid_days
  FROM invalid_days;

  IF v_invalid_days > 0 THEN
    RAISE EXCEPTION
      'Cannot split the existing daily capacity into positive departure capacities for % tour/date combinations. Operator review is required.',
      v_invalid_days;
  END IF;

  WITH eligible_days AS (
    SELECT
      ta.tour_id,
      ta.date,
      ta.max_capacity,
      t.duration_hours,
      t.departure_time
    FROM public.tour_availability AS ta
    JOIN public.tours AS t ON t.id = ta.tour_id
    WHERE t.status = 'published'
      AND ta.date > (now() AT TIME ZONE 'Africa/Cairo')::DATE
      AND ta.status = 'available'
      AND ta.max_capacity BETWEEN 1 AND 500
      AND t.duration_hours > 0
      AND nullif(btrim(t.departure_time),'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings AS b
        WHERE b.tour_id = ta.tour_id
          AND b.booking_date = ta.date
          AND b.departure_id IS NULL
          AND b.status <> 'cancelled'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.departures AS existing
        WHERE existing.tour_id = ta.tour_id
          AND existing.date = ta.date
      )
  ),
  parsed_slots AS (
    SELECT DISTINCT
      d.tour_id,
      d.date,
      d.max_capacity AS daily_capacity,
      d.duration_hours,
      to_timestamp(btrim(slot_time),'HH12:MI AM')::TIME AS start_time
    FROM eligible_days AS d
    CROSS JOIN LATERAL unnest(string_to_array(d.departure_time,',')) AS slot_time
    WHERE btrim(slot_time) ~* '^[0-9]{1,2}:[0-9]{2}[[:space:]]*(AM|PM)$'
  ),
  numbered_slots AS (
    SELECT
      parsed.*,
      row_number() OVER (
        PARTITION BY parsed.tour_id,parsed.date
        ORDER BY parsed.start_time
      )::INTEGER AS slot_number,
      count(*) OVER (
        PARTITION BY parsed.tour_id,parsed.date
      )::INTEGER AS slot_count
    FROM parsed_slots AS parsed
  ),
  candidate_slots AS (
    SELECT
      tour_id,
      date,
      (
        (daily_capacity / slot_count)
        + CASE WHEN slot_number <= mod(daily_capacity,slot_count) THEN 1 ELSE 0 END
      )::INTEGER AS capacity,
      to_char(start_time,'HH24:MI') AS start_time,
      to_char(
        start_time + make_interval(secs => (duration_hours * 3600)::DOUBLE PRECISION),
        'HH24:MI'
      ) AS end_time
    FROM numbered_slots
  ),
  inserted AS (
    INSERT INTO public.departures (
      tour_id,date,start_time,end_time,capacity,booked_passengers,remaining_capacity,
      status,notes
    )
    SELECT
      candidate.tour_id,
      candidate.date,
      candidate.start_time,
      candidate.end_time,
      candidate.capacity,
      0,
      candidate.capacity,
      'scheduled',
      'PROVISIONAL: existing daily capacity was evenly split across configured departure times. Operator verification and resource assignment are required before confirming this slot.'
    FROM candidate_slots AS candidate
    WHERE candidate.capacity > 0
    ON CONFLICT (tour_id,date,start_time) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::INTEGER INTO v_inserted FROM inserted;

  RAISE NOTICE 'Created % provisional departure slots with daily capacity preserved.', v_inserted;
END;
$seed$;

-- Rebuild the one-row-per-day summary from all departure slots. Legacy
-- bookings remain unassigned and their passenger counts are preserved.
UPDATE public.tour_availability AS ta
SET
  max_capacity = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.departures AS d
      WHERE d.tour_id = ta.tour_id AND d.date = ta.date
        AND d.status NOT IN ('cancelled','completed')
    ) THEN coalesce((
      SELECT sum(d.capacity)::INTEGER
      FROM public.departures AS d
      WHERE d.tour_id = ta.tour_id
        AND d.date = ta.date
        AND d.status NOT IN ('cancelled','completed')
    ),0)
    WHEN EXISTS (
      SELECT 1 FROM public.bookings AS b
      WHERE b.tour_id = ta.tour_id AND b.booking_date = ta.date
        AND b.departure_id IS NULL AND b.status <> 'cancelled'
    ) THEN ta.max_capacity
    ELSE 0
  END,
  booked_count = coalesce((
    SELECT sum(d.booked_passengers)::INTEGER
    FROM public.departures AS d
    WHERE d.tour_id = ta.tour_id
      AND d.date = ta.date
      AND d.status NOT IN ('cancelled','completed')
  ),0) + coalesce((
    SELECT sum(b.adult_count + b.child_count + b.infant_count)::INTEGER
    FROM public.bookings AS b
    WHERE b.tour_id = ta.tour_id AND b.booking_date = ta.date
      AND b.departure_id IS NULL AND b.status <> 'cancelled'
  ),0),
  status = CASE
    WHEN ta.is_blackout THEN 'unavailable'
    WHEN EXISTS (
      SELECT 1 FROM public.departures AS d
      WHERE d.tour_id = ta.tour_id AND d.date = ta.date
        AND d.status = 'confirmed' AND d.remaining_capacity > 0
    ) THEN 'available'
    WHEN EXISTS (
      SELECT 1 FROM public.departures AS d
      WHERE d.tour_id = ta.tour_id AND d.date = ta.date AND d.status = 'confirmed'
    ) THEN 'sold_out'
    ELSE 'unavailable'
  END,
  departure_id = NULL,
  notes = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.bookings AS b
      WHERE b.tour_id = ta.tour_id AND b.booking_date = ta.date
        AND b.departure_id IS NULL AND b.status <> 'cancelled'
    ) THEN concat_ws(' ', nullif(ta.notes,''), 'Legacy bookings remain unassigned; departure slots were not created for this date.')
    WHEN EXISTS (
      SELECT 1 FROM public.departures AS d
      WHERE d.tour_id = ta.tour_id AND d.date = ta.date
        AND d.notes LIKE 'PROVISIONAL:%'
    ) THEN concat_ws(' ', nullif(ta.notes,''), 'Daily capacity is preserved across provisional departure slots; operator confirmation is required.')
    ELSE ta.notes
  END,
  updated_at = now()
WHERE ta.date > (now() AT TIME ZONE 'Africa/Cairo')::DATE
  AND EXISTS (
    SELECT 1 FROM public.tours AS published
    WHERE published.id = ta.tour_id AND published.status = 'published'
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
