-- Secure booking lookup returns the exact selected departure for new bookings.
-- Legacy bookings with no departure_id remain unassigned and are not given a
-- guessed time from the tour's comma-separated default schedule.

BEGIN;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS unit_price_adult NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_child NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $migration$
DECLARE
  v_definition TEXT;
  v_old_declaration TEXT := '  v_tour RECORD;';
  v_new_declaration TEXT := '  v_tour RECORD;' || E'\n' || '  v_departure RECORD;';
  v_old_tour_query TEXT := E'  SELECT t.id, t.title, t.slug, t.departure_time, t.duration,' || E'\n' ||
    '         d.name AS destination_name' || E'\n' ||
    '  INTO v_tour' || E'\n' ||
    '  FROM public.tours AS t' || E'\n' ||
    '  LEFT JOIN public.destinations AS d ON d.id = t.destination_id' || E'\n' ||
    '  WHERE t.id = v_booking.tour_id;';
  v_new_tour_query TEXT := v_old_tour_query || E'\n\n' ||
    '  SELECT d.id,d.start_time,d.end_time' || E'\n' ||
    '  INTO v_departure' || E'\n' ||
    '  FROM public.departures AS d' || E'\n' ||
    '  WHERE d.id = v_booking.departure_id;';
  v_old_nested_time TEXT := E'      ''departureTime'', COALESCE(v_tour.departure_time, ''08:30 AM''),';
  v_new_nested_time TEXT := E'      ''departureTime'', v_departure.start_time,';
  v_old_booking_date TEXT := E'    ''bookingDate'', v_booking.booking_date,';
  v_new_booking_date TEXT := E'    ''bookingDate'', v_booking.booking_date,' || E'\n' ||
    '    ''departureId'', v_booking.departure_id,' || E'\n' ||
    '    ''departureTime'', v_departure.start_time,';
  v_old_pricing TEXT := E'    ''pricing'', JSONB_BUILD_OBJECT(' || E'\n' ||
    '      ''subtotal'', v_booking.subtotal,' || E'\n' ||
    '      ''extrasTotal'', v_booking.extras_total,' || E'\n' ||
    '      ''discount'', v_booking.discount,' || E'\n' ||
    '      ''total'', v_booking.total,' || E'\n' ||
    '      ''currency'', v_booking.currency,' || E'\n' ||
    '      ''paymentStatus'', v_booking.payment_status,' || E'\n' ||
    '      ''paymentMethod'', v_booking.payment_method' || E'\n' ||
    '    ),';
  v_new_pricing TEXT := E'    ''pricing'', JSONB_BUILD_OBJECT(' || E'\n' ||
    '      ''subtotal'', v_booking.subtotal,' || E'\n' ||
    '      ''extrasTotal'', v_booking.extras_total,' || E'\n' ||
    '      ''discount'', v_booking.discount,' || E'\n' ||
    '      ''total'', v_booking.total,' || E'\n' ||
    '      ''basePricePerAdultEur'', NULLIF(v_booking.unit_price_adult, 0),' || E'\n' ||
    '      ''basePricePerChildEur'', NULLIF(v_booking.unit_price_child, 0),' || E'\n' ||
    '      ''currency'', v_booking.currency,' || E'\n' ||
    '      ''paymentStatus'', v_booking.payment_status,' || E'\n' ||
    '      ''paymentMethod'', v_booking.payment_method' || E'\n' ||
    '    ),';
BEGIN
  SELECT pg_get_functiondef('private.lookup_booking_secure(text,text)'::regprocedure)
  INTO v_definition;

  IF position(v_old_declaration in v_definition) = 0
     OR position(v_old_tour_query in v_definition) = 0
     OR position(v_old_nested_time in v_definition) = 0
     OR position(v_old_booking_date in v_definition) = 0
     OR position(v_old_pricing in v_definition) = 0 THEN
    RAISE EXCEPTION 'Secure booking lookup no longer matches the reviewed departure-detail anchors.';
  END IF;

  v_definition := replace(v_definition,v_old_declaration,v_new_declaration);
  v_definition := replace(v_definition,v_old_tour_query,v_new_tour_query);
  v_definition := replace(v_definition,v_old_nested_time,v_new_nested_time);
  v_definition := replace(v_definition,v_old_booking_date,v_new_booking_date);
  v_definition := replace(v_definition,v_old_pricing,v_new_pricing);

  EXECUTE v_definition;
END;
$migration$;

COMMENT ON COLUMN public.bookings.unit_price_adult IS 'Adult per-person rate captured when this booking was created; legacy rows remain zero until explicitly reconciled.';
COMMENT ON COLUMN public.bookings.unit_price_child IS 'Child per-person rate captured when this booking was created; private tours store the same per-person rate for adults and children.';

COMMENT ON FUNCTION private.lookup_booking_secure(TEXT,TEXT)
IS 'Verifies the booking reference and contact, then returns the exact assigned departure for the verified booking without guessing legacy departure times.';

NOTIFY pgrst, 'reload schema';
COMMIT;
