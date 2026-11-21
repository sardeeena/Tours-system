-- Ensure each durable background job has a single active Node.js consumer,
-- even when the hosting platform runs multiple application processes.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.background_worker_leases (
  worker_name TEXT PRIMARY KEY
    CHECK (worker_name IN ('booking_notification', 'staff_notification')),
  owner_id UUID NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE private.background_worker_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.background_worker_leases FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.acquire_background_worker_lease(
  p_worker_name TEXT,
  p_owner_id UUID,
  p_lease_seconds INTEGER DEFAULT 90
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_acquired BOOLEAN := FALSE;
  v_lease_seconds INTEGER := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 90), 300));
BEGIN
  IF p_worker_name NOT IN ('booking_notification', 'staff_notification')
     OR p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Invalid background worker lease request'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.background_worker_leases (
    worker_name, owner_id, lease_expires_at, updated_at
  )
  VALUES (
    p_worker_name,
    p_owner_id,
    clock_timestamp() + make_interval(secs => v_lease_seconds),
    clock_timestamp()
  )
  ON CONFLICT (worker_name) DO UPDATE
  SET owner_id = EXCLUDED.owner_id,
      lease_expires_at = EXCLUDED.lease_expires_at,
      updated_at = EXCLUDED.updated_at
  WHERE private.background_worker_leases.lease_expires_at <= clock_timestamp()
     OR private.background_worker_leases.owner_id = EXCLUDED.owner_id
  RETURNING TRUE INTO v_acquired;

  RETURN COALESCE(v_acquired, FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_background_worker_lease(
  p_worker_name TEXT,
  p_owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_released BOOLEAN := FALSE;
BEGIN
  IF p_worker_name NOT IN ('booking_notification', 'staff_notification')
     OR p_owner_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM private.background_worker_leases
  WHERE worker_name = p_worker_name
    AND owner_id = p_owner_id
  RETURNING TRUE INTO v_released;

  RETURN COALESCE(v_released, FALSE);
END;
$function$;

REVOKE ALL ON FUNCTION public.acquire_background_worker_lease(TEXT, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_background_worker_lease(TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_background_worker_lease(TEXT, UUID, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_background_worker_lease(TEXT, UUID)
  TO service_role;

COMMIT;
