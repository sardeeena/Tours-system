-- Fix booking-reference generation for SECURITY DEFINER functions with an empty search_path.
-- Supabase installs pgcrypto in the extensions schema; any direct call must be qualified.
BEGIN;

DO $migration$
DECLARE
  v_function_oid oid;
  v_definition text;
  v_rewritten text;
  v_unqualified_pattern text := '(^|[^.[:alnum:]_])gen_random_bytes[[:space:]]*\(';
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

  IF v_definition ~* v_unqualified_pattern THEN
    v_rewritten := regexp_replace(
      v_definition,
      v_unqualified_pattern,
      E'\\1extensions.gen_random_bytes(',
      'gi'
    );

    IF v_rewritten ~* v_unqualified_pattern THEN
      RAISE EXCEPTION 'Could not safely qualify every unqualified gen_random_bytes call';
    END IF;

    EXECUTE v_rewritten;
  ELSE
    RAISE NOTICE 'No unqualified gen_random_bytes call found; no function rewrite required';
  END IF;
END
$migration$;

COMMIT;
