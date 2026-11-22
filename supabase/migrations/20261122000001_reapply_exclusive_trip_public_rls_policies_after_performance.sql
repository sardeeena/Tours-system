-- Re-apply role-specific public policies after 20261122000000_project_performance_optimization.
-- That earlier migration recreates shared anon/authenticated SELECT policies which
-- invoke public.has_permission(text) from an anon-capable policy. Keep the helper
-- non-executable by anon and restore separate role-scoped policies after it.
BEGIN;

DROP POLICY IF EXISTS exclusive_trips_select ON public.exclusive_trips;
DROP POLICY IF EXISTS exclusive_trips_anon_read ON public.exclusive_trips;
DROP POLICY IF EXISTS exclusive_trips_authenticated_read ON public.exclusive_trips;

CREATE POLICY exclusive_trips_anon_read
  ON public.exclusive_trips
  FOR SELECT
  TO anon
  USING (
    is_active
    AND EXISTS (
      SELECT 1
      FROM public.tours AS t
      WHERE t.id = exclusive_trips.tour_id
        AND t.is_exclusive = TRUE
        AND t.status = 'published'
    )
  );

CREATE POLICY exclusive_trips_authenticated_read
  ON public.exclusive_trips
  FOR SELECT
  TO authenticated
  USING (
    (
      is_active
      AND EXISTS (
        SELECT 1
        FROM public.tours AS t
        WHERE t.id = exclusive_trips.tour_id
          AND t.is_exclusive = TRUE
          AND t.status = 'published'
      )
    )
    OR (SELECT public.has_permission('content.read'))
  );

DROP POLICY IF EXISTS exclusive_departures_select ON public.exclusive_departures;
DROP POLICY IF EXISTS exclusive_departures_anon_read ON public.exclusive_departures;
DROP POLICY IF EXISTS exclusive_departures_authenticated_read ON public.exclusive_departures;

CREATE POLICY exclusive_departures_anon_read
  ON public.exclusive_departures
  FOR SELECT
  TO anon
  USING (
    status = 'confirmed'
    AND date >= (now() AT TIME ZONE 'Africa/Cairo')::date
    AND public.is_exclusive_departure_available(id)
    AND EXISTS (
      SELECT 1
      FROM public.exclusive_trips AS et
      JOIN public.tours AS t ON t.id = et.tour_id
      WHERE et.id = exclusive_departures.exclusive_trip_id
        AND et.is_active = TRUE
        AND t.is_exclusive = TRUE
        AND t.status = 'published'
    )
  );

CREATE POLICY exclusive_departures_authenticated_read
  ON public.exclusive_departures
  FOR SELECT
  TO authenticated
  USING (
    (
      status = 'confirmed'
      AND date >= (now() AT TIME ZONE 'Africa/Cairo')::date
      AND public.is_exclusive_departure_available(id)
      AND EXISTS (
        SELECT 1
        FROM public.exclusive_trips AS et
        JOIN public.tours AS t ON t.id = et.tour_id
        WHERE et.id = exclusive_departures.exclusive_trip_id
          AND et.is_active = TRUE
          AND t.is_exclusive = TRUE
          AND t.status = 'published'
      )
    )
    OR (SELECT public.has_permission('operations.read'))
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
