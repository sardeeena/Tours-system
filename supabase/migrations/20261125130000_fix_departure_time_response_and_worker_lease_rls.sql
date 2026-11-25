BEGIN;

-- Keep the selected departure time present and stable in every booking result.
-- The selected departure row is the source of truth; do not depend on a RECORD
-- field surviving later edits to the atomic booking function.
DO $migration$
DECLARE
  v_signature regprocedure := to_regprocedure(
    'private.create_booking_atomic(text,date,integer,integer,integer,text,text,text,text,text,text,text,text,jsonb,text,text,text,text,text)'
  );
  v_definition text;
  v_old_final constant text := '''departureTime'', v_avail.start_time,';
  v_new_final constant text := '''departureTime'', (SELECT d.start_time FROM public.departures AS d WHERE d.id = v_selected_departure_id),';
  v_old_duplicate constant text := '''bookingDate'', v_existing_dup.booking_date,';
  v_new_duplicate constant text := '''bookingDate'', v_existing_dup.booking_date,' || E'\n' ||
    '            ''departureId'', v_existing_dup.departure_id,' || E'\n' ||
    '            ''departureTime'', (SELECT d.start_time FROM public.departures AS d WHERE d.id = v_existing_dup.departure_id),';
  v_duplicate_count integer;
BEGIN
  IF v_signature IS NULL THEN
    RAISE EXCEPTION 'Expected language-aware atomic booking function overload was not found.';
  END IF;

  v_definition := pg_get_functiondef(v_signature);
  v_duplicate_count := (
    length(v_definition) - length(replace(v_definition, v_old_duplicate, ''))
  ) / length(v_old_duplicate);

  IF position(v_new_final IN v_definition) = 0 THEN
    IF position(v_old_final IN v_definition) = 0 THEN
      RAISE EXCEPTION 'The expected selected-departure response field was not found.';
    END IF;
    v_definition := replace(v_definition, v_old_final, v_new_final);
  END IF;

  IF v_duplicate_count > 0 THEN
    IF v_duplicate_count <> 3 THEN
      RAISE EXCEPTION 'Expected three idempotent booking response blocks; found %.', v_duplicate_count;
    END IF;
    v_definition := replace(v_definition, v_old_duplicate, v_new_duplicate);
  ELSIF position('''departureTime'', (SELECT d.start_time FROM public.departures AS d WHERE d.id = v_existing_dup.departure_id),' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Idempotent booking responses are missing their departure details.';
  END IF;

  IF position(v_new_final IN v_definition) = 0
     OR position('''departureId'', v_existing_dup.departure_id,' IN v_definition) = 0
     OR position('''departureTime'', (SELECT d.start_time FROM public.departures AS d WHERE d.id = v_existing_dup.departure_id),' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Departure response rewrite did not produce all expected fields.';
  END IF;

  EXECUTE v_definition;
END;
$migration$;

-- This table is deliberately private and must never be readable or writable by
-- browser roles. An explicit deny policy documents that intent and keeps RLS
-- fail-closed while service-role/background workers retain their existing access.
DROP POLICY IF EXISTS background_worker_leases_deny_client_access
  ON private.background_worker_leases;
CREATE POLICY background_worker_leases_deny_client_access
  ON private.background_worker_leases
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
