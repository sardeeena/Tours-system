-- Persist the customer's interface/communication locale in the same transaction
-- as the authoritative booking, without conflating it with the spoken guide language.
BEGIN;

CREATE OR REPLACE FUNCTION private.create_booking_atomic_with_locale(
  p_tour_identifier text,
  p_booking_date date,
  p_adult_count integer,
  p_child_count integer,
  p_infant_count integer,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_country text,
  p_customer_hotel text,
  p_pickup_location_id text,
  p_pickup_room_number text,
  p_extras jsonb,
  p_coupon_code text,
  p_payment_method text,
  p_special_requests text,
  p_idempotency_key text,
  p_tour_language text,
  p_customer_locale text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb;
  v_booking_id uuid;
  v_customer_id uuid;
BEGIN
  IF p_customer_locale IS NULL OR p_customer_locale NOT IN ('en', 'de', 'it', 'ro', 'ru') THEN
    RAISE EXCEPTION 'Unsupported customer locale.' USING ERRCODE = '22023';
  END IF;

  v_result := public.create_booking_atomic_with_language(
    p_tour_identifier,
    p_booking_date,
    p_adult_count,
    p_child_count,
    p_infant_count,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_email,
    p_customer_phone,
    p_customer_country,
    p_customer_hotel,
    p_pickup_location_id,
    p_pickup_room_number,
    p_extras,
    p_coupon_code,
    p_payment_method,
    p_special_requests,
    p_idempotency_key,
    p_tour_language
  );

  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RETURN v_result;
  END IF;

  v_booking_id := NULLIF(v_result->>'bookingId', '')::uuid;
  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking service returned no booking identifier.';
  END IF;

  UPDATE public.bookings AS booking
  SET customer_locale = p_customer_locale
  WHERE booking.id = v_booking_id
  RETURNING booking.customer_id INTO v_customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Created booking could not be found for locale persistence.';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET preferred_locale = p_customer_locale,
        updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION private.create_booking_atomic_with_locale(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.create_booking_atomic_with_locale(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION private.create_booking_atomic_with_locale(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text
) IS 'Private security-definer implementation for atomic booking and customer locale persistence.';


-- Public PostgREST entrypoint remains invoker-rights, matching the existing
-- booking RPC contract. Privileged writes are isolated in the private definer.
CREATE OR REPLACE FUNCTION public.create_booking_atomic_with_locale(
  p_tour_identifier text,
  p_booking_date date,
  p_adult_count integer,
  p_child_count integer,
  p_infant_count integer,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_email text,
  p_customer_phone text,
  p_customer_country text,
  p_customer_hotel text,
  p_pickup_location_id text,
  p_pickup_room_number text,
  p_extras jsonb,
  p_coupon_code text,
  p_payment_method text,
  p_special_requests text,
  p_idempotency_key text,
  p_tour_language text,
  p_customer_locale text
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.create_booking_atomic_with_locale(
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
  );
$function$;

REVOKE ALL ON FUNCTION public.create_booking_atomic_with_locale(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic_with_locale(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.create_booking_atomic_with_locale(
  text, date, integer, integer, integer, text, text, text, text, text,
  text, text, text, jsonb, text, text, text, text, text, text
) IS 'Invoker-rights booking entrypoint; the private implementation persists the customer interface locale atomically.';

COMMIT;
