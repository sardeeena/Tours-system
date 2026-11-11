-- Fix booking-reference generation for SECURITY DEFINER functions with an empty search_path.
-- Supabase installs pgcrypto in the extensions schema; the function must qualify it.
BEGIN;

DO $migration$
DECLARE
  v_function_oid oid;
  v_definition text;
  v_unqualified text := 'ENCODE(gen_random_bytes(10), ''hex'')';
  v_qualified text := 'ENCODE(extensions.gen_random_bytes(10), ''hex'')';
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

  IF position(v_qualified IN v_definition) > 0 THEN
    RAISE NOTICE 'Booking-reference generator is already schema-qualified';
  ELSIF position(v_unqualified IN v_definition) > 0 THEN
    v_definition := replace(v_definition, v_unqualified, v_qualified);
    EXECUTE v_definition;
  ELSE
    RAISE EXCEPTION 'Expected booking-reference expression was not found; refusing to modify the function';
  END IF;
END
$migration$;

COMMIT;
