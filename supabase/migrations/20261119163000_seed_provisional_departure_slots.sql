-- Materialize the existing published departure schedule into independently
-- bookable slot records. Capacity is copied from the existing daily capacity
-- (35) and explicitly marked provisional. Slots remain SCHEDULED, so they are
-- not publicly bookable until an operator verifies capacity/resources and
-- changes each slot to CONFIRMED. No legacy booking is assigned or modified.

BEGIN;

DO $seed$
DECLARE
  v_inserted INTEGER := 0;
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
      AND nullif(btrim(t.departure_time),'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookings AS b
        WHERE b.tour_id = ta.tour_id
          AND b.booking_date = ta.date
          AND b.status <> 'cancelled'
      )
  ),
  candidate_slots AS (
    SELECT
      d.tour_id,
      d.date,
      greatest(1,least(500,d.max_capacity))::INTEGER AS capacity,
      to_char(to_timestamp(btrim(slot_time),'HH12:MI AM')::TIME,'HH24:MI') AS start_time,
      to_char(
        (
          to_timestamp(btrim(slot_time),'HH12:MI AM')::TIME
          + make_interval(secs => (d.duration_hours * 3600)::DOUBLE PRECISION)
        ),
        'HH24:MI'
      ) AS end_time
    FROM eligible_days AS d
    CROSS JOIN LATERAL unnest(string_to_array(d.departure_time,',')) AS slot_time
    WHERE d.duration_hours > 0
      AND btrim(slot_time) ~* '^[0-9]{1,2}:[0-9]{2}[[:space:]]*(AM|PM)
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
      'PROVISIONAL: generated from the published tour departure_time and existing daily capacity. Operator verification and resource assignment are required before confirming this slot.'
    FROM candidate_slots AS candidate
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*)::INTEGER INTO v_inserted FROM inserted;

  RAISE NOTICE 'Created % provisional departure slots.', v_inserted;
END;
$seed$;

-- Rebuild the one-row-per-day summary from all departure slots. A date with
-- only scheduled slots remains unavailable to customers until an operator
-- confirms at least one slot. Explicit blackout overrides remain untouched.
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
      WHERE d.tour_id = ta.tour_id AND d.date = ta.date AND d.status = 'confirmed'
        AND d.remaining_capacity > 0
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
    ) THEN concat_ws(' ', nullif(ta.notes,''), 'Daily capacity is the sum of provisional departure slots; operator confirmation is required.')
    ELSE ta.notes
  END,
  updated_at = now()
WHERE ta.date > (now() AT TIME ZONE 'Africa/Cairo')::DATE;

NOTIFY pgrst, 'reload schema';
COMMIT;

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
      'PROVISIONAL: generated from the published tour departure_time and existing daily capacity. Operator verification and resource assignment are required before confirming this slot.'
    FROM candidate_slots AS candidate
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT count(*)::INTEGER INTO v_inserted FROM inserted;

  RAISE NOTICE 'Created % provisional departure slots.', v_inserted;
END;
$seed$;

-- Rebuild the one-row-per-day summary from all departure slots. A date with
-- only scheduled slots remains unavailable to customers until an operator
-- confirms at least one slot. Explicit blackout overrides remain untouched.
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
      WHERE d.tour_id = ta.tour_id AND d.date = ta.date AND d.status = 'confirmed'
        AND d.remaining_capacity > 0
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
    ) THEN concat_ws(' ', nullif(ta.notes,''), 'Daily capacity is the sum of provisional departure slots; operator confirmation is required.')
    ELSE ta.notes
  END,
  updated_at = now()
WHERE ta.date > (now() AT TIME ZONE 'Africa/Cairo')::DATE;

NOTIFY pgrst, 'reload schema';
COMMIT;
