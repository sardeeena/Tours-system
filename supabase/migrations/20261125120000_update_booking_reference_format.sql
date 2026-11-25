BEGIN;

-- Keep the already-applied compact-reference migration immutable. This follow-up
-- changes only the generator used by new bookings to the agreed human-readable
-- nine-character format: AA- plus six digits. Existing references are untouched.
CREATE OR REPLACE FUNCTION private.generate_booking_reference(p_booking_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_number integer;
  v_reference text;
BEGIN
  IF p_booking_date IS NULL THEN
    RAISE EXCEPTION 'A departure date is required to generate a booking reference.'
      USING ERRCODE = '22004';
  END IF;

  LOOP
    -- Six decimal digits are easier to read and dictate than a base-36 code.
    v_number := (('x' || encode(extensions.gen_random_bytes(3), 'hex'))::bit(24)::integer
      % 900000) + 100000;
    v_reference := 'AA-' || lpad(v_number::text, 6, '0');

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
  'Internal collision-safe generator for nine-character AA- plus six-digit cryptographically random booking references. The date argument is retained for RPC compatibility.';

COMMIT;
