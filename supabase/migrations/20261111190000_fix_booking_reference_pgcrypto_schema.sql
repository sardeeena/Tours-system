-- Fix booking-reference generation for SECURITY DEFINER functions with an empty search_path.
-- Supabase installs pgcrypto in the extensions schema; the function must qualify it.
BEGIN;

DO $migration$
DECLARE
  v_function_oid oid;
  v_definition text;
BEGIN
  SELECT p.oid
    INTO v_function_oid
  FROM pg_proc AS p
  JOIN pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND p.proname = 'create_booking_atomic'
    AND p.pronargs = 18;

  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'Expected private.create_booking_atomic/18 was not found';
  END IF;

  IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto extensions.gen_random_bytes(integer) is not installed';
  END IF;

  v_definition := pg_get_functiondef(v_function_oid);

  IF v_definition ~* 'encode\(\s*extensions\.gen_random_bytes\(10\)\s*,\s*''hex''\s*\)' THEN
    RAISE NOTICE 'Booking-reference generator is already schema-qualified';
  ELSIF v_definition ~* 'encode\(\s*gen_random_bytes\(10\)\s*,\s*''hex''\s*\)' THEN
    v_definition := regexp_replace(
      v_definition,
      'encode\(\s*gen_random_bytes\(10\)\s*,\s*''hex''\s*\)',
      'encode(extensions.gen_random_bytes(10), ''hex'')',
      'gi'
    );
    EXECUTE v_definition;
  ELSE
    RAISE EXCEPTION 'Expected booking-reference expression was not found; refusing to modify the function';
  END IF;
END
$migration$;

COMMIT;
