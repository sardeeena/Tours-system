-- Keep public exclusive-trip catalogue reads independent from staff RBAC helpers.
-- public.has_permission(text) is intentionally not executable by anon. A shared
-- anon/authenticated policy that ORs a role check with has_permission can still
-- invoke the helper while PostgreSQL evaluates the policy, producing SQLSTATE 42501.
-- Split the public and authenticated predicates instead of widening function grants.
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
