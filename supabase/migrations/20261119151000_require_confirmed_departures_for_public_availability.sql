-- Do not advertise generic date rows as bookable departures.
-- Public availability only reports capacity when a real matching departure
-- record is linked to the date row. This is read-only with respect to data.
DO $migration$
DECLARE
  v_signature regprocedure := to_regprocedure('private.get_tour_availability_schedule(text,date,date)');
  v_definition text;
  v_old_join text := E'  LEFT JOIN public.tour_availability AS ta\n    ON ta.tour_id = v_tour.id AND ta.date = ds.calendar_date\n  LEFT JOIN live_bookings AS lb';
  v_new_join text := E'  LEFT JOIN public.tour_availability AS ta\n    ON ta.tour_id = v_tour.id AND ta.date = ds.calendar_date\n  LEFT JOIN public.departures AS d\n    ON d.id = ta.departure_id\n   AND d.tour_id = v_tour.id\n   AND d.date = ds.calendar_date\n   AND d.status NOT IN (''cancelled'', ''completed'')\n  LEFT JOIN live_bookings AS lb';
  v_old_status text := '      WHEN ta.id IS NULL THEN ''unavailable''';
  v_new_status text := '      WHEN ta.id IS NULL OR d.id IS NULL THEN ''unavailable''';
  v_old_capacity text := '    COALESCE(ta.max_capacity, 0)::int AS max_capacity,';
  v_new_capacity text := '    CASE WHEN d.id IS NULL THEN 0 ELSE COALESCE(ta.max_capacity, 0) END::int AS max_capacity,';
  v_old_booked text := '    GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))::int AS booked_count,';
  v_new_booked text := '    CASE WHEN d.id IS NULL THEN 0 ELSE GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0)) END::int AS booked_count,';
  v_old_remaining text := E'    GREATEST(\n      0,\n      COALESCE(ta.max_capacity, 0)\n        - GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))\n    )::int AS remaining_capacity,';
  v_new_remaining text := E'    CASE WHEN d.id IS NULL THEN 0 ELSE GREATEST(\n      0,\n      COALESCE(ta.max_capacity, 0)\n        - GREATEST(COALESCE(ta.booked_count, 0), COALESCE(lb.reserved_count, 0))\n    ) END::int AS remaining_capacity,';
  v_old_available text := '      WHEN ta.id IS NULL THEN FALSE';
  v_new_available text := '      WHEN ta.id IS NULL OR d.id IS NULL THEN FALSE';
  v_old_blackout text := '    (ta.id IS NULL OR COALESCE(ta.status, '''') = ''unavailable'') AS is_blackout,';
  v_new_blackout text := '    (ta.id IS NULL OR d.id IS NULL OR COALESCE(ta.status, '''') = ''unavailable'') AS is_blackout,';
  v_old_time text := '    CASE WHEN ta.id IS NULL THEN NULL ELSE v_tour.departure_time END AS departure_time,';
  v_new_time text := '    CASE WHEN d.id IS NULL THEN NULL ELSE v_tour.departure_time END AS departure_time,';
BEGIN
  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'Expected private.get_tour_availability_schedule function was not found.';
  END IF;

  v_definition := pg_get_functiondef(v_signature);
  IF position(v_old_join in v_definition) = 0
     OR position(v_old_status in v_definition) = 0
     OR position(v_old_capacity in v_definition) = 0
     OR position(v_old_booked in v_definition) = 0
     OR position(v_old_remaining in v_definition) = 0
     OR position(v_old_available in v_definition) = 0
     OR position(v_old_blackout in v_definition) = 0
     OR position(v_old_time in v_definition) = 0 THEN
    RAISE EXCEPTION 'Availability function source no longer matches the reviewed migration anchors; stop and review manually.';
  END IF;

  v_definition := replace(v_definition, v_old_join, v_new_join);
  v_definition := replace(v_definition, v_old_status, v_new_status);
  v_definition := replace(v_definition, v_old_capacity, v_new_capacity);
  v_definition := replace(v_definition, v_old_booked, v_new_booked);
  v_definition := replace(v_definition, v_old_remaining, v_new_remaining);
  v_definition := replace(v_definition, v_old_available, v_new_available);
  v_definition := replace(v_definition, v_old_blackout, v_new_blackout);
  v_definition := replace(v_definition, v_old_time, v_new_time);

  EXECUTE v_definition;
END;
$migration$;

COMMENT ON FUNCTION private.get_tour_availability_schedule(text,date,date)
IS 'Public availability exposes bookable capacity only for dates linked to a real, matching, non-cancelled departure.';
