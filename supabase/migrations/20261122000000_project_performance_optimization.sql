-- Project-wide performance improvements: visitor event ingestion and indexed/RLS lookups.
-- No existing booking, customer, payment, or media records are rewritten.

CREATE INDEX IF NOT EXISTS exclusive_departures_captain_id_idx
  ON public.exclusive_departures (captain_id);
CREATE INDEX IF NOT EXISTS exclusive_departures_driver_id_idx
  ON public.exclusive_departures (driver_id);
CREATE INDEX IF NOT EXISTS exclusive_departures_guide_id_idx
  ON public.exclusive_departures (guide_id);
CREATE INDEX IF NOT EXISTS exclusive_departures_vessel_id_idx
  ON public.exclusive_departures (vessel_id);

DROP POLICY IF EXISTS exclusive_trips_select ON public.exclusive_trips;
CREATE POLICY exclusive_trips_select
  ON public.exclusive_trips
  FOR SELECT
  TO anon, authenticated
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
    OR (
      (SELECT auth.role()) = 'authenticated'
      AND (SELECT public.has_permission('content.read'::text))
    )
  );

DROP POLICY IF EXISTS exclusive_departures_select ON public.exclusive_departures;
CREATE POLICY exclusive_departures_select
  ON public.exclusive_departures
  FOR SELECT
  TO anon, authenticated
  USING (
    (
      status = 'confirmed'
      AND date >= ((now() AT TIME ZONE 'Africa/Cairo')::date)
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
    OR (
      (SELECT auth.role()) = 'authenticated'
      AND (SELECT public.has_permission('operations.read'::text))
    )
  );

CREATE OR REPLACE FUNCTION public.record_visitor_event(
  p_session_id UUID,
  p_user_id UUID,
  p_event_name TEXT,
  p_page_path TEXT,
  p_page_title TEXT,
  p_duration_ms INTEGER,
  p_event_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  IF p_session_id IS NULL OR p_event_name IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.visitor_sessions
  SET
    last_seen_at = clock_timestamp(),
    user_id = p_user_id
  WHERE id = p_session_id
    AND analytics_consent = TRUE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.visitor_events (
    session_id,
    user_id,
    event_name,
    page_path,
    page_title,
    duration_ms,
    event_data
  ) VALUES (
    p_session_id,
    p_user_id,
    p_event_name,
    p_page_path,
    p_page_title,
    p_duration_ms,
    COALESCE(p_event_data, '{}'::jsonb)
  );

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_visitor_event(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_visitor_event(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, JSONB)
  TO service_role;
