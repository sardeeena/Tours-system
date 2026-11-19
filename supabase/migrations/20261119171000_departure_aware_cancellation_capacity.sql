-- Cancellation must release capacity through the departure ledger for
-- departure-linked bookings. The old resolver also decremented the daily
-- availability cache, which double-released capacity after the new booking
-- status trigger had already recalculated the departure and daily summary.
-- Unassigned legacy bookings retain the original daily-cache fallback.

BEGIN;

DO $migration$
DECLARE
  v_definition TEXT;
  v_old_capacity_block TEXT := $old$
  UPDATE public.tour_availability AS ta
  SET booked_count = ta.booked_count - v_guest_count,
      status = CASE
        WHEN ta.status = 'sold_out' AND (ta.booked_count - v_guest_count) < ta.max_capacity THEN 'available'
        ELSE ta.status
      END,
      updated_at = NOW()
  WHERE ta.tour_id = v_booking.tour_id
    AND ta.date = v_booking.booking_date
    AND ta.booked_count >= v_guest_count;

  GET DIAGNOSTICS v_new_booked_count = ROW_COUNT;
  IF v_new_booked_count <> 1 THEN
    RAISE EXCEPTION 'Cannot approve cancellation: availability capacity is missing or inconsistent for booking %.', v_booking.booking_reference
      USING ERRCODE = '23514';
  END IF;
$old$;
  v_new_capacity_block TEXT := $new$
  IF v_booking.departure_id IS NULL THEN
    -- Historical bookings have no departure row; retain their daily capacity
    -- release behavior without assigning or rewriting their departure_id.
    UPDATE public.tour_availability AS ta
    SET booked_count = ta.booked_count - v_guest_count,
        status = CASE
          WHEN ta.status = 'sold_out' AND (ta.booked_count - v_guest_count) < ta.max_capacity THEN 'available'
          ELSE ta.status
        END,
        updated_at = NOW()
    WHERE ta.tour_id = v_booking.tour_id
      AND ta.date = v_booking.booking_date
      AND ta.booked_count >= v_guest_count;

    GET DIAGNOSTICS v_new_booked_count = ROW_COUNT;
    IF v_new_booked_count <> 1 THEN
      RAISE EXCEPTION 'Cannot approve cancellation: availability capacity is missing or inconsistent for legacy booking %.', v_booking.booking_reference
        USING ERRCODE = '23514';
    END IF;
  ELSE
    -- The booking status update above fires the departure-capacity trigger.
    -- Verify that the selected slot now equals its remaining active bookings;
    -- do not decrement the daily summary a second time.
    IF NOT EXISTS (
      SELECT 1
      FROM public.departures AS d
      WHERE d.id = v_booking.departure_id
        AND d.tour_id = v_booking.tour_id
        AND d.date = v_booking.booking_date
        AND d.booked_passengers = (
          SELECT COALESCE(SUM(b.adult_count + b.child_count + b.infant_count), 0)::INTEGER
          FROM public.bookings AS b
          WHERE b.departure_id = d.id
            AND b.status <> 'cancelled'
        )
    ) THEN
      RAISE EXCEPTION 'Cannot approve cancellation: departure capacity could not be reconciled for booking %.', v_booking.booking_reference
        USING ERRCODE = '23514';
    END IF;
    v_new_booked_count := 1;
  END IF;
$new$;
BEGIN
  SELECT pg_get_functiondef(
    'private.admin_resolve_booking_cancellation(text,text,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_capacity_block IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Expected legacy cancellation capacity block was not found; refusing to alter the cancellation workflow.';
  END IF;

  v_definition := replace(v_definition, v_old_capacity_block, v_new_capacity_block);

  IF position('IF v_booking.departure_id IS NULL THEN' IN v_definition) = 0
     OR position('d.booked_passengers = (' IN v_definition) = 0
     OR position('booked_count = ta.booked_count - v_guest_count' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Departure-aware cancellation capacity postconditions failed.';
  END IF;

  EXECUTE v_definition;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
