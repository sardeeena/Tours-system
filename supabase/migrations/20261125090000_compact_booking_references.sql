BEGIN;

-- New customer-facing references are exactly nine characters:
-- "AA" plus seven base-36 characters. Cryptographic randomness keeps references
-- difficult to guess; the bookings unique constraint and retry loop prevent collisions.
DO $extension_check$
BEGIN
  IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto extensions.gen_random_bytes(integer) is required for compact booking references.';
  END IF;
END;
$extension_check$;

CREATE OR REPLACE FUNCTION private.encode_booking_reference_suffix(p_value bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $function$
DECLARE
  v_remaining bigint := p_value;
  v_encoded text := '';
  v_alphabet CONSTANT text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_digit integer;
BEGIN
  IF p_value < 0 OR p_value > 78364164095 THEN
    RAISE EXCEPTION 'Booking reference sequence is outside the seven-character base-36 range.'
      USING ERRCODE = '22003';
  END IF;

  IF v_remaining = 0 THEN
    RETURN '0000000';
  END IF;

  WHILE v_remaining > 0 LOOP
    v_digit := mod(v_remaining, 36)::integer;
    v_encoded := substr(v_alphabet, v_digit + 1, 1) || v_encoded;
    v_remaining := v_remaining / 36;
  END LOOP;

  RETURN lpad(v_encoded, 7, '0');
END;
$function$;

REVOKE ALL ON FUNCTION private.encode_booking_reference_suffix(bigint)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.generate_booking_reference(p_booking_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_number bigint;
  v_reference text;
BEGIN
  IF p_booking_date IS NULL THEN
    RAISE EXCEPTION 'A departure date is required to generate a booking reference.'
      USING ERRCODE = '22004';
  END IF;

  LOOP
    -- 56 cryptographically random bits are mapped into the seven-character
    -- base-36 suffix. Any collision is retried; bookings.booking_reference is UNIQUE.
    v_number := (('x' || encode(extensions.gen_random_bytes(7), 'hex'))::bit(56)::bigint
      % 78364164095) + 1;

    v_reference := 'AA' || private.encode_booking_reference_suffix(v_number);

    -- Skip references already present from imports or previous deployments.
    -- The bookings UNIQUE constraint and caller retry handle concurrent collisions.
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.bookings
      WHERE booking_reference = v_reference
    );
  END LOOP;

  RETURN v_reference;
END;
$function$;

REVOKE ALL ON FUNCTION private.generate_booking_reference(date)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION private.generate_booking_reference(date) IS
  'Internal collision-safe generator for nine-character AA plus seven-character cryptographically random base-36 booking references. The date argument is retained for RPC compatibility.';

-- The verified guest lookup and cancellation RPCs historically rejected references
-- shorter than ten characters. Lower their minimum to nine while preserving their
-- contact verification, rate limits, permissions, and exact-match lookup behavior.
DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_rewritten text;
  v_lookup_patched integer := 0;
  v_cancellation_patched integer := 0;
BEGIN
  -- The lookup implementation is private in the current schema history, while
  -- its narrow guest RPC remains public. Patch whichever implementation owns
  -- the length guard instead of assuming a particular schema placement.
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_proc AS p
    INNER JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.proname IN ('lookup_booking_secure', 'request_booking_cancellation_secure')
  LOOP
    v_definition := pg_get_functiondef(v_function.signature);
    v_rewritten := replace(
      v_definition,
      'p_reference)) < 10',
      'p_reference)) < 9'
    );

    IF v_rewritten = v_definition THEN
      v_rewritten := regexp_replace(
        v_definition,
        'p_reference\)\)[[:space:]]*<[[:space:]]*10',
        'p_reference)) < 9',
        'gi'
      );
    END IF;

    IF v_rewritten <> v_definition THEN
      EXECUTE v_rewritten;
      IF v_function.proname = 'lookup_booking_secure' THEN
        v_lookup_patched := v_lookup_patched + 1;
      ELSIF v_function.proname = 'request_booking_cancellation_secure' THEN
        v_cancellation_patched := v_cancellation_patched + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_lookup_patched = 0 THEN
    RAISE EXCEPTION 'No secure booking lookup implementation with the reviewed ten-character guard was found.';
  END IF;
  IF v_cancellation_patched = 0 THEN
    RAISE EXCEPTION 'No secure booking cancellation implementation with the reviewed ten-character guard was found.';
  END IF;
END;
$migration$;

COMMIT;
