-- Give each passenger a stable position within their booking so manifest edits
-- can upsert the correct person without relying on synthetic browser IDs.
ALTER TABLE public.booking_passengers
  ADD COLUMN IF NOT EXISTS passenger_index integer;

WITH ranked_passengers AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id
      ORDER BY
        COALESCE(is_lead_passenger, is_lead, false) DESC,
        created_at ASC,
        id ASC
    ) - 1 AS passenger_index
  FROM public.booking_passengers
)
UPDATE public.booking_passengers AS passenger
SET passenger_index = ranked.passenger_index
FROM ranked_passengers AS ranked
WHERE passenger.id = ranked.id
  AND passenger.passenger_index IS NULL;

ALTER TABLE public.booking_passengers
  ALTER COLUMN passenger_index SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.booking_passengers'::regclass
      AND conname = 'booking_passengers_booking_id_passenger_index_key'
  ) THEN
    ALTER TABLE public.booking_passengers
      ADD CONSTRAINT booking_passengers_booking_id_passenger_index_key
      UNIQUE (booking_id, passenger_index);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking_index
  ON public.booking_passengers (booking_id, passenger_index);

UPDATE public.booking_passengers
SET
  is_lead_passenger = (passenger_index = 0),
  is_lead = (passenger_index = 0)
WHERE is_lead_passenger IS DISTINCT FROM (passenger_index = 0)
   OR is_lead IS DISTINCT FROM (passenger_index = 0);

COMMENT ON COLUMN public.booking_passengers.passenger_index IS
  'Stable zero-based passenger position within a booking; unique with booking_id for manifest upserts.';
