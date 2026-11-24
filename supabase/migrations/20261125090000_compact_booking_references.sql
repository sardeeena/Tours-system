BEGIN;

-- New customer-facing references are exactly nine characters:
-- "AA" plus seven base-36 sequence characters. A global database sequence
-- guarantees uniqueness across all tours and departure dates.
CREATE SEQUENCE private.booking_reference_global_seq
  AS bigint
  MINVALUE 1
  MAXVALUE 78364164095
  START WITH 1
  INCREMENT BY 1
  NO CYCLE
  CACHE 1;

REVOKE ALL ON SEQUENCE private.booking_reference_global_seq
  FROM PUBLIC, anon, authenticated, service_role;

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
    v_number := nextval('private.booking_reference_global_seq'::regclass);

    IF v_number > 78364164095 THEN
      RAISE EXCEPTION 'The nine-character booking reference sequence is exhausted.'
        USING ERRCODE = '54000';
    END IF;

    v_reference := 'AA' || private.encode_booking_reference_suffix(v_number);

    -- Skip any reference that may already exist from a manually imported
    -- booking or a previous deployment. Sequence values themselves never repeat.
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
  'Internal collision-safe generator for nine-character AA plus seven-character base-36 booking references. The date argument is retained for RPC compatibility; uniqueness is global.';

-- The verified guest lookup and cancellation RPCs historically rejected references
-- shorter than ten characters. Lower their minimum to nine while preserving their
-- contact verification, rate limits, permissions, and exact-match lookup behavior.
DO $migration$
DECLARE
  v_lookup_definition text;
  v_cancellation_definition text;
BEGIN
  SELECT pg_get_functiondef('public.lookup_booking_secure(text,text)'::regprocedure)
    INTO v_lookup_definition;

  v_lookup_definition := regexp_replace(
    v_lookup_definition,
    'length[[:space:]]*\([[:space:]]*trim[[:space:]]*\([[:space:]]*p_reference[[:space:]]*\)[[:space:]]*\)[[:space:]]*<[[:space:]]*10',
    'length(trim(p_reference)) < 9',
    'gi'
  );

  IF position('p_reference' IN v_lookup_definition) = 0
     OR position('length(trim(p_reference)) < 9' IN lower(v_lookup_definition)) = 0 THEN
    RAISE EXCEPTION 'Secure booking lookup reference-length guard could not be updated.';
  END IF;
  EXECUTE v_lookup_definition;

  SELECT pg_get_functiondef('public.request_booking_cancellation_secure(text,text,text)'::regprocedure)
    INTO v_cancellation_definition;

  v_cancellation_definition := regexp_replace(
    v_cancellation_definition,
    'length[[:space:]]*\([[:space:]]*trim[[:space:]]*\([[:space:]]*p_reference[[:space:]]*\)[[:space:]]*\)[[:space:]]*<[[:space:]]*10',
    'length(trim(p_reference)) < 9',
    'gi'
  );

  IF position('p_reference' IN v_cancellation_definition) = 0
     OR position('length(trim(p_reference)) < 9' IN lower(v_cancellation_definition)) = 0 THEN
    RAISE EXCEPTION 'Secure booking cancellation reference-length guard could not be updated.';
  END IF;
  EXECUTE v_cancellation_definition;
END;
$migration$;

COMMIT;
